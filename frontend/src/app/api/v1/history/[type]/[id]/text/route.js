import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest, verifyOwnership } from '@/app/api/auth';

export async function PUT(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    const { type, id } = await params;
    const itemId = parseInt(id, 10);
    const itemType = type; // 'reply' or 'review'

    if (isNaN(itemId) || (itemType !== 'reply' && itemType !== 'review')) {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid history parameter' }, { status: 400 });
    }

    const { text } = await request.json();
    const cleanText = (text || '').trim();
    if (!cleanText) {
      return NextResponse.json({ error: 'bad_request', message: 'Text content is required' }, { status: 400 });
    }

    try {
      const businessId = await verifyOwnership(itemType, itemId, userId);

      // Update text and set status = 'edited'
      let updateQuery = '';
      if (itemType === 'reply') {
        updateQuery = "UPDATE reviews_replied SET selected_reply = $1, status = 'edited' WHERE id = $2 AND business_id = $3";
      } else {
        updateQuery = "UPDATE reviews_drafted SET selected_review = $1, status = 'edited' WHERE id = $2 AND business_id = $3";
      }

      await query(updateQuery, [cleanText, itemId, businessId]);

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (err) {
      if (err.message === 'Access denied or record not found') {
        return NextResponse.json({ error: 'forbidden', message: err.message }, { status: 403 });
      }
      throw err;
    }
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Update text error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to update text' }, { status: 500 });
  }
}
