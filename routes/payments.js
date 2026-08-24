import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { query } from '../db.js';
import { authMiddleware } from '../auth.js';

dotenv.config();

const router = express.Router();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key_id';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_dummy_secret';

let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

// Plan Configurations
const PLANS = {
  '1_month': {
    name: '1 Month Access',
    amount: 100000, // INR 1,000 in paise
    durationMonths: 1,
    displayPrice: '₹1,000'
  },
  '6_months': {
    name: '6 Months Access',
    amount: 400000, // INR 4,000 in paise
    durationMonths: 6,
    displayPrice: '₹4,000'
  },
  '12_months': {
    name: '12 Months Access',
    amount: 500000, // INR 5,000 in paise
    durationMonths: 12,
    displayPrice: '₹5,000'
  }
};

// ----------------------------------------------------------------------
// PUBLIC PRE-PAYMENT ROUTES
// NOTE: create-public-order and verify-public-payment are handled
// directly in server.js (via routes/publicPayments.js) BEFORE this router
// is mounted, so authMiddleware below never fires for those endpoints.
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// AUTHENTICATED PAYMENT ROUTES (all routes below require JWT auth)
// ----------------------------------------------------------------------
router.use(authMiddleware);

// GET /api/v1/payments/admin/pending-accounts
router.get('/admin/pending-accounts', async (req, res) => {
  try {
    const result = await query('SELECT * FROM pending_accounts ORDER BY id DESC');
    return res.status(200).json({ pending_accounts: result.rows });
  } catch (err) {
    console.error('Fetch pending accounts error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to fetch pending accounts' });
  }
});

// POST /api/v1/payments/admin/approve-account
router.post('/admin/approve-account', async (req, res) => {
  try {
    const { pending_id, final_email, final_password } = req.body;
    const bcrypt = (await import('bcryptjs')).default;

    const pendRes = await query('SELECT * FROM pending_accounts WHERE id = $1', [Number(pending_id)]);
    if (!pendRes.rows || pendRes.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Pending account record not found' });
    }

    const item = pendRes.rows[0];
    const emailToUse = (final_email || item.email).trim().toLowerCase();
    const passToUse = final_password || item.password || 'password123';

    // Hash password
    const passwordHash = await bcrypt.hash(passToUse, 10);

    // Calculate expiration
    const selectedPlan = PLANS[item.plan] || PLANS['1_month'];
    const intervalStr = `${selectedPlan.durationMonths} months`;

    // Create user in users table
    const userRes = await query(
      `INSERT INTO users (email, password_hash, subscription_plan, subscription_expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '${intervalStr}')
       RETURNING id, email`,
      [emailToUse, passwordHash, item.plan]
    );

    const user = userRes.rows[0];

    // Create business for user
    if (item.business_name) {
      const slug = (item.business_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      await query(
        `INSERT INTO businesses (user_id, name, category, slug, google_review_link)
         VALUES ($1, $2, 'General', $3, 'https://search.google.com/local/writereview')`,
        [user.id, item.business_name, slug + '-' + user.id]
      );
    }

    // Update pending_accounts status
    await query('UPDATE pending_accounts SET status = $1 WHERE id = $2', ['approved', item.id]);

    return res.status(200).json({
      status: 'success',
      message: `Account for ${emailToUse} has been approved and activated!`,
      credentials: {
        email: emailToUse,
        password: passToUse,
        plan: selectedPlan.name
      }
    });

  } catch (err) {
    console.error('Approve account error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to approve account' });
  }
});

// POST /api/v1/payments/admin/create-manual-account
// Create account directly for offline/cash customers (no pending record needed)
router.post('/admin/create-manual-account', async (req, res) => {
  try {
    const { email, password, phone, business_name, plan, amount, order_id } = req.body;
    const bcrypt = (await import('bcryptjs')).default;

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone  || '').trim();
    const cleanBiz   = (business_name || '').trim();

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'bad_request', message: 'Email and password are required' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Resolve plan
    const selectedPlan = PLANS[plan] || PLANS['1_month'];
    const intervalStr  = `${selectedPlan.durationMonths} months`;

    // Create user
    const userRes = await query(
      `INSERT INTO users (email, password_hash, subscription_plan, subscription_expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '${intervalStr}')
       RETURNING id, email`,
      [cleanEmail, passwordHash, plan || '1_month']
    );
    const user = userRes.rows[0];

    // Create business profile
    if (cleanBiz) {
      const slug = cleanBiz.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      await query(
        `INSERT INTO businesses (user_id, name, category, slug, google_review_link)
         VALUES ($1, $2, 'General', $3, 'https://search.google.com/local/writereview')`,
        [user.id, cleanBiz, slug + '-' + user.id]
      );
    }

    // Log in pending_accounts for record-keeping
    const manualOrderId = order_id || `manual_${Date.now()}`;
    await query(
      `INSERT INTO pending_accounts (email, phone, password, business_name, plan, amount, order_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved')`,
      [cleanEmail, cleanPhone, password, cleanBiz, plan || '1_month', amount || 0, manualOrderId]
    );

    return res.status(200).json({
      status:   'success',
      user_id:  user.id,
      message:  `Manual account created for ${cleanEmail}`,
      credentials: { email: cleanEmail, password, plan: selectedPlan.name }
    });

  } catch (err) {
    console.error('Create manual account error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'duplicate', message: 'An account with this email already exists.' });
    }
    return res.status(500).json({ error: 'server_error', message: 'Failed to create manual account' });
  }
});

