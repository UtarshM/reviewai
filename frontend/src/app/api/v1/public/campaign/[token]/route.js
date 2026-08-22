import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { fetchGoogleReviews } from '@/app/api/serp';

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: 'bad_request', message: 'Token is required' }, { status: 400 });
    }

    const campaignResult = await query(
      `SELECT 
         c.id as campaign_id, c.business_id, c.name as campaign_name, c.description as campaign_description,
         c.campaign_type, c.behavior, c.is_active, c.expires_at, c.scan_limit, c.review_limit,
         c.language, c.theme, c.qr_logo, c.qr_color, c.qr_background, c.frame_style, c.button_color,
         c.welcome_title, c.welcome_subtitle, c.review_style, c.review_length,
         b.name as business_name, b.category as business_category, b.city, b.state, b.country,
         b.google_review_link
       FROM review_qr_campaigns c
       JOIN businesses b ON c.business_id = b.id
       WHERE c.token = $1`,
      [token]
    );

    if (campaignResult.rows.length === 0) {
      return NextResponse.json({ error: 'not_found', message: 'Review campaign not found or link is invalid' }, { status: 404 });
    }

    const campaign = campaignResult.rows[0];

    // Cache the direct placeid write review link if none exists yet
    if (!campaign.google_review_link || campaign.google_review_link.trim() === '') {
      try {
        const data = await fetchGoogleReviews(
          campaign.business_name,
          campaign.business_category,
          campaign.google_review_link,
          campaign.city,
          campaign.state,
          campaign.country
        );
        if (data.place_id) {
          const writeReviewUrl = `https://search.google.com/local/writereview?placeid=${data.place_id}`;
          await query(
            'UPDATE businesses SET google_review_link = $1 WHERE id = $2',
            [writeReviewUrl, campaign.business_id]
          );
          campaign.google_review_link = writeReviewUrl; // Update returned object
          console.log(`Dynamically resolved and cached google_review_link for campaign ${token}: ${writeReviewUrl}`);
        }
      } catch (serpErr) {
        console.error('Failed to dynamically resolve place_id for campaign:', serpErr.message);
      }
    }

    // Check if active
    if (!campaign.is_active) {
      return NextResponse.json({ error: 'inactive', message: 'This review campaign is currently disabled.' }, { status: 200 });
    }

    // Check expiration
    if (campaign.expires_at && new Date(campaign.expires_at) < new Date()) {
      return NextResponse.json({ error: 'expired', message: 'This review campaign has expired.' }, { status: 200 });
    }

    // Check scan limit
    if (campaign.scan_limit > 0) {
      const scansCount = await query('SELECT COUNT(*)::int FROM review_qr_scans WHERE campaign_id = $1', [campaign.campaign_id]);
      if (scansCount.rows[0].count >= campaign.scan_limit) {
        return NextResponse.json({ error: 'limit_exceeded', message: 'This campaign scan limit has been reached.' }, { status: 200 });
      }
    }

    // Check review limit
    if (campaign.review_limit > 0) {
      const reviewsCount = await query('SELECT COUNT(*)::int FROM customer_reviews WHERE campaign_id = $1', [campaign.campaign_id]);
      if (reviewsCount.rows[0].count >= campaign.review_limit) {
        return NextResponse.json({ error: 'limit_exceeded', message: 'This campaign review limit has been reached.' }, { status: 200 });
      }
    }

    return NextResponse.json(campaign, { status: 200 });
  } catch (error) {
    console.error('Fetch public campaign details error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to retrieve campaign details' }, { status: 500 });
  }
}
