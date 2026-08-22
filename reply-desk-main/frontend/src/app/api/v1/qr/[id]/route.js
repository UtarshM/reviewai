import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';

async function checkCampaignOwnership(campaignId, userId) {
  const result = await query(
    `SELECT c.id FROM review_qr_campaigns c
     JOIN businesses b ON c.business_id = b.id
     WHERE c.id = $1 AND b.user_id = $2`,
    [campaignId, userId]
  );
  return result.rows.length > 0;
}

// PUT /api/v1/qr/:id
export async function PUT(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    const { id } = await params;
    const campaignId = parseInt(id, 10);

    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid campaign ID' }, { status: 400 });
    }

    const isOwner = await checkCampaignOwnership(campaignId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      template_id, name, description, campaign_type, behavior, is_active,
      review_style, review_length, expires_at, scan_limit, review_limit,
      language, theme, qr_logo, qr_color, qr_background, frame_style,
      button_color, welcome_title, welcome_subtitle
    } = body;

    const cleanName = (name || '').trim();
    if (!cleanName) {
      return NextResponse.json({ error: 'bad_request', message: 'Campaign name is required' }, { status: 400 });
    }

    const templateId = template_id ? parseInt(template_id, 10) : null;
    const cleanType = campaign_type || 'store';
    const cleanBehavior = behavior || 'internal';
    const activeStatus = is_active !== false;
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

    const queryStr = `
      UPDATE review_qr_campaigns SET
        template_id = $1, name = $2, description = $3, campaign_type = $4,
        behavior = $5, is_active = $6, review_style = $7, review_length = $8,
        expires_at = $9, scan_limit = $10, review_limit = $11, language = $12,
        theme = $13, qr_logo = $14, qr_color = $15, qr_background = $16,
        frame_style = $17, button_color = $18, welcome_title = $19, welcome_subtitle = $20
      WHERE id = $21
      RETURNING *
    `;

    const result = await query(queryStr, [
      templateId, cleanName, description || '', cleanType, cleanBehavior, activeStatus,
      cleanStyle, cleanLength, expiresAt, scanLimit, reviewLimit, cleanLanguage,
      cleanTheme, qr_logo || null, qrColor, qrBg, frameStyleClean, btnColor,
      welcome_title || '', welcome_subtitle || '', campaignId
    ]);

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Update campaign error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to update campaign' }, { status: 500 });
  }
}

// DELETE /api/v1/qr/:id
export async function DELETE(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    const { id } = await params;
    const campaignId = parseInt(id, 10);

    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid campaign ID' }, { status: 400 });
    }

    const isOwner = await checkCampaignOwnership(campaignId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    await query('DELETE FROM review_qr_campaigns WHERE id = $1', [campaignId]);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Delete campaign error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to delete campaign' }, { status: 500 });
  }
}
