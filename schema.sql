-- RevmeAI Full Production Database Schema for Supabase

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  subscription_plan TEXT DEFAULT NULL,
  subscription_expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  tone_default VARCHAR(50) DEFAULT 'friendly',
  google_review_link VARCHAR(555) DEFAULT '',
  city VARCHAR(100) DEFAULT '',
  state VARCHAR(100) DEFAULT '',
  country VARCHAR(100) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews_replied (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_name VARCHAR(255),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  selected_reply TEXT,
  status VARCHAR(50) DEFAULT 'drafted',
  tone VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews_drafted (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  liked TEXT,
  disliked TEXT,
  selected_review TEXT,
  status VARCHAR(50) DEFAULT 'drafted',
  tone VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS private_feedback (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  customer_name TEXT DEFAULT 'Anonymous',
  customer_phone TEXT DEFAULT '',
  rating INTEGER DEFAULT 2,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending',
  order_id TEXT,
  payment_id TEXT,
  signature TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS google_posts (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  post_type TEXT DEFAULT 'update',
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generation_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  flow_type VARCHAR(50) DEFAULT 'reply',
  action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_qr_campaigns (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES prompt_templates(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  campaign_type VARCHAR(50) DEFAULT 'store',
  token VARCHAR(50) UNIQUE NOT NULL,
  campaign_slug VARCHAR(100) UNIQUE,
  behavior VARCHAR(50) DEFAULT 'internal',
  is_active BOOLEAN DEFAULT TRUE,
  review_style VARCHAR(50) DEFAULT 'friendly',
  review_length VARCHAR(50) DEFAULT 'medium',
  expires_at TIMESTAMPTZ,
  scan_limit INTEGER DEFAULT 0,
  review_limit INTEGER DEFAULT 0,
  language VARCHAR(10) DEFAULT 'en',
  theme VARCHAR(50) DEFAULT 'light',
  qr_logo TEXT,
  qr_color VARCHAR(50) DEFAULT '#000000',
  qr_background VARCHAR(50) DEFAULT '#FFFFFF',
  frame_style VARCHAR(50) DEFAULT 'none',
  button_color VARCHAR(50) DEFAULT '#2563EB',
  welcome_title VARCHAR(255),
  welcome_subtitle VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_qr_scans (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES review_qr_campaigns(id) ON DELETE CASCADE,
  ip_hash VARCHAR(64) NOT NULL,
  browser_fingerprint VARCHAR(64),
  device_type VARCHAR(50),
  browser VARCHAR(50),
  city VARCHAR(100),
  country VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_reviews (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES review_qr_campaigns(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  ai_suggestion TEXT,
  final_review TEXT,
  status VARCHAR(50) DEFAULT 'submitted',
  is_edited BOOLEAN DEFAULT FALSE,
  generation_history JSONB,
  time_to_complete INTEGER,
  ip_hash VARCHAR(64) NOT NULL,
  browser_fingerprint VARCHAR(64),
  device_type VARCHAR(50),
  browser VARCHAR(50),
  city VARCHAR(100),
  country VARCHAR(100),
  business_reply TEXT,
  reply_created_at TIMESTAMPTZ,
  reply_updated_at TIMESTAMPTZ,
  reply_ai_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_ai_insights (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  period VARCHAR(20) DEFAULT 'weekly',
  start_date DATE,
  end_date DATE,
  insights JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON reviews_replied(business_id);
CREATE INDEX IF NOT EXISTS idx_feedback_business_id ON private_feedback(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_gen_log_user_id ON generation_log(user_id);
