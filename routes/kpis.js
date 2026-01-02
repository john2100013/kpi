const express = require('express');
const { query } = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { sendEmail, emailTemplates } = require('../services/emailService');
const router = express.Router();
require('dotenv').config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Get all KPIs
router.get('/', authenticateToken, async (req, res) => {
  try {
    let result;
    
    if (req.user.role === 'employee') {
      result = await query(
        `SELECT k.*, 
         e.name as employee_name, e.department as employee_department,
         m.name as manager_name
         FROM kpis k
         JOIN users e ON k.employee_id = e.id
         JOIN users m ON k.manager_id = m.id
         WHERE k.employee_id = $1
         ORDER BY k.created_at DESC`,
        [req.user.id]
      );
    } else if (req.user.role === 'manager') {
      result = await query(
        `SELECT k.*, 
         e.name as employee_name, e.department as employee_department,
         m.name as manager_name
         FROM kpis k
         JOIN users e ON k.employee_id = e.id
         JOIN users m ON k.manager_id = m.id
         WHERE k.manager_id = $1
         ORDER BY k.created_at DESC`,
        [req.user.id]
      );
    } else {
      // HR sees all
      result = await query(
        `SELECT k.*, 
         e.name as employee_name, e.department as employee_department,
         m.name as manager_name
         FROM kpis k
         JOIN users e ON k.employee_id = e.id
         JOIN users m ON k.manager_id = m.id
         ORDER BY k.created_at DESC`
      );
    }

    // Fetch items for each KPI
    const kpisWithItems = await Promise.all(
      result.rows.map(async (kpi) => {
        const itemsResult = await query(
          'SELECT * FROM kpi_items WHERE kpi_id = $1 ORDER BY item_order',
          [kpi.id]
        );
        return {
          ...kpi,
          items: itemsResult.rows,
          item_count: itemsResult.rows.length,
        };
      })
    );

    res.json({ kpis: kpisWithItems });
  } catch (error) {
    console.error('Get KPIs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get KPI by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT k.*, 
       e.name as employee_name, e.department as employee_department, e.position as employee_position,
       e.payroll_number as employee_payroll, e.payroll_number as employee_payroll_number,
       e.employment_date as employee_employment_date,
       m.name as manager_name, m.position as manager_position
       FROM kpis k
       JOIN users e ON k.employee_id = e.id
       JOIN users m ON k.manager_id = m.id
       WHERE k.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    const kpi = result.rows[0];

    // Check access permissions
    if (req.user.role === 'employee' && kpi.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'manager' && kpi.manager_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch KPI items
    const itemsResult = await query(
      'SELECT * FROM kpi_items WHERE kpi_id = $1 ORDER BY item_order',
      [id]
    );

    res.json({ 
      kpi: {
        ...kpi,
        items: itemsResult.rows,
        item_count: itemsResult.rows.length,
      }
    });
  } catch (error) {
    console.error('Get KPI error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create KPI Form with multiple items (Manager only)
router.post('/', authenticateToken, authorizeRoles('manager'), async (req, res) => {
  try {
    const {
      employee_id,
      period,
      quarter,
      year,
      meeting_date,
      manager_signature,
      kpi_items, // Array of KPI items: [{title, description, target_value, measure_unit, measure_criteria}, ...]
    } = req.body;

    // Support legacy single KPI format for backward compatibility
    const legacyTitle = req.body.title;
    const legacyDescription = req.body.description;
    const legacyTargetValue = req.body.target_value;
    const legacyMeasureUnit = req.body.measure_unit;
    const legacyMeasureCriteria = req.body.measure_criteria;

    if (!employee_id || !period) {
      return res.status(400).json({ error: 'Employee ID and period are required' });
    }

    // Verify employee exists and is under this manager
    const employeeCheck = await query(
      'SELECT id, name, email, manager_id FROM users WHERE id = $1 AND role = $2',
      [employee_id, 'employee']
    );

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (employeeCheck.rows[0].manager_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only set KPIs for your team members' });
    }

    // Prepare KPI items array
    let itemsToCreate = [];
    if (kpi_items && Array.isArray(kpi_items) && kpi_items.length > 0) {
      // New format: multiple items
      itemsToCreate = kpi_items.filter(item => item.title && item.title.trim() !== '');
    } else if (legacyTitle) {
      // Legacy format: single KPI
      itemsToCreate = [{
        title: legacyTitle,
        description: legacyDescription,
        target_value: legacyTargetValue,
        measure_unit: legacyMeasureUnit,
        measure_criteria: legacyMeasureCriteria,
      }];
    } else {
      return res.status(400).json({ error: 'At least one KPI item is required' });
    }

    if (itemsToCreate.length === 0) {
      return res.status(400).json({ error: 'At least one valid KPI item is required' });
    }

    // Generate a title for the KPI form (use first item's title or a generic one)
    const formTitle = itemsToCreate.length === 1 
      ? itemsToCreate[0].title 
      : `${itemsToCreate.length} KPIs - ${quarter || ''} ${year || ''}`;

    // Insert KPI Form (main record)
    const result = await query(
      `INSERT INTO kpis (
        employee_id, manager_id, title, description, period, quarter, year, 
        meeting_date, manager_signature, manager_signed_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'pending')
      RETURNING *`,
      [
        employee_id,
        req.user.id,
        formTitle,
        `KPI Form with ${itemsToCreate.length} item(s)`,
        period,
        quarter,
        year,
        meeting_date,
        manager_signature,
      ]
    );

    const kpi = result.rows[0];

    // Insert KPI Items
    for (let i = 0; i < itemsToCreate.length; i++) {
      const item = itemsToCreate[i];
      await query(
        `INSERT INTO kpi_items (
          kpi_id, title, description, target_value, measure_unit, measure_criteria, item_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          kpi.id,
          item.title,
          item.description || '',
          item.target_value || '',
          item.measure_unit || '',
          item.measure_criteria || '',
          i + 1,
        ]
      );
    }

    // Create reminders for KPI setting meeting
    if (meeting_date) {
      const reminderTypes = ['2_weeks', '1_week', '3_days', '2_days', '1_day', 'meeting_day'];
      for (const reminderType of reminderTypes) {
        await query(
          `INSERT INTO kpi_setting_reminders (kpi_id, employee_id, manager_id, meeting_date, reminder_type)
           VALUES ($1, $2, $3, $4, $5)`,
          [kpi.id, employee_id, req.user.id, meeting_date, reminderType]
        );
      }
    }

    // Send email notification to employee
    const employee = employeeCheck.rows[0];
    const link = `${FRONTEND_URL}/employee/kpi-acknowledgement/${kpi.id}`;
    await sendEmail(
      employee.email,
      'New KPI Assigned',
      emailTemplates.kpiAssigned(employee.name, req.user.name, link)
    );

    // Create in-app notification
    await query(
      `INSERT INTO notifications (recipient_id, message, type, related_kpi_id)
       VALUES ($1, $2, $3, $4)`,
      [
        employee_id,
        `New KPI form with ${itemsToCreate.length} item(s) assigned by ${req.user.name}`,
        'kpi_assigned',
        kpi.id,
      ]
    );

    // Notify HR
    const hrUsers = await query("SELECT id, email FROM users WHERE role = 'hr'");
    for (const hr of hrUsers.rows) {
      await query(
        `INSERT INTO notifications (recipient_id, message, type, related_kpi_id)
         VALUES ($1, $2, $3, $4)`,
        [
          hr.id,
          `New KPI form set for ${employee.name} by ${req.user.name}`,
          'kpi_set',
          kpi.id,
        ]
      );
    }

    // Fetch the created KPI with its items
    const kpiWithItems = await query(
      `SELECT k.*, 
       e.name as employee_name, e.department as employee_department,
       m.name as manager_name
       FROM kpis k
       JOIN users e ON k.employee_id = e.id
       JOIN users m ON k.manager_id = m.id
       WHERE k.id = $1`,
      [kpi.id]
    );

    const items = await query(
      'SELECT * FROM kpi_items WHERE kpi_id = $1 ORDER BY item_order',
      [kpi.id]
    );

    res.status(201).json({ 
      kpi: { ...kpiWithItems.rows[0], items: items.rows } 
    });
  } catch (error) {
    console.error('Create KPI error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update KPI
router.patch('/:id', authenticateToken, authorizeRoles('manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if KPI exists and belongs to this manager
    const kpiCheck = await query('SELECT * FROM kpis WHERE id = $1', [id]);
    if (kpiCheck.rows.length === 0) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    if (kpiCheck.rows[0].manager_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build update query dynamically
    const allowedFields = [
      'title', 'description', 'target_value', 'measure_unit', 'measure_criteria',
      'period', 'quarter', 'year', 'meeting_date', 'manager_signature', 'status'
    ];
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE kpis SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ kpi: result.rows[0] });
  } catch (error) {
    console.error('Update KPI error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get KPIs for dashboard statistics
router.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    let stats = {};

    if (req.user.role === 'manager') {
      const totalEmployees = await query(
        'SELECT COUNT(*) FROM users WHERE manager_id = $1',
        [req.user.id]
      );

      const pendingKPIs = await query(
        "SELECT COUNT(*) FROM kpis WHERE manager_id = $1 AND status = 'pending'",
        [req.user.id]
      );

      const completedKPIs = await query(
        "SELECT COUNT(*) FROM kpis WHERE manager_id = $1 AND status = 'completed'",
        [req.user.id]
      );

      stats = {
        totalEmployees: parseInt(totalEmployees.rows[0].count),
        pendingKPIs: parseInt(pendingKPIs.rows[0].count),
        completedKPIs: parseInt(completedKPIs.rows[0].count),
      };
    } else if (req.user.role === 'employee') {
      const myKPIs = await query(
        'SELECT COUNT(*) FROM kpis WHERE employee_id = $1',
        [req.user.id]
      );

      const pendingKPIs = await query(
        "SELECT COUNT(*) FROM kpis WHERE employee_id = $1 AND status = 'pending'",
        [req.user.id]
      );

      const completedKPIs = await query(
        "SELECT COUNT(*) FROM kpis WHERE employee_id = $1 AND status = 'completed'",
        [req.user.id]
      );

      stats = {
        totalKPIs: parseInt(myKPIs.rows[0].count),
        pendingKPIs: parseInt(pendingKPIs.rows[0].count),
        completedKPIs: parseInt(completedKPIs.rows[0].count),
      };
    }

    res.json({ stats });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

