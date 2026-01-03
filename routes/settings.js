const express = require('express');
const { query } = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// ========== KPI Period Settings ==========

// Get all period settings for company
router.get('/period-settings', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM kpi_period_settings 
       WHERE company_id = $1 
       ORDER BY year DESC, period_type, quarter`,
      [req.user.company_id]
    );
    res.json({ settings: result.rows });
  } catch (error) {
    console.error('Get period settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update period setting
router.post('/period-settings', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { period_type, quarter, year, start_date, end_date, is_active } = req.body;

    if (!period_type || !year || !start_date || !end_date) {
      return res.status(400).json({ error: 'period_type, year, start_date, and end_date are required' });
    }

    if (period_type === 'quarterly' && !quarter) {
      return res.status(400).json({ error: 'quarter is required for quarterly period' });
    }

    // Check if setting already exists
    const existingResult = await query(
      `SELECT id FROM kpi_period_settings 
       WHERE company_id = $1 AND period_type = $2 AND year = $3 
       AND (quarter = $4 OR (quarter IS NULL AND $4 IS NULL))`,
      [req.user.company_id, period_type, year, quarter || null]
    );

    let result;
    if (existingResult.rows.length > 0) {
      // Update existing
      result = await query(
        `UPDATE kpi_period_settings 
         SET start_date = $1, end_date = $2, is_active = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [start_date, end_date, is_active !== false, existingResult.rows[0].id]
      );
    } else {
      // Create new
      result = await query(
        `INSERT INTO kpi_period_settings 
         (company_id, period_type, quarter, year, start_date, end_date, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [req.user.company_id, period_type, quarter || null, year, start_date, end_date, is_active !== false]
      );
    }

    res.json({ setting: result.rows[0] });
  } catch (error) {
    console.error('Create/update period setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete period setting
router.delete('/period-settings/:id', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify setting belongs to company
    const checkResult = await query(
      'SELECT id FROM kpi_period_settings WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    await query('DELETE FROM kpi_period_settings WHERE id = $1', [id]);
    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Delete period setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== Reminder Settings ==========

// Get all reminder settings for company
router.get('/reminder-settings', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { reminder_type, period_type } = req.query;
    
    let queryText = `SELECT * FROM reminder_settings WHERE company_id = $1`;
    const params = [req.user.company_id];
    let paramIndex = 2;

    if (reminder_type) {
      queryText += ` AND reminder_type = $${paramIndex}`;
      params.push(reminder_type);
      paramIndex++;
    }

    if (period_type) {
      queryText += ` AND (period_type = $${paramIndex} OR period_type IS NULL)`;
      params.push(period_type);
      paramIndex++;
    }

    queryText += ` ORDER BY reminder_type, period_type, reminder_number`;

    const result = await query(queryText, params);
    res.json({ settings: result.rows });
  } catch (error) {
    console.error('Get reminder settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update reminder setting
router.post('/reminder-settings', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { reminder_type, period_type, reminder_number, reminder_days_before, reminder_label, is_active } = req.body;

    if (!reminder_type || !reminder_number || reminder_days_before === undefined) {
      return res.status(400).json({ error: 'reminder_type, reminder_number, and reminder_days_before are required' });
    }

    // Check if setting already exists
    const existingResult = await query(
      `SELECT id FROM reminder_settings 
       WHERE company_id = $1 AND reminder_type = $2 
       AND (period_type = $3 OR (period_type IS NULL AND $3 IS NULL))
       AND reminder_number = $4`,
      [req.user.company_id, reminder_type, period_type || null, reminder_number]
    );

    let result;
    if (existingResult.rows.length > 0) {
      // Update existing
      result = await query(
        `UPDATE reminder_settings 
         SET reminder_days_before = $1, reminder_label = $2, is_active = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [reminder_days_before, reminder_label || null, is_active !== false, existingResult.rows[0].id]
      );
    } else {
      // Create new
      result = await query(
        `INSERT INTO reminder_settings 
         (company_id, reminder_type, period_type, reminder_number, reminder_days_before, reminder_label, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [req.user.company_id, reminder_type, period_type || null, reminder_number, reminder_days_before, reminder_label || null, is_active !== false]
      );
    }

    res.json({ setting: result.rows[0] });
  } catch (error) {
    console.error('Create/update reminder setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete reminder setting
router.delete('/reminder-settings/:id', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify setting belongs to company
    const checkResult = await query(
      'SELECT id FROM reminder_settings WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    await query('DELETE FROM reminder_settings WHERE id = $1', [id]);
    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Delete reminder setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== Daily Reminder Settings ==========

// Get daily reminder settings for company
router.get('/daily-reminder-settings', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM kpi_setting_daily_reminder_settings WHERE company_id = $1`,
      [req.user.company_id]
    );

    if (result.rows.length === 0) {
      // Return default if not set
      return res.json({ 
        setting: { 
          company_id: req.user.company_id, 
          send_daily_reminders: false, 
          days_before_meeting: 3 
        } 
      });
    }

    res.json({ setting: result.rows[0] });
  } catch (error) {
    console.error('Get daily reminder settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update daily reminder settings
router.post('/daily-reminder-settings', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { send_daily_reminders, days_before_meeting } = req.body;

    // Check if setting exists
    const existingResult = await query(
      'SELECT id FROM kpi_setting_daily_reminder_settings WHERE company_id = $1',
      [req.user.company_id]
    );

    let result;
    if (existingResult.rows.length > 0) {
      // Update
      result = await query(
        `UPDATE kpi_setting_daily_reminder_settings 
         SET send_daily_reminders = $1, days_before_meeting = $2, updated_at = NOW()
         WHERE company_id = $3
         RETURNING *`,
        [send_daily_reminders !== false, days_before_meeting || 3, req.user.company_id]
      );
    } else {
      // Create
      result = await query(
        `INSERT INTO kpi_setting_daily_reminder_settings 
         (company_id, send_daily_reminders, days_before_meeting)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [req.user.company_id, send_daily_reminders !== false, days_before_meeting || 3]
      );
    }

    res.json({ setting: result.rows[0] });
  } catch (error) {
    console.error('Create/update daily reminder settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get HR email notification settings
router.get('/hr-email-notifications', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const result = await query(
      'SELECT receive_email_notifications FROM hr_email_notification_settings WHERE company_id = $1',
      [req.user.company_id]
    );

    if (result.rows.length === 0) {
      // Default to true if no setting exists
      return res.json({ setting: { receive_email_notifications: true } });
    }

    res.json({ setting: result.rows[0] });
  } catch (error) {
    console.error('Get HR email notification settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update HR email notification settings
router.post('/hr-email-notifications', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { receive_email_notifications } = req.body;

    if (typeof receive_email_notifications !== 'boolean') {
      return res.status(400).json({ error: 'receive_email_notifications must be a boolean' });
    }

    // Check if setting exists
    const existingResult = await query(
      'SELECT id FROM hr_email_notification_settings WHERE company_id = $1',
      [req.user.company_id]
    );

    let result;
    if (existingResult.rows.length > 0) {
      // Update existing
      result = await query(
        `UPDATE hr_email_notification_settings 
         SET receive_email_notifications = $1, updated_at = NOW()
         WHERE company_id = $2
         RETURNING *`,
        [receive_email_notifications, req.user.company_id]
      );
    } else {
      // Create new
      result = await query(
        `INSERT INTO hr_email_notification_settings (company_id, receive_email_notifications)
         VALUES ($1, $2)
         RETURNING *`,
        [req.user.company_id, receive_email_notifications]
      );
    }

    res.json({ setting: result.rows[0] });
  } catch (error) {
    console.error('Update HR email notification settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

