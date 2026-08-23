import pg from 'pg';
import dotenv from 'dotenv';
import { parse } from 'pg-connection-string';
import fs from 'fs';
import path from 'path';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || '';

let pool = null;
let usePostgres = false;

if (connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
  try {
    const isRemote = connectionString.includes('supabase') || connectionString.includes('neon') || connectionString.includes('sslmode=require') || connectionString.includes('pooler');
    const cleanUrl = connectionString.replace(/([?&])sslmode=[^&]*/, '').replace(/\?$/, '');
    pool = new Pool({
      connectionString: cleanUrl,
      ssl: isRemote ? { rejectUnauthorized: false } : false
    });
    usePostgres = true;
  } catch (e) {
    console.warn('Failed to parse DATABASE_URL, using JSON file fallback:', e.message);
  }
}

// In-Memory / File Persistent Store
const DATA_FILE = path.resolve('/tmp', 'replydesk_store.json');

function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading store file:', e.message);
  }
  return {
    users: [],
    businesses: [
      {
        id: 1,
        user_id: 1,
        name: 'Artisan Coffee & Bakery',
        category: 'Coffee & Bakery',
        slug: 'artisan-coffee-bakery',
        tone_default: 'friendly',
        google_review_link: 'https://search.google.com/local/writereview',
        city: 'San Francisco',
        created_at: new Date().toISOString()
      }
    ],
    reviews_replied: [],
    private_feedbacks: [],
    payments: [],
    google_posts: [],
    user_id_seq: 2,
    business_id_seq: 2,
    review_id_seq: 1,
    feedback_id_seq: 1,
    payment_id_seq: 1,
    post_id_seq: 1
  };
}

function saveStore(store) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving store file:', e.message);
  }
}

let storeMemory = loadStore();
if (!storeMemory.private_feedbacks) storeMemory.private_feedbacks = [];
if (!storeMemory.google_posts) storeMemory.google_posts = [];
if (!storeMemory.feedback_id_seq) storeMemory.feedback_id_seq = 1;
if (!storeMemory.post_id_seq) storeMemory.post_id_seq = 1;

function generateSlug(name) {
  const base = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return base || `biz-${Date.now().toString(36)}`;
}

