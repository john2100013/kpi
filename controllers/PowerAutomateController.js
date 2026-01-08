import BaseController from './BaseController.js';
import { query } from '../database/db.js';
import { sendTemplatedEmail } from '../services/powerAutomateService.js';
import dotenv from 'dotenv';

dotenv.config();

class PowerAutomateController extends BaseController {
  // Get Power Automate configuration (HR only)
  async getConfig(req, res) {
    const result = await query(
      'SELECT id, webhook_url, is_active, created_at, updated_at FROM power_automate_config WHERE company_id = $1',
      [req.user.company_id]
    );

    if (result.rows.length === 0) {
      return this.success(res, { config: null });
    }

    return this.success(res, { config: result.rows[0] });
  }

  // Create or update Power Automate configuration (HR only)
  async saveConfig(req, res) {
    const { webhook_url, is_active } = req.body;

    if (!webhook_url) {
      return this.validationError(res, 'webhook_url is required');
    }

    // Validate webhook URL format
    try {
      new URL(webhook_url);
    } catch (e) {
      return this.validationError(res, 'Invalid webhook URL format');
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

      return this.success(res, { config: result.rows[0], created: false });
    } else {
      // Create new config
      const result = await query(
        `INSERT INTO power_automate_config (company_id, webhook_url, is_active)
         VALUES ($1, $2, $3)
         RETURNING id, webhook_url, is_active, created_at, updated_at`,
        [req.user.company_id, webhook_url, is_active !== undefined ? is_active : true]
      );

      return this.success(res, { config: result.rows[0], created: true }, 201);
    }
  }

  // Test Power Automate connection (HR only)
  async testConnection(req, res) {
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
      return this.success(res, { success: true, message: 'Test email sent successfully' });
    } else {
      return this.error(res, testResult.error || 'Failed to send test email', 500);
    }
  }
}

export default new PowerAutomateController();
