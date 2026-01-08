const express = require('express');
const { query } = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Get Power Automate configuration (HR only)
router.get('/config', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const result = await query(
      'SELECT id, webhook_url, is_active, created_at, updated_at FROM power_automate_config WHERE company_id = $1',
      [req.user.company_id]
    );

    if (result.rows.length === 0) {
      return res.json({ config: null });
    }

    res.json({ config: result.rows[0] });
  } catch (error) {
    console.error('Get Power Automate config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update Power Automate configuration (HR only)
router.post('/config', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { webhook_url, is_active } = req.body;

    if (!webhook_url) {
      return res.status(400).json({ error: 'webhook_url is required' });
    }

    // Validate webhook URL format
    try {
      new URL(webhook_url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid webhook URL format' });
    }

    // Check if config already exists
    const existingResult = await query(
      'SELECT id FROM power_automate_config WHERE company_id = $1',
      [req.user.company_id]
    );

    if (existingResult.rows.length > 0) {
      // Update existing config
      const result = await query(
        `UPDATE power_automate_config 
         SET webhook_url = $1, is_active = $2, updated_at = NOW()
         WHERE company_id = $3
         RETURNING id, webhook_url, is_active, created_at, updated_at`,
        [webhook_url, is_active !== undefined ? is_active : true, req.user.company_id]
      );

      res.json({ config: result.rows[0], created: false });
    } else {
      // Create new config
      const result = await query(
        `INSERT INTO power_automate_config (company_id, webhook_url, is_active)
         VALUES ($1, $2, $3)
         RETURNING id, webhook_url, is_active, created_at, updated_at`,
        [req.user.company_id, webhook_url, is_active !== undefined ? is_active : true]
      );

      res.status(201).json({ config: result.rows[0], created: true });
    }
  } catch (error) {
    console.error('Create/Update Power Automate config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test Power Automate connection (HR only)
router.post('/test', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { sendTemplatedEmail } = require('../services/powerAutomateService');

    // Send a test email
    const testResult = await sendTemplatedEmail(
      req.user.company_id,
      req.user.email,
      'kpi_assigned',
      {
        employeeName: 'Test User',
        managerName: req.user.name,
        link: process.env.FRONTEND_URL || 'http://localhost:5173',
      }
    );

    if (testResult.success) {
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      res.status(500).json({ success: false, error: testResult.error || 'Failed to send test email' });
    }
  } catch (error) {
    console.error('Test Power Automate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

