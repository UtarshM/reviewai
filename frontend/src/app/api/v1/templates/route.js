import { NextResponse } from 'next/server';
import { query } from '@/app/api/db';
import { getUserIdFromRequest } from '@/app/api/auth';

// Helper to check business ownership
async function verifyBusiness(businessId, userId) {
  const result = await query(
    'SELECT id FROM businesses WHERE id = $1 AND user_id = $2',
    [businessId, userId]
  );
  return result.rows.length > 0;
}

// GET /api/v1/templates?business_id=123
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
      'SELECT id, name, system_prompt, created_at FROM prompt_templates WHERE business_id = $1 ORDER BY name ASC',
      [businessId]
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('List templates error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to retrieve templates' }, { status: 500 });
  }
}

// POST /api/v1/templates
export async function POST(request) {
  try {
    const userId = getUserIdFromRequest(request);
    const { business_id, name, system_prompt } = await request.json();
    const businessId = parseInt(business_id, 10);

    if (isNaN(businessId)) {
      return NextResponse.json({ error: 'bad_request', message: 'Valid business_id is required' }, { status: 400 });
    }

    const cleanName = (name || '').trim();
    const cleanPrompt = (system_prompt || '').trim();

    if (!cleanName || !cleanPrompt) {
      return NextResponse.json({ error: 'bad_request', message: 'Template name and system prompt are required' }, { status: 400 });
    }

    const isOwner = await verifyBusiness(businessId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'forbidden', message: 'Access denied' }, { status: 403 });
    }

    const result = await query(
      'INSERT INTO prompt_templates (business_id, name, system_prompt) VALUES ($1, $2, $3) RETURNING id, business_id, name, system_prompt, created_at',
      [businessId, cleanName, cleanPrompt]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    if (error.message.includes('Authorization header') || error.message.includes('Invalid or expired token')) {
      return NextResponse.json({ error: 'unauthorized', message: error.message }, { status: 401 });
    }
    console.error('Create template error:', error);
    return NextResponse.json({ error: 'server_error', message: 'Failed to create template' }, { status: 500 });
  }
}
