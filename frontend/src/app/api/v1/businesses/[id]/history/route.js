import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';

export async function GET(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    const { id } = await params;
    const businessId = parseInt(id, 10);
    if (isNaN(businessId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid business ID' }, { status: 400 });
    }

    // Parse search params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Verify ownership of business profile first
    const ownerResult = await query(
      'SELECT id FROM businesses WHERE id = $1 AND user_id = $2',
      [businessId, userId]
    );

    if (ownerResult.rows.length === 0) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    // Fetch unified history
    const historyQuery = `
      SELECT id, business_id, 'reply' as type, customer_name, review_text, selected_reply as selected_text, rating, tone, status, '' as liked, '' as disliked, created_at
      FROM reviews_replied
      WHERE business_id = $1
      UNION ALL
      SELECT id, business_id, 'review' as type, '' as customer_name, '' as review_text, selected_review as selected_text, rating, tone, status, liked, disliked, created_at
      FROM reviews_drafted
      WHERE business_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const historyResult = await query(historyQuery, [businessId, limit, offset]);

    // Get daily generation count for pacing warning
    let dailyCount = 0;
    try {
      const countRes = await query(
        "SELECT COUNT(*)::int FROM generation_log WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'",
        [businessId]
      );
      dailyCount = countRes.rows[0].count;
    } catch (countErr) {
      console.error('Failed to retrieve daily generation count:', countErr);
    }

    return NextResponse.json({
      history: historyResult.rows,
      pacing_warning: dailyCount >= 3,
      daily_count: dailyCount
    }, { status: 200 });
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Fetch history error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to fetch history' }, { status: 500 });
  }
}
