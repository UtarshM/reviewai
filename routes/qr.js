import express from 'express';
import { query } from '../db.js';
import { authMiddleware, verifyBusinessOwnership } from '../auth.js';
import { generateSecureToken } from '../token.js';

const router = express.Router();

router.use(authMiddleware);

async function verifyBusiness(businessId, userId) {
  const result = await query(
    'SELECT id FROM businesses WHERE id = $1 AND user_id = $2',
    [businessId, userId]
  );
  return result.rows.length > 0;
}

async function checkCampaignOwnership(campaignId, userId) {
  const result = await query(
    `SELECT c.id FROM review_qr_campaigns c
     JOIN businesses b ON c.business_id = b.id
     WHERE c.id = $1 AND b.user_id = $2`,
    [campaignId, userId]
  );
  return result.rows.length > 0;
}

// ==========================================
// PROMPT TEMPLATES CRUD
// ==========================================

// GET /api/v1/qr/templates?business_id=123
router.get('/templates', async (req, res) => {
  try {
    const userId = req.userId;
    const businessId = parseInt(req.query.business_id, 10);

    if (isNaN(businessId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Valid business_id query parameter is required' });
    }

    const isOwner = await verifyBusiness(businessId, userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
    }

    const result = await query(
      'SELECT id, name, system_prompt, created_at FROM prompt_templates WHERE business_id = $1 ORDER BY name ASC',
      [businessId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List templates error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to retrieve templates' });
  }
});

// POST /api/v1/qr/templates
router.post('/templates', async (req, res) => {
  try {
    const userId = req.userId;
    const { business_id, name, system_prompt } = req.body;
    const businessId = parseInt(business_id, 10);

    if (isNaN(businessId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Valid business_id is required' });
    }

    const cleanName = (name || '').trim();
    const cleanPrompt = (system_prompt || '').trim();

    if (!cleanName || !cleanPrompt) {
      return res.status(400).json({ error: 'bad_request', message: 'Template name and system prompt are required' });
    }

    const isOwner = await verifyBusiness(businessId, userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
    }

    const result = await query(
      'INSERT INTO prompt_templates (business_id, name, system_prompt) VALUES ($1, $2, $3) RETURNING id, business_id, name, system_prompt, created_at',
      [businessId, cleanName, cleanPrompt]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create template error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to create template' });
  }
});

// DELETE /api/v1/qr/templates/:id
router.delete('/templates/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const templateId = parseInt(req.params.id, 10);

    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid template ID' });
    }

    const checkResult = await query(
      `SELECT t.id FROM prompt_templates t
       JOIN businesses b ON t.business_id = b.id
       WHERE t.id = $1 AND b.user_id = $2`,
      [templateId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
    }

    await query('DELETE FROM prompt_templates WHERE id = $1', [templateId]);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Delete template error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to delete template' });
  }
});

// ==========================================
// QR CAMPAIGNS CRUD
// ==========================================

// GET /api/v1/qr?business_id=123
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const businessId = parseInt(req.query.business_id, 10);

    if (isNaN(businessId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Valid business_id query parameter is required' });
    }

    const isOwner = await verifyBusiness(businessId, userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
    }

    const result = await query(
      `SELECT q.*, t.name as template_name FROM review_qr_campaigns q
       LEFT JOIN prompt_templates t ON q.template_id = t.id
       WHERE q.business_id = $1
       ORDER BY q.created_at DESC`,
      [businessId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List campaigns error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to list campaigns' });
  }
});

// POST /api/v1/qr
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    const {
      business_id, template_id, name, description, campaign_type,
      behavior, review_style, review_length, expires_at, scan_limit,
      review_limit, language, theme, qr_logo, qr_color, qr_background,
      frame_style, button_color, welcome_title, welcome_subtitle
    } = req.body;

    const businessId = parseInt(business_id, 10);
    if (isNaN(businessId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Valid business_id is required' });
    }

    const isOwner = await verifyBusiness(businessId, userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
    }

    const cleanName = (name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'bad_request', message: 'Campaign name is required' });
    }

    const templateId = template_id ? parseInt(template_id, 10) : null;
    const cleanType = campaign_type || 'store';
    const cleanBehavior = behavior || 'internal';
    const cleanStyle = review_style || 'friendly';
    const cleanLength = review_length || 'medium';
    const expiresAt = expires_at || null;
    const scanLimit = parseInt(scan_limit, 10) || 0;
    const reviewLimit = parseInt(review_limit, 10) || 0;
    const cleanLanguage = language || 'en';
    const cleanTheme = theme || 'light';
    const qrColor = qr_color || '#000000';
    const qrBg = qr_background || '#FFFFFF';
    const frameStyleClean = frame_style || 'none';
    const btnColor = button_color || '#2563EB';

    const token = generateSecureToken();

    const queryStr = `
      INSERT INTO review_qr_campaigns (
        business_id, template_id, name, description, campaign_type, token,
        behavior, review_style, review_length, expires_at, scan_limit,
        review_limit, language, theme, qr_logo, qr_color, qr_background,
        frame_style, button_color, welcome_title, welcome_subtitle
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING *
    `;

    const result = await query(queryStr, [
      businessId, templateId, cleanName, description || '', cleanType, token,
      cleanBehavior, cleanStyle, cleanLength, expiresAt, scanLimit,
      reviewLimit, cleanLanguage, cleanTheme, qr_logo || null, qrColor, qrBg,
      frameStyleClean, btnColor, welcome_title || '', welcome_subtitle || ''
    ]);

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create campaign error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to create campaign' });
  }
});

