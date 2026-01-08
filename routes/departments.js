const express = require('express');
const { query } = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Get department statistics with KPI status breakdown (HR and Manager)
// Optimized for large datasets (millions of records)
router.get('/statistics', authenticateToken, authorizeRoles('hr', 'manager'), async (req, res) => {
  try {
    const { department, period, manager } = req.query;

    // Build dynamic filter conditions
    const filters = [];
    const kpiFilters = [];
    let paramIndex = 2; // Start at 2 because $1 is company_id
    const params = [req.user.company_id];

    // Add manager filter - managers only see their own department
    if (req.user.role === 'manager') {
      // Get manager's department from their user record
      const managerResult = await query('SELECT department FROM users WHERE id = $1', [req.user.id]);
      if (managerResult.rows.length > 0 && managerResult.rows[0].department) {
        filters.push(`u.department = $${paramIndex}`);
        params.push(managerResult.rows[0].department);
        paramIndex++;
      }
    } else if (manager && manager !== '') {
      filters.push(`u.manager_id = $${paramIndex}`);
      params.push(parseInt(manager));
      paramIndex++;
    }

    // Add department filter
    if (department && department !== '') {
      filters.push(`u.department = $${paramIndex}`);
      params.push(department);
      paramIndex++;
    }

    // Add period filter to KPI query
    if (period && period !== '') {
      const [periodType, quarter, year] = period.split('|');
      if (periodType === 'quarterly' && quarter) {
        kpiFilters.push(`k.period_type = 'quarterly' AND k.quarter = '${quarter}' AND k.year = ${year}`);
      } else if (periodType === 'annual') {
        kpiFilters.push(`k.period_type = 'annual' AND k.year = ${year}`);
      }
    }

    const filterCondition = filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';
    const kpiFilterCondition = kpiFilters.length > 0 ? 'AND ' + kpiFilters.join(' AND ') : '';

    // Single aggregated query to get all statistics with filters
    const statsQuery = `
      WITH latest_kpis AS (
        SELECT DISTINCT ON (k.employee_id) 
          k.employee_id,
          k.id as kpi_id,
          k.status as kpi_status,
          k.created_at,
          kr.id as review_id,
          kr.review_status
        FROM kpis k
        LEFT JOIN kpi_reviews kr ON k.id = kr.kpi_id
        WHERE k.company_id = $1
        ${kpiFilterCondition}
        ORDER BY k.employee_id, k.created_at DESC
      ),
      employee_status AS (
        SELECT 
          u.id as employee_id,
          u.department,
          CASE
            WHEN lk.kpi_id IS NULL THEN 'no_kpi'
            WHEN lk.kpi_status = 'pending' THEN 'pending'
            WHEN lk.kpi_status = 'acknowledged' AND lk.review_id IS NULL THEN 'acknowledged_review_pending'
            WHEN lk.review_status = 'employee_submitted' THEN 'self_rating_submitted'
            WHEN lk.review_status IN ('manager_submitted', 'completed') THEN 'review_completed'
            WHEN lk.review_status = 'pending' THEN 'review_pending'
            ELSE 'unknown'
          END as category
        FROM users u
        LEFT JOIN latest_kpis lk ON u.id = lk.employee_id
        WHERE u.company_id = $1 
          AND u.role = 'employee'
          AND u.department IS NOT NULL 
          AND u.department != ''
          ${filterCondition}
      )
      SELECT 
        department,
        COUNT(*) as total_employees,
        COUNT(*) FILTER (WHERE category = 'pending') as pending,
        COUNT(*) FILTER (WHERE category = 'acknowledged_review_pending') as acknowledged_review_pending,
        COUNT(*) FILTER (WHERE category = 'self_rating_submitted') as self_rating_submitted,
        COUNT(*) FILTER (WHERE category = 'review_completed') as review_completed,
        COUNT(*) FILTER (WHERE category = 'review_pending') as review_pending,
        COUNT(*) FILTER (WHERE category = 'no_kpi') as no_kpi
      FROM employee_status
      GROUP BY department
      ORDER BY department
    `;

    const statsResult = await query(statsQuery, params);

    const statistics = statsResult.rows.map(row => ({
      department: row.department,
      total_employees: parseInt(row.total_employees),
      categories: {
        pending: parseInt(row.pending),
        acknowledged_review_pending: parseInt(row.acknowledged_review_pending),
        self_rating_submitted: parseInt(row.self_rating_submitted),
        review_completed: parseInt(row.review_completed),
        review_pending: parseInt(row.review_pending),
        no_kpi: parseInt(row.no_kpi),
      }
    }));

    res.json({ statistics });
  } catch (error) {
    console.error('Get department statistics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get employees in a specific department and category (HR and Manager)
// Optimized for large datasets with single query approach
router.get('/statistics/:department/:category', authenticateToken, authorizeRoles('hr', 'manager'), async (req, res) => {
  try {
    const { department, category } = req.params;

    const validCategories = [
      'pending',
      'acknowledged_review_pending',
      'self_rating_submitted',
      'review_completed',
      'review_pending',
      'no_kpi'
    ];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Build optimized query - managers can only view their own department
    let managerCondition = '';
    let params = [req.user.company_id, department];
    
    if (req.user.role === 'manager') {
      // Verify the requested department matches manager's department
      const managerResult = await query('SELECT department FROM users WHERE id = $1', [req.user.id]);
      if (managerResult.rows.length === 0 || managerResult.rows[0].department !== department) {
        return res.status(403).json({ error: 'You can only view your own department' });
      }
    }

    // Single optimized query to get employees in category with all details
    const employeesQuery = `
      WITH latest_kpis AS (
        SELECT DISTINCT ON (k.employee_id) 
          k.employee_id,
          k.id as kpi_id,
          k.status as kpi_status,
          k.created_at,
          kr.id as review_id,
          kr.review_status
        FROM kpis k
        LEFT JOIN kpi_reviews kr ON k.id = kr.kpi_id
        WHERE k.company_id = $1
        ORDER BY k.employee_id, k.created_at DESC
      ),
      employee_with_category AS (
        SELECT 
          u.id,
          u.name,
          u.email,
          u.payroll_number,
          u.department,
          u.position,
          u.employment_date,
          u.manager_id,
          m.name as manager_name,
          CASE
            WHEN lk.kpi_id IS NULL THEN 'no_kpi'
            WHEN lk.kpi_status = 'pending' THEN 'pending'
            WHEN lk.kpi_status = 'acknowledged' AND lk.review_id IS NULL THEN 'acknowledged_review_pending'
            WHEN lk.review_status = 'employee_submitted' THEN 'self_rating_submitted'
            WHEN lk.review_status IN ('manager_submitted', 'completed') THEN 'review_completed'
            WHEN lk.review_status = 'pending' THEN 'review_pending'
            ELSE 'unknown'
          END as category
        FROM users u
        LEFT JOIN latest_kpis lk ON u.id = lk.employee_id
        LEFT JOIN users m ON u.manager_id = m.id
        WHERE u.company_id = $1 
          AND u.department = $2
          AND u.role = 'employee'
      )
      SELECT 
        id, name, email, payroll_number, department, position, 
        employment_date, manager_id, manager_name
      FROM employee_with_category
      WHERE category = $${params.length + 1}
      ORDER BY name
    `;

    const result = await query(employeesQuery, [...params, category]);

    res.json({ employees: result.rows });
  } catch (error) {
    console.error('Get employees by category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get list of managers in the company (HR only)
router.get('/managers', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const managersResult = await query(
      `SELECT DISTINCT u.id, u.name 
       FROM users u
       INNER JOIN users e ON e.manager_id = u.id
       WHERE u.company_id = $1 
       AND u.role = 'manager'
       AND e.role = 'employee'
       ORDER BY u.name`,
      [req.user.company_id]
    );

    res.json({ managers: managersResult.rows });
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

