import express from 'express';
import { query } from '../db.js';
import { callGroqDirect } from '../groq.js';
import crypto from 'crypto';

const router = express.Router();

// GET /api/v1/public/campaign/:token
router.get('/campaign/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'bad_request', message: 'Token is required' });
    }

    const campaignResult = await query(
      `SELECT 
         c.id as campaign_id, c.business_id, c.name as campaign_name, c.description as campaign_description,
         c.campaign_type, c.behavior, c.is_active, c.expires_at, c.scan_limit, c.review_limit,
         c.language, c.theme, c.qr_logo, c.qr_color, c.qr_background, c.frame_style, c.button_color,
         c.welcome_title, c.welcome_subtitle, c.review_style, c.review_length,
         b.name as business_name, b.category as business_category, b.city, b.state, b.country,
         b.google_review_link
       FROM review_qr_campaigns c
       JOIN businesses b ON c.business_id = b.id
       WHERE c.token = $1`,
      [token]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Review campaign not found or link is invalid' });
    }

    const campaign = campaignResult.rows[0];

    if (!campaign.is_active) {
      return res.status(200).json({ error: 'inactive', message: 'This review campaign is currently disabled.' });
    }

    if (campaign.expires_at && new Date(campaign.expires_at) < new Date()) {
      return res.status(200).json({ error: 'expired', message: 'This review campaign has expired.' });
    }

    if (campaign.scan_limit > 0) {
      const scansCount = await query('SELECT COUNT(*)::int FROM review_qr_scans WHERE campaign_id = $1', [campaign.campaign_id]);
      if (scansCount.rows[0].count >= campaign.scan_limit) {
        return res.status(200).json({ error: 'limit_exceeded', message: 'This campaign scan limit has been reached.' });
      }
    }

    if (campaign.review_limit > 0) {
      const reviewsCount = await query('SELECT COUNT(*)::int FROM customer_reviews WHERE campaign_id = $1', [campaign.campaign_id]);
      if (reviewsCount.rows[0].count >= campaign.review_limit) {
        return res.status(200).json({ error: 'limit_exceeded', message: 'This campaign review limit has been reached.' });
      }
    }

    return res.status(200).json(campaign);
  } catch (err) {
    console.error('Fetch public campaign details error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to retrieve campaign details' });
  }
});

