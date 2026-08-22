import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';

async function checkCampaignOwnership(campaignId, userId) {
  const result = await query(
    `SELECT c.id FROM review_qr_campaigns c
     JOIN businesses b ON c.business_id = b.id
     WHERE c.id = $1 AND b.user_id = $2`,
    [campaignId, userId]
  );
  return result.rows.length > 0;
}

export async function GET(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    const { id } = await params;
    const campaignId = parseInt(id, 10);

    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid campaign ID' }, { status: 400 });
    }

    const isOwner = await checkCampaignOwnership(campaignId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    // 1. Scans and Unique Visitors
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

    // Calculate rates
    const conversion_rate = total_scans > 0 ? parseFloat(((total_reviews / total_scans) * 100).toFixed(1)) : 0;
    const ai_acceptance_rate = total_reviews > 0 ? parseFloat(((metrics.ai_accepted_count / total_reviews) * 100).toFixed(1)) : 0;
    const edited_percent = total_reviews > 0 ? parseFloat(((metrics.edited_count / total_reviews) * 100).toFixed(1)) : 0;
    const generated_percent = total_reviews > 0 ? parseFloat(((metrics.generated_count / total_reviews) * 100).toFixed(1)) : 0;
    const redirect_percent = total_reviews > 0 ? parseFloat(((metrics.redirect_count / total_reviews) * 100).toFixed(1)) : 0;

    // 3. Daily Scans Timeline (past 30 days)
    const dailyScansResult = await query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*)::int as count 
       FROM review_qr_scans 
       WHERE campaign_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD') 
       ORDER BY date ASC`,
      [campaignId]
    );

    // 4. Daily Reviews Timeline (past 30 days)
    const dailyReviewsResult = await query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*)::int as count 
       FROM customer_reviews 
       WHERE campaign_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD') 
       ORDER BY date ASC`,
      [campaignId]
    );

    // 5. Device Types Breakdown
    const devicesResult = await query(
      `SELECT COALESCE(device_type, 'Unknown') as name, COUNT(*)::int as value 
       FROM review_qr_scans WHERE campaign_id = $1 GROUP BY device_type`,
      [campaignId]
    );

    // 6. Browser Breakdown
    const browsersResult = await query(
      `SELECT COALESCE(browser, 'Unknown') as name, COUNT(*)::int as value 
       FROM review_qr_scans WHERE campaign_id = $1 GROUP BY browser`,
      [campaignId]
    );

    // 7. Geographic Location Breakdown (top 10)
    const locationsResult = await query(
      `SELECT COALESCE(country, 'Unknown') as country, COALESCE(city, 'Unknown') as city, COUNT(*)::int as count 
       FROM review_qr_scans WHERE campaign_id = $1 GROUP BY country, city ORDER BY count DESC LIMIT 10`,
      [campaignId]
    );

    // 8. Hourly spikes (0 - 23)
    const hourlySpikesResult = await query(
      `SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::int as count 
       FROM review_qr_scans WHERE campaign_id = $1 GROUP BY hour ORDER BY hour ASC`,
      [campaignId]
    );

    return NextResponse.json({
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
    }, { status: 200 });

  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Fetch campaign analytics error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to retrieve campaign analytics' }, { status: 500 });
  }
}
