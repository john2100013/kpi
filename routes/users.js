const express = require('express');
const router = express.Router();
const { pool } = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get user counts by role (for all companies or specific company)
// Optimized query with conditional company filter
router.get('/counts', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { companyId } = req.query;
    
    let query;
    let params;
    
    if (companyId && companyId !== 'all') {
      // Get counts for specific company
      query = `
        SELECT 
          role,
          COUNT(*) as count
        FROM users
        WHERE company_id = $1 AND role IN ('employee', 'manager', 'hr')
        GROUP BY role
      `;
      params = [companyId];
    } else {
      // Get counts for all companies
      query = `
        SELECT 
          role,
          COUNT(*) as count
        FROM users
        WHERE role IN ('employee', 'manager', 'hr')
        GROUP BY role
      `;
      params = [];
    }
    
    const result = await pool.query(query, params);
    
    // Transform result to object
    const counts = {
      employee: 0,
      manager: 0,
      hr: 0
    };
    
    result.rows.forEach(row => {
      counts[row.role] = parseInt(row.count);
    });
    
    res.json({ counts });
  } catch (error) {
    console.error('Error fetching user counts:', error);
    res.status(500).json({ error: 'Failed to fetch user counts' });
  }
});

// Get paginated users list by role and company
// Optimized with proper indexing assumptions and efficient JOIN
router.get('/', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { companyId, role, page = 1, limit = 25 } = req.query;
    
    if (!companyId || companyId === 'all') {
      return res.status(400).json({ error: 'Company selection is required for user list' });
    }
    
    if (!role || !['employee', 'manager', 'hr'].includes(role)) {
      return res.status(400).json({ error: 'Valid role is required (employee, manager, hr)' });
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Optimized query with LEFT JOIN for manager/department info
    // Note: All user data including employee info is in users table
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.company_id,
        u.payroll_number,
        u.national_id,
        u.department,
        d.name as department_name,
        u.position,
        u.employment_date,
        u.manager_id,
        m.name as manager_name
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
    
    // Execute both queries in parallel for better performance
    const [usersResult, countResult] = await Promise.all([
      pool.query(query, [companyId, role, parseInt(limit), offset]),
      pool.query(countQuery, [companyId, role])
    ]);
    
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / parseInt(limit));
    
    res.json({
      users: usersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user information
// Optimized to update only changed fields
router.put('/:userId', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;
    const { companyId } = req.query;
    const {
      name,
      email,
      payroll_number,
      national_id,
      department,
      position,
      employment_date,
      manager_id
    } = req.body;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    
    await client.query('BEGIN');
    
    // Verify user belongs to the specified company
    const userCheck = await client.query(
      'SELECT role FROM users WHERE id = $1 AND company_id = $2',
      [userId, companyId]
    );
    
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found in this company' });
    }
    
    const userRole = userCheck.rows[0].role;
    
    // Build dynamic update query for users table
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;
    
    // Always update name and email
    updateFields.push(`name = $${paramCount++}`);
    updateValues.push(name);
    updateFields.push(`email = $${paramCount++}`);
    updateValues.push(email);
    
    // Add optional fields based on role
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
      // For managers and HR, allow updating department and position
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
    
    // Update users table
    await client.query(
      `UPDATE users 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}`,
      updateValues
    );
    
    await client.query('COMMIT');
    
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  } finally {
    client.release();
  }
});

// Add HR to multiple companies
// Allows an HR user to belong to multiple companies
router.post('/add-hr-to-companies', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { hr_id, company_ids } = req.body;
    
    if (!hr_id || !company_ids || !Array.isArray(company_ids) || company_ids.length === 0) {
      return res.status(400).json({ error: 'HR user ID and company IDs are required' });
    }
    
    await client.query('BEGIN');
    
    // Verify the user is HR
    const userCheck = await client.query(
      'SELECT id, role FROM users WHERE id = $1',
      [hr_id]
    );
    
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'HR user not found' });
    }
    
    if (userCheck.rows[0].role !== 'hr') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Selected user is not an HR user' });
    }
    
    // Create user_companies table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_companies (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, company_id)
      )
    `);
    
    // Add HR to each company (ignore if already exists)
    for (const company_id of company_ids) {
      await client.query(
        `INSERT INTO user_companies (user_id, company_id) 
         VALUES ($1, $2) 
         ON CONFLICT (user_id, company_id) DO NOTHING`,
        [hr_id, company_id]
      );
    }
    
    await client.query('COMMIT');
    
    res.json({ 
      message: 'HR user successfully added to companies',
      hr_id,
      company_count: company_ids.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding HR to companies:', error);
    res.status(500).json({ error: 'Failed to add HR to companies' });
  } finally {
    client.release();
  }
});

// Database optimization recommendations:
// These indexes should exist for optimal performance:
// CREATE INDEX IF NOT EXISTS idx_users_company_role ON users(company_id, role);
// CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
// CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id) WHERE manager_id IS NOT NULL;
// CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id) WHERE department_id IS NOT NULL;
// CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id);
//
// Note: Employee data is stored directly in users table, not in separate employees table

module.exports = router;