// POST /api/v1/public/scan/:token
router.post('/scan/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { browser_fingerprint } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'bad_request', message: 'Token is required' });
    }

    const campaignResult = await query(
      'SELECT id, is_active FROM review_qr_campaigns WHERE token = $1',
      [token]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Campaign not found' });
    }

    const campaign = campaignResult.rows[0];
    if (!campaign.is_active) {
      return res.status(400).json({ error: 'inactive', message: 'Campaign is inactive' });
    }

    // Resolve client IP
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

    // Parse User-Agent
    const userAgent = req.headers['user-agent'] || '';
    let deviceType = 'Desktop';
    if (/Mobi|Android|iPhone/i.test(userAgent)) {
      deviceType = 'Mobile';
    } else if (/Tablet|iPad|PlayBook/i.test(userAgent)) {
      deviceType = 'Tablet';
    }

    let browser = 'Unknown';
    if (/Chrome/i.test(userAgent)) browser = 'Chrome';
    else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) browser = 'Safari';
    else if (/Firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/Edg/i.test(userAgent)) browser = 'Edge';

    // Geolocation falls back to Localhost parameters on Express
    const country = req.headers['x-vercel-ip-country'] || 'Local';
    const city = req.headers['x-vercel-ip-city'] || 'Local';

    await query(
      `INSERT INTO review_qr_scans (
         campaign_id, ip_hash, browser_fingerprint, device_type, browser, city, country
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [campaign.id, ipHash, browser_fingerprint || null, deviceType, browser, city, country]
    );

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('Log scan error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to log scan' });
  }
});

// POST /api/v1/public/review/suggest
router.post('/review/suggest', async (req, res) => {
  try {
    const {
      campaign_id, rating, liked_aspects, modifier, previous_suggestion
    } = req.body;

    const campaignId = parseInt(campaign_id, 10);
    const starRating = parseInt(rating, 10);

    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Valid campaign_id is required' });
    }
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      return res.status(400).json({ error: 'bad_request', message: 'Star rating must be between 1 and 5' });
    }

    const campaignResult = await query(
      `SELECT 
         c.id, c.template_id, c.review_style, c.review_length, c.language,
         b.name as business_name, b.category as business_category, b.city, b.state, b.country
       FROM review_qr_campaigns c
       JOIN businesses b ON c.business_id = b.id
       WHERE c.id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Campaign not found' });
    }

    const campaign = campaignResult.rows[0];

    let systemPrompt = '';
    if (campaign.template_id) {
      const templateResult = await query('SELECT system_prompt FROM prompt_templates WHERE id = $1', [campaign.template_id]);
      if (templateResult.rows.length > 0) {
        systemPrompt = templateResult.rows[0].system_prompt;
      }
    }

    if (!systemPrompt) {
      systemPrompt = `You are helping a customer write a natural, honest Google review draft for a business in the first person ("I").
Write in a realistic, conversational human voice.
Do not exaggerate, make up details, use overly hyped marketing language, or fabricate names.
Write strictly in the requested language (defaults to English).
You MUST generate 3 distinct suggested variations in different styles (Friendly, Professional, and Detailed) and return them in a JSON object with this exact structure, with no markdown code blocks:
{
  "suggestion": "a default medium length review draft",
  "variants": [
    { "label": "Friendly", "text": "a warm, friendly, casual draft" },
    { "label": "Professional", "text": "a polite, formal, objective draft" },
    { "label": "Detailed", "text": "a highly descriptive, specific draft highlighting concrete elements of their experience" }
  ]
}`;
    } else {
      systemPrompt += `\n\nYou MUST generate 3 distinct suggested variations in different styles (Friendly, Professional, and Detailed) and return them in a JSON object with this exact structure, with no markdown code blocks:
{
  "suggestion": "a default medium length review draft",
  "variants": [
    { "label": "Friendly", "text": "a warm, friendly, casual draft" },
    { "label": "Professional", "text": "a polite, formal, objective draft" },
    { "label": "Detailed", "text": "a highly descriptive, specific draft highlighting concrete elements of their experience" }
  ]
}`;
    }

    const locationParts = [campaign.city, campaign.state, campaign.country].filter(Boolean);
    const locationStr = locationParts.join(', ');
    const style = campaign.review_style || 'friendly';
    const length = campaign.review_length || 'medium';

    let lengthDirective = 'around 3-4 sentences';
    if (length === 'short') lengthDirective = '1-2 short, concise sentences';
    else if (length === 'long') lengthDirective = '5 or more detailed sentences';

    let sentimentDirective = '';
    if (starRating >= 4) {
      sentimentDirective = 'Write a positive, appreciative review highlighting outstanding service or quality.';
    } else if (starRating === 3) {
      sentimentDirective = 'Write a balanced, constructive review mentioning both positive aspects and areas of minor improvement.';
    } else {
      sentimentDirective = 'Write a polite but disappointed review focusing on the issues without being aggressive.';
    }

    let userPrompt = `Business Name: ${campaign.business_name}
Business Category: ${campaign.business_category}
${locationStr ? `Location: ${locationStr}\n` : ''}Selected Rating: ${starRating} out of 5 stars
Style / Tone: ${style}
Target Review Length: ${lengthDirective}
${sentimentDirective}
`;

    if (liked_aspects && liked_aspects.trim()) {
      userPrompt += `\nThe customer noted these specific memorable aspects of their experience:\n"${liked_aspects.trim()}"\n`;
    }

    if (modifier && previous_suggestion) {
      userPrompt += `\n---
We have already drafted this review:
"${previous_suggestion}"

Please modify the draft above according to the following edit instruction:
`;
      if (modifier === 'make_shorter') {
        userPrompt += 'Make it significantly shorter and more concise (1-2 sentences).';
      } else if (modifier === 'make_longer') {
        userPrompt += 'Expand and add more elaborate detail (5+ sentences).';
      } else if (modifier === 'more_professional') {
        userPrompt += 'Rewrite it to sound more formal, polite, and professional.';
      } else if (modifier === 'more_friendly') {
        userPrompt += 'Rewrite it to sound warmer, enthusiastic, and friendly.';
      } else if (modifier === 'simpler_language') {
        userPrompt += 'Use simpler, everyday language, and remove complex vocabulary.';
      } else {
        userPrompt += `Regenerate it with: ${modifier}`;
      }
    }

    let insightsJSON;
    try {
      insightsJSON = await callGroqDirect(systemPrompt, userPrompt);
    } catch (err) {
      console.error('Groq public review suggestion failed:', err);
      return res.status(502).json({ error: 'service_error', message: 'Failed to communicate with AI writer' });
    }

    return res.status(200).json(insightsJSON);
  } catch (err) {
    console.error('Generate review suggestion error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to generate review suggestion' });
  }
});

