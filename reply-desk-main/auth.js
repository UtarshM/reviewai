import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query } from './db.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'replydesk-secret-key-change-in-production';

// Generate JWT token for 72 hours
export function generateToken(userId, email) {
  return jwt.sign(
    { user_id: userId, email: email },
    JWT_SECRET,
    { expiresIn: '72h' }
  );
}

// Authentication middleware for Express
export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'unauthorized', message: 'Authorization header missing' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({ error: 'unauthorized', message: 'Authorization header format must be Bearer <token>' });
  }

  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.user_id === undefined) {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid token claims' });
    }
    req.userId = decoded.user_id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
  }
}

// Check if the business belongs to the authenticated user
export async function verifyBusinessOwnership(businessId, userId) {
  const result = await query(
    'SELECT id, name, category, tone_default, city, state, country, google_review_link FROM businesses WHERE id = $1 AND user_id = $2',
    [businessId, userId]
  );
  if (result.rows.length === 0) {
    const err = new Error('Access denied to this business profile');
    err.status = 403;
    err.errorType = 'forbidden';
    throw err;
  }
  return result.rows[0];
}

// Check if the history item (reply or review) belongs to a business owned by the user
export async function verifyHistoryOwnership(type, id, userId) {
  let queryStr = '';
  if (type === 'reply') {
    queryStr = `
      SELECT r.business_id 
      FROM reviews_replied r 
      JOIN businesses b ON r.business_id = b.id 
      WHERE r.id = $1 AND b.user_id = $2
    `;
  } else if (type === 'review') {
    queryStr = `
      SELECT r.business_id 
      FROM reviews_drafted r 
      JOIN businesses b ON r.business_id = b.id 
      WHERE r.id = $1 AND b.user_id = $2
    `;
  } else {
    const err = new Error('Invalid flow type');
    err.status = 400;
    err.errorType = 'bad_request';
    throw err;
  }

  const result = await query(queryStr, [id, userId]);
  if (result.rows.length === 0) {
    const err = new Error('Access denied or record not found');
    err.status = 403;
    err.errorType = 'forbidden';
    throw err;
  }
  return result.rows[0].business_id;
}
