import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';

async function verifyBusiness(businessId, userId) {
  const result = await query(
    'SELECT id FROM businesses WHERE id = $1 AND user_id = $2',
    [businessId, userId]
  );
  return result.rows.length > 0;
}

// GET /api/v1/qr/reviews?business_id=123&rating=all&search=...&sort=newest
export async function GET(request) {
  try {
    const userId = getUserIdFromRequest(request);
    const { searchParams } = new URL(request.url);
    const businessId = parseInt(searchParams.get('business_id'), 10);
    const ratingFilter = searchParams.get('rating') || 'all';
    const statusFilter = searchParams.get('status') || 'all'; // 'all', 'awaiting', 'replied'
    const searchQuery = searchParams.get('search') || '';
    const sortOrder = searchParams.get('sort') || 'newest';

    if (isNaN(businessId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Valid business_id is required' }, { status: 400 });
    }

    const isOwner = await verifyBusiness(businessId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    // 1. Build reviews list query
    let queryParams = [businessId];
    let queryStr = `
      SELECT cr.*, q.token as campaign_token
      FROM customer_reviews cr
      JOIN review_qr_campaigns q ON cr.campaign_id = q.id
      WHERE cr.business_id = $1
    `;

    if (statusFilter === 'awaiting') {
      queryStr += ` AND (cr.business_reply IS NULL OR TRIM(cr.business_reply) = '')`;
    } else if (statusFilter === 'replied') {
      queryStr += ` AND (cr.business_reply IS NOT NULL AND TRIM(cr.business_reply) <> '')`;
    }

    let paramIdx = 2;

    if (ratingFilter !== 'all') {
      const ratingVal = parseInt(ratingFilter, 10);
      if (!isNaN(ratingVal)) {
        queryStr += ` AND cr.rating = $${paramIdx}`;
        queryParams.push(ratingVal);
        paramIdx++;
      }
    }

    if (searchQuery.trim()) {
      queryStr += ` AND (cr.final_review ILIKE $${paramIdx} OR cr.ai_suggestion ILIKE $${paramIdx})`;
      queryParams.push(`%${searchQuery.trim()}%`);
      paramIdx++;
    }

    if (sortOrder === 'oldest') {
      queryStr += ` ORDER BY cr.created_at ASC`;
    } else {
      queryStr += ` ORDER BY cr.created_at DESC`;
    }

    const reviewsResult = await query(queryStr, queryParams);

    // 2. Compute aggregate statistics (Calculated on ALL reviews, ignoring search/rating filters)
    const statsResult = await query(
      `SELECT 
         COUNT(*)::int as total_reviews,
         COALESCE(AVG(rating), 0.0)::float as avg_rating,
         COUNT(CASE WHEN rating = 5 THEN 1 END)::int as five_star_count,
         COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int as recent_count,
         COUNT(CASE WHEN business_reply IS NULL OR TRIM(business_reply) = '' THEN 1 END)::int as new_reviews_count
       FROM customer_reviews
       WHERE business_id = $1`,
      [businessId]
    );

    const stats = statsResult.rows[0] || {
      total_reviews: 0,
      avg_rating: 0.0,
      five_star_count: 0,
      recent_count: 0,
      new_reviews_count: 0
    };

    return NextResponse.json({
      reviews: reviewsResult.rows,
      stats: {
        totalReviews: stats.total_reviews,
        avgRating: parseFloat(stats.avg_rating.toFixed(1)),
        fiveStar: stats.five_star_count,
        recentReviews: stats.recent_count,
        newReviewsCount: stats.new_reviews_count
      }
    }, { status: 200 });

  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Fetch QR reviews error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to retrieve reviews' }, { status: 500 });
  }
}
