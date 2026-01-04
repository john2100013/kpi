const express = require('express');
const { query } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get rating options for company
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM rating_options 
       WHERE company_id = $1 AND is_active = true 
       ORDER BY display_order, rating_value`,
      [req.user.company_id]
    );
    res.json({ rating_options: result.rows });
  } catch (error) {
    console.error('Get rating options error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

