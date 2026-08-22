import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';
import { callGroq } from '@/app/api/groq';

export async function POST(request) {
  try {
    const userId = getUserIdFromRequest(request);
    const { business_id, customer_name, rating, review_text, tone, context } = await request.json();

    const cleanCustomerName = (customer_name || '').trim();
    const cleanReviewText = (review_text || '').trim();
    const cleanTone = (tone || '').trim() || 'friendly';
    const cleanContext = (context || '').trim();
    const businessId = parseInt(business_id, 10);
    const starRating = parseInt(rating, 10);

    if (isNaN(businessId) || businessId <= 0) {
      return NextResponse.json({ error: 'bad_request', message: 'Valid Business ID is required' }, { status: 400 });
    }
    if (!cleanCustomerName) {
      return NextResponse.json({ error: 'bad_request', message: 'Customer name is required' }, { status: 400 });
    }
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      return NextResponse.json({ error: 'bad_request', message: 'Rating must be between 1 and 5' }, { status: 400 });
    }
    if (!cleanReviewText) {
      return NextResponse.json({ error: 'bad_request', message: 'Review text is required' }, { status: 400 });
    }

    // 1. Verify business ownership
    const bizResult = await query(
      'SELECT id, name, category, tone_default, city, state, country FROM businesses WHERE id = $1 AND user_id = $2',
      [businessId, userId]
    );

    if (bizResult.rows.length === 0) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied to this business profile' }, { status: 403 });
    }

    const business = bizResult.rows[0];

    // 2. Rate limiting check (max 20)
    const countResult = await query(
      "SELECT COUNT(*) FROM generation_log WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'",
      [businessId]
    );
    const dailyCount = parseInt(countResult.rows[0].count, 10);

    if (dailyCount >= 20) {
      return NextResponse.json({
        error: 'rate_limit_exceeded',
        message: 'Daily rate limit reached. A maximum of 20 generations is allowed per business per day to prevent spam and protect usage.'
      }, { status: 429 });
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
      return NextResponse.json({
        error: 'generation_failed',
        message: 'AI reply generation failed. The model response was invalid or blocked. Please verify details and try again.'
      }, { status: 502 });
    }

    // 4. Log generation
    await query(
      "INSERT INTO generation_log (business_id, flow_type) VALUES ($1, 'reply')",
      [businessId]
    );

    // 5. Automatically save first variant draft to history
    const saveResult = await query(
      'INSERT INTO reviews_replied (business_id, customer_name, rating, review_text, selected_reply, tone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, business_id, customer_name, rating, review_text, selected_reply, status, tone, created_at',
      [businessId, cleanCustomerName, starRating, cleanReviewText, respLLM.variants[0].text, cleanTone]
    );
    const savedDraft = saveResult.rows[0];

    const pacingWarning = (dailyCount + 1) >= 3;

    return NextResponse.json({
      id: savedDraft.id,
      variants: respLLM.variants,
      pacing_warning: pacingWarning,
      daily_count: dailyCount + 1
    }, { status: 200 });

  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Replies generation error:', error);
    return NextResponse.json({ error: 'server_error', message: error.message }, { status: 500 });
  }
}
