import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import crypto from 'crypto';

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const { browser_fingerprint } = body;

    if (!token) {
      return NextResponse.json({ error: 'bad_request', message: 'Token is required' }, { status: 400 });
    }

    // Resolve campaign
    const campaignResult = await query(
      'SELECT id, is_active FROM review_qr_campaigns WHERE token = $1',
      [token]
    );

    if (campaignResult.rows.length === 0) {
      return NextResponse.json({ error: 'not_found', message: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaignResult.rows[0];
    if (!campaign.is_active) {
      return NextResponse.json({ error: 'inactive', message: 'Campaign is inactive' }, { status: 400 });
    }

    // Resolve metadata
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

    const userAgent = request.headers.get('user-agent') || '';
    let deviceType = 'Desktop';
    if (/Mobi|Android|iPhone/i.test(userAgent)) {
      deviceType = 'Mobile';
    } else if (/Tablet|iPad|PlayBook/i.test(userAgent)) {
      deviceType = 'Tablet';
    }

    let browser = 'Unknown';
    if (/Chrome/i.test(userAgent)) browser = 'Chrome';
    else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) browser = 'Safari';
    else if (/Firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/Edg/i.test(userAgent)) browser = 'Edge';

    const country = request.headers.get('x-vercel-ip-country') || 'Unknown';
    const city = request.headers.get('x-vercel-ip-city') || 'Unknown';

    // Insert Scan Log
    await query(
      `INSERT INTO review_qr_scans (
         campaign_id, ip_hash, browser_fingerprint, device_type, browser, city, country
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [campaign.id, ipHash, browser_fingerprint || null, deviceType, browser, city, country]
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Log scan error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to log scan' }, { status: 500 });
  }
}
