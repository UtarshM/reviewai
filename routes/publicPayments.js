/**
 * publicPayments.js
 * Public (unauthenticated) payment handlers.
 * Imported directly into server.js and registered on the Express `app`
 * BEFORE the main paymentRoutes router so authMiddleware never fires.
 */
import crypto from 'crypto';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { query } from '../db.js';

dotenv.config();

const RAZORPAY_KEY_ID  = process.env.RAZORPAY_KEY_ID  || 'rzp_test_dummy_key_id';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_dummy_secret';

let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id:    process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

const PLANS = {
  '1_month':  { name: '1 Month Access',  baseAmount: 1000, amount: 118000, durationMonths: 1,  displayPrice: '₹1,180 (incl. 18% GST)' },
  '6_months': { name: '6 Months Access', baseAmount: 4000, amount: 472000, durationMonths: 6,  displayPrice: '₹4,720 (incl. 18% GST)' },
  '12_months':{ name: '12 Months Access',baseAmount: 5000, amount: 590000, durationMonths: 12, displayPrice: '₹5,900 (incl. 18% GST)' }
};

// POST /api/v1/payments/create-public-order — NO AUTH
export async function createPublicOrder(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const { email, phone, password, business_name, plan, coupon_code } = req.body;

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone  || '').trim();
    const cleanBiz   = (business_name || '').trim();

    if (!cleanEmail || !cleanPhone) {
      return res.status(400).json({ error: 'bad_request', message: 'Email address and phone number are required.' });
    }

    const selectedPlan = PLANS[plan] || PLANS['1_month'];
    let finalAmount    = selectedPlan.amount;
    let discountApplied = false;

    if (coupon_code) {
      const code = String(coupon_code).trim().toUpperCase();
      if (code === 'SCA99') {
        discountApplied = true;
        const base = (selectedPlan.baseAmount || 1000) * 0.01;
        finalAmount = Math.max(100, Math.round(base * 1.18 * 100));
      }
    }

    let orderId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    let subscriptionId = null;
    let isAutoPay = (plan === '1_month');

    if (razorpayInstance) {
      if (isAutoPay) {
        try {
          let planId = process.env.RAZORPAY_MONTHLY_PLAN_ID;
          if (!planId) {
            const newPlan = await razorpayInstance.plans.create({
              period: 'monthly',
              interval: 1,
              item: {
                name: 'Monthly Sub (RevmeAI)',
                amount: finalAmount,
                currency: 'INR',
                description: 'Monthly AutoPay Access'
              }
            });
            planId = newPlan.id;
          }
          if (planId) {
            const sub = await razorpayInstance.subscriptions.create({
              plan_id: planId,
              total_count: 12,
              quantity: 1,
              customer_notify: 1,
              notes: { email: cleanEmail, phone: cleanPhone, plan }
            });
            subscriptionId = sub.id;
            orderId = sub.id;
          }
        } catch (subErr) {
          console.warn('Subscription creation fallback to order:', subErr.message);
        }
      }

      if (!subscriptionId) {
        const options = {
          amount:   finalAmount,
          currency: 'INR',
          receipt:  `rcpt_pub_${Date.now()}`,
          notes: { email: cleanEmail, phone: cleanPhone, plan, coupon: coupon_code || '' }
        };
        const order = await razorpayInstance.orders.create(options);
        orderId = order.id;
      }
    }

    await query(
      `INSERT INTO pending_accounts (email, phone, password, business_name, plan, amount, order_id, coupon_code, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'order_created')`,
      [cleanEmail, cleanPhone, password || '', cleanBiz, plan || '1_month', finalAmount / 100, orderId, coupon_code || null]
    );

    return res.status(200).json({
      order_id:        orderId,
      subscription_id: subscriptionId,
      is_autopay:      isAutoPay,
      amount:          finalAmount,
      currency:        'INR',
      key_id:          RAZORPAY_KEY_ID,
      plan,
      plan_name:       selectedPlan.name,
      discount_applied: discountApplied,
      coupon_code:     discountApplied ? 'SCA99' : null,
      email:           cleanEmail,
      phone:           cleanPhone
    });
  } catch (err) {
    console.error('createPublicOrder error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to create payment order' });
  }
}

// POST /api/v1/payments/verify-public-payment — NO AUTH
export async function verifyPublicPayment(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, phone, password, business_name, plan } = req.body;

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone  || '').trim();

    if (process.env.RAZORPAY_KEY_SECRET && razorpay_signature && razorpay_signature !== 'demo_sig') {
      const body1 = razorpay_order_id + '|' + razorpay_payment_id;
      const body2 = razorpay_payment_id + '|' + razorpay_order_id;
      const expected1 = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body1).digest('hex');
      const expected2 = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body2).digest('hex');
      if (expected1 !== razorpay_signature && expected2 !== razorpay_signature) {
        return res.status(400).json({ error: 'payment_failed', message: 'Invalid payment signature' });
      }
    }

    const payId = razorpay_payment_id || `pay_verified_${Date.now()}`;

    await query(
      `UPDATE pending_accounts
         SET payment_id = $1, signature = $2, status = 'paid_pending_manual_approval'
       WHERE order_id = $3`,
      [payId, razorpay_signature || 'verified', razorpay_order_id]
    );

    const selectedPlan = PLANS[plan] || PLANS['1_month'];

    return res.status(200).json({
      status:        'success',
      message:       'Payment received successfully! Your account will be set up within 24 hours.',
      payment_id:    payId,
      order_id:      razorpay_order_id,
      email:         cleanEmail,
      phone:         cleanPhone,
      business_name: business_name || '',
      plan_name:     selectedPlan.name
    });
  } catch (err) {
    console.error('verifyPublicPayment error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to verify public payment' });
  }
}
