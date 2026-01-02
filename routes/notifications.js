const express = require('express');
const { query } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all notifications for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { read, limit = 50, type } = req.query;

    let queryText = `
      SELECT n.*, 
       k.title as kpi_title,
       k.quarter as kpi_quarter,
       k.year as kpi_year,
       k.period as kpi_period,
       e.name as employee_name,
       m.name as manager_name,
       kr.id as review_id,
       kr.review_status
       FROM notifications n
       LEFT JOIN kpis k ON n.related_kpi_id = k.id
       LEFT JOIN kpi_reviews kr ON n.related_review_id = kr.id
       LEFT JOIN users e ON k.employee_id = e.id
       LEFT JOIN users m ON k.manager_id = m.id
       WHERE n.recipient_id = $1
    `;

    const params = [req.user.id];
    let paramIndex = 2;

    if (read !== undefined) {
      queryText += ` AND n.read = $${paramIndex}`;
      params.push(read === 'true');
      paramIndex++;
    }

    if (type) {
      queryText += ` AND n.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    queryText += ` ORDER BY n.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await query(queryText, params);

    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent activity (last 10 notifications)
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT n.*, 
       k.title as kpi_title,
       k.quarter as kpi_quarter,
       k.year as kpi_year,
       e.name as employee_name,
       m.name as manager_name
       FROM notifications n
       LEFT JOIN kpis k ON n.related_kpi_id = k.id
       LEFT JOIN users e ON k.employee_id = e.id
       LEFT JOIN users m ON k.manager_id = m.id
       WHERE n.recipient_id = $1
       ORDER BY n.created_at DESC
       LIMIT 10`,
      [req.user.id]
    );

    res.json({ activities: result.rows });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE notifications SET read = true WHERE id = $1 AND recipient_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification: result.rows[0] });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET read = true WHERE recipient_id = $1 AND read = false',
      [req.user.id]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread notification count
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND read = false',
      [req.user.id]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

