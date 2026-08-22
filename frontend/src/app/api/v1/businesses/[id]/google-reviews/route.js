import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';
import { fetchGoogleReviews } from '@/app/api/serp';

export async function GET(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    const { id } = await params;
    const businessId = parseInt(id, 10);
    
    if (isNaN(businessId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid business ID' }, { status: 400 });
    }

    // 1. Verify business ownership
    const bizResult = await query(
      'SELECT id, name, category, google_review_link, city, state, country FROM businesses WHERE id = $1 AND user_id = $2',
      [businessId, userId]
    );

    if (bizResult.rows.length === 0) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied to this business profile' }, { status: 403 });
    }

    const business = bizResult.rows[0];

    // 2. Fetch Google Reviews using SerpApi
    try {
      const data = await fetchGoogleReviews(
        business.name,
        business.category,
        business.google_review_link,
        business.city,
        business.state,
        business.country
      );

      // Cache the direct placeid write review link if we resolved place_id and no valid deep link exists yet
      if (data.place_id && (!business.google_review_link || business.google_review_link.trim() === '')) {
        const writeReviewUrl = `https://search.google.com/local/writereview?placeid=${data.place_id}`;
        await query(
          'UPDATE businesses SET google_review_link = $1 WHERE id = $2',
          [writeReviewUrl, businessId]
        );
        console.log(`Updated business ID ${businessId} google_review_link to: ${writeReviewUrl}`);
      }

      return NextResponse.json(data, { status: 200 });
    } catch (serpErr) {
      console.error('SerpApi error:', serpErr);
      return NextResponse.json({ error: 'service_error', message: serpErr.message }, { status: 502 });
    }

  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Fetch Google Reviews error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to fetch Google Reviews' }, { status: 500 });
  }
}
