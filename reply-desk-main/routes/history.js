import express from 'express';
import { query } from '../db.js';
import { authMiddleware, verifyBusinessOwnership, verifyHistoryOwnership } from '../auth.js';

const router = express.Router();

router.use(authMiddleware);

// GET /api/v1/businesses/:id/history
router.get('/businesses/:id/history', async (req, res) => {
  try {
    const userId = req.userId;
    const businessId = parseInt(req.params.id, 10);

    if (isNaN(businessId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid Business ID' });
    }

    // Verify business ownership
    try {
      await verifyBusinessOwnership(businessId, userId);
    } catch (authErr) {
      return res.status(authErr.status || 403).json({ error: authErr.errorType || 'forbidden', message: authErr.message });
    }

    // Parse pagination parameters
    let limit = 10;
    let offset = 0;

    const limitQuery = parseInt(req.query.limit, 10);
    const offsetQuery = parseInt(req.query.offset, 10);

    if (!isNaN(limitQuery) && limitQuery > 0) {
      limit = limitQuery;
    }
    if (!isNaN(offsetQuery) && offsetQuery >= 0) {
      offset = offsetQuery;
    }

    // Get combined history from replies and reviews drafted
    const historyQuery = `
      SELECT id, business_id, 'reply' as type, customer_name, review_text, selected_reply as selected_text, rating, tone, status, '' as liked, '' as disliked, created_at
      FROM reviews_replied
      WHERE business_id = $1
      UNION ALL
      SELECT id, business_id, 'review' as type, '' as customer_name, '' as review_text, selected_review as selected_text, rating, tone, status, liked, disliked, created_at
      FROM reviews_drafted
      WHERE business_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const historyResult = await query(historyQuery, [businessId, limit, offset]);

    // Get daily count for pacing warning
    const countResult = await query(
      "SELECT COUNT(*) FROM generation_log WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'",
      [businessId]
    );
    const dailyCount = parseInt(countResult.rows[0].count, 10);

    return res.status(200).json({
      history: historyResult.rows,
      pacing_warning: dailyCount >= 3,
      daily_count: dailyCount
    });

  } catch (err) {
    console.error('Get history error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to retrieve business history' });
  }
});

// PUT /api/v1/history/:type/:id/status
router.put('/history/:type/:id/status', async (req, res) => {
  try {
    const userId = req.userId;
    const { type, id } = req.params;
    const itemId = parseInt(id, 10);
    const { status } = req.body;

    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid item ID' });
    }

    const cleanStatus = (status || '').trim().toLowerCase();
    if (cleanStatus !== 'drafted' && cleanStatus !== 'edited' && cleanStatus !== 'posted') {
      return res.status(400).json({ error: 'bad_request', message: 'Status must be drafted, edited, or posted' });
    }

    if (type !== 'reply' && type !== 'review') {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid flow type (must be reply or review)' });
    }

    // Verify ownership of the item
    let businessId;
    try {
      businessId = await verifyHistoryOwnership(type, itemId, userId);
    } catch (authErr) {
      return res.status(authErr.status || 403).json({ error: authErr.errorType || 'forbidden', message: authErr.message });
    }

    // Perform update
    let updateQuery = '';
    if (type === 'reply') {
      updateQuery = `UPDATE reviews_replied SET status = $1 WHERE id = $2 AND business_id = $3`;
    } else {
      updateQuery = `UPDATE reviews_drafted SET status = $1 WHERE id = $2 AND business_id = $3`;
    }

    const result = await query(updateQuery, [cleanStatus, itemId, businessId]);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Update status error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to update status' });
  }
});

// PUT /api/v1/history/:type/:id/text
router.put('/history/:type/:id/text', async (req, res) => {
  try {
    const userId = req.userId;
    const { type, id } = req.params;
    const itemId = parseInt(id, 10);
    const { text } = req.body;

    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid item ID' });
    }

    const cleanText = (text || '').trim();
    if (!cleanText) {
      return res.status(400).json({ error: 'bad_request', message: 'Content text cannot be empty' });
    }

    if (type !== 'reply' && type !== 'review') {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid flow type (must be reply or review)' });
    }

    // Verify ownership of the item
    let businessId;
    try {
      businessId = await verifyHistoryOwnership(type, itemId, userId);
    } catch (authErr) {
      return res.status(authErr.status || 403).json({ error: authErr.errorType || 'forbidden', message: authErr.message });
    }

    // Perform update
    let updateQuery = '';
    if (type === 'reply') {
      updateQuery = `UPDATE reviews_replied SET selected_reply = $1, status = 'edited' WHERE id = $2 AND business_id = $3`;
    } else {
      updateQuery = `UPDATE reviews_drafted SET selected_review = $1, status = 'edited' WHERE id = $2 AND business_id = $3`;
    }

    await query(updateQuery, [cleanText, itemId, businessId]);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Update text error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to update content' });
  }
});

// DELETE /api/v1/history/:type/:id
router.delete('/history/:type/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const { type, id } = req.params;
    const itemId = parseInt(id, 10);

    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid item ID' });
    }

    if (type !== 'reply' && type !== 'review') {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid flow type (must be reply or review)' });
    }

    // Verify ownership of the item
    let businessId;
    try {
      businessId = await verifyHistoryOwnership(type, itemId, userId);
    } catch (authErr) {
      return res.status(authErr.status || 403).json({ error: authErr.errorType || 'forbidden', message: authErr.message });
    }

    // Perform delete
    let deleteQuery = '';
    if (type === 'reply') {
      deleteQuery = `DELETE FROM reviews_replied WHERE id = $1 AND business_id = $2`;
    } else {
      deleteQuery = `DELETE FROM reviews_drafted WHERE id = $1 AND business_id = $2`;
    }

    await query(deleteQuery, [itemId, businessId]);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Delete history error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to delete history record' });
  }
});

export default router;
