import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';

async function checkReviewOwnership(reviewId, userId) {
  const result = await query(
    `SELECT cr.id FROM customer_reviews cr
     JOIN businesses b ON cr.business_id = b.id
     WHERE cr.id = $1 AND b.user_id = $2`,
    [reviewId, userId]
  );
  return result.rows.length > 0;
}

// POST /api/v1/qr/reviews/[id]/reply
export async function POST(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    const { id } = await params;
    const reviewId = parseInt(id, 10);

    if (isNaN(reviewId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid review ID' }, { status: 400 });
    }

    const { reply } = await request.json();
    const cleanReply = (reply || '').trim();

    if (!cleanReply) {
      return NextResponse.json({ error: 'bad_request', message: 'Reply text cannot be empty' }, { status: 400 });
    }

    const isOwner = await checkReviewOwnership(reviewId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    const now = new Date();
    await query(
      `UPDATE customer_reviews
       SET business_reply = $1,
           reply_updated_at = $2,
           reply_created_at = COALESCE(reply_created_at, $2),
           reply_ai_generated = FALSE
       WHERE id = $3`,
      [cleanReply, now, reviewId]
    );

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Save QR review reply error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to save reply' }, { status: 500 });
  }
}
