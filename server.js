import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import businessRoutes from './routes/businesses.js';
import repliesRoutes from './routes/replies.js';
import reviewsRoutes from './routes/reviews.js';
import historyRoutes from './routes/history.js';
import qrRoutes from './routes/qr.js';
import insightsRoutes from './routes/insights.js';
import publicRoutes from './routes/public.js';
import paymentRoutes from './routes/payments.js';
import reviewAcquisitionRoutes from './routes/reviewAcquisition.js';
import { createPublicOrder, verifyPublicPayment } from './routes/publicPayments.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS with support for rev.scalezix.com
const allowedOrigins = [
  'https://rev.scalezix.com',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.scalezix.com') || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive for production web access
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());

// System Health Check Endpoint
app.get('/api/v1/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'Reply Desk API',
    domain: 'rev.scalezix.com',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// ── PUBLIC PAYMENT ROUTES (no auth) ──────────────────────────────────────────
// Registered directly on app BEFORE paymentRoutes so authMiddleware never fires
app.options('/api/v1/payments/create-public-order', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.sendStatus(204);
});
app.post('/api/v1/payments/create-public-order', createPublicOrder);

app.options('/api/v1/payments/verify-public-payment', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.sendStatus(204);
});
app.post('/api/v1/payments/verify-public-payment', verifyPublicPayment);

// ── AUTHENTICATED API ROUTES ──────────────────────────────────────────────────
// API Routes (reviewAcquisitionRoutes first for /api/v1/public/business/:slug)
app.use('/api/v1', reviewAcquisitionRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/businesses', businessRoutes);
app.use('/api/v1/replies', repliesRoutes);
app.use('/api/v1/reviews', reviewsRoutes);
app.use('/api/v1', historyRoutes); // history.js contains /businesses/:id/history and /history/* routes
app.use('/api/v1/qr', qrRoutes);
app.use('/api/v1/insights', insightsRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/payments', paymentRoutes);


// Static file serving from ./web
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'web')));

// SPA Fallback for client routes
app.get('*', (req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
  } else {
    next();
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'server_error', message: 'An unexpected error occurred' });
});

// Export app for Vercel Serverless environment
export default app;

// Run server locally if executed directly
const isMain = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(__filename) ||
  path.resolve(process.argv[1]).replace(/\.[jt]s$/, '') === path.resolve(__filename).replace(/\.[jt]s$/, '')
);

if (isMain) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server starting on port ${PORT} (bound to 0.0.0.0)...`);
  });
}