// PUT /api/v1/qr/:id
router.put('/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const campaignId = parseInt(req.params.id, 10);

    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid campaign ID' });
    }

    const isOwner = await checkCampaignOwnership(campaignId, userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
    }

    const {
      template_id, name, description, campaign_type, behavior, is_active,
      review_style, review_length, expires_at, scan_limit, review_limit,
      language, theme, qr_logo, qr_color, qr_background, frame_style,
      button_color, welcome_title, welcome_subtitle
    } = req.body;

    const cleanName = (name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'bad_request', message: 'Campaign name is required' });
    }

    const templateId = template_id ? parseInt(template_id, 10) : null;
    const cleanType = campaign_type || 'store';
    const cleanBehavior = behavior || 'internal';
    const activeStatus = is_active !== false;
    const cleanStyle = review_style || 'friendly';
    const cleanLength = review_length || 'medium';
    const expiresAt = expires_at || null;
    const scanLimit = parseInt(scan_limit, 10) || 0;
    const reviewLimit = parseInt(review_limit, 10) || 0;
    const cleanLanguage = language || 'en';
    const cleanTheme = theme || 'light';
    const qrColor = qr_color || '#000000';
    const qrBg = qr_background || '#FFFFFF';
    const frameStyleClean = frame_style || 'none';
    const btnColor = button_color || '#2563EB';

    const queryStr = `
      UPDATE review_qr_campaigns SET
        template_id = $1, name = $2, description = $3, campaign_type = $4,
        behavior = $5, is_active = $6, review_style = $7, review_length = $8,
        expires_at = $9, scan_limit = $10, review_limit = $11, language = $12,
        theme = $13, qr_logo = $14, qr_color = $15, qr_background = $16,
        frame_style = $17, button_color = $18, welcome_title = $19, welcome_subtitle = $20
      WHERE id = $21
      RETURNING *
    `;

    const result = await query(queryStr, [
      templateId, cleanName, description || '', cleanType, cleanBehavior, activeStatus,
      cleanStyle, cleanLength, expiresAt, scanLimit, reviewLimit, cleanLanguage,
      cleanTheme, qr_logo || null, qrColor, qrBg, frameStyleClean, btnColor,
      welcome_title || '', welcome_subtitle || '', campaignId
    ]);

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Update campaign error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to update campaign' });
  }
});

// DELETE /api/v1/qr/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const campaignId = parseInt(req.params.id, 10);

    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid campaign ID' });
    }

    const isOwner = await checkCampaignOwnership(campaignId, userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
    }

    await query('DELETE FROM review_qr_campaigns WHERE id = $1', [campaignId]);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Delete campaign error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to delete campaign' });
  }
});

// ==========================================
// QR CAMPAIGN ANALYTICS
// ==========================================

