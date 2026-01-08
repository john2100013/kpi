import { BaseController } from './BaseController.js';
import { query } from '../database/db.js';

class DepartmentsController extends BaseController {
  /**
   * Get department statistics
   */
  async getStatistics(req, res) {
    try {
      const { department, period, manager } = req.query;
      const filters = [];
      const kpiFilters = [];
      let paramIndex = 2;
      const params = [req.user.company_id];

      // Manager filter logic
      if (req.user.role === 'manager') {
        const tableCheckResult = await query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'manager_departments'
          )
        `);
        
        if (tableCheckResult.rows[0].exists) {
          const managerDeptResult = await query(`
            SELECT d.name 
            FROM manager_departments md
            JOIN departments d ON d.id = md.department_id
            WHERE md.manager_id = $1
          `, [req.user.id]);
          
          if (managerDeptResult.rows.length > 0) {
            const deptNames = managerDeptResult.rows.map(row => row.name);
            const placeholders = deptNames.map((_, i) => `$${paramIndex + i}`).join(', ');
            filters.push(`u.department IN (${placeholders})`);
            params.push(...deptNames);
            paramIndex += deptNames.length;
          } else {
            return this.success(res, { statistics: [] });
          }
        }
      } else if (manager && manager !== '') {
        filters.push(`u.manager_id = $${paramIndex}`);
        params.push(parseInt(manager));
        paramIndex++;
      }

      if (department && department !== '') {
        filters.push(`u.department = $${paramIndex}`);
        params.push(department);
        paramIndex++;
      }

      if (period && period !== '') {
        const [periodType, quarter, year] = period.split('|');
        if (periodType === 'quarterly' && quarter) {
          kpiFilters.push(`k.period = 'quarterly' AND k.quarter = '${quarter}' AND k.year = ${year}`);
        } else if (periodType === 'annual') {
          kpiFilters.push(`k.period = 'annual' AND k.year = ${year}`);
        }
      }

      const filterCondition = filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';
      const kpiFilterCondition = kpiFilters.length > 0 ? 'AND ' + kpiFilters.join(' AND ') : '';

      const statsQuery = `
        WITH latest_kpis AS (
          SELECT DISTINCT ON (k.employee_id) 
            k.employee_id,
            k.id as kpi_id,
            k.status as kpi_status,
            k.created_at,
            kr.id as review_id,
            kr.review_status,
            kr.rejection_resolved_status
          FROM kpis k
          LEFT JOIN kpi_reviews kr ON k.id = kr.kpi_id
          WHERE k.company_id = $1
          ${kpiFilterCondition}
          ORDER BY k.employee_id, k.created_at DESC
        )
        SELECT 
          COALESCE(u.department, 'Unassigned') as department,
          COUNT(DISTINCT u.id) as total_employees,
          COUNT(DISTINCT CASE WHEN lk.kpi_status = 'pending' THEN u.id END) as pending_setting,
          COUNT(DISTINCT CASE WHEN lk.kpi_status = 'acknowledged' AND lk.review_id IS NULL THEN u.id END) as pending_self_rating,
          COUNT(DISTINCT CASE WHEN lk.review_status = 'employee_submitted' THEN u.id END) as pending_manager_review,
          COUNT(DISTINCT CASE WHEN lk.review_status IN ('manager_submitted', 'completed') THEN u.id END) as completed,
          COUNT(DISTINCT CASE WHEN lk.review_status = 'rejected' AND lk.rejection_resolved_status != 'resolved' THEN u.id END) as rejected_pending,
          COUNT(DISTINCT CASE WHEN lk.kpi_id IS NULL THEN u.id END) as not_started
        FROM users u
        LEFT JOIN latest_kpis lk ON u.id = lk.employee_id
        WHERE u.role = 'employee' AND u.company_id = $1
        ${filterCondition}
        GROUP BY u.department
        ORDER BY u.department
      `;

      const result = await query(statsQuery, params);
      return this.success(res, { statistics: result.rows });
    } catch (error) {
      console.error('Get department statistics error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get all departments
   */
  async getAllDepartments(req, res) {
    try {
      const companyId = req.query.companyId || req.user.company_id;

      const result = await query(
        `SELECT id, name, description, created_at 
         FROM departments 
         WHERE company_id = $1 
         ORDER BY name`,
        [companyId]
      );

      return this.success(res, { departments: result.rows });
    } catch (error) {
      console.error('Get departments error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Create department
   */
  async createDepartment(req, res) {
    try {
      const { name, description } = req.body;
      const companyId = req.query.companyId || req.user.company_id;

      if (!name) {
        return this.validationError(res, 'Department name is required');
      }

      const result = await query(
        'INSERT INTO departments (name, description, company_id) VALUES ($1, $2, $3) RETURNING *',
        [name, description || null, companyId]
      );

      return this.success(res, { department: result.rows[0], message: 'Department created successfully' }, 201);
    } catch (error) {
      console.error('Create department error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Update department
   */
  async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      if (!name) {
        return this.validationError(res, 'Department name is required');
      }

      const result = await query(
        'UPDATE departments SET name = $1, description = $2 WHERE id = $3 RETURNING *',
        [name, description || null, id]
      );

      if (result.rows.length === 0) {
        return this.notFound(res, 'Department not found');
      }

      return this.success(res, { department: result.rows[0], message: 'Department updated successfully' });
    } catch (error) {
      console.error('Update department error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Delete department
   */
  async deleteDepartment(req, res) {
    try {
      const { id } = req.params;

      // Check if department has employees
      const checkResult = await query(
        'SELECT COUNT(*) as count FROM users WHERE department_id = $1',
        [id]
      );

      if (parseInt(checkResult.rows[0].count) > 0) {
        return this.validationError(res, 'Cannot delete department with existing employees');
      }

      const result = await query(
        'DELETE FROM departments WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return this.notFound(res, 'Department not found');
      }

      return this.success(res, { message: 'Department deleted successfully' });
    } catch (error) {
      console.error('Delete department error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get employees by department and category
   */
  async getEmployeesByCategory(req, res) {
    try {
      const { department, category } = req.params;
      const companyId = req.user.company_id;

      // Validate category
      const validCategories = [
        'pending', 'acknowledged_review_pending', 'self_rating_submitted',
        'awaiting_employee_confirmation', 'review_completed', 'review_rejected',
        'rejection_resolved', 'review_pending', 'no_kpi'
      ];

      if (!validCategories.includes(category)) {
        return this.validationError(res, 'Invalid category');
      }

      // Check manager authorization for this department
      if (req.user.role === 'manager') {
        const authCheck = await query(
          `SELECT 1 FROM manager_departments md
           JOIN departments d ON d.id = md.department_id
           WHERE md.manager_id = $1 AND d.name = $2`,
          [req.user.id, department]
        );

        if (authCheck.rows.length === 0) {
          return this.forbidden(res, 'You are not authorized to access this department');
        }
      }

      // Build query based on category
      let employeesQuery;
      switch (category) {
        case 'pending':
          employeesQuery = `
            SELECT DISTINCT u.id, u.name, u.email, u.payroll_number, u.department, u.position, u.employment_date, u.manager_id, m.name as manager_name
            FROM users u
            LEFT JOIN users m ON u.manager_id = m.id
            LEFT JOIN kpis k ON u.id = k.employee_id AND k.company_id = $1
            WHERE u.role = 'employee' AND u.company_id = $1 AND u.department = $2
            AND (k.status = 'pending' OR k.id IS NULL)
            ORDER BY u.name
          `;
          break;
        case 'acknowledged_review_pending':
          employeesQuery = `
            SELECT DISTINCT u.id, u.name, u.email, u.payroll_number, u.department, u.position, u.employment_date, u.manager_id, m.name as manager_name
            FROM users u
            LEFT JOIN users m ON u.manager_id = m.id
            JOIN kpis k ON u.id = k.employee_id
            LEFT JOIN kpi_reviews kr ON k.id = kr.kpi_id
            WHERE u.role = 'employee' AND u.company_id = $1 AND u.department = $2
            AND k.status = 'acknowledged' AND kr.id IS NULL
            ORDER BY u.name
          `;
          break;
        case 'review_completed':
          employeesQuery = `
            SELECT DISTINCT u.id, u.name, u.email, u.payroll_number, u.department, u.position, u.employment_date, u.manager_id, m.name as manager_name
            FROM users u
            LEFT JOIN users m ON u.manager_id = m.id
            JOIN kpis k ON u.id = k.employee_id
            JOIN kpi_reviews kr ON k.id = kr.kpi_id
            WHERE u.role = 'employee' AND u.company_id = $1 AND u.department = $2
            AND kr.review_status IN ('manager_submitted', 'completed')
            ORDER BY u.name
          `;
          break;
        case 'no_kpi':
          employeesQuery = `
            SELECT DISTINCT u.id, u.name, u.email, u.payroll_number, u.department, u.position, u.employment_date, u.manager_id, m.name as manager_name
            FROM users u
            LEFT JOIN users m ON u.manager_id = m.id
            LEFT JOIN kpis k ON u.id = k.employee_id
            WHERE u.role = 'employee' AND u.company_id = $1 AND u.department = $2
            AND k.id IS NULL
            ORDER BY u.name
          `;
          break;
        default:
          employeesQuery = `
            SELECT DISTINCT u.id, u.name, u.email, u.payroll_number, u.department, u.position, u.employment_date, u.manager_id, m.name as manager_name
            FROM users u
            LEFT JOIN users m ON u.manager_id = m.id
            WHERE u.role = 'employee' AND u.company_id = $1 AND u.department = $2
            ORDER BY u.name
          `;
      }

      const result = await query(employeesQuery, [companyId, department]);
      return this.success(res, { employees: result.rows });
    } catch (error) {
      console.error('Get employees by category error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get managers with employees
   */
  async getManagers(req, res) {
    try {
      const companyId = req.user.company_id;

      const result = await query(
        `SELECT DISTINCT u.id, u.name
         FROM users u
         INNER JOIN users e ON e.manager_id = u.id
         WHERE u.company_id = $1 AND u.role = 'manager'
         ORDER BY u.name`,
        [companyId]
      );

      return this.success(res, { managers: result.rows });
    } catch (error) {
      console.error('Get managers error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get departments assigned to logged-in manager
   */
  async getManagerDepartments(req, res) {
    try {
      const managerId = req.user.id;

      const result = await query(
        `SELECT d.id, d.name
         FROM manager_departments md
         JOIN departments d ON d.id = md.department_id
         WHERE md.manager_id = $1
         ORDER BY d.name`,
        [managerId]
      );

      return this.success(res, { departments: result.rows });
    } catch (error) {
      console.error('Get manager departments error:', error);
      return this.error(res, 'Internal server error');
    }
  }
}

export default new DepartmentsController();
