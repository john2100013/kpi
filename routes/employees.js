const express = require('express');
const { query } = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Get all employees (for managers and HR)
router.get('/', authenticateToken, authorizeRoles('manager', 'hr'), async (req, res) => {
  try {
    let result;
    
    if (req.user.role === 'manager') {
      // Managers see only their team in their company
      result = await query(
        `SELECT id, name, email, role, payroll_number, department, position, employment_date
         FROM users WHERE (manager_id = $1 OR id = $1) AND company_id = $2 ORDER BY name`,
        [req.user.id, req.user.company_id]
      );
    } else {
      // HR sees all employees in their company
      result = await query(
        `SELECT id, name, email, role, payroll_number, department, position, employment_date, manager_id
         FROM users WHERE role = 'employee' AND company_id = $1 ORDER BY name`,
        [req.user.company_id]
      );
    }

    res.json({ employees: result.rows });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get employee by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Employees can only see their own data, managers can see their team, HR can see all
    let result;
    if (req.user.role === 'employee' && parseInt(id) !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    result = await query(
      `SELECT id, name, email, role, payroll_number, national_id, department, position, employment_date, manager_id
       FROM users WHERE id = $1 AND company_id = $2`,
      [id, req.user.company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ employee: result.rows[0] });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get employees under a manager
router.get('/manager/:managerId', authenticateToken, async (req, res) => {
  try {
    const { managerId } = req.params;

    const result = await query(
      `SELECT id, name, email, role, payroll_number, department, position, employment_date
       FROM users WHERE manager_id = $1 AND company_id = $2 ORDER BY name`,
      [managerId, req.user.company_id]
    );

    res.json({ employees: result.rows });
  } catch (error) {
    console.error('Get manager employees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