// GET /api/v1/qr/:id/analytics
router.get('/:id/analytics', async (req, res) => {
  try {
    const userId = req.userId;
    const campaignId = parseInt(req.params.id, 10);

    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid campaign ID' });
    }

    const isOwner = await checkCampaignOwnership(campaignId, userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
    }

    // 1. Scans count
    const scanCountResult = await query(
      'SELECT COUNT(*)::int as total_scans, COUNT(DISTINCT ip_hash)::int as unique_scans FROM review_qr_scans WHERE campaign_id = $1',
      [campaignId]
    );
    const { total_scans, unique_scans } = scanCountResult.rows[0] || { total_scans: 0, unique_scans: 0 };

    // 2. Reviews metrics
    const reviewMetricsResult = await query(
      `SELECT 
         COUNT(*)::int as total_reviews, 
         COALESCE(AVG(rating), 0)::float as avg_rating,
         COALESCE(AVG(LENGTH(final_review)), 0)::float as avg_review_length,
         COALESCE(AVG(time_to_complete), 0)::float as avg_completion_time,
         COUNT(CASE WHEN is_edited = FALSE THEN 1 END)::int as ai_accepted_count,
         COUNT(CASE WHEN is_edited = TRUE THEN 1 END)::int as edited_count,
         COUNT(CASE WHEN ai_suggestion IS NOT NULL AND ai_suggestion <> '' THEN 1 END)::int as generated_count,
         COUNT(CASE WHEN status = 'redirected' THEN 1 END)::int as redirect_count
       FROM customer_reviews
       WHERE campaign_id = $1`,
      [campaignId]
    );
    const metrics = reviewMetricsResult.rows[0] || {};
    const total_reviews = metrics.total_reviews || 0;

    const conversion_rate = total_scans > 0 ? parseFloat(((total_reviews / total_scans) * 100).toFixed(1)) : 0;
    const ai_acceptance_rate = total_reviews > 0 ? parseFloat(((metrics.ai_accepted_count / total_reviews) * 100).toFixed(1)) : 0;
    const edited_percent = total_reviews > 0 ? parseFloat(((metrics.edited_count / total_reviews) * 100).toFixed(1)) : 0;
    const generated_percent = total_reviews > 0 ? parseFloat(((metrics.generated_count / total_reviews) * 100).toFixed(1)) : 0;
    const redirect_percent = total_reviews > 0 ? parseFloat(((metrics.redirect_count / total_reviews) * 100).toFixed(1)) : 0;

    // 3. Timelines (past 30 days)
    const dailyScansResult = await query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*)::int as count 
       FROM review_qr_scans 
       WHERE campaign_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD') 
       ORDER BY date ASC`,
      [campaignId]
    );

    const dailyReviewsResult = await query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*)::int as count 
       FROM customer_reviews 
       WHERE campaign_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD') 
       ORDER BY date ASC`,
      [campaignId]
    );

    // 4. Demographics
    const devicesResult = await query(
      `SELECT COALESCE(device_type, 'Unknown') as name, COUNT(*)::int as value 
       FROM review_qr_scans WHERE campaign_id = $1 GROUP BY device_type`,
      [campaignId]
    );

    const browsersResult = await query(
      `SELECT COALESCE(browser, 'Unknown') as name, COUNT(*)::int as value 
       FROM review_qr_scans WHERE campaign_id = $1 GROUP BY browser`,
      [campaignId]
    );

    const locationsResult = await query(
      `SELECT COALESCE(country, 'Unknown') as country, COALESCE(city, 'Unknown') as city, COUNT(*)::int as count 
       FROM review_qr_scans WHERE campaign_id = $1 GROUP BY country, city ORDER BY count DESC LIMIT 10`,
      [campaignId]
    );

    const hourlySpikesResult = await query(
      `SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::int as count 
       FROM review_qr_scans WHERE campaign_id = $1 GROUP BY hour ORDER BY hour ASC`,
      [campaignId]
    );

    return res.status(200).json({
      summary: {
        total_scans,
        unique_scans,
        total_reviews,
        avg_rating: parseFloat(metrics.avg_rating.toFixed(2)),
        conversion_rate,
        avg_review_length: Math.round(metrics.avg_review_length),
        avg_completion_time: Math.round(metrics.avg_completion_time),
        ai_acceptance_rate,
        edited_percent,
        generated_percent,
        redirect_percent
      },
      timelines: {
        scans: dailyScansResult.rows,
        reviews: dailyReviewsResult.rows
      },
      demographics: {
        devices: devicesResult.rows,
        browsers: browsersResult.rows,
        locations: locationsResult.rows,
        hourly: hourlySpikesResult.rows
      }
    });
  } catch (err) {
    console.error('Fetch campaign analytics error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to retrieve campaign analytics' });
  }
});

export default router;
