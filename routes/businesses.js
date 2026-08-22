import express from 'express';
import { query } from '../db.js';
import { authMiddleware, verifyBusinessOwnership } from '../auth.js';
import { resolvePlaceId, fetchGoogleReviews } from '../serp.js';

const router = express.Router();

// Ensure all routes in this file are protected by authMiddleware
router.use(authMiddleware);

// GET /api/v1/businesses
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const result = await query(
      'SELECT id, user_id, name, category, slug, tone_default, google_review_link, city, state, country, created_at FROM businesses WHERE user_id = $1 ORDER BY name ASC',
      [userId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List businesses error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to list businesses' });
  }
});

// POST /api/v1/businesses
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    const { name, category, tone_default, google_review_link, city, state, country } = req.body;

    const cleanName = (name || '').trim().replace(/['";<>\\]/g, '').substring(0, 100);
    const cleanCategory = (category || '').trim().replace(/['";<>\\]/g, '').substring(0, 80);
    const cleanTone = (tone_default || '').trim() || 'friendly';
    const cleanCity = (city || '').trim().replace(/['";<>\\]/g, '').substring(0, 80);
    const cleanState = (state || '').trim().replace(/['";<>\\]/g, '').substring(0, 50);
    const cleanCountry = (country || '').trim().replace(/['";<>\\]/g, '').substring(0, 50);

    if (!cleanName || !cleanCategory) {
      return res.status(400).json({ error: 'bad_request', message: 'Business name and category are required' });
    }

    // Prevent names that look like SQL injection or code injection attempts
    const sqlPattern = /union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+set|exec\s*\(|script>/i;
    if (sqlPattern.test(cleanName) || sqlPattern.test(cleanCategory)) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid input detected' });
    }

    const generateSlug = (n) => {
      const base = (n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return (base || 'biz') + '-' + Math.floor(1000 + Math.random() * 9000);
    };
    const slug = generateSlug(cleanName);

    const result = await query(
      'INSERT INTO businesses (user_id, name, category, slug, tone_default, google_review_link, city, state, country) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, user_id, name, category, slug, tone_default, google_review_link, city, state, country, created_at',
      [userId, cleanName, cleanCategory, slug, cleanTone, '', cleanCity, cleanState, cleanCountry]
    );

    const newBusiness = result.rows[0];

    try {
      const placeId = await resolvePlaceId(cleanName, cleanCategory, cleanCity, cleanState, cleanCountry);
      const reviewLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
      await query(
        'UPDATE businesses SET google_review_link = $1 WHERE id = $2',
        [reviewLink, newBusiness.id]
      );
      newBusiness.google_review_link = reviewLink;
    } catch (serpErr) {
      console.error('Failed to auto-resolve Google review link:', serpErr);
    }

    return res.status(201).json(newBusiness);
  } catch (err) {
    console.error('Create business error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to create business' });
  }
});

// PUT /api/v1/businesses/:id
router.put('/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const businessId = parseInt(req.params.id, 10);

    if (isNaN(businessId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid business ID' });
    }

    const { name, category, tone_default, google_review_link, city, state, country } = req.body;

    const cleanName = (name || '').trim();
    const cleanCategory = (category || '').trim();
    const cleanTone = (tone_default || '').trim() || 'friendly';
    const cleanLink = (google_review_link || '').trim();
    const cleanCity = (city || '').trim();
    const cleanState = (state || '').trim();
    const cleanCountry = (country || '').trim();

    if (!cleanName || !cleanCategory) {
      return res.status(400).json({ error: 'bad_request', message: 'Business name and category are required' });
    }

    // Verify ownership (will throw error if not owned, caught in catch block or checked manually)
    try {
      await verifyBusinessOwnership(businessId, userId);
    } catch (authErr) {
      return res.status(authErr.status || 403).json({ error: authErr.errorType || 'forbidden', message: authErr.message });
    }

    const result = await query(
      'UPDATE businesses SET name = $1, category = $2, tone_default = $3, google_review_link = $4, city = $5, state = $6, country = $7 WHERE id = $8 AND user_id = $9 RETURNING id, user_id, name, category, tone_default, google_review_link, city, state, country, created_at',
      [cleanName, cleanCategory, cleanTone, cleanLink, cleanCity, cleanState, cleanCountry, businessId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Business not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Update business error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to update business' });
  }
});

// GET /api/v1/businesses/:id/google-reviews
router.get('/:id/google-reviews', async (req, res) => {
  try {
    const userId = req.userId;
    const businessId = parseInt(req.params.id, 10);

    if (isNaN(businessId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid business ID' });
    }

    let business;
    try {
      business = await verifyBusinessOwnership(businessId, userId);
    } catch (authErr) {
      return res.status(authErr.status || 403).json({ error: authErr.errorType || 'forbidden', message: authErr.message });
    }

    try {
      const data = await fetchGoogleReviews(
        business.name,
        business.category,
        business.google_review_link,
        business.city,
        business.state,
        business.country
      );

      // Persist the resolved place_id as a proper review deep link,
      // but only if we don't already have one saved — never overwrite
      // a link the owner manually entered in BusinessModal.
      const alreadyHasDeepLink = (business.google_review_link || '').includes('placeid=');
      if (data.place_id && !alreadyHasDeepLink) {
        const deepLink = `https://search.google.com/local/writereview?placeid=${data.place_id}`;
        await query(
          'UPDATE businesses SET google_review_link = $1 WHERE id = $2 AND user_id = $3',
          [deepLink, businessId, userId]
        );
      }

      return res.status(200).json(data);
    } catch (serpErr) {
      console.error('SerpApi error:', serpErr);
      return res.status(502).json({ error: 'service_error', message: serpErr.message });
    }

  } catch (err) {
    console.error('Fetch Google Reviews error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to fetch Google Reviews' });
  }
});
export default router;
