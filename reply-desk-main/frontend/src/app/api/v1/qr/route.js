import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';
import { generateSecureToken } from '@/app/api/token';

async function verifyBusiness(businessId, userId) {
  const result = await query(
    'SELECT id FROM businesses WHERE id = $1 AND user_id = $2',
    [businessId, userId]
  );
  return result.rows.length > 0;
}

// GET /api/v1/qr?business_id=123
export async function GET(request) {
  try {
    const userId = getUserIdFromRequest(request);
    const { searchParams } = new URL(request.url);
    const businessId = parseInt(searchParams.get('business_id'), 10);

    if (isNaN(businessId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Valid business_id query parameter is required' }, { status: 400 });
    }

    const isOwner = await verifyBusiness(businessId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    const result = await query(
      `SELECT q.*, t.name as template_name FROM review_qr_campaigns q
       LEFT JOIN prompt_templates t ON q.template_id = t.id
       WHERE q.business_id = $1
       ORDER BY q.created_at DESC`,
      [businessId]
    );

    if (result.rows.length === 0) {
      const token = generateSecureToken();
      const bizInfo = await query('SELECT name FROM businesses WHERE id = $1', [businessId]);
      const bizName = bizInfo.rows[0]?.name || 'our business';
      
      const insertResult = await query(
        `INSERT INTO review_qr_campaigns (
          business_id, name, campaign_type, behavior, token, welcome_title, welcome_subtitle
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          businessId,
          'Default QR Reviews',
          'store',
          'redirect_after_ai',
          token,
          `How was your experience at ${bizName}?`,
          "We'd love your feedback ❤️"
        ]
      );
      return NextResponse.json([insertResult.rows[0]], { status: 200 });
    }

    return NextResponse.json(result.rows, { status: 200 });

  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('List campaigns error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to list campaigns' }, { status: 500 });
  }
}

// POST /api/v1/qr
export async function POST(request) {
  try {
    const userId = getUserIdFromRequest(request);
    const body = await request.json();
    const {
      business_id, template_id, name, description, campaign_type,
      behavior, review_style, review_length, expires_at, scan_limit,
      review_limit, language, theme, qr_logo, qr_color, qr_background,
      frame_style, button_color, welcome_title, welcome_subtitle
    } = body;

    const businessId = parseInt(business_id, 10);
    if (isNaN(businessId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Valid business_id is required' }, { status: 400 });
    }

    const isOwner = await verifyBusiness(businessId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    const cleanName = (name || '').trim();
    if (!cleanName) {
      return NextResponse.json({ error: 'bad_request', message: 'Campaign name is required' }, { status: 400 });
    }

    const templateId = template_id ? parseInt(template_id, 10) : null;
    const cleanType = campaign_type || 'store';
    const cleanBehavior = behavior || 'internal';
    const cleanStyle = review_style || 'friendly';
    const cleanLength = review_length || 'medium';
    const expiresAt = expires_at || null;
    const scanLimit = parseInt(scan_limit, 10) || 0;
    const reviewLimit = parseInt(review_limit, 10) || 0;
    const cleanLanguage = language || 'en';
    const cleanTheme = theme || 'light';
    const qrColor = qr_color || '#000000';
    const qrBg = qr_background || '#FFFFFF';
    const frameStyleClean = frame_style || 'none';
    const btnColor = button_color || '#2563EB';
    
    // Generate unique token
    const token = generateSecureToken();

    const queryStr = `
      INSERT INTO review_qr_campaigns (
        business_id, template_id, name, description, campaign_type, token,
        behavior, review_style, review_length, expires_at, scan_limit,
        review_limit, language, theme, qr_logo, qr_color, qr_background,
        frame_style, button_color, welcome_title, welcome_subtitle
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING *
    `;

    const result = await query(queryStr, [
      businessId, templateId, cleanName, description || '', cleanType, token,
      cleanBehavior, cleanStyle, cleanLength, expiresAt, scanLimit,
      reviewLimit, cleanLanguage, cleanTheme, qr_logo || null, qrColor, qrBg,
      frameStyleClean, btnColor, welcome_title || '', welcome_subtitle || ''
    ]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Create campaign error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to create campaign' }, { status: 500 });
  }
}
