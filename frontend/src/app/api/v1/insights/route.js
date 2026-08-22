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

// GET /api/v1/insights?business_id=123&period=weekly
export async function GET(request) {
  try {
    const userId = getUserIdFromRequest(request);
    const { searchParams } = new URL(request.url);
    const businessId = parseInt(searchParams.get('business_id'), 10);
    const period = searchParams.get('period') || 'weekly';

    if (isNaN(businessId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Valid business_id query parameter is required' }, { status: 400 });
    }

    const isOwner = await verifyBusiness(businessId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    const result = await query(
      `SELECT id, period, start_date, end_date, insights, created_at 
       FROM review_ai_insights 
       WHERE business_id = $1 AND period = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [businessId, period]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ insights: null }, { status: 200 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Get insights error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to retrieve insights' }, { status: 500 });
  }
}