// GET /api/v1/payments/status - Get current user subscription status
router.get('/status', async (req, res) => {
  try {
    const userId = req.userId;
    const result = await query(
      'SELECT subscription_plan, subscription_expires_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'User not found' });
    }

    const user = result.rows[0];
    const expiresAt = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
    const isActive = expiresAt ? expiresAt > new Date() : false;

    return res.status(200).json({
      subscription_plan: user.subscription_plan || 'free',
      subscription_expires_at: user.subscription_expires_at,
      is_active: isActive,
      plans: Object.keys(PLANS).map(key => ({
        key,
        name: PLANS[key].name,
        display_price: PLANS[key].displayPrice,
        duration_months: PLANS[key].durationMonths
      }))
    });
  } catch (err) {
    console.error('Fetch payment status error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to fetch subscription status' });
  }
});

// POST /api/v1/payments/create-order - Create Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const userId = req.userId;
    const { plan, coupon_code } = req.body;

    const selectedPlan = PLANS[plan];
    if (!selectedPlan) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Invalid plan selected. Choose "1_month" (₹1,000), "6_months" (₹4,000), or "12_months" (₹5,000).'
      });
    }

    let finalAmount = selectedPlan.amount;
    let discountApplied = false;

    if (coupon_code) {
      const code = String(coupon_code).trim().toUpperCase();
      if (code === 'SCA99') {
        discountApplied = true;
        // 99% OFF (Pay 1%, min 100 paise = ₹1)
        finalAmount = Math.max(100, Math.round(selectedPlan.amount * 0.01));
      } else {
        return res.status(400).json({
          error: 'invalid_coupon',
          message: 'Invalid coupon code. Please check and try again.'
        });
      }
    }

    let orderId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (razorpayInstance) {
      const options = {
        amount: finalAmount,
        currency: 'INR',
        receipt: `rcpt_${userId}_${Date.now()}`,
        notes: { user_id: userId, plan: plan, coupon: coupon_code || '' }
      };
      const order = await razorpayInstance.orders.create(options);
      orderId = order.id;
    }

    // Save order in payments log table
    await query(
      'INSERT INTO payments (user_id, order_id, amount, plan, status) VALUES ($1, $2, $3, $4, $5)',
      [userId, orderId, finalAmount / 100, plan, 'created']
    );

    return res.status(200).json({
      order_id: orderId,
      amount: finalAmount,
      currency: 'INR',
      key_id: RAZORPAY_KEY_ID,
      plan: plan,
      plan_name: selectedPlan.name,
      discount_applied: discountApplied,
      coupon_code: discountApplied ? 'SCA99' : null
    });

  } catch (err) {
    console.error('Create payment order error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to create payment order' });
  }
});

// POST /api/v1/payments/verify-payment - Verify payment & activate subscription
router.post('/verify-payment', async (req, res) => {
  try {
    const userId = req.userId;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    const selectedPlan = PLANS[plan];
    if (!selectedPlan) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid plan specified' });
    }

    // If actual Razorpay credentials are present, verify HMAC signature
    if (process.env.RAZORPAY_KEY_SECRET && razorpay_signature) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'payment_failed', message: 'Invalid payment signature' });
      }
    }

    // Calculate expiration date
    const intervalStr = `${selectedPlan.durationMonths} months`;
    const updateResult = await query(
      `UPDATE users 
       SET subscription_plan = $1, 
           subscription_expires_at = NOW() + INTERVAL '${intervalStr}'
       WHERE id = $2 
       RETURNING subscription_plan, subscription_expires_at`,
      [plan, userId]
    );

    const updatedUser = updateResult.rows[0];

    // Log payment capture
    await query(
      `UPDATE payments 
       SET payment_id = $1, status = 'captured' 
       WHERE order_id = $2 AND user_id = $3`,
      [razorpay_payment_id || `pay_${Date.now()}`, razorpay_order_id, userId]
    );

    return res.status(200).json({
      status: 'success',
      message: `Subscription successfully activated for ${selectedPlan.name}!`,
      subscription_plan: updatedUser.subscription_plan,
      subscription_expires_at: updatedUser.subscription_expires_at
    });

  } catch (err) {
    console.error('Verify payment error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to verify and activate payment' });
  }
});

export default router;
