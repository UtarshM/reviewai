import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      campaign_id, rating, ai_suggestion, final_review,
      time_to_complete, browser_fingerprint, device_type, browser
    } = body;

    const campaignId = parseInt(campaign_id, 10);
    const starRating = parseInt(rating, 10);

    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Valid campaign_id is required' }, { status: 400 });
    }
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      return NextResponse.json({ error: 'bad_request', message: 'Star rating must be between 1 and 5' }, { status: 400 });
    }
    
    const cleanFinalReview = (final_review || '').trim();
    if (!cleanFinalReview) {
      return NextResponse.json({ error: 'bad_request', message: 'Review content cannot be empty' }, { status: 400 });
    }

    // 1. Resolve campaign and business configuration
    const campaignResult = await query(
      `SELECT c.id, c.business_id, c.behavior, b.google_review_link 
       FROM review_qr_campaigns c
       JOIN businesses b ON c.business_id = b.id
       WHERE c.id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      return NextResponse.json({ error: 'not_found', message: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaignResult.rows[0];

    // 2. Resolve client IP and Hash it
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

    // 3. Strict anti-spam: Block duplicate submissions within 120 minutes
    const duplicateCheck = await query(
      `SELECT id FROM customer_reviews 
       WHERE campaign_id = $1 
         AND (ip_hash = $2 OR (browser_fingerprint = $3 AND browser_fingerprint IS NOT NULL))
         AND created_at >= NOW() - INTERVAL '120 minutes'
       LIMIT 1`,
      [campaignId, ipHash, browser_fingerprint || null]
    );

    if (duplicateCheck.rows.length > 0) {
      return NextResponse.json({ 
        error: 'duplicate', 
        message: 'A review has already been submitted from this device recently. Thank you for your feedback!' 
      }, { status: 429 });
    }

    // 4. Resolve Device and Browser details
    const userAgent = request.headers.get('user-agent') || '';
    let resolvedDevice = device_type || 'Desktop';
    if (!device_type) {
      if (/Mobi|Android|iPhone/i.test(userAgent)) resolvedDevice = 'Mobile';
      else if (/Tablet|iPad|PlayBook/i.test(userAgent)) resolvedDevice = 'Tablet';
    }

    let resolvedBrowser = browser || 'Unknown';
    if (!browser) {
      if (/Chrome/i.test(userAgent)) resolvedBrowser = 'Chrome';
      else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) resolvedBrowser = 'Safari';
      else if (/Firefox/i.test(userAgent)) resolvedBrowser = 'Firefox';
      else if (/Edg/i.test(userAgent)) resolvedBrowser = 'Edge';
    }

    const country = request.headers.get('x-vercel-ip-country') || 'Unknown';
    const city = request.headers.get('x-vercel-ip-city') || 'Unknown';

    // 5. Determine status and is_edited
    const isEdited = ai_suggestion !== cleanFinalReview;
    const initialStatus = campaign.behavior === 'internal' ? 'submitted' : 'redirected';
    const timeCompleted = parseInt(time_to_complete, 10) || null;

    // 6. Save customer review to DB
    await query(
      `INSERT INTO customer_reviews (
         business_id, campaign_id, rating, ai_suggestion, final_review,
         status, is_edited, time_to_complete, ip_hash, browser_fingerprint,
         device_type, browser, city, country
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        campaign.business_id, campaignId, starRating, ai_suggestion || '', cleanFinalReview,
        initialStatus, isEdited, timeCompleted, ipHash, browser_fingerprint || null,
        resolvedDevice, resolvedBrowser, city, country
      ]
    );

    // Return redirect info to the public client page
    return NextResponse.json({
      success: true,
      behavior: campaign.behavior,
      google_review_link: campaign.google_review_link || ''
    }, { status: 201 });

  } catch (error) {
    console.error('Submit customer review error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to submit review' }, { status: 500 });
  }
}
