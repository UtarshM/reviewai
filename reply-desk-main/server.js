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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/businesses', businessRoutes);
app.use('/api/v1/replies', repliesRoutes);
app.use('/api/v1/reviews', reviewsRoutes);
app.use('/api/v1', historyRoutes); // history.js contains /businesses/:id/history and /history/* routes
app.use('/api/v1/qr', qrRoutes);
app.use('/api/v1/insights', insightsRoutes);
app.use('/api/v1/public', publicRoutes);

// Static file serving from ./web
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'web')));

// SPA Routing fallback: redirect all non-API GET requests to index.html
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
  app.listen(PORT, () => {
    console.log(`Server starting on port ${PORT}...`);
  });
}
