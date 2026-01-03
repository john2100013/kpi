const express = require('express');
const { query } = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { sendTemplatedEmail } = require('../services/powerAutomateService');
const router = express.Router();
require('dotenv').config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Get all meeting schedules (Manager only - sees their team's meetings)
router.get('/', authenticateToken, authorizeRoles('manager'), async (req, res) => {
  try {
    const result = await query(
      `SELECT ms.*, 
       e.name as employee_name, e.email as employee_email, e.department as employee_department,
       m.name as manager_name, m.email as manager_email,
       k.title as kpi_title, k.period as kpi_period, k.quarter, k.year
       FROM meeting_schedules ms
       JOIN users e ON ms.employee_id = e.id
       JOIN users m ON ms.manager_id = m.id
       LEFT JOIN kpis k ON ms.kpi_id = k.id
       WHERE ms.manager_id = $1 AND ms.company_id = $2
       ORDER BY ms.scheduled_date DESC, ms.scheduled_time DESC`,
      [req.user.id, req.user.company_id]
    );

    res.json({ meetings: result.rows });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get meetings for a specific KPI or Review
router.get('/by-kpi/:kpiId', authenticateToken, authorizeRoles('manager'), async (req, res) => {
  try {
    const { kpiId } = req.params;

    const result = await query(
      `SELECT ms.*, 
       e.name as employee_name, e.email as employee_email,
       m.name as manager_name
       FROM meeting_schedules ms
       JOIN users e ON ms.employee_id = e.id
       JOIN users m ON ms.manager_id = m.id
       WHERE ms.kpi_id = $1 AND ms.manager_id = $2 AND ms.company_id = $3
       ORDER BY ms.scheduled_date DESC`,
      [kpiId, req.user.id, req.user.company_id]
    );

    res.json({ meetings: result.rows });
  } catch (error) {
    console.error('Get meetings by KPI error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific meeting
router.get('/:id', authenticateToken, authorizeRoles('manager', 'hr'), async (req, res) => {
  try {
    const { id } = req.params;

    let result;
    if (req.user.role === 'manager') {
      result = await query(
        `SELECT ms.*, 
         e.name as employee_name, e.email as employee_email,
         m.name as manager_name
         FROM meeting_schedules ms
         JOIN users e ON ms.employee_id = e.id
         JOIN users m ON ms.manager_id = m.id
         WHERE ms.id = $1 AND ms.manager_id = $2 AND ms.company_id = $3`,
        [id, req.user.id, req.user.company_id]
      );
    } else {
      // HR can see all meetings in their company
      result = await query(
        `SELECT ms.*, 
         e.name as employee_name, e.email as employee_email,
         m.name as manager_name
         FROM meeting_schedules ms
         JOIN users e ON ms.employee_id = e.id
         JOIN users m ON ms.manager_id = m.id
         WHERE ms.id = $1 AND ms.company_id = $2`,
        [id, req.user.company_id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ meeting: result.rows[0] });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create meeting schedule (Manager only)
router.post('/', authenticateToken, authorizeRoles('manager'), async (req, res) => {
  try {
    const { kpi_id, review_id, employee_id, meeting_type, scheduled_date, scheduled_time, location, notes } = req.body;

    if (!employee_id || !meeting_type || !scheduled_date) {
      return res.status(400).json({ error: 'employee_id, meeting_type, and scheduled_date are required' });
    }

    if (!['kpi_setting', 'kpi_review'].includes(meeting_type)) {
      return res.status(400).json({ error: 'meeting_type must be "kpi_setting" or "kpi_review"' });
    }

    // Verify employee belongs to this manager
    const employeeCheck = await query(
      'SELECT id, company_id FROM users WHERE id = $1 AND manager_id = $2',
      [employee_id, req.user.id]
    );

    if (employeeCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Employee not found or does not belong to your team' });
    }

    // If kpi_id is provided, verify it exists and belongs to the employee
    if (kpi_id) {
      const kpiCheck = await query(
        'SELECT id FROM kpis WHERE id = $1 AND employee_id = $2 AND manager_id = $3 AND company_id = $4',
        [kpi_id, employee_id, req.user.id, req.user.company_id]
      );

      if (kpiCheck.rows.length === 0) {
        return res.status(404).json({ error: 'KPI not found or does not belong to this employee' });
      }
    }

    // Create meeting schedule
    const result = await query(
      `INSERT INTO meeting_schedules 
       (kpi_id, review_id, employee_id, manager_id, company_id, meeting_type, scheduled_date, scheduled_time, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        kpi_id || null,
        review_id || null,
        employee_id,
        req.user.id,
        req.user.company_id,
        meeting_type,
        scheduled_date,
        scheduled_time || null,
        location || null,
        notes || null,
      ]
    );

    const meeting = result.rows[0];

    // Update KPI meeting_date if this is a KPI setting meeting
    if (meeting_type === 'kpi_setting' && kpi_id) {
      await query(
        'UPDATE kpis SET meeting_date = $1, updated_at = NOW() WHERE id = $2',
        [scheduled_date, kpi_id]
      );
    }

    // Send email notifications via Power Automate
    try {
      const employeeResult = await query('SELECT name, email FROM users WHERE id = $1', [employee_id]);
      const employee = employeeResult.rows[0];

      // Get HR emails for notification
      const hrResult = await query(
        'SELECT email FROM users WHERE role = $1 AND company_id = $2',
        ['hr', req.user.company_id]
      );
      const hrEmails = hrResult.rows.map(row => row.email);

      const meetingDateStr = new Date(scheduled_date).toLocaleDateString();
      const meetingTimeStr = scheduled_time || 'TBD';

      // Send to employee
      await sendTemplatedEmail(
        req.user.company_id,
        employee.email,
        'kpi_setting_reminder',
        {
          employeeName: employee.name,
          managerName: req.user.name,
          meetingDate: `${meetingDateStr} at ${meetingTimeStr}`,
          reminderType: 'scheduled',
          link: kpi_id ? `${FRONTEND_URL}/employee/kpi-details/${kpi_id}` : FRONTEND_URL,
        },
        { meetingType: meeting_type, location: location || 'TBD' }
      );

      // Send to manager (self)
      await sendTemplatedEmail(
        req.user.company_id,
        req.user.email,
        'kpi_setting_reminder',
        {
          employeeName: employee.name,
          managerName: req.user.name,
          meetingDate: `${meetingDateStr} at ${meetingTimeStr}`,
          reminderType: 'scheduled',
          link: kpi_id ? `${FRONTEND_URL}/manager/kpi-details/${kpi_id}` : FRONTEND_URL,
        },
        { meetingType: meeting_type, location: location || 'TBD' }
      );

      // Send to HR
      for (const hrEmail of hrEmails) {
        await sendTemplatedEmail(
          req.user.company_id,
          hrEmail,
          'kpi_setting_reminder',
          {
            employeeName: employee.name,
            managerName: req.user.name,
            meetingDate: `${meetingDateStr} at ${meetingTimeStr}`,
            reminderType: 'scheduled',
            link: FRONTEND_URL,
          },
          { meetingType: meeting_type, location: location || 'TBD' }
        );
      }
    } catch (emailError) {
      console.error('Error sending meeting notification emails:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({ meeting });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update meeting schedule (Manager only)
router.patch('/:id', authenticateToken, authorizeRoles('manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduled_date, scheduled_time, location, notes, status } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (scheduled_date !== undefined) {
      updateFields.push(`scheduled_date = $${paramCount}`);
      values.push(scheduled_date);
      paramCount++;
    }

    if (scheduled_time !== undefined) {
      updateFields.push(`scheduled_time = $${paramCount}`);
      values.push(scheduled_time);
      paramCount++;
    }

    if (location !== undefined) {
      updateFields.push(`location = $${paramCount}`);
      values.push(location);
      paramCount++;
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount}`);
      values.push(notes);
      paramCount++;
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id, req.user.id, req.user.company_id);

    const result = await query(
      `UPDATE meeting_schedules 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramCount} AND manager_id = $${paramCount + 1} AND company_id = $${paramCount + 2}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ meeting: result.rows[0] });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete meeting schedule (Manager only)
router.delete('/:id', authenticateToken, authorizeRoles('manager'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM meeting_schedules WHERE id = $1 AND manager_id = $2 AND company_id = $3 RETURNING *',
      [id, req.user.id, req.user.company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

