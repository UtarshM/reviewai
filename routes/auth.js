import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { generateToken } from '../auth.js';

const router = express.Router();

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'bad_request', message: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'bad_request', message: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const userCheck = await query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (userCheck.rows && userCheck.rows.length > 0) {
      return res.status(409).json({ error: 'conflict', message: 'Email is already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const insertResult = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [cleanEmail, passwordHash]
    );

    const user = (insertResult.rows && insertResult.rows[0]) || { id: 1, email: cleanEmail };

    // Generate token
    const token = generateToken(user.id, user.email);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message || 'Failed to create user', details: err.stack });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'bad_request', message: 'Email and password are required' });
    }

    // Fetch user
    const result = await query('SELECT id, email, password_hash FROM users WHERE email = $1', [cleanEmail]);
    if (!result.rows || result.rows.length === 0) {
      // Check if user paid and is waiting for manual account approval
      const pendCheck = await query("SELECT * FROM pending_accounts WHERE LOWER(email) = $1 AND status = 'paid_pending_manual_approval'", [cleanEmail]);
      if (pendCheck.rows && pendCheck.rows.length > 0) {
        return res.status(403).json({
          error: 'pending_manual_approval',
          message: '🔒 Payment Verified & Received! Your account is currently being set up manually by our team. Your verified Login ID & Password will be sent to your email & phone number shortly.'
        });
      }
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message || 'Authentication failure' });
  }
});

export default router;
