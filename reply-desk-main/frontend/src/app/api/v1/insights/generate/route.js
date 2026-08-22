import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';
import { callGroqDirect } from '@/app/api/llm';

async function verifyBusiness(businessId, userId) {
  const result = await query(
    'SELECT id, name, category FROM businesses WHERE id = $1 AND user_id = $2',
    [businessId, userId]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

// POST /api/v1/insights/generate
export async function POST(request) {
  try {
    const userId = getUserIdFromRequest(request);
    const { business_id, period } = await request.json();
    const businessId = parseInt(business_id, 10);
    const cleanPeriod = period || 'weekly';

    if (isNaN(businessId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Valid business_id is required' }, { status: 400 });
    }

    const business = await verifyBusiness(businessId, userId);
    if (!business) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    // Determine interval
    let days = 7;
    if (cleanPeriod === 'monthly') days = 30;
    else if (cleanPeriod === 'quarterly') days = 90;

    // Fetch reviews in range
    const reviewsResult = await query(
      `SELECT rating, final_review, created_at FROM customer_reviews 
       WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'`,
      [businessId]
    );

    const reviews = reviewsResult.rows;

    if (reviews.length === 0) {
      return NextResponse.json({ 
        error: 'not_enough_data', 
        message: 'No reviews found in this period. Collect at least one customer review to generate AI insights.' 
      }, { status: 200 });
    }

    // Format reviews for prompt
    const reviewListText = reviews.map((r, i) => `${i + 1}. [Rating: ${r.rating}/5 stars] Review: "${r.final_review}"`).join('\n\n');

    const systemPrompt = `You are a professional business analyst AI. Analyze the customer reviews provided below for the business "${business.name}" (${business.category}).
    
Generate a detailed SaaS analysis in JSON format containing:
1. "overall_sentiment_score": a percentage score (0 to 100) representing customer sentiment.
2. "customer_mood": a string representing the overall mood (e.g. 'Satisfied', 'Delighted', 'Frustrated', 'Indifferent').
3. "strengths": an array of 3-5 strings detailing key business strengths mentioned by customers.
4. "weaknesses": an array of 3-5 strings detailing key complaints or weaknesses.
5. "product_mentions": an array of objects representing products/services mentioned, e.g. [{"name": "Sourdough", "sentiment": "positive"}] (max 5 items).
6. "staff_mentions": an array of objects representing staff names or service team mentions, e.g. [{"name": "Cashier", "sentiment": "friendly"}] (max 5 items).
7. "weekly_trend": a 1-2 sentence text summarizing the latest customer trends.
8. "next_month_predicted_rating": a decimal number (1.0 to 5.0) predicting next month's rating based on current trends.
9. "biggest_opportunity": a 1-sentence description of the single biggest improvement opportunity.
10. "summary": a comprehensive multi-line paragraph summarizing the customer feedback analysis.

Output ONLY valid JSON. Do not include markdown code block formatting (like \`\`\`json) or any pre/post commentary.`;

    const userPrompt = `Here are the customer reviews for "${business.name}" over the past ${days} days:\n\n${reviewListText}`;

    let insightsJSON;
    try {
      insightsJSON = await callGroqDirect(systemPrompt, userPrompt);
    } catch (err) {
      console.error('Groq direct call failed:', err);
      return NextResponse.json({ error: 'service_error', message: 'Failed to generate insights via Groq: ' + err.message }, { status: 502 });
    }

    // Save/Cache insights
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    const insertResult = await query(
      `INSERT INTO review_ai_insights (business_id, period, start_date, end_date, insights) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, period, start_date, end_date, insights, created_at`,
      [businessId, cleanPeriod, startDate, endDate, JSON.stringify(insightsJSON)]
    );

    return NextResponse.json(insertResult.rows[0], { status: 201 });
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Generate insights error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to generate AI insights' }, { status: 500 });
  }
}
