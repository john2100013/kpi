import { BaseController } from './BaseController.js';
import { query } from '../database/db.js';
import bcrypt from 'bcryptjs';

class EmployeesController extends BaseController {
  /**
   * Get managers for a company
   */
  async getManagers(req, res) {
    try {
      const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

      if (req.user.role === 'super_admin' && !companyId) {
        return this.validationError(res, 'Company ID is required for super admin');
      }

      const result = await query(
        `SELECT u.id, u.name, u.email
         FROM users u
         WHERE u.role IN ('manager', 'hr') AND u.company_id = $1
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
   * Get employee count
   */
  async getEmployeeCount(req, res) {
    try {
      const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

      if (req.user.role === 'super_admin' && !companyId) {
        return this.validationError(res, 'Company ID is required for super admin');
      }

      const result = await query(
        `SELECT COUNT(*) as count FROM users WHERE role = 'employee' AND company_id = $1`,
        [companyId]
      );

      return this.success(res, { count: parseInt(result.rows[0].count) });
    } catch (error) {
      console.error('Get employee count error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get all employees with pagination
   */
  async getAllEmployees(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

      if (req.user.role === 'super_admin' && !companyId) {
        return this.validationError(res, 'Company ID is required for super admin');
      }

      let countQuery, dataQuery, countParams, dataParams;

      if (req.user.role === 'manager') {
        const searchCondition = search 
          ? `AND (u.name ILIKE $3 OR u.payroll_number ILIKE $3 OR u.email ILIKE $3)`
          : '';
        
        countQuery = `
          SELECT COUNT(*) as total
          FROM users u
          WHERE u.role = 'employee' 
          AND (u.manager_id = $1 OR u.id = $1) 
          AND u.company_id = $2
          ${searchCondition}
        `;
        
        dataQuery = `
          SELECT u.id, u.name, u.email, u.role, u.payroll_number, u.national_id, 
                 u.department, u.position, u.employment_date, u.manager_id,
                 u.created_at, u.updated_at,
                 m.name as manager_name,
                 d.name as department_name
          FROM users u
          LEFT JOIN users m ON u.manager_id = m.id
          LEFT JOIN departments d ON u.department_id = d.id
          WHERE u.role = 'employee' 
          AND (u.manager_id = $1 OR u.id = $1) 
          AND u.company_id = $2
          ${searchCondition}
          ORDER BY u.name
          LIMIT $${search ? 4 : 3} OFFSET $${search ? 5 : 4}
        `;
        
        countParams = search ? [req.user.id, req.user.company_id, `%${search}%`] : [req.user.id, req.user.company_id];
        dataParams = search 
          ? [req.user.id, req.user.company_id, `%${search}%`, limit, offset]
          : [req.user.id, req.user.company_id, limit, offset];
      } else {
        const searchCondition = search 
          ? `AND (u.name ILIKE $2 OR u.payroll_number ILIKE $2 OR u.email ILIKE $2)`
          : '';
        
        countQuery = `
          SELECT COUNT(*) as total
          FROM users u
          WHERE u.role = 'employee' AND u.company_id = $1
          ${searchCondition}
        `;
        
        dataQuery = `
          SELECT u.id, u.name, u.email, u.role, u.payroll_number, u.national_id,
                 u.department, u.position, u.employment_date, u.manager_id,
                 u.created_at, u.updated_at,
                 m.name as manager_name,
                 d.name as department_name
          FROM users u
          LEFT JOIN users m ON u.manager_id = m.id
          LEFT JOIN departments d ON u.department_id = d.id
          WHERE u.role = 'employee' AND u.company_id = $1
          ${searchCondition}
          ORDER BY u.name
          LIMIT $${search ? 3 : 2} OFFSET $${search ? 4 : 3}
        `;
        
        countParams = search ? [companyId, `%${search}%`] : [companyId];
        dataParams = search 
          ? [companyId, `%${search}%`, limit, offset]
          : [companyId, limit, offset];
      }

      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);
      
      const dataResult = await query(dataQuery, dataParams);

      return this.success(res, {
        employees: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get employees error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Create new employee
   */
  async createEmployee(req, res) {
    try {
      const { name, email, payrollNumber, nationalId, department, departmentId, position, employmentDate, managerId } = req.body;
      const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

      if (!name || !payrollNumber || !email) {
        return this.validationError(res, 'Name, payroll number, and email are required');
      }

      if (req.user.role === 'super_admin' && !companyId) {
        return this.validationError(res, 'Company ID is required for super admin');
      }

      // Check if employee with payroll number already exists
      const existingPayroll = await query(
        'SELECT id FROM users WHERE payroll_number = $1 AND company_id = $2',
        [payrollNumber, companyId]
      );

      if (existingPayroll.rows.length > 0) {
        return this.validationError(res, 'Employee with this payroll number already exists');
      }

      // Check if email already exists
      const existingEmail = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingEmail.rows.length > 0) {
        return this.validationError(res, 'Email already exists');
      }

      // Verify manager if provided
      if (managerId) {
        const managerCheck = await query(
          'SELECT id FROM users WHERE id = $1 AND company_id = $2 AND role IN ($3, $4)',
          [managerId, companyId, 'manager', 'hr']
        );
        if (managerCheck.rows.length === 0) {
          return this.validationError(res, 'Invalid manager');
        }
      }

      // Hash default password
      const defaultPassword = 'Africa.1';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      const result = await query(
        `INSERT INTO users (name, email, password_hash, password_change_required, payroll_number, national_id, role, department, department_id, position, employment_date, manager_id, company_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'employee', $7, $8, $9, $10, $11, $12)
         RETURNING id, name, email, payroll_number, national_id, department, position, employment_date, manager_id, created_at`,
        [name, email, passwordHash, true, payrollNumber, nationalId || null, department || null, departmentId || null, position || null, employmentDate || null, managerId || null, companyId]
      );

      const employeeId = result.rows[0].id;

      // Add to user_companies
      await query(
        'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, $3) ON CONFLICT (user_id, company_id) DO NOTHING',
        [employeeId, companyId, true]
      );

      return this.success(res, { 
        employee: result.rows[0],
        message: 'Employee created successfully with default password: Africa.1'
      }, 201);
    } catch (error) {
      console.error('Create employee error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get single employee by ID
   */
  async getEmployeeById(req, res) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT u.id, u.name, u.email, u.payroll_number, u.national_id, 
                u.department, u.department_id, u.position, u.employment_date, u.manager_id,
                u.created_at, u.updated_at,
                m.name as manager_name,
                d.name as department_name
         FROM users u
         LEFT JOIN users m ON u.manager_id = m.id
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.id = $1 AND u.role = 'employee'`,
        [id]
      );

      if (result.rows.length === 0) {
        return this.notFound(res, 'Employee not found');
      }

      return this.success(res, { employee: result.rows[0] });
    } catch (error) {
      console.error('Get employee error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Update employee
   */
  async updateEmployee(req, res) {
    try {
      const { id } = req.params;
      const { name, email, payrollNumber, nationalId, department, departmentId, position, employmentDate, managerId } = req.body;

      // Check if employee exists
      const existing = await query(
        'SELECT id, company_id FROM users WHERE id = $1 AND role = $2',
        [id, 'employee']
      );

      if (existing.rows.length === 0) {
        return this.notFound(res, 'Employee not found');
      }

      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (name) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (email) {
        updates.push(`email = $${paramIndex++}`);
        values.push(email);
      }
      if (payrollNumber) {
        updates.push(`payroll_number = $${paramIndex++}`);
        values.push(payrollNumber);
      }
      if (nationalId !== undefined) {
        updates.push(`national_id = $${paramIndex++}`);
        values.push(nationalId);
      }
      if (department !== undefined) {
        updates.push(`department = $${paramIndex++}`);
        values.push(department);
      }
      if (departmentId !== undefined) {
        updates.push(`department_id = $${paramIndex++}`);
        values.push(departmentId);
      }
      if (position !== undefined) {
        updates.push(`position = $${paramIndex++}`);
        values.push(position);
      }
      if (employmentDate !== undefined) {
        updates.push(`employment_date = $${paramIndex++}`);
        values.push(employmentDate);
      }
      if (managerId !== undefined) {
        updates.push(`manager_id = $${paramIndex++}`);
        values.push(managerId);
      }

      if (updates.length === 0) {
        return this.validationError(res, 'No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      return this.success(res, { message: 'Employee updated successfully' });
    } catch (error) {
      console.error('Update employee error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Delete employee
   */
  async deleteEmployee(req, res) {
    try {
      const { id } = req.params;

      const result = await query(
        'DELETE FROM users WHERE id = $1 AND role = $2 RETURNING id',
        [id, 'employee']
      );

      if (result.rows.length === 0) {
        return this.notFound(res, 'Employee not found');
      }

      return this.success(res, { message: 'Employee deleted successfully' });
    } catch (error) {
      console.error('Delete employee error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get employees by manager ID
   */
  async getEmployeesByManager(req, res) {
    try {
      const { managerId } = req.params;

      const result = await query(
        `SELECT u.id, u.name, u.email, u.payroll_number, u.national_id, 
                u.department, u.position, u.employment_date, u.manager_id,
                m.name as manager_name,
                d.name as department_name
         FROM users u
         LEFT JOIN users m ON u.manager_id = m.id
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.manager_id = $1 AND u.role = 'employee'
         ORDER BY u.name`,
        [managerId]
      );

      return this.success(res, { employees: result.rows });
    } catch (error) {
      console.error('Get employees by manager error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Bulk upload employees from Excel file
   */
  async bulkUploadEmployees(req, res) {
    try {
      const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

      if (!req.file) {
        return this.validationError(res, 'Excel file is required');
      }

      if (req.user.role === 'super_admin' && !companyId) {
        return this.validationError(res, 'Company ID is required for super admin');
      }

      // Parse Excel file
      const xlsx = await import('xlsx');
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        return this.validationError(res, 'Excel file is empty');
      }

      // Parse employees from Excel data
      const employees = [];
      const errors = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const name = row['Name'] || row['name'] || row['NAME'];
        const payrollNumber = row['Payroll Number'] || row['payroll_number'] || row['PayrollNumber'];
        const email = row['Email'] || row['email'] || row['EMAIL'];
        const nationalId = row['National ID'] || row['national_id'] || row['NationalID'];
        const department = row['Department'] || row['department'];
        const position = row['Position'] || row['position'];
        const employmentDate = row['Employment Date'] || row['employment_date'];
        const managerEmail = row['Manager Email'] || row['manager_email'];

        if (!name || !payrollNumber || !email) {
          errors.push(`Row ${i + 2}: Missing required fields (Name, Payroll Number, Email)`);
          continue;
        }

        employees.push({
          name: String(name).trim(),
          payrollNumber: String(payrollNumber).trim(),
          email: String(email).trim(),
          nationalId: nationalId ? String(nationalId).trim() : null,
          department: department ? String(department).trim() : null,
          position: position ? String(position).trim() : null,
          employmentDate: employmentDate ? new Date(employmentDate) : null,
          managerEmail: managerEmail ? String(managerEmail).trim() : null,
        });
      }

      if (employees.length === 0) {
        return this.validationError(res, 'No valid employees found in Excel file');
      }

      // Get departments for this company
      const deptResult = await query(
        'SELECT id, name FROM departments WHERE company_id = $1',
        [companyId]
      );
      const departmentMap = {};
      deptResult.rows.forEach(dept => {
        departmentMap[dept.name.toLowerCase()] = dept.id;
      });

      // Get managers for this company
      const mgrResult = await query(
        `SELECT u.id, u.email
         FROM users u
         WHERE u.company_id = $1 AND u.role IN ('manager', 'hr')`,
        [companyId]
      );
      const managerMap = {};
      mgrResult.rows.forEach(mgr => {
        managerMap[mgr.email.toLowerCase()] = mgr.id;
      });

      // Insert employees
      let successCount = 0;
      let skipCount = 0;

      await query('BEGIN');

      try {
        const defaultPassword = 'Africa.1';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        for (const employee of employees) {
          // Check if employee already exists
          const existing = await query(
            'SELECT id FROM users WHERE (payroll_number = $1 OR email = $2) AND company_id = $3',
            [employee.payrollNumber, employee.email, companyId]
          );

          if (existing.rows.length > 0) {
            skipCount++;
            continue;
          }

          // Find manager
          let managerId = null;
          if (employee.managerEmail) {
            managerId = managerMap[employee.managerEmail.toLowerCase()] || null;
          }

          // Get department ID
          const deptId = employee.department ? departmentMap[employee.department.toLowerCase()] : null;

          const employeeResult = await query(
            `INSERT INTO users (name, email, password_hash, password_change_required, payroll_number, national_id, role, department, department_id, position, employment_date, manager_id, company_id)
             VALUES ($1, $2, $3, $4, $5, $6, 'employee', $7, $8, $9, $10, $11, $12)
             RETURNING id`,
            [
              employee.name,
              employee.email,
              passwordHash,
              true,
              employee.payrollNumber,
              employee.nationalId,
              employee.department,
              deptId,
              employee.position,
              employee.employmentDate,
              managerId,
              companyId
            ]
          );

          // Add to user_companies
          const employeeId = employeeResult.rows[0].id;
          await query(
            'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, $3) ON CONFLICT (user_id, company_id) DO NOTHING',
            [employeeId, companyId, true]
          );

          successCount++;
        }

        await query('COMMIT');

        return this.success(res, {
          message: `Successfully imported ${successCount} employees`,
          imported: successCount,
          skipped: skipCount,
          errors: errors.length > 0 ? errors : undefined
        });
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Bulk upload employees error:', error);
      return this.error(res, 'Internal server error: ' + error.message);
    }
  }
}

export default new EmployeesController();
