import pg from 'pg';
import dotenv from 'dotenv';
import { parse } from 'pg-connection-string';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgres://postgres@localhost:5433/replydesk?sslmode=disable';

// Parse connection options first
const poolOptions = parse(connectionString);

// Enable SSL if connecting to a remote database (like Supabase)
if (connectionString.includes('supabase.com') || connectionString.includes('sslmode=require')) {
  poolOptions.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolOptions);

let migrationPromise = null;

async function runMigrations() {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    const client = await pool.connect();
    try {
      console.log('Running database migrations...');
      const schema = `
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Businesses table
        CREATE TABLE IF NOT EXISTS businesses (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(255) NOT NULL,
          tone_default VARCHAR(50) DEFAULT 'friendly',
          google_review_link VARCHAR(555) DEFAULT '',
          city VARCHAR(100) DEFAULT '',
          state VARCHAR(100) DEFAULT '',
          country VARCHAR(100) DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Ensure columns exist for older databases
        ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_review_link VARCHAR(555) DEFAULT '';
        ALTER TABLE businesses ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT '';
        ALTER TABLE businesses ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT '';
        ALTER TABLE businesses ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT '';

        -- Reviews Replied table
        CREATE TABLE IF NOT EXISTS reviews_replied (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          customer_name VARCHAR(255) NOT NULL,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          review_text TEXT NOT NULL,
          selected_reply TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'drafted',
          tone VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Reviews Drafted table
        CREATE TABLE IF NOT EXISTS reviews_drafted (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          liked TEXT NOT NULL,
          disliked TEXT NOT NULL,
          selected_review TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'drafted',
          tone VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Generation Log table
        CREATE TABLE IF NOT EXISTS generation_log (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          flow_type VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Prompt Templates table
        CREATE TABLE IF NOT EXISTS prompt_templates (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          system_prompt TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- QR Campaigns table
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
          expires_at TIMESTAMP,
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- QR Scans table
        CREATE TABLE IF NOT EXISTS review_qr_scans (
          id SERIAL PRIMARY KEY,
          campaign_id INTEGER NOT NULL REFERENCES review_qr_campaigns(id) ON DELETE CASCADE,
          ip_hash VARCHAR(64) NOT NULL,
          browser_fingerprint VARCHAR(64),
          device_type VARCHAR(50),
          browser VARCHAR(50),
          city VARCHAR(100),
          country VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Customer Reviews table
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
          reply_created_at TIMESTAMP,
          reply_updated_at TIMESTAMP,
          reply_ai_generated BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Ensure columns exist for older databases
        ALTER TABLE customer_reviews ADD COLUMN IF NOT EXISTS business_reply TEXT;
        ALTER TABLE customer_reviews ADD COLUMN IF NOT EXISTS reply_created_at TIMESTAMP;
        ALTER TABLE customer_reviews ADD COLUMN IF NOT EXISTS reply_updated_at TIMESTAMP;
        ALTER TABLE customer_reviews ADD COLUMN IF NOT EXISTS reply_ai_generated BOOLEAN DEFAULT FALSE;


        -- AI Insights table
        CREATE TABLE IF NOT EXISTS review_ai_insights (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          period VARCHAR(20) DEFAULT 'weekly',
          start_date DATE,
          end_date DATE,
          insights JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await client.query(schema);
      console.log('Database schema migrations applied successfully');
    } catch (err) {
      console.error('Database migration failed:', err);
      throw err;
    } finally {
      client.release();
    }
  })();

  return migrationPromise;
}

export async function query(text, params) {
  await runMigrations();
  return pool.query(text, params);
}

export default pool;
