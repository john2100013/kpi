const express = require('express');
const { query } = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const multer = require('multer');
const xlsx = require('xlsx');
const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

// Get managers for a company (helper endpoint)
router.get('/managers', authenticateToken, authorizeRoles('hr', 'super_admin', 'manager'), async (req, res) => {
  try {
    const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

    if (req.user.role === 'super_admin' && !companyId) {
      return res.status(400).json({ error: 'Company ID is required for super admin' });
    }

    const result = await query(
      `SELECT u.id, u.name, u.email
       FROM users u
       WHERE u.role IN ('manager', 'hr') AND u.company_id = $1
       ORDER BY u.name`,
      [companyId]
    );

    res.json({ managers: result.rows });
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get total employee count for company (optimized for large datasets)
router.get('/count', authenticateToken, authorizeRoles('hr', 'super_admin'), async (req, res) => {
  try {
    const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

    if (req.user.role === 'super_admin' && !companyId) {
      return res.status(400).json({ error: 'Company ID is required for super admin' });
    }

    const result = await query(
      `SELECT COUNT(*) as count FROM users WHERE role = 'employee' AND company_id = $1`,
      [companyId]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get employee count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all employees with pagination (for managers, HR, and super admin)
router.get('/', authenticateToken, authorizeRoles('manager', 'hr', 'super_admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

    if (req.user.role === 'super_admin' && !companyId) {
      return res.status(400).json({ error: 'Company ID is required for super admin' });
    }

    let countQuery, dataQuery, countParams, dataParams;

    if (req.user.role === 'manager') {
      // Managers see only their team in their company
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
      // HR and Super Admin see all employees in the company
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

    res.json({
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new employee
router.post('/', authenticateToken, authorizeRoles('hr', 'super_admin'), async (req, res) => {
  try {
    const { name, email, payrollNumber, nationalId, department, departmentId, position, employmentDate, managerId } = req.body;
    const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

    if (!name || !payrollNumber || !email) {
      return res.status(400).json({ error: 'Name, payroll number, and email are required' });
    }

    if (req.user.role === 'super_admin' && !companyId) {
      return res.status(400).json({ error: 'Company ID is required for super admin' });
    }

    // Check if employee with payroll number already exists
    const existingPayroll = await query(
      'SELECT id FROM users WHERE payroll_number = $1 AND company_id = $2',
      [payrollNumber, companyId]
    );

    if (existingPayroll.rows.length > 0) {
      return res.status(400).json({ error: 'Employee with this payroll number already exists' });
    }

    // Check if email already exists
    const existingEmail = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Verify manager belongs to same company if provided
    if (managerId) {
      const managerCheck = await query(
        'SELECT id FROM users WHERE id = $1 AND company_id = $2 AND role IN ($3, $4)',
        [managerId, companyId, 'manager', 'hr']
      );
      if (managerCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid manager' });
      }
    }

    // Hash default password "Africa.1"
    const bcrypt = require('bcryptjs');
    const defaultPassword = 'Africa.1';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, password_change_required, payroll_number, national_id, role, department, department_id, position, employment_date, manager_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'employee', $7, $8, $9, $10, $11, $12)
       RETURNING id, name, email, payroll_number, national_id, department, position, employment_date, manager_id, created_at`,
      [name, email, passwordHash, true, payrollNumber, nationalId || null, department || null, departmentId || null, position || null, employmentDate || null, managerId || null, companyId]
    );

    const employeeId = result.rows[0].id;

    // Add to user_companies (required for login)
    await query(
      'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, $3) ON CONFLICT (user_id, company_id) DO NOTHING',
      [employeeId, companyId, true]
    );

    res.status(201).json({ 
      employee: result.rows[0],
      message: 'Employee created successfully with default password: Africa.1'
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk upload employees from Excel (must come before /:id)
router.post('/upload', authenticateToken, authorizeRoles('hr', 'super_admin'), upload.single('file'), async (req, res) => {
  try {
    const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

    if (!req.file) {
      return res.status(400).json({ error: 'Excel file is required' });
    }

    if (req.user.role === 'super_admin' && !companyId) {
      return res.status(400).json({ error: 'Company ID is required for super admin' });
    }

    // Parse Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
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
      `SELECT u.id, u.email, md.department_id 
       FROM users u
       LEFT JOIN manager_departments md ON u.id = md.manager_id
       WHERE u.company_id = $1 AND u.role = 'manager'`,
      [companyId]
    );
    const managerMap = {};
    mgrResult.rows.forEach(mgr => {
      if (!managerMap[mgr.email]) {
        managerMap[mgr.email] = {};
      }
      if (mgr.department_id) {
        managerMap[mgr.email][mgr.department_id] = mgr.id;
      }
    });

    let successCount = 0;
    let skipCount = 0;
    const errors = [];

    await query('BEGIN');

    try {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const name = row['Name'] || row['name'] || row['NAME'];
        const payrollNumber = row['Payroll Number'] || row['payroll_number'] || row['PayrollNumber'];
        const nationalId = row['National ID'] || row['national_id'] || row['NationalID'];
        const department = row['Department'] || row['department'] || row['DEPARTMENT'];
        const position = row['Position'] || row['position'] || row['POSITION'];
        const employmentDate = row['Employment Date'] || row['employment_date'] || row['EmploymentDate'];
        const managerEmail = row['Manager Email'] || row['manager_email'] || row['ManagerEmail'];

        if (!name || !payrollNumber || !nationalId) {
          errors.push(`Row ${i + 2}: Missing required fields (Name, Payroll Number, National ID)`);
          continue;
        }

        // Check if employee already exists
        const existing = await query(
          'SELECT id FROM users WHERE payroll_number = $1 AND company_id = $2',
          [String(payrollNumber).trim(), companyId]
        );

        if (existing.rows.length > 0) {
          skipCount++;
          continue;
        }

        // Find manager
        let managerId = null;
        if (managerEmail) {
          const mgr = managerMap[String(managerEmail).trim().toLowerCase()];
          if (mgr) {
            const deptId = department ? departmentMap[String(department).trim().toLowerCase()] : null;
            if (deptId && mgr[deptId]) {
              managerId = mgr[deptId];
            } else if (Object.keys(mgr).length > 0) {
              managerId = Object.values(mgr)[0];
            }
          }
        } else if (department) {
          const deptId = departmentMap[String(department).trim().toLowerCase()];
          if (deptId) {
            const mgrForDept = await query(
              'SELECT manager_id FROM manager_departments WHERE department_id = $1 LIMIT 1',
              [deptId]
            );
            if (mgrForDept.rows.length > 0) {
              managerId = mgrForDept.rows[0].manager_id;
            }
          }
        }

        const deptId = department ? departmentMap[String(department).trim().toLowerCase()] : null;

        const employeeResult = await query(
          `INSERT INTO users (name, payroll_number, national_id, role, department, department_id, position, employment_date, manager_id, company_id)
           VALUES ($1, $2, $3, 'employee', $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            String(name).trim(),
            String(payrollNumber).trim(),
            String(nationalId).trim(),
            department ? String(department).trim() : null,
            deptId,
            position ? String(position).trim() : null,
            employmentDate ? new Date(employmentDate) : null,
            managerId,
            companyId
          ]
        );

        // Add to user_companies (required for login)
        const employeeId = employeeResult.rows[0].id;
        await query(
          'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, $3) ON CONFLICT (user_id, company_id) DO NOTHING',
          [employeeId, companyId, true]
        );

        successCount++;
      }

      await query('COMMIT');

      res.json({
        success: true,
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
    console.error('Upload employees error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// Get employees under a manager (must come before /:id)
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

// Get employee by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

    // Employees can only see their own data, managers can see their team, HR can see all
    if (req.user.role === 'employee' && parseInt(id) !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'super_admin' && !companyId) {
      return res.status(400).json({ error: 'Company ID is required for super admin' });
    }

    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.payroll_number, u.national_id, 
              u.department, u.position, u.employment_date, u.manager_id,
              u.created_at, u.updated_at,
              m.name as manager_name,
              d.name as department_name
       FROM users u
       LEFT JOIN users m ON u.manager_id = m.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1 AND u.company_id = $2`,
      [id, companyId]
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

// Update employee
router.put('/:id', authenticateToken, authorizeRoles('hr', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, payrollNumber, nationalId, department, departmentId, position, employmentDate, managerId } = req.body;
    const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

    if (req.user.role === 'super_admin' && !companyId) {
      return res.status(400).json({ error: 'Company ID is required for super admin' });
    }

    // Verify employee exists and belongs to company
    const employeeCheck = await query(
      'SELECT id FROM users WHERE id = $1 AND company_id = $2 AND role = $3',
      [id, companyId, 'employee']
    );

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if payroll number is being changed and if it conflicts
    if (payrollNumber) {
      const payrollCheck = await query(
        'SELECT id FROM users WHERE payroll_number = $1 AND company_id = $2 AND id != $3',
        [payrollNumber, companyId, id]
      );
      if (payrollCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Payroll number already exists' });
      }
    }

    // Verify manager if provided
    if (managerId) {
      const managerCheck = await query(
        'SELECT id FROM users WHERE id = $1 AND company_id = $2 AND role IN ($3, $4)',
        [managerId, companyId, 'manager', 'hr']
      );
      if (managerCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid manager' });
      }
    }

    const result = await query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           payroll_number = COALESCE($2, payroll_number),
           national_id = COALESCE($3, national_id),
           department = COALESCE($4, department),
           department_id = COALESCE($5, department_id),
           position = COALESCE($6, position),
           employment_date = COALESCE($7, employment_date),
           manager_id = COALESCE($8, manager_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND company_id = $10
       RETURNING id, name, payroll_number, national_id, department, position, employment_date, manager_id, updated_at`,
      [name, payrollNumber, nationalId, department, departmentId, position, employmentDate, managerId, id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ employee: result.rows[0] });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete employee (cascade deletes KPIs and related data)
router.delete('/:id', authenticateToken, authorizeRoles('hr', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.query.companyId || (req.user.role === 'super_admin' ? null : req.user.company_id);

    if (req.user.role === 'super_admin' && !companyId) {
      return res.status(400).json({ error: 'Company ID is required for super admin' });
    }

    // Verify employee exists and belongs to company
    const employeeCheck = await query(
      'SELECT id FROM users WHERE id = $1 AND company_id = $2 AND role = $3',
      [id, companyId, 'employee']
    );

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Start transaction for cascade delete
    await query('BEGIN');

    try {
      // Delete KPIs (cascade will delete kpi_items, kpi_reviews, etc.)
      await query('DELETE FROM kpis WHERE employee_id = $1', [id]);
      
      // Delete notifications
      await query('DELETE FROM notifications WHERE recipient_id = $1', [id]);
      
      // Delete reminders
      await query('DELETE FROM kpi_setting_reminders WHERE employee_id = $1', [id]);
      await query('DELETE FROM kpi_review_reminders WHERE employee_id = $1', [id]);
      
      // Delete user (cascade will handle related data)
      await query('DELETE FROM users WHERE id = $1', [id]);

      await query('COMMIT');

      res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

