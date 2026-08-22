import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest, verifyOwnership } from '@/app/api/auth';

export async function DELETE(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    const { type, id } = await params;
    const itemId = parseInt(id, 10);
    const itemType = type; // 'reply' or 'review'

    if (isNaN(itemId) || (itemType !== 'reply' && itemType !== 'review')) {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid history parameter' }, { status: 400 });
    }

    try {
      const businessId = await verifyOwnership(itemType, itemId, userId);

      // Delete item
      let deleteQuery = '';
      if (itemType === 'reply') {
        deleteQuery = 'DELETE FROM reviews_replied WHERE id = $1 AND business_id = $2';
      } else {
        deleteQuery = 'DELETE FROM reviews_drafted WHERE id = $1 AND business_id = $2';
      }

      await query(deleteQuery, [itemId, businessId]);

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
    console.error('Delete history error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to delete history' }, { status: 500 });
  }
}