// POST /api/v1/public/review/submit
router.post('/review/submit', async (req, res) => {
  try {
    const {
      campaign_id, rating, ai_suggestion, final_review,
      time_to_complete, browser_fingerprint, device_type, browser
    } = req.body;

    const campaignId = parseInt(campaign_id, 10);
    const starRating = parseInt(rating, 10);

    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Valid campaign_id is required' });
    }
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      return res.status(400).json({ error: 'bad_request', message: 'Star rating must be between 1 and 5' });
    }

    const cleanFinalReview = (final_review || '').trim();
    if (!cleanFinalReview) {
      return res.status(400).json({ error: 'bad_request', message: 'Review content cannot be empty' });
    }

    // Resolve campaign
    const campaignResult = await query(
      `SELECT c.id, c.business_id, c.behavior, b.google_review_link 
       FROM review_qr_campaigns c
       JOIN businesses b ON c.business_id = b.id
       WHERE c.id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Campaign not found' });
    }

    const campaign = campaignResult.rows[0];

    // IP Hash
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

    // Anti-spam check
    const duplicateCheck = await query(
      `SELECT id FROM customer_reviews 
       WHERE campaign_id = $1 
         AND (ip_hash = $2 OR (browser_fingerprint = $3 AND browser_fingerprint IS NOT NULL))
         AND created_at >= NOW() - INTERVAL '120 minutes'
       LIMIT 1`,
      [campaignId, ipHash, browser_fingerprint || null]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(429).json({ 
        error: 'duplicate', 
        message: 'A review has already been submitted from this device recently. Thank you for your feedback!' 
      });
    }

    const userAgent = req.headers['user-agent'] || '';
    let resolvedDevice = device_type || 'Desktop';
    if (!device_type) {
      if (/Mobi|Android|iPhone/i.test(userAgent)) resolvedDevice = 'Mobile';
      else if (/Tablet|iPad|PlayBook/i.test(userAgent)) resolvedDevice = 'Tablet';
    }

    let resolvedBrowser = browser || 'Unknown';
    if (!browser) {
      if (/Chrome/i.test(userAgent)) resolvedBrowser = 'Chrome';
      else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) resolvedBrowser = 'Safari';
      else if (/Firefox/i.test(userAgent)) resolvedBrowser = 'Firefox';
      else if (/Edg/i.test(userAgent)) resolvedBrowser = 'Edge';
    }

    const country = req.headers['x-vercel-ip-country'] || 'Local';
    const city = req.headers['x-vercel-ip-city'] || 'Local';

    const isEdited = ai_suggestion !== cleanFinalReview;
    const initialStatus = campaign.behavior === 'internal' ? 'submitted' : 'redirected';
    const timeCompleted = parseInt(time_to_complete, 10) || null;

    await query(
      `INSERT INTO customer_reviews (
         business_id, campaign_id, rating, ai_suggestion, final_review,
         status, is_edited, time_to_complete, ip_hash, browser_fingerprint,
         device_type, browser, city, country
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        campaign.business_id, campaignId, starRating, ai_suggestion || '', cleanFinalReview,
        initialStatus, isEdited, timeCompleted, ipHash, browser_fingerprint || null,
        resolvedDevice, resolvedBrowser, city, country
      ]
    );

    return res.status(201).json({
      success: true,
      behavior: campaign.behavior,
      google_review_link: campaign.google_review_link || ''
    });
  } catch (err) {
    console.error('Submit customer review error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to submit review' });
  }
});

export default router;
