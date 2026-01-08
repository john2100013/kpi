import { BaseController } from './BaseController.js';
import { query } from '../database/db.js';

class UsersController extends BaseController {
  /**
   * Get user counts by role
   */
  async getCounts(req, res) {
    try {
      const { companyId } = req.query;
      
      let queryText;
      let params;
      
      if (companyId && companyId !== 'all') {
        queryText = `
          SELECT role, COUNT(*) as count
          FROM users
          WHERE company_id = $1 AND role IN ('employee', 'manager', 'hr')
          GROUP BY role
        `;
        params = [companyId];
      } else {
        queryText = `
          SELECT role, COUNT(*) as count
          FROM users
          WHERE role IN ('employee', 'manager', 'hr')
          GROUP BY role
        `;
        params = [];
      }
      
      const result = await query(queryText, params);
      
      const counts = { employee: 0, manager: 0, hr: 0 };
      result.rows.forEach(row => {
        counts[row.role] = parseInt(row.count);
      });
      
      return this.success(res, { counts });
    } catch (error) {
      console.error('Error fetching user counts:', error);
      return this.error(res, 'Failed to fetch user counts');
    }
  }

  /**
   * Get paginated users list
   */
  async getAll(req, res) {
    try {
      const { companyId, role, page = 1, limit = 25 } = req.query;
      
      // Special case: fetch all users of specific role across companies (for dropdowns)
      if (!companyId && role && ['manager', 'hr'].includes(role)) {
        const result = await query(
          `SELECT u.id, u.name, u.email, u.role, u.company_id, c.name as company_name
           FROM users u
           LEFT JOIN companies c ON u.company_id = c.id
           WHERE u.role = $1
           ORDER BY c.name, u.name ASC
           LIMIT $2`,
          [role, parseInt(limit)]
        );
        
        return this.success(res, {
          users: result.rows,
          pagination: {
            page: 1,
            limit: parseInt(limit),
            total: result.rows.length,
            totalPages: 1
          }
        });
      }
      
      if (!companyId || companyId === 'all') {
        return this.validationError(res, 'Company selection is required for user list');
      }
      
      if (!role || !['employee', 'manager', 'hr'].includes(role)) {
        return this.validationError(res, 'Valid role is required (employee, manager, hr)');
      }
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      const queryText = `
        SELECT u.id, u.name, u.email, u.role, u.company_id, u.payroll_number,
               u.national_id, u.department, d.name as department_name, u.position,
               u.employment_date, u.manager_id, m.name as manager_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users m ON u.manager_id = m.id
        WHERE u.company_id = $1 AND u.role = $2
        ORDER BY u.name ASC
        LIMIT $3 OFFSET $4
      `;
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM users
        WHERE company_id = $1 AND role = $2
      `;
      
      const [usersResult, countResult] = await Promise.all([
        query(queryText, [companyId, role, parseInt(limit), offset]),
        query(countQuery, [companyId, role])
      ]);
      
      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / parseInt(limit));
      let users = usersResult.rows;
      
      // If fetching managers, include assigned departments
      if (role === 'manager') {
        const tableCheck = await query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'manager_departments'
          )
        `);
        
        if (tableCheck.rows[0].exists) {
          for (let user of users) {
            const deptResult = await query(
              `SELECT d.id, d.name
               FROM manager_departments md
               JOIN departments d ON d.id = md.department_id
               WHERE md.manager_id = $1
               ORDER BY d.name`,
              [user.id]
            );
            user.assigned_departments = deptResult.rows;
          }
        }
      }
      
      return this.success(res, {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      return this.error(res, 'Failed to fetch users');
    }
  }

