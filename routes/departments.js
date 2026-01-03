const express = require('express');
const { query } = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Get department statistics with KPI status breakdown (HR only)
router.get('/statistics', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    // Get all departments for the company
    const departmentsResult = await query(
      `SELECT DISTINCT department FROM users 
       WHERE company_id = $1 AND department IS NOT NULL AND department != ''
       ORDER BY department`,
      [req.user.company_id]
    );

    const departments = departmentsResult.rows.map(row => row.department);
    const statistics = [];

    for (const department of departments) {
      // Get all employees in this department
      const employeesResult = await query(
        `SELECT id FROM users 
         WHERE company_id = $1 AND department = $2 AND role = 'employee'`,
        [req.user.company_id, department]
      );

      const employeeIds = employeesResult.rows.map(e => e.id);
      if (employeeIds.length === 0) continue;

      // Count employees by KPI status
      const stats = {
        department,
        total_employees: employeeIds.length,
        categories: {
          pending: 0, // KPI Setting - Awaiting Acknowledgement
          acknowledged_review_pending: 0, // KPI Acknowledged - Review Pending
          self_rating_submitted: 0, // Self-Rating Submitted - Awaiting Manager Review
          review_completed: 0, // KPI Review Completed
          review_pending: 0, // KPI Review - Self-Rating Required
          no_kpi: 0, // No KPI assigned
        },
        employees_by_category: {
          pending: [],
          acknowledged_review_pending: [],
          self_rating_submitted: [],
          review_completed: [],
          review_pending: [],
          no_kpi: [],
        }
      };

      // Get all KPIs for employees in this department
      const kpisResult = await query(
        `SELECT k.*, kr.id as review_id, kr.review_status 
         FROM kpis k
         LEFT JOIN kpi_reviews kr ON k.id = kr.kpi_id
         WHERE k.employee_id = ANY($1::int[]) AND k.company_id = $2
         ORDER BY k.created_at DESC`,
        [employeeIds, req.user.company_id]
      );

      // Track which employees have KPIs
      const employeesWithKPI = new Set();
      
      // Group KPIs by employee (get latest KPI per employee)
      const latestKPIsByEmployee = {};
      for (const kpi of kpisResult.rows) {
        if (!latestKPIsByEmployee[kpi.employee_id] || 
            new Date(kpi.created_at) > new Date(latestKPIsByEmployee[kpi.employee_id].created_at)) {
          latestKPIsByEmployee[kpi.employee_id] = kpi;
        }
        employeesWithKPI.add(kpi.employee_id);
      }

      // Categorize employees
      for (const employeeId of employeeIds) {
        if (!latestKPIsByEmployee[employeeId]) {
          // No KPI assigned
          stats.categories.no_kpi++;
          stats.employees_by_category.no_kpi.push(employeeId);
          continue;
        }

        const kpi = latestKPIsByEmployee[employeeId];

        if (kpi.status === 'pending') {
          stats.categories.pending++;
          stats.employees_by_category.pending.push(employeeId);
        } else if (kpi.status === 'acknowledged' && !kpi.review_id) {
          stats.categories.acknowledged_review_pending++;
          stats.employees_by_category.acknowledged_review_pending.push(employeeId);
        } else if (kpi.review_id) {
          if (kpi.review_status === 'employee_submitted') {
            stats.categories.self_rating_submitted++;
            stats.employees_by_category.self_rating_submitted.push(employeeId);
          } else if (kpi.review_status === 'manager_submitted' || kpi.review_status === 'completed') {
            stats.categories.review_completed++;
            stats.employees_by_category.review_completed.push(employeeId);
          } else if (kpi.review_status === 'pending') {
            stats.categories.review_pending++;
            stats.employees_by_category.review_pending.push(employeeId);
          }
        }
      }

      statistics.push(stats);
    }

    res.json({ statistics });
  } catch (error) {
    console.error('Get department statistics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get employees in a specific department and category
router.get('/statistics/:department/:category', authenticateToken, authorizeRoles('hr'), async (req, res) => {
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

    // Get all employees in this department
    const employeesResult = await query(
      `SELECT id FROM users 
       WHERE company_id = $1 AND department = $2 AND role = 'employee'`,
      [req.user.company_id, department]
    );

    const employeeIds = employeesResult.rows.map(e => e.id);
    if (employeeIds.length === 0) {
      return res.json({ employees: [] });
    }

    let employeeIdsInCategory = [];

    if (category === 'no_kpi') {
      // Employees with no KPIs
      const kpisResult = await query(
        `SELECT DISTINCT employee_id FROM kpis 
         WHERE employee_id = ANY($1::int[]) AND company_id = $2`,
        [employeeIds, req.user.company_id]
      );
      const employeesWithKPI = new Set(kpisResult.rows.map(r => r.employee_id));
      employeeIdsInCategory = employeeIds.filter(id => !employeesWithKPI.has(id));
    } else {
      // Get all KPIs for employees in this department
      const kpisResult = await query(
        `SELECT k.*, kr.id as review_id, kr.review_status 
         FROM kpis k
         LEFT JOIN kpi_reviews kr ON k.id = kr.kpi_id
         WHERE k.employee_id = ANY($1::int[]) AND k.company_id = $2
         ORDER BY k.created_at DESC`,
        [employeeIds, req.user.company_id]
      );

      // Group KPIs by employee (get latest KPI per employee)
      const latestKPIsByEmployee = {};
      for (const kpi of kpisResult.rows) {
        if (!latestKPIsByEmployee[kpi.employee_id] || 
            new Date(kpi.created_at) > new Date(latestKPIsByEmployee[kpi.employee_id].created_at)) {
          latestKPIsByEmployee[kpi.employee_id] = kpi;
        }
      }

      // Filter by category
      for (const employeeId of employeeIds) {
        const kpi = latestKPIsByEmployee[employeeId];
        if (!kpi && category !== 'no_kpi') continue;

        let matches = false;
        if (category === 'pending' && kpi && kpi.status === 'pending') {
          matches = true;
        } else if (category === 'acknowledged_review_pending' && kpi && kpi.status === 'acknowledged' && !kpi.review_id) {
          matches = true;
        } else if (category === 'self_rating_submitted' && kpi && kpi.review_id && kpi.review_status === 'employee_submitted') {
          matches = true;
        } else if (category === 'review_completed' && kpi && kpi.review_id && 
                   (kpi.review_status === 'manager_submitted' || kpi.review_status === 'completed')) {
          matches = true;
        } else if (category === 'review_pending' && kpi && kpi.review_id && kpi.review_status === 'pending') {
          matches = true;
        }

        if (matches) {
          employeeIdsInCategory.push(employeeId);
        }
      }
    }

    // Get employee details
    if (employeeIdsInCategory.length === 0) {
      return res.json({ employees: [] });
    }

    const employeeDetailsResult = await query(
      `SELECT id, name, email, payroll_number, department, position, employment_date, manager_id
       FROM users 
       WHERE id = ANY($1::int[]) AND company_id = $2
       ORDER BY name`,
      [employeeIdsInCategory, req.user.company_id]
    );

    // Also get manager names
    const employees = await Promise.all(
      employeeDetailsResult.rows.map(async (employee) => {
        if (employee.manager_id) {
          const managerResult = await query(
            'SELECT name FROM users WHERE id = $1',
            [employee.manager_id]
          );
          return {
            ...employee,
            manager_name: managerResult.rows[0]?.name || null
          };
        }
        return { ...employee, manager_name: null };
      })
    );

    res.json({ employees });
  } catch (error) {
    console.error('Get employees by category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

