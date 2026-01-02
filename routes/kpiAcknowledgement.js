const express = require('express');
const { query } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail, emailTemplates } = require('../services/emailService');
const router = express.Router();

// Acknowledge KPI (Employee)
router.post('/:kpiId', authenticateToken, async (req, res) => {
  try {
    const { kpiId } = req.params;
    const { employee_signature } = req.body;

    if (!employee_signature) {
      return res.status(400).json({ error: 'Employee signature is required' });
    }

    // Get KPI
    const kpiResult = await query(
      `SELECT k.*, e.name as employee_name, e.email as employee_email,
       m.name as manager_name, m.email as manager_email
       FROM kpis k
       JOIN users e ON k.employee_id = e.id
       JOIN users m ON k.manager_id = m.id
       WHERE k.id = $1`,
      [kpiId]
    );

    if (kpiResult.rows.length === 0) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    const kpi = kpiResult.rows[0];

    // Verify employee owns this KPI
    if (req.user.role !== 'employee' || kpi.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update KPI with employee signature
    const result = await query(
      `UPDATE kpis 
       SET employee_signature = $1, employee_signed_at = NOW(), status = 'acknowledged', updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [employee_signature, kpiId]
    );

    const updatedKPI = result.rows[0];

    // Send email notification to manager
    await sendEmail(
      kpi.manager_email,
      'KPI Acknowledged',
      emailTemplates.kpiAcknowledged(kpi.manager_name, kpi.employee_name)
    );

    // Create in-app notification for manager
    await query(
      `INSERT INTO notifications (recipient_id, message, type, related_kpi_id)
       VALUES ($1, $2, $3, $4)`,
      [
        kpi.manager_id,
        `${kpi.employee_name} has acknowledged the assigned KPIs`,
        'kpi_acknowledged',
        kpiId,
      ]
    );

    // Notify HR
    const hrUsers = await query("SELECT id FROM users WHERE role = 'hr'");
    for (const hr of hrUsers.rows) {
      await query(
        `INSERT INTO notifications (recipient_id, message, type, related_kpi_id)
         VALUES ($1, $2, $3, $4)`,
        [
          hr.id,
          `${kpi.employee_name} has acknowledged KPIs set by ${kpi.manager_name}`,
          'kpi_acknowledged',
          kpiId,
        ]
      );
    }

    res.json({ kpi: updatedKPI });
  } catch (error) {
    console.error('Acknowledge KPI error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

