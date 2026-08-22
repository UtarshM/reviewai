import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';
import { callGroq } from '@/app/api/groq';

export async function POST(request) {
  try {
    const userId = getUserIdFromRequest(request);
    const { business_id, rating, liked, disliked, tone } = await request.json();

    const cleanLiked = (liked || '').trim();
    const cleanDisliked = (disliked || '').trim();
    const cleanTone = (tone || '').trim() || 'friendly';
    const businessId = parseInt(business_id, 10);
    const starRating = parseInt(rating, 10);

    if (isNaN(businessId) || businessId <= 0) {
      return NextResponse.json({ error: 'bad_request', message: 'Valid Business ID is required' }, { status: 400 });
    }
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      return NextResponse.json({ error: 'bad_request', message: 'Rating must be between 1 and 5' }, { status: 400 });
    }
    if (!cleanLiked) {
      return NextResponse.json({ error: 'bad_request', message: 'What the customer liked is required' }, { status: 400 });
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
      return NextResponse.json({
        error: 'generation_failed',
        message: 'AI review generation failed. The model response was invalid or blocked. Please verify details and try again.'
      }, { status: 502 });
    }

    // 4. Log generation
    await query(
      "INSERT INTO generation_log (business_id, flow_type) VALUES ($1, 'review')",
      [businessId]
    );

    // 5. Automatically save first variant draft to history
    const saveResult = await query(
      'INSERT INTO reviews_drafted (business_id, rating, liked, disliked, selected_review, tone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, business_id, rating, liked, disliked, selected_review, status, tone, created_at',
      [businessId, starRating, cleanLiked, cleanDisliked, respLLM.variants[0].text, cleanTone]
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
    console.error('Reviews generation error:', error);
    return NextResponse.json({ error: 'server_error', message: error.message }, { status: 500 });
  }
}
