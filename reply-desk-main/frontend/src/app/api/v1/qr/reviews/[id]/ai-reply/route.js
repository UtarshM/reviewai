import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';
import { callGroqDirect } from '@/app/api/llm';

async function getReviewDetailsForAi(reviewId, userId) {
  const result = await query(
    `SELECT cr.id, cr.rating, cr.final_review, b.name as business_name, b.category as business_category, b.tone_default as business_tone
     FROM customer_reviews cr
     JOIN businesses b ON cr.business_id = b.id
     WHERE cr.id = $1 AND b.user_id = $2`,
    [reviewId, userId]
  );
  return result.rows[0] || null;
}

// POST /api/v1/qr/reviews/[id]/ai-reply
export async function POST(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    const { id } = await params;
    const reviewId = parseInt(id, 10);

    if (isNaN(reviewId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid review ID' }, { status: 400 });
    }

    const review = await getReviewDetailsForAi(reviewId, userId);
    if (!review) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied or review not found' }, { status: 403 });
    }

    // Rate limit check
    const countResult = await query(
      "SELECT COUNT(*) FROM generation_log WHERE business_id = (SELECT business_id FROM customer_reviews WHERE id = $1) AND created_at >= NOW() - INTERVAL '24 hours'",
      [reviewId]
    );
    const dailyCount = parseInt(countResult.rows[0].count, 10);

    if (dailyCount >= 20) {
      return NextResponse.json({
        error: 'rate_limit_exceeded',
        message: 'Daily AI generation limit reached (max 20 per day).'
      }, { status: 429 });
    }

    // System prompt for replying to QR review
    const systemPrompt = `You are a small business owner replying to a customer review left on your QR Reviews page.
Write a concise, natural, polite business reply (2-3 sentences max).
Match the tone to the business tone settings and rating.
Only use details explicitly given. Do not invent facts, names, or dates.
You MUST output ONLY a valid JSON object with a single "reply" key:
{
  "reply": "the concise, natural business reply draft"
}`;

    const userPrompt = `Business Name: ${review.business_name}
Business Category: ${review.business_category}
Business Tone Setting: ${review.business_tone}
Customer Star Rating: ${review.rating} out of 5 stars
Customer Review text: "${review.final_review}"`;

    let llmResult;
    try {
      llmResult = await callGroqDirect(systemPrompt, userPrompt);
    } catch (err) {
      console.error('[LLM ERROR] AI QR review reply generation failed:', err);
      return NextResponse.json({
        error: 'generation_failed',
        message: 'AI reply generation failed. The AI provider is temporarily unavailable.'
      }, { status: 502 });
    }

    // Log generation
    const getBizResult = await query('SELECT business_id FROM customer_reviews WHERE id = $1', [reviewId]);
    const bizId = getBizResult.rows[0]?.business_id;
    if (bizId) {
      await query(
        "INSERT INTO generation_log (business_id, flow_type) VALUES ($1, 'reply')",
        [bizId]
      );
    }

    const replyText = llmResult.reply || '';

    // Automatically update DB setting reply_ai_generated to true and save draft reply
    const now = new Date();
    await query(
      `UPDATE customer_reviews
       SET business_reply = $1,
           reply_updated_at = $2,
           reply_created_at = COALESCE(reply_created_at, $2),
           reply_ai_generated = TRUE
       WHERE id = $3`,
      [replyText, now, reviewId]
    );

    return NextResponse.json({ reply: replyText }, { status: 200 });

  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('AI QR review reply error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to generate AI reply' }, { status: 500 });
  }
}