function titleCaseSlug(slug) {
  return (slug || 'local-business')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function runJsQuery(text, params = []) {
  try {
    const sql = (text || '').trim();
    const lowerSql = sql.toLowerCase();

    // 0. generation_log check
    if (lowerSql.includes('generation_log')) {
      return { rows: [{ count: '0', id: 1 }] };
    }

    // 1. SELECT user by email
    if (lowerSql.includes('from users') && lowerSql.includes('email =')) {
      const email = params[0];
      const user = storeMemory.users.find(u => u.email && u.email.toLowerCase() === (email || '').toLowerCase());
      return { rows: user ? [user] : [] };
    }

    // 2. SELECT user by id
    if (lowerSql.includes('from users') && lowerSql.includes('id =')) {
      const id = Number(params[0]);
      const user = storeMemory.users.find(u => u.id === id);
      return { rows: user ? [user] : [] };
    }

    // 3. INSERT user
    if (lowerSql.includes('insert into users')) {
      const email = params[0];
      const password_hash = params[1];
      const existing = storeMemory.users.find(u => u.email && u.email.toLowerCase() === (email || '').toLowerCase());
      if (existing) {
        const err = new Error('Email is already registered');
        err.code = '23505';
        throw err;
      }
      const newUser = {
        id: storeMemory.user_id_seq++,
        email,
        password_hash,
        subscription_plan: 'free',
        subscription_expires_at: null,
        razorpay_customer_id: null,
        created_at: new Date().toISOString()
      };
      storeMemory.users.push(newUser);
      saveStore(storeMemory);
      return { rows: [newUser] };
    }

    // 4. SELECT businesses for user
    if (lowerSql.includes('from businesses') && lowerSql.includes('user_id =')) {
      const userId = Number(params[0]);
      let list = storeMemory.businesses.filter(b => b.user_id === userId);
      if (list.length === 0) {
        // Auto-seed default business for user
        const defaultBiz = {
          id: storeMemory.business_id_seq++,
          user_id: userId,
          name: 'Artisan Coffee & Bakery',
          category: 'Coffee & Bakery',
          slug: 'artisan-coffee-bakery',
          tone_default: 'friendly',
          google_review_link: 'https://search.google.com/local/writereview',
          city: 'San Francisco',
          state: 'CA',
          country: 'US',
          created_at: new Date().toISOString()
        };
        storeMemory.businesses.push(defaultBiz);
        saveStore(storeMemory);
        list = [defaultBiz];
      }
      return { rows: list };
    }

    // 5. SELECT business by slug (strict lookup - no auto-creation)
    if (lowerSql.includes('from businesses') && lowerSql.includes('slug =')) {
      const slug = (params[0] || '').toLowerCase();
      const business = storeMemory.businesses.find(b => (b.slug || '').toLowerCase() === slug);
      return { rows: business ? [business] : [] };
    }

    // 6. SELECT business by id
    if (lowerSql.includes('from businesses') && lowerSql.includes('id =')) {
      const id = Number(params[0]);
      const business = storeMemory.businesses.find(b => b.id === id);
      return { rows: business ? [business] : [] };
    }

    // 7. INSERT business
    if (lowerSql.includes('insert into businesses')) {
      const [user_id, name, category, tone_default, google_review_link, city, state, country] = params;
      let slug = generateSlug(name);
      if (storeMemory.businesses.some(b => b.slug === slug)) {
        slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
      }

      const newBiz = {
        id: storeMemory.business_id_seq++,
        user_id: Number(user_id),
        name,
        category,
        slug,
        tone_default: tone_default || 'friendly',
        google_review_link: google_review_link || 'https://search.google.com/local/writereview',
        city: city || '',
        state: state || '',
        country: country || '',
        created_at: new Date().toISOString()
      };
      storeMemory.businesses.push(newBiz);
      saveStore(storeMemory);
      return { rows: [newBiz] };
    }

    // 8. INSERT private_feedback
    if (lowerSql.includes('insert into private_feedback')) {
      const [business_id, customer_name, customer_phone, rating, message] = params;
      const newFeedback = {
        id: storeMemory.feedback_id_seq++,
        business_id: Number(business_id),
        customer_name: customer_name || 'Anonymous Customer',
        customer_phone: customer_phone || '',
        rating: Number(rating),
        message,
        created_at: new Date().toISOString()
      };
      storeMemory.private_feedbacks.push(newFeedback);
      saveStore(storeMemory);
      return { rows: [newFeedback] };
    }

    // 9. SELECT private_feedback for business
    if (lowerSql.includes('from private_feedback')) {
      const bizId = Number(params[0]);
      const list = storeMemory.private_feedbacks.filter(f => f.business_id === bizId);
      return { rows: list };
    }

    // 10. INSERT review
    if (lowerSql.includes('insert into reviews_replied')) {
      const [business_id, customer_name, rating, review_text, selected_reply, status, tone] = params;
      const newRev = {
        id: storeMemory.review_id_seq++,
        business_id: Number(business_id),
        customer_name,
        rating: Number(rating),
        review_text,
        selected_reply,
        status: status || 'drafted',
        tone,
        created_at: new Date().toISOString()
      };
      storeMemory.reviews_replied.push(newRev);
      saveStore(storeMemory);
      return { rows: [newRev] };
    }

    // 11. SELECT reviews for business / combined history query
    if (lowerSql.includes('from reviews_replied') && lowerSql.includes('join businesses')) {
      const revId = Number(params[0]);
      const userId = Number(params[1]);
      const rev = storeMemory.reviews_replied.find(r => r.id === revId);
      if (rev) {
        const biz = storeMemory.businesses.find(b => b.id === rev.business_id && b.user_id === userId);
        if (biz) return { rows: [{ business_id: biz.id }] };
      }
      return { rows: [] };
    }

    if (lowerSql.includes('from reviews_replied')) {
      const bizId = Number(params[0]);
      const list = storeMemory.reviews_replied.filter(r => r.business_id === bizId).map(r => ({
        id: r.id,
        business_id: r.business_id,
        type: 'reply',
        customer_name: r.customer_name,
        review_text: r.review_text,
        selected_text: r.selected_reply,
        rating: r.rating,
        tone: r.tone,
        status: r.status || 'drafted',
        created_at: r.created_at
      }));
      return { rows: list };
    }

    // 12. UPDATE / DELETE reviews_replied
    if (lowerSql.includes('update reviews_replied')) {
      const itemId = Number(params[1]);
      const rev = storeMemory.reviews_replied.find(r => r.id === itemId);
      if (rev) {
        if (lowerSql.includes('set status =')) rev.status = params[0];
        if (lowerSql.includes('set selected_reply =')) {
          rev.selected_reply = params[0];
          rev.status = 'edited';
        }
        saveStore(storeMemory);
        return { rows: [rev] };
      }
      return { rows: [] };
    }

    if (lowerSql.includes('delete from reviews_replied')) {
      const itemId = Number(params[0]);
      storeMemory.reviews_replied = storeMemory.reviews_replied.filter(r => r.id !== itemId);
      saveStore(storeMemory);
      return { rows: [] };
    }

    // 13. generation_log mock
    if (lowerSql.includes('generation_log')) {
      return { rows: [{ count: 0, id: 1 }] };
    }

    // 14. INSERT payment
    if (lowerSql.includes('insert into payments')) {
      const [user_id, order_id, amount, plan, status] = params;
      const newPay = {
        id: storeMemory.payment_id_seq++,
        user_id: Number(user_id),
        order_id,
        payment_id: null,
        amount: Number(amount),
        plan,
        status: status || 'created',
        created_at: new Date().toISOString()
      };
      storeMemory.payments.push(newPay);
      saveStore(storeMemory);
      return { rows: [newPay] };
    }

    // 13. UPDATE users subscription
    if (lowerSql.includes('update users')) {
      const plan = params[0];
      const userId = Number(params[1]);
      const user = storeMemory.users.find(u => u.id === userId);
      if (user) {
        user.subscription_plan = plan;
        const months = plan === '12_months' ? 12 : plan === '6_months' ? 6 : 1;
        const exp = new Date();
        exp.setMonth(exp.getMonth() + months);
        user.subscription_expires_at = exp.toISOString();
        saveStore(storeMemory);
        return { rows: [user] };
      }
      return { rows: [] };
    }

    // 14. UPDATE payments
    if (lowerSql.includes('update payments')) {
      const [payment_id, order_id, user_id] = params;
      const pay = storeMemory.payments.find(p => p.order_id === order_id);
      if (pay) {
        pay.payment_id = payment_id;
        pay.status = 'captured';
        saveStore(storeMemory);
        return { rows: [pay] };
      }
      return { rows: [] };
    }

    // 15. pending_accounts handlers
    if (lowerSql.includes('insert into pending_accounts')) {
      const [email, phone, password, business_name, plan, amount, order_id, coupon_code, status] = params;
      const newAcc = {
        id: storeMemory.pending_id_seq++,
        email: (email || '').trim().toLowerCase(),
        phone: (phone || '').trim(),
        password: password || '',
        business_name: business_name || '',
        plan: plan || '1_month',
        amount: Number(amount || 0),
        order_id,
        payment_id: null,
        signature: null,
        coupon_code: coupon_code || null,
        status: status || 'paid_pending_manual_approval',
        created_at: new Date().toISOString()
      };
      if (!storeMemory.pending_accounts) storeMemory.pending_accounts = [];
      storeMemory.pending_accounts.push(newAcc);
      saveStore(storeMemory);
      return { rows: [newAcc] };
    }

    if (lowerSql.includes('from pending_accounts')) {
      if (!storeMemory.pending_accounts) storeMemory.pending_accounts = [];
      let list = [...storeMemory.pending_accounts];
      if (lowerSql.includes('email =')) {
        const email = (params[0] || '').trim().toLowerCase();
        list = list.filter(p => p.email.toLowerCase() === email);
      }
      if (lowerSql.includes('order_id =')) {
        const orderId = params[0];
        list = list.filter(p => p.order_id === orderId);
      }
      if (lowerSql.includes('status =')) {
        const st = params[0];
        list = list.filter(p => p.status === st);
      }
      return { rows: list };
    }

    if (lowerSql.includes('update pending_accounts')) {
      if (!storeMemory.pending_accounts) storeMemory.pending_accounts = [];
      const [payment_id, signature, status, order_id] = params;
      const item = storeMemory.pending_accounts.find(p => p.order_id === order_id);
      if (item) {
        item.payment_id = payment_id;
        item.signature = signature;
        item.status = status;
        saveStore(storeMemory);
        return { rows: [item] };
      }
      return { rows: [] };
    }
  } catch (err) {
    if (err.code === '23505') throw err;
    console.error('JS Store query execution error:', err);
  }

  return { rows: [] };
}

let pgTested = false;

async function checkPg() {
  if (pgTested) return usePostgres;
  pgTested = true;
  if (!usePostgres || !pool) {
    usePostgres = false;
    return false;
  }
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS pending_accounts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        password TEXT NOT NULL,
        business_name VARCHAR(255) DEFAULT '',
        plan TEXT NOT NULL,
        amount INTEGER NOT NULL,
        order_id TEXT UNIQUE NOT NULL,
        payment_id TEXT,
        signature TEXT,
        coupon_code TEXT,
        status VARCHAR(50) DEFAULT 'paid_pending_manual_approval',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    client.release();
    usePostgres = true;
  } catch (err) {
    console.warn('PostgreSQL unavailable, using Pure JS Store Engine fallback:', err.message);
    usePostgres = false;
  }
  return usePostgres;
}

export async function query(text, params = []) {
  const isPgAvailable = await checkPg();
  if (isPgAvailable && pool) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.warn('PostgreSQL query failed, falling back to Pure JS Store Engine:', err.message);
      return runJsQuery(text, params);
    }
  }
  return runJsQuery(text, params);
}

export default pool;
