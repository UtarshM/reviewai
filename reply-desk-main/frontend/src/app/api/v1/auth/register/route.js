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

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const result = await query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [email, passwordHash]
      );
      const user = result.rows[0];
      const token = generateToken(user.id, user.email);

      return NextResponse.json({ user, token }, { status: 201 });
    } catch (err) {
      if (err.code === '23505') { // unique violation
        return NextResponse.json({ error: 'conflict', message: 'User already exists' }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'internal_error', message: error.message }, { status: 500 });
  }
}
