import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';

export async function PUT(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    const { id } = await params;
    const businessId = parseInt(id, 10);
    if (isNaN(businessId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid business ID' }, { status: 400 });
    }

    const { name, category, tone_default, google_review_link, city, state, country } = await request.json();

    const cleanName = (name || '').trim();
    const cleanCategory = (category || '').trim();
    const cleanTone = (tone_default || '').trim() || 'friendly';
    const cleanLink = (google_review_link || '').trim();
    const cleanCity = (city || '').trim();
    const cleanState = (state || '').trim();
    const cleanCountry = (country || '').trim();

    if (!cleanName || !cleanCategory) {
      return NextResponse.json({ error: 'bad_request', message: 'Business name and category are required' }, { status: 400 });
    }

    // Verify ownership first
    const ownerCheck = await query(
      'SELECT id FROM businesses WHERE id = $1 AND user_id = $2',
      [businessId, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    // Update
    const result = await query(
      'UPDATE businesses SET name = $1, category = $2, tone_default = $3, google_review_link = $4, city = $5, state = $6, country = $7 WHERE id = $8 AND user_id = $9 RETURNING id, user_id, name, category, tone_default, google_review_link, city, state, country, created_at',
      [cleanName, cleanCategory, cleanTone, cleanLink, cleanCity, cleanState, cleanCountry, businessId, userId]
    );

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Update business error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to update business' }, { status: 500 });
  }
}
