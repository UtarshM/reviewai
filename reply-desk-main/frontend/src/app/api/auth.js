import jwt from 'jsonwebtoken';
import { query } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'replydesk-secret-key-change-in-production';

export function generateToken(userId, email) {
  return jwt.sign(
    { user_id: userId, email: email },
    JWT_SECRET,
    { expiresIn: '72h' }
  );
}

export function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Authorization header missing');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new Error('Authorization header format must be Bearer <token>');
  }

  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.user_id === undefined) {
      throw new Error('Invalid token claims');
    }
    return decoded.user_id;
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
}

export async function verifyOwnership(type, id, userId) {
  if (type === 'reply') {
    const res = await query(
      `SELECT r.business_id 
       FROM reviews_replied r 
       JOIN businesses b ON r.business_id = b.id 
       WHERE r.id = $1 AND b.user_id = $2`,
      [id, userId]
    );
    if (res.rows.length === 0) {
      throw new Error('Access denied or record not found');
    }
    return res.rows[0].business_id;
  } else if (type === 'review') {
    const res = await query(
      `SELECT r.business_id 
       FROM reviews_drafted r 
       JOIN businesses b ON r.business_id = b.id 
       WHERE r.id = $1 AND b.user_id = $2`,
      [id, userId]
    );
    if (res.rows.length === 0) {
      throw new Error('Access denied or record not found');
    }
    return res.rows[0].business_id;
  } else {
    throw new Error('Invalid flow type');
  }
}
