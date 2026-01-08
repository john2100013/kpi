import BaseController from './BaseController.js';
import { query } from '../database/db.js';

class SettingsController extends BaseController {
  // ========== KPI Period Settings ==========

  // Get all period settings for company
  async getPeriodSettings(req, res) {
    const result = await query(
      `SELECT 
        id, company_id, period_type, quarter, year, is_active, created_at, updated_at,
        to_char(start_date, 'YYYY-MM-DD') as start_date,
        to_char(end_date, 'YYYY-MM-DD') as end_date
       FROM kpi_period_settings 
       WHERE company_id = $1 
       ORDER BY year DESC, period_type, quarter`,
      [req.user.company_id]
    );
    
    return this.success(res, { settings: result.rows });
  }

  // Create or update period setting
  async savePeriodSetting(req, res) {
    const { id, period_type, quarter, year, start_date, end_date, is_active } = req.body;

    // Validate required fields
    if (!period_type || !year) {
      return this.validationError(res, 'period_type and year are required');
    }

    if (!start_date || !end_date) {
      return this.validationError(res, 'start_date and end_date are required');
    }

    // Validate date format (should be YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start_date)) {
      return this.validationError(res, 'start_date must be in YYYY-MM-DD format');
    }
    if (!dateRegex.test(end_date)) {
      return this.validationError(res, 'end_date must be in YYYY-MM-DD format');
    }

    if (period_type === 'quarterly' && !quarter) {
      return this.validationError(res, 'quarter is required for quarterly period');
    }

    let result;
    
