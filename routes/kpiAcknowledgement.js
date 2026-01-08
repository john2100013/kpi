import express from 'express';
import { query } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendEmailWithFallback, emailTemplates, shouldSendHRNotification, getHREmails } from '../services/emailService.js';
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
       WHERE k.id = $1 AND k.company_id = $2`,
      [kpiId, req.user.company_id]
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

    // Get company_id from KPI (should be available in the query)
    const kpiCompanyId = kpi.company_id || req.user.company_id;
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/manager/kpi-details/${kpiId}`;
    const emailHtml = emailTemplates.kpiAcknowledged(kpi.manager_name, kpi.employee_name, link);

    // Send email notification to manager
    await sendEmailWithFallback(
      kpiCompanyId,
      kpi.manager_email,
      'KPI Acknowledged',
      emailHtml,
      '',
      'kpi_acknowledged',
      {
        managerName: kpi.manager_name,
        employeeName: kpi.employee_name,
        link: link,
      }
    );

    // Send email to HR if enabled
    const hrShouldReceive = await shouldSendHRNotification(kpiCompanyId);
    if (hrShouldReceive) {
      const hrEmails = await getHREmails(kpiCompanyId);
      for (const hrEmail of hrEmails) {
        await sendEmailWithFallback(
          kpiCompanyId,
          hrEmail,
          'KPI Acknowledged',
          emailHtml,
          '',
          'kpi_acknowledged',
          {
            managerName: kpi.manager_name,
            employeeName: kpi.employee_name,
            link: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/hr/kpi-details/${kpiId}`,
          }
        );
      }
    }

    // Create in-app notification for manager
    await query(
      `INSERT INTO notifications (recipient_id, message, type, related_kpi_id, company_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        kpi.manager_id,
        `${kpi.employee_name} has acknowledged the assigned KPIs`,
        'kpi_acknowledged',
        kpiId,
        kpiCompanyId,
      ]
    );

    // Notify HR (in-app notifications)
    const hrUsers = await query(
      "SELECT id FROM users WHERE role = 'hr' AND company_id = $1",
      [kpiCompanyId]
    );
    for (const hr of hrUsers.rows) {
      await query(
        `INSERT INTO notifications (recipient_id, message, type, related_kpi_id, company_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          hr.id,
          `${kpi.employee_name} has acknowledged KPIs set by ${kpi.manager_name}`,
          'kpi_acknowledged',
          kpiId,
          kpiCompanyId,
        ]
      );
    }

    res.json({ kpi: updatedKPI });
  } catch (error) {
    console.error('Acknowledge KPI error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