  /**
   * Update user
   */
  async update(req, res) {
    try {
      const { userId } = req.params;
      const { companyId } = req.query;
      const {
        name, email, payroll_number, national_id,
        department, position, employment_date, manager_id
      } = req.body;
      
      if (!companyId) {
        return this.validationError(res, 'Company ID is required');
      }
      
      await query('BEGIN');
      
      const userCheck = await query(
        'SELECT role FROM users WHERE id = $1 AND company_id = $2',
        [userId, companyId]
      );
      
      if (userCheck.rows.length === 0) {
        await query('ROLLBACK');
        return this.notFound(res, 'User not found in this company');
      }
      
      const userRole = userCheck.rows[0].role;
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;
      
      updateFields.push(`name = $${paramCount++}`);
      updateValues.push(name);
      updateFields.push(`email = $${paramCount++}`);
      updateValues.push(email);
      
      if (userRole === 'employee') {
        if (payroll_number !== undefined) {
          updateFields.push(`payroll_number = $${paramCount++}`);
          updateValues.push(payroll_number);
        }
        if (national_id !== undefined) {
          updateFields.push(`national_id = $${paramCount++}`);
          updateValues.push(national_id);
        }
        if (department !== undefined) {
          updateFields.push(`department = $${paramCount++}`);
          updateValues.push(department);
        }
        if (position !== undefined) {
          updateFields.push(`position = $${paramCount++}`);
          updateValues.push(position);
        }
        if (employment_date !== undefined) {
          updateFields.push(`employment_date = $${paramCount++}`);
          updateValues.push(employment_date || null);
        }
        if (manager_id !== undefined) {
          updateFields.push(`manager_id = $${paramCount++}`);
          updateValues.push(manager_id || null);
        }
      } else {
        if (department !== undefined) {
          updateFields.push(`department = $${paramCount++}`);
          updateValues.push(department);
        }
        if (position !== undefined) {
          updateFields.push(`position = $${paramCount++}`);
          updateValues.push(position);
        }
      }
      
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(userId);
      
      await query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
        updateValues
      );
      
      await query('COMMIT');
      
      return this.success(res, { message: 'User updated successfully' });
    } catch (error) {
      await query('ROLLBACK');
      console.error('Error updating user:', error);
      return this.error(res, 'Failed to update user');
    }
  }

  /**
   * Add HR to multiple companies
   */
  async addHRToCompanies(req, res) {
    try {
      const { hr_id, company_ids } = req.body;
      
      if (!hr_id || !company_ids || !Array.isArray(company_ids) || company_ids.length === 0) {
        return this.validationError(res, 'HR user ID and company IDs are required');
      }
      
      await query('BEGIN');
      
      const userCheck = await query(
        'SELECT id, role FROM users WHERE id = $1',
        [hr_id]
      );
      
      if (userCheck.rows.length === 0) {
        await query('ROLLBACK');
        return this.notFound(res, 'HR user not found');
      }
      
      if (userCheck.rows[0].role !== 'hr') {
        await query('ROLLBACK');
        return this.validationError(res, 'Selected user is not an HR user');
      }
      
      await query(`
        CREATE TABLE IF NOT EXISTS user_companies (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, company_id)
        )
      `);
      
      for (const company_id of company_ids) {
        await query(
          `INSERT INTO user_companies (user_id, company_id) 
           VALUES ($1, $2) 
           ON CONFLICT (user_id, company_id) DO NOTHING`,
          [hr_id, company_id]
        );
      }
      
      await query('COMMIT');
      
      return this.success(res, { 
        message: 'HR user successfully added to companies',
        hr_id,
        company_count: company_ids.length
      });
    } catch (error) {
      await query('ROLLBACK');
      console.error('Error adding HR to companies:', error);
      return this.error(res, 'Failed to add HR to companies');
    }
  }

  /**
   * Get manager's departments
   */
  async getManagerDepartments(req, res) {
    try {
      const { userId } = req.params;
      
      const tableCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'manager_departments'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        return this.success(res, { department_ids: [] });
      }
      
      const result = await query(
        'SELECT department_id FROM manager_departments WHERE manager_id = $1',
        [userId]
      );
      
      return this.success(res, { department_ids: result.rows.map(r => r.department_id) });
    } catch (error) {
      console.error('Error fetching manager departments:', error);
      return this.error(res, 'Failed to fetch manager departments');
    }
  }

  /**
   * Assign manager to departments
   */
  async assignManagerDepartments(req, res) {
    try {
      const { manager_id, department_ids } = req.body;
      
      if (!manager_id || !department_ids || !Array.isArray(department_ids)) {
        return this.validationError(res, 'Manager ID and department IDs are required');
      }
      
      await query('BEGIN');
      
      await query(`
        CREATE TABLE IF NOT EXISTS manager_departments (
          id SERIAL PRIMARY KEY,
          manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(manager_id, department_id)
        )
      `);
      
      await query(`
        CREATE INDEX IF NOT EXISTS idx_manager_departments_manager_id 
        ON manager_departments(manager_id)
      `);
      
      await query(`
        CREATE INDEX IF NOT EXISTS idx_manager_departments_department_id 
        ON manager_departments(department_id)
      `);
      
      await query('DELETE FROM manager_departments WHERE manager_id = $1', [manager_id]);
      
      const managerResult = await query('SELECT company_id FROM users WHERE id = $1', [manager_id]);
      if (managerResult.rows.length === 0) {
        await query('ROLLBACK');
        return this.notFound(res, 'Manager not found');
      }
      
      const companyId = managerResult.rows[0].company_id;
      
      for (const deptId of department_ids) {
        await query(
          `INSERT INTO manager_departments (manager_id, department_id, company_id) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (manager_id, department_id) DO NOTHING`,
          [manager_id, deptId, companyId]
        );
      }
      
      await query('COMMIT');
      
      return this.success(res, { message: 'Manager departments assigned successfully' });
    } catch (error) {
      await query('ROLLBACK');
      console.error('Error assigning manager departments:', error);
      return this.error(res, 'Failed to assign manager departments');
    }
  }
}

export default new UsersController();
