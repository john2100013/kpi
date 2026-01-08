import { BaseController } from './BaseController.js';
import { query } from '../database/db.js';
import bcrypt from 'bcryptjs';

class CompaniesController extends BaseController {
  /**
   * Get all companies for current user
   */
  async getMyCompanies(req, res) {
    try {
      const result = await query(
        `SELECT c.id, c.name, c.domain, uc.is_primary
         FROM companies c
         INNER JOIN user_companies uc ON c.id = uc.company_id
         WHERE uc.user_id = $1
         ORDER BY uc.is_primary DESC, c.name`,
        [req.user.id]
      );

      return this.success(res, { companies: result.rows });
    } catch (error) {
      console.error('Get companies error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get all companies with statistics (super admin only)
   */
  async getAllCompanies(req, res) {
    try {
      const result = await query(
        `SELECT 
          c.id, 
          c.name, 
          c.domain, 
          c.created_at,
          (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id AND u.role = 'employee') as total_employees,
          (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id AND u.role = 'manager') as total_managers,
          (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id AND u.role = 'hr') as total_hr,
          (SELECT COUNT(*) FROM departments d WHERE d.company_id = c.id) as total_departments
         FROM companies c
         ORDER BY c.name`
      );

      return this.success(res, { companies: result.rows });
    } catch (error) {
      console.error('Get all companies error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get all HR users with their companies
   */
  async getHRUsers(req, res) {
    try {
      const result = await query(
        `SELECT 
           u.id,
           u.name,
           u.email,
           COALESCE(
             JSON_AGG(
               DISTINCT JSONB_BUILD_OBJECT(
                 'id', c.id,
                 'name', c.name,
                 'domain', c.domain,
                 'is_primary', uc.is_primary
               )
             ) FILTER (WHERE c.id IS NOT NULL),
             '[]'
           ) AS companies
         FROM users u
         LEFT JOIN user_companies uc ON u.id = uc.user_id
         LEFT JOIN companies c ON uc.company_id = c.id
         WHERE u.role = 'hr'
         GROUP BY u.id, u.name, u.email
         ORDER BY u.name`
      );

      return this.success(res, { hrUsers: result.rows });
    } catch (error) {
      console.error('Get HR users error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get available companies for HR user
   */
  async getAvailableCompaniesForHR(req, res) {
    try {
      const { userId } = req.params;

      // Verify the user is an HR user
      const userResult = await query(
        'SELECT id, role FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return this.notFound(res, 'HR user not found');
      }

      if (userResult.rows[0].role !== 'hr') {
        return this.validationError(res, 'Selected user is not an HR user');
      }

      // Return companies not associated with this HR user
      const companiesResult = await query(
        `SELECT c.id, c.name, c.domain, c.created_at
         FROM companies c
         WHERE NOT EXISTS (
           SELECT 1 
           FROM user_companies uc 
           WHERE uc.company_id = c.id 
             AND uc.user_id = $1
         )
         ORDER BY c.name`,
        [userId]
      );

      return this.success(res, { companies: companiesResult.rows });
    } catch (error) {
      console.error('Get available companies for HR error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Assign HR user to company
   */
  async assignHRToCompany(req, res) {
    try {
      const { userId, companyId } = req.body;

      if (!userId || !companyId) {
        return this.validationError(res, 'User ID and Company ID are required');
      }

      // Verify user is HR
      const userResult = await query(
        'SELECT id, role FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return this.notFound(res, 'HR user not found');
      }

      if (userResult.rows[0].role !== 'hr') {
        return this.validationError(res, 'Selected user is not an HR user');
      }

      // Verify company exists
      const companyResult = await query(
        'SELECT id FROM companies WHERE id = $1',
        [companyId]
      );

      if (companyResult.rows.length === 0) {
        return this.notFound(res, 'Company not found');
      }

      // Check if already assigned
      const existingAssignment = await query(
        'SELECT user_id FROM user_companies WHERE user_id = $1 AND company_id = $2',
        [userId, companyId]
      );

      if (existingAssignment.rows.length > 0) {
        return this.validationError(res, 'HR user is already assigned to this company');
      }

      // Assign HR to company
      await query(
        'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, false)',
        [userId, companyId]
      );

      return this.success(res, { message: 'HR user successfully assigned to company' });
    } catch (error) {
      console.error('Assign HR to company error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Create new company with initial HR user
   */
  async createCompany(req, res) {
    try {
      const { companyName, domain, hrName, hrEmail, hrPassword } = req.body;

      if (!companyName || !hrEmail || !hrPassword) {
        return this.validationError(res, 'Company name, HR email, and password are required');
      }

      // Check if company name already exists
      const existingCompany = await query(
        'SELECT id FROM companies WHERE name = $1',
        [companyName]
      );

      if (existingCompany.rows.length > 0) {
        return this.validationError(res, 'Company with this name already exists');
      }

      // Check if HR email already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [hrEmail]
      );

      if (existingUser.rows.length > 0) {
        return this.validationError(res, 'User with this email already exists');
      }

      // Start transaction
      await query('BEGIN');

      try {
        // Create company
        const companyResult = await query(
          'INSERT INTO companies (name, domain) VALUES ($1, $2) RETURNING id',
          [companyName, domain || null]
        );
        const companyId = companyResult.rows[0].id;

        // Hash password
        const passwordHash = await bcrypt.hash(hrPassword, 10);

        // Create HR user
        const hrResult = await query(
          `INSERT INTO users (name, email, password_hash, role, company_id)
           VALUES ($1, $2, $3, 'hr', $4) RETURNING id`,
          [hrName || 'HR User', hrEmail, passwordHash, companyId]
        );
        const hrId = hrResult.rows[0].id;

        // Add to user_companies
        await query(
          'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, true)',
          [hrId, companyId]
        );

        await query('COMMIT');

        return this.success(res, {
          message: 'Company created successfully',
          company: { id: companyId, name: companyName },
          hrUser: { id: hrId, email: hrEmail }
        }, 201);
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Create company error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Bulk upload users for a company
   */
  async bulkUploadUsers(req, res) {
    try {
      const { companyId } = req.params;
      const file = req.file;

      if (!file) {
        return this.validationError(res, 'Excel file is required');
      }

      // Parse Excel file
      const xlsx = await import('xlsx');
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        return this.validationError(res, 'Excel file is empty');
      }

      let successCount = 0;
      let skipCount = 0;
      const errors = [];

      await query('BEGIN');

      try {
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const name = row['Name'] || row['name'];
          const email = row['Email'] || row['email'];
          const role = (row['Role'] || row['role'] || 'employee').toLowerCase();
          const password = row['Password'] || row['password'] || 'defaultPass123';

          if (!name || !email) {
            errors.push(`Row ${i + 2}: Missing required fields (Name, Email)`);
            continue;
          }

          // Check if user already exists
          const existing = await query(
            'SELECT id FROM users WHERE email = $1',
            [email.trim()]
          );

          if (existing.rows.length > 0) {
            skipCount++;
            continue;
          }

          // Hash password
          const passwordHash = await bcrypt.hash(password, 10);

          // Create user
          const userResult = await query(
            `INSERT INTO users (name, email, password_hash, role, company_id)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [name.trim(), email.trim(), passwordHash, role, companyId]
          );

          // Add to user_companies
          await query(
            'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, true)',
            [userResult.rows[0].id, companyId]
          );

          successCount++;
        }

        await query('COMMIT');

        return this.success(res, {
          message: `Successfully imported ${successCount} users`,
          imported: successCount,
          skipped: skipCount,
          errors: errors.length > 0 ? errors : undefined
        });
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Bulk upload users error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Update company
   */
  async updateCompany(req, res) {
    try {
      const { id } = req.params;
      const { name, domain } = req.body;

      if (!name) {
        return this.validationError(res, 'Company name is required');
      }

      // Check if company exists
      const existing = await query('SELECT id FROM companies WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return this.notFound(res, 'Company not found');
      }

      // Update company
      await query(
        'UPDATE companies SET name = $1, domain = $2 WHERE id = $3',
        [name, domain || null, id]
      );

      return this.success(res, { message: 'Company updated successfully' });
    } catch (error) {
      console.error('Update company error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Delete company
   */
  async deleteCompany(req, res) {
    try {
      const { id } = req.params;

      // Check if company has users
      const usersResult = await query(
        'SELECT COUNT(*) as count FROM users WHERE company_id = $1',
        [id]
      );

      if (parseInt(usersResult.rows[0].count) > 0) {
        return this.validationError(res, 'Cannot delete company with existing users');
      }

      // Delete company
      const result = await query('DELETE FROM companies WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        return this.notFound(res, 'Company not found');
      }

      return this.success(res, { message: 'Company deleted successfully' });
    } catch (error) {
      console.error('Delete company error:', error);
      return this.error(res, 'Internal server error');
    }
  }
}

export default new CompaniesController();
