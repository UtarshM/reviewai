import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';
import { resolvePlaceId } from '@/app/api/serp';

export async function GET(request) {
  try {
    const userId = getUserIdFromRequest(request);
    const result = await query(
      'SELECT id, user_id, name, category, tone_default, google_review_link, city, state, country, created_at FROM businesses WHERE user_id = $1 ORDER BY name ASC',
      [userId]
    );
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('List businesses error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to list businesses' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = getUserIdFromRequest(request);
    const { name, category, tone_default, google_review_link, city, state, country } = await request.json();

    const cleanName = (name || '').trim();
    const cleanCategory = (category || '').trim();
    const cleanTone = (tone_default || '').trim() || 'friendly';
    const cleanCity = (city || '').trim();
    const cleanState = (state || '').trim();
    const cleanCountry = (country || '').trim();

    if (!cleanName || !cleanCategory) {
      return NextResponse.json({ error: 'bad_request', message: 'Business name and category are required' }, { status: 400 });
    }

    const result = await query(
      'INSERT INTO businesses (user_id, name, category, tone_default, google_review_link, city, state, country) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, user_id, name, category, tone_default, google_review_link, city, state, country, created_at',
      [userId, cleanName, cleanCategory, cleanTone, '', cleanCity, cleanState, cleanCountry]
    );

    const newBusiness = result.rows[0];

    try {
      const placeId = await resolvePlaceId(cleanName, cleanCategory, cleanCity, cleanState, cleanCountry);
      const reviewLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
      await query(
        'UPDATE businesses SET google_review_link = $1 WHERE id = $2',
        [reviewLink, newBusiness.id]
      );
      newBusiness.google_review_link = reviewLink;
    } catch (serpErr) {
      console.error('Failed to auto-resolve Google review link:', serpErr);
    }

    return NextResponse.json(newBusiness, { status: 201 });
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Create business error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to create business' }, { status: 500 });
  }
}
