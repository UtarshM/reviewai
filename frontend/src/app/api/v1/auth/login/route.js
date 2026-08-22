import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/app/api/db';
import { generateToken } from '@/app/api/auth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'bad_request', message: 'Email and password are required' }, { status: 400 });
    }

    const result = await query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'unauthorized', message: 'Invalid credentials' }, { status: 401 });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return NextResponse.json({ error: 'unauthorized', message: 'Invalid credentials' }, { status: 401 });
    }

    const token = generateToken(user.id, user.email);

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      token
    }, { status: 200 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'internal_error', message: error.message }, { status: 500 });
  }
}
