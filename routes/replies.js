import express from 'express';
import { query } from '../db.js';
import { authMiddleware, requireSubscription, verifyBusinessOwnership } from '../auth.js';
import { callGroq } from '../groq.js';

const router = express.Router();

// PUBLIC DEMO ENDPOINT - Allow visitors/unsubscribed users to try 1 sample AI reply
router.post('/demo-generate', async (req, res) => {
  try {
    const { business_name, category, customer_name, rating, review_text, tone } = req.body;

    const cleanBizName = (business_name || 'Sample Business').trim();
    const cleanCategory = (category || 'General').trim();
    const cleanCustomerName = (customer_name || 'Happy Customer').trim();
    const cleanReviewText = (review_text || 'Great service and quick response time! Highly recommended.').trim();
    const cleanTone = (tone || 'friendly').trim();
    const starRating = parseInt(rating, 10) || 5;

    const systemPrompt = `You are helping a small business owner reply to a customer review on Google.
Write the reply using only the details given. Do not invent facts or specifics not provided.
Output ONLY valid JSON, no markdown fences:
{"variants":[{"label":"Professional & Warm","text":"..."},{"label":"Short & Direct","text":"..."},{"label":"Customer Delight Focus","text":"..."}]}`;

    const userPrompt = `Business Name: ${cleanBizName}
Business Category: ${cleanCategory}
Requested Tone: ${cleanTone}
Customer Name: ${cleanCustomerName}
Star Rating: ${starRating} stars
Review Text: ${cleanReviewText}`;

    let respLLM;
    try {
      respLLM = await callGroq(systemPrompt, userPrompt);
    } catch (err) {
      // Fallback demo response if Groq fails or API key is not configured
      respLLM = {
        variants: [
          { label: 'Professional & Warm', text: `Hi ${cleanCustomerName}, thank you so much for your ${starRating}-star review! We are delighted that you enjoyed your experience with ${cleanBizName}.` },
          { label: 'Short & Direct', text: `Thanks for the wonderful review, ${cleanCustomerName}! We really appreciate your support at ${cleanBizName}.` },
          { label: 'Customer Delight Focus', text: `Dear ${cleanCustomerName}, seeing your great review made our day! Thanks for choosing ${cleanBizName}.` }
        ]
      };
    }

    return res.status(200).json({
      is_demo: true,
      variants: respLLM.variants,
      disclaimer: 'DEMO MODE: To manage business profiles, auto-sync Google reviews, and generate unlimited replies, please activate a subscription plan.'
    });
  } catch (err) {
    console.error('Demo generation error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to generate demo reply' });
  }
});

// PROTECTED ENDPOINTS Below
router.use(authMiddleware);

// POST /api/v1/replies/generate (Requires Active Subscription)
router.post('/generate', requireSubscription, async (req, res) => {
  try {
    const userId = req.userId;
    const { business_id, customer_name, rating, review_text, tone, context } = req.body;

    const cleanCustomerName = (customer_name || '').trim();
    const cleanReviewText = (review_text || '').trim();
    const cleanTone = (tone || '').trim() || 'friendly';
    const cleanContext = (context || '').trim();
    const businessId = parseInt(business_id, 10);
    const starRating = parseInt(rating, 10);

    if (isNaN(businessId) || businessId <= 0) {
      return res.status(400).json({ error: 'bad_request', message: 'Valid Business ID is required' });
    }
    if (!cleanCustomerName) {
      return res.status(400).json({ error: 'bad_request', message: 'Customer name is required' });
    }
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      return res.status(400).json({ error: 'bad_request', message: 'Rating must be between 1 and 5' });
    }
    if (!cleanReviewText) {
      return res.status(400).json({ error: 'bad_request', message: 'Review text is required' });
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
    const systemPrompt = `You are helping a small business owner reply to a customer review on Google.

Write the reply using only the details given. Do not invent facts, names,
dates, or specifics that aren't provided.

Match the tone to the star rating:
- 4-5 stars: warm, appreciative, specific
- 3 stars: honest acknowledgment of a mixed experience, don't oversell it
- 1-2 stars: acknowledge the exact complaint, stay non-defensive, and if
  appropriate invite them to reach out directly to make it right

Reference at least one concrete detail from the review itself. Never use:
"we strive to provide great service," "your satisfaction is our priority,"
"we take this seriously," "thank you for your feedback."

Reply in the same language the review is written in. Keep each reply to
2-4 sentences. Sign off like a real owner, not "the team."

Output ONLY valid JSON, no markdown fences:
{"variants":[{"label":"...","text":"..."}, x3]}`;

    const userPrompt = `Business Name: ${business.name}
Business Category: ${business.category}
${locationStr ? locationStr + '\n' : ''}Requested Tone: ${cleanTone}
Additional Context: ${cleanContext}
Customer Name: ${cleanCustomerName}
Star Rating: ${starRating} stars
Review Text: ${cleanReviewText}`;

    let respLLM;
    try {
      respLLM = await callGroq(systemPrompt, userPrompt);
    } catch (err) {
      console.error('[LLM ERROR] Reply generation failed:', err);
      return res.status(502).json({
        error: 'generation_failed',
        message: 'AI reply generation failed. The model response was invalid or blocked. Please verify details and try again.'
      });
    }

    // 4. Log generation for rate-limiting
    await query(
      "INSERT INTO generation_log (business_id, flow_type) VALUES ($1, 'reply')",
      [businessId]
    );

    // 5. Automatically save initial draft (Option 1) to database history
    const saveResult = await query(
      'INSERT INTO reviews_replied (business_id, customer_name, rating, review_text, selected_reply, tone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, business_id, customer_name, rating, review_text, selected_reply, status, tone, created_at',
      [businessId, cleanCustomerName, starRating, cleanReviewText, respLLM.variants[0].text, cleanTone]
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
    console.error('Replies generation error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to generate replies' });
  }
});

export default router;

