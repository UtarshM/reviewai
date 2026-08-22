import express from 'express';
import { query } from '../db.js';
import { authMiddleware, verifyBusinessOwnership } from '../auth.js';
import { callGroq } from '../groq.js';

const router = express.Router();

router.use(authMiddleware);

// POST /api/v1/reviews/generate
router.post('/generate', async (req, res) => {
  try {
    const userId = req.userId;
    const { business_id, rating, liked, disliked, tone } = req.body;

    const cleanLiked = (liked || '').trim();
    const cleanDisliked = (disliked || '').trim();
    const cleanTone = (tone || '').trim() || 'friendly';
    const businessId = parseInt(business_id, 10);
    const starRating = parseInt(rating, 10);

    if (isNaN(businessId) || businessId <= 0) {
      return res.status(400).json({ error: 'bad_request', message: 'Valid Business ID is required' });
    }
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      return res.status(400).json({ error: 'bad_request', message: 'Rating must be between 1 and 5' });
    }
    if (!cleanLiked) {
      return res.status(400).json({ error: 'bad_request', message: 'What the customer liked is required' });
    }

    // 1. Verify business ownership
    let business;
    try {
      business = await verifyBusinessOwnership(businessId, userId);
    } catch (authErr) {
      return res.status(authErr.status || 403).json({ error: authErr.errorType || 'forbidden', message: authErr.message });
    }

    // 2. Rate limiting check (max 20 generations in 24 hours)
    const countResult = await query(
      "SELECT COUNT(*) FROM generation_log WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'",
      [businessId]
    );
    const dailyCount = parseInt(countResult.rows[0].count, 10);

    if (dailyCount >= 20) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Daily rate limit reached. A maximum of 20 generations is allowed per business per day to prevent spam and protect usage.'
      });
    }

    const locationParts = [business.city, business.state, business.country].filter(Boolean);
    const locationStr = locationParts.length > 0 ? `Location: ${locationParts.join(', ')}` : '';

    // 3. Groq LLM Generation
    const systemPrompt = `Help a customer turn their real experience into a short, honest Google
review draft, in their own voice.

Only use details explicitly given. Never invent staff names, dates, or
specifics not mentioned.

Match sentiment exactly to the star rating - don't inflate a 3-star
experience into glowing praise, don't make a 5-star review sound lukewarm.

Write in first person. Include at least one specific detail given - avoid
generic lines like "highly recommend, great service." Keep negative
feedback in unless the rating is 5 stars and it's clearly minor.

Keep it to 2-4 sentences, natural spoken register, not marketing copy.

Output ONLY valid JSON, no markdown fences:
{"variants":[{"label":"...","text":"..."}, x3]}`;

    const userPrompt = `Business Name: ${business.name}
Business Category: ${business.category}
${locationStr ? locationStr + '\n' : ''}Requested Tone: ${cleanTone}
Star Rating: ${starRating} stars
What was liked: ${cleanLiked}
What was disliked: ${cleanDisliked}`;

    let respLLM;
    try {
      respLLM = await callGroq(systemPrompt, userPrompt);
    } catch (err) {
      console.error('[LLM ERROR] Review generation failed:', err);
      return res.status(502).json({
        error: 'generation_failed',
        message: 'AI review generation failed. The model response was invalid or blocked. Please verify details and try again.'
      });
    }

    // 4. Log generation for rate-limiting
    await query(
      "INSERT INTO generation_log (business_id, flow_type) VALUES ($1, 'review')",
      [businessId]
    );

    // 5. Automatically save initial draft (Option 1) to database history
    const saveResult = await query(
      'INSERT INTO reviews_drafted (business_id, rating, liked, disliked, selected_review, tone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, business_id, rating, liked, disliked, selected_review, status, tone, created_at',
      [businessId, starRating, cleanLiked, cleanDisliked, respLLM.variants[0].text, cleanTone]
    );
    const savedDraft = saveResult.rows[0];

    // Pacing warning flags if dailyCount (including this one) is >= 3
    const pacingWarning = (dailyCount + 1) >= 3;

    return res.status(200).json({
      id: savedDraft.id,
      variants: respLLM.variants,
      pacing_warning: pacingWarning,
      daily_count: dailyCount + 1
    });

  } catch (err) {
    console.error('Reviews generation error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to generate reviews' });
  }
});

export default router;