    // If id is provided, update the specific record
    if (id) {
      // Verify the record exists and belongs to the company
      const checkResult = await query(
        'SELECT id FROM kpi_period_settings WHERE id = $1 AND company_id = $2',
        [id, req.user.company_id]
      );

      if (checkResult.rows.length === 0) {
        return this.notFound(res, 'Period setting not found or access denied');
      }

      // Update existing record
      result = await query(
        `UPDATE kpi_period_settings 
         SET period_type = $1, quarter = $2, year = $3, start_date = $4, end_date = $5, is_active = $6, updated_at = NOW()
         WHERE id = $7 AND company_id = $8
         RETURNING *`,
        [period_type, quarter || null, year, start_date, end_date, is_active !== false, id, req.user.company_id]
      );
    } else {
      // Check if setting already exists (for create)
      const existingResult = await query(
        `SELECT id FROM kpi_period_settings 
         WHERE company_id = $1 AND period_type = $2 AND year = $3 
         AND (quarter = $4 OR (quarter IS NULL AND $4 IS NULL))`,
        [req.user.company_id, period_type, year, quarter || null]
      );

      if (existingResult.rows.length > 0) {
        // Update existing record found by period_type, year, quarter
        result = await query(
          `UPDATE kpi_period_settings 
           SET period_type = $1, quarter = $2, year = $3, start_date = $4, end_date = $5, is_active = $6, updated_at = NOW()
           WHERE id = $7
           RETURNING *`,
          [period_type, quarter || null, year, start_date, end_date, is_active !== false, existingResult.rows[0].id]
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
    }

    if (result.rows.length === 0) {
      return this.error(res, 'Failed to save period setting', 500);
    }

    // Query again with to_char to get properly formatted dates
    const formattedResult = await query(
      `SELECT 
        id, company_id, period_type, quarter, year, is_active, created_at, updated_at,
        to_char(start_date, 'YYYY-MM-DD') as start_date,
        to_char(end_date, 'YYYY-MM-DD') as end_date
       FROM kpi_period_settings 
       WHERE id = $1`,
      [result.rows[0].id]
    );

    return this.success(res, { setting: formattedResult.rows[0] });
  }

  // Delete period setting
  async deletePeriodSetting(req, res) {
    const { id } = req.params;

    // Verify setting belongs to company
    const checkResult = await query(
      'SELECT id FROM kpi_period_settings WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (checkResult.rows.length === 0) {
      return this.notFound(res, 'Setting not found');
    }

    await query('DELETE FROM kpi_period_settings WHERE id = $1', [id]);
    return this.success(res, { message: 'Setting deleted successfully' });
  }

  // Get available KPI periods for managers/employees (active periods only)
  async getAvailablePeriods(req, res) {
    const { period_type } = req.query;
    
    let queryText = `
      SELECT 
        id, company_id, period_type, quarter, year, is_active, created_at, updated_at,
        to_char(start_date, 'YYYY-MM-DD') as start_date,
        to_char(end_date, 'YYYY-MM-DD') as end_date
      FROM kpi_period_settings 
      WHERE company_id = $1 AND is_active = true
    `;
    const params = [req.user.company_id];
    
    if (period_type) {
      queryText += ` AND period_type = $2`;
      params.push(period_type);
    }
    
    queryText += ` ORDER BY year DESC, period_type, quarter`;
    
    const result = await query(queryText, params);
    return this.success(res, { periods: result.rows });
  }

  // ========== Reminder Settings ==========

  // Get all reminder settings for company
  async getReminderSettings(req, res) {
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
    return this.success(res, { settings: result.rows });
  }

  // Create or update reminder setting
  async saveReminderSetting(req, res) {
    const { reminder_type, period_type, reminder_number, reminder_days_before, reminder_label, is_active } = req.body;

    if (!reminder_type || !reminder_number || reminder_days_before === undefined) {
      return this.validationError(res, 'reminder_type, reminder_number, and reminder_days_before are required');
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

    return this.success(res, { setting: result.rows[0] });
  }

  // Delete reminder setting
  async deleteReminderSetting(req, res) {
    const { id } = req.params;

    // Verify setting belongs to company
    const checkResult = await query(
      'SELECT id FROM reminder_settings WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (checkResult.rows.length === 0) {
      return this.notFound(res, 'Setting not found');
    }

    await query('DELETE FROM reminder_settings WHERE id = $1', [id]);
    return this.success(res, { message: 'Setting deleted successfully' });
  }

  // ========== Daily Reminder Settings ==========

  // Get daily reminder settings for company
  async getDailyReminderSettings(req, res) {
    const result = await query(
      `SELECT * FROM kpi_setting_daily_reminder_settings WHERE company_id = $1`,
      [req.user.company_id]
    );

    if (result.rows.length === 0) {
      // Return default if not set
      return this.success(res, { 
        setting: { 
          company_id: req.user.company_id, 
          send_daily_reminders: false, 
          days_before_meeting: 3 
        } 
      });
    }

    return this.success(res, { setting: result.rows[0] });
  }

  // Create or update daily reminder settings
  async saveDailyReminderSettings(req, res) {
    const { send_daily_reminders, days_before_meeting, cc_emails } = req.body;

    // Validate CC emails format (comma-separated)
    let ccEmailsValue = null;
    if (cc_emails && typeof cc_emails === 'string' && cc_emails.trim()) {
      // Basic email validation
      const emails = cc_emails.split(',').map(e => e.trim()).filter(e => e);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emails.filter(e => !emailRegex.test(e));
      if (invalidEmails.length > 0) {
        return this.validationError(res, `Invalid email addresses: ${invalidEmails.join(', ')}`);
      }
      ccEmailsValue = emails.join(', ');
    }

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
         SET send_daily_reminders = $1, days_before_meeting = $2, cc_emails = $3, updated_at = NOW()
         WHERE company_id = $4
         RETURNING *`,
        [send_daily_reminders !== false, days_before_meeting || 3, ccEmailsValue, req.user.company_id]
      );
    } else {
      // Create
      result = await query(
        `INSERT INTO kpi_setting_daily_reminder_settings 
         (company_id, send_daily_reminders, days_before_meeting, cc_emails)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [req.user.company_id, send_daily_reminders !== false, days_before_meeting || 3, ccEmailsValue]
      );
    }

    return this.success(res, { setting: result.rows[0] });
  }

  // Get HR email notification settings
  async getHREmailNotifications(req, res) {
    const result = await query(
      'SELECT receive_email_notifications FROM hr_email_notification_settings WHERE company_id = $1',
      [req.user.company_id]
    );

    if (result.rows.length === 0) {
      // Default to true if no setting exists
      return this.success(res, { setting: { receive_email_notifications: true } });
    }

    return this.success(res, { setting: result.rows[0] });
  }

  // Update HR email notification settings
  async saveHREmailNotifications(req, res) {
    const { receive_email_notifications } = req.body;

    if (typeof receive_email_notifications !== 'boolean') {
      return this.validationError(res, 'receive_email_notifications must be a boolean');
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

    return this.success(res, { setting: result.rows[0] });
  }
}

export default new SettingsController();
