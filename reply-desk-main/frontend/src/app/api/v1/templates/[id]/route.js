import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';

export async function DELETE(request, { params }) {
  try {
    const userId = getUserIdFromRequest(request);
    const { id } = await params;
    const templateId = parseInt(id, 10);

    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid template ID' }, { status: 400 });
    }

    // Verify template owner
    const checkResult = await query(
      `SELECT t.id FROM prompt_templates t
       JOIN businesses b ON t.business_id = b.id
       WHERE t.id = $1 AND b.user_id = $2`,
      [templateId, userId]
    );

    if (checkResult.rows.length === 0) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    await query('DELETE FROM prompt_templates WHERE id = $1', [templateId]);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Delete template error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to delete template' }, { status: 500 });
  }
}
