const express = require('express');
const bcrypt = require('bcryptjs');
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

// Get all companies for a user (for multi-company selection)
router.get('/my-companies', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id, c.name, c.domain, uc.is_primary
       FROM companies c
       INNER JOIN user_companies uc ON c.id = uc.company_id
       WHERE uc.user_id = $1
       ORDER BY uc.is_primary DESC, c.name`,
      [req.user.id]
    );

    res.json({ companies: result.rows });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all companies with statistics (for super admin)
router.get('/', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
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

    res.json({ companies: result.rows });
  } catch (error) {
    console.error('Get all companies error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new company with onboarding data (super admin only)
router.post('/onboard', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { 
      companyName, 
      hrUsers, 
      departments, 
      managers, 
      employees 
    } = req.body;

    if (!companyName) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Start transaction
    await query('BEGIN');

    try {
      // 1. Create company
      const companyResult = await query(
        'INSERT INTO companies (name) VALUES ($1) RETURNING id',
        [companyName]
      );
      const companyId = companyResult.rows[0].id;

      // 2. Create departments
      const departmentMap = {};
      if (departments && departments.length > 0) {
        for (const deptName of departments) {
          if (deptName && deptName.trim()) {
            const deptResult = await query(
              'INSERT INTO departments (company_id, name) VALUES ($1, $2) RETURNING id',
              [companyId, deptName.trim()]
            );
            departmentMap[deptName.trim()] = deptResult.rows[0].id;
          }
        }
      }

      // 3. Create HR users
      const hrUserIds = [];
      if (hrUsers && hrUsers.length > 0) {
        for (const hr of hrUsers) {
          if (!hr.email || !hr.password || !hr.name) {
            continue;
          }

          const passwordHash = await bcrypt.hash(hr.password, 10);
          
          // Check if user with this email already exists
          const existingUser = await query(
            'SELECT id FROM users WHERE email = $1',
            [hr.email]
          );

          let userId;
          if (existingUser.rows.length > 0) {
            userId = existingUser.rows[0].id;
            // Add company association
            await query(
              'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, $3) ON CONFLICT (user_id, company_id) DO NOTHING',
              [userId, companyId, false]
            );
          } else {
            // Create new HR user
            const userResult = await query(
              `INSERT INTO users (name, email, password_hash, role, payroll_number, company_id)
               VALUES ($1, $2, $3, 'hr', $4, $5) RETURNING id`,
              [hr.name, hr.email, passwordHash, `HR-${companyId}-${Date.now()}`, companyId]
            );
            userId = userResult.rows[0].id;
            
            // Add to user_companies
            await query(
              'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, $3)',
              [userId, companyId, hrUserIds.length === 0] // First HR is primary
            );
          }
          hrUserIds.push(userId);
        }
      }

      // 4. Create managers
      const managerMap = {};
      if (managers && managers.length > 0) {
        for (const manager of managers) {
          if (!manager.email || !manager.password || !manager.name) {
            continue;
          }

          const passwordHash = await bcrypt.hash(manager.password, 10);
          
          // Check if user with this email already exists
          const existingUser = await query(
            'SELECT id FROM users WHERE email = $1',
            [manager.email]
          );

          let userId;
          if (existingUser.rows.length > 0) {
            userId = existingUser.rows[0].id;
            // Update role if needed
            await query(
              'UPDATE users SET role = CASE WHEN role = \'employee\' THEN \'manager\' ELSE role END WHERE id = $1',
              [userId]
            );
            // Add company association
            await query(
              'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, $3) ON CONFLICT (user_id, company_id) DO NOTHING',
              [userId, companyId, false]
            );
          } else {
            // Create new manager
            const userResult = await query(
              `INSERT INTO users (name, email, password_hash, role, payroll_number, company_id)
               VALUES ($1, $2, $3, 'manager', $4, $5) RETURNING id`,
              [manager.name, manager.email, passwordHash, `MGR-${companyId}-${Date.now()}`, companyId]
            );
            userId = userResult.rows[0].id;
            
            // Add to user_companies
            await query(
              'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, $3)',
              [userId, companyId, true]
            );
          }

          // Assign manager to departments
          if (manager.departments && Array.isArray(manager.departments)) {
            for (const deptName of manager.departments) {
              const deptId = departmentMap[deptName];
              if (deptId) {
                await query(
                  'INSERT INTO manager_departments (manager_id, department_id, company_id) VALUES ($1, $2, $3) ON CONFLICT (manager_id, department_id) DO NOTHING',
                  [userId, deptId, companyId]
                );
              }
            }
          }

          managerMap[manager.email] = userId;
        }
      }

      // 5. Create employees
      if (employees && employees.length > 0) {
        for (const employee of employees) {
          if (!employee.payrollNumber || !employee.nationalId || !employee.name) {
            continue;
          }

          // Check if employee already exists
          const existingEmployee = await query(
            'SELECT id FROM users WHERE payroll_number = $1 AND company_id = $2',
            [employee.payrollNumber, companyId]
          );

          if (existingEmployee.rows.length > 0) {
            continue; // Skip existing employees
          }

          // Get manager ID if department is specified
          let managerId = null;
          if (employee.department) {
            const deptId = departmentMap[employee.department];
            if (deptId) {
              // Find a manager for this department
              const mgrResult = await query(
                'SELECT manager_id FROM manager_departments WHERE department_id = $1 LIMIT 1',
                [deptId]
              );
              if (mgrResult.rows.length > 0) {
                managerId = mgrResult.rows[0].manager_id;
              }
            }
          }

          // Create employee (no email/password required)
          const employeeResult = await query(
            `INSERT INTO users (name, payroll_number, national_id, role, department, department_id, position, employment_date, manager_id, company_id)
             VALUES ($1, $2, $3, 'employee', $4, $5, $6, $7, $8, $9) RETURNING id`,
            [
              employee.name,
              employee.payrollNumber,
              employee.nationalId,
              employee.department || null,
              departmentMap[employee.department] || null,
              employee.position || null,
              employee.employmentDate || null,
              managerId,
              companyId
            ]
          );
          
          // Add to user_companies (required for login)
          const employeeId = employeeResult.rows[0].id;
          await query(
            'INSERT INTO user_companies (user_id, company_id, is_primary) VALUES ($1, $2, $3)',
            [employeeId, companyId, true]
          );
        }
      }

      await query('COMMIT');

      res.json({ 
        success: true, 
        companyId,
        message: 'Company onboarded successfully' 
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Onboard company error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// Bulk upload employees from Excel
router.post('/:companyId/employees/upload', authenticateToken, authorizeRoles('hr'), upload.single('file'), async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Excel file is required' });
    }

    // Parse Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    // Expected columns: Name, Payroll Number, National ID, Department, Position, Employment Date, Manager Email
    const employees = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = row['Name'] || row['name'] || row['NAME'];
      const payrollNumber = row['Payroll Number'] || row['Payroll Number'] || row['payroll_number'] || row['PayrollNumber'];
      const nationalId = row['National ID'] || row['National ID'] || row['national_id'] || row['NationalID'];
      const department = row['Department'] || row['department'] || row['DEPARTMENT'];
      const position = row['Position'] || row['position'] || row['POSITION'];
      const employmentDate = row['Employment Date'] || row['employment_date'] || row['EmploymentDate'];
      const managerEmail = row['Manager Email'] || row['manager_email'] || row['ManagerEmail'];

      if (!name || !payrollNumber || !nationalId) {
        errors.push(`Row ${i + 2}: Missing required fields (Name, Payroll Number, National ID)`);
        continue;
      }

      employees.push({
        name: String(name).trim(),
        payrollNumber: String(payrollNumber).trim(),
        nationalId: String(nationalId).trim(),
        department: department ? String(department).trim() : null,
        position: position ? String(position).trim() : null,
        employmentDate: employmentDate ? new Date(employmentDate) : null,
        managerEmail: managerEmail ? String(managerEmail).trim() : null,
      });
    }

    if (employees.length === 0) {
      return res.status(400).json({ error: 'No valid employees found in Excel file' });
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
       INNER JOIN manager_departments md ON u.id = md.manager_id
       WHERE u.company_id = $1 AND u.role = 'manager'`,
      [companyId]
    );
    const managerMap = {};
    mgrResult.rows.forEach(mgr => {
      if (!managerMap[mgr.email]) {
        managerMap[mgr.email] = {};
      }
      managerMap[mgr.email][mgr.department_id] = mgr.id;
    });

    // Insert employees
    let successCount = 0;
    let skipCount = 0;

    await query('BEGIN');

    try {
      for (const employee of employees) {
        // Check if employee already exists
        const existing = await query(
          'SELECT id FROM users WHERE payroll_number = $1 AND company_id = $2',
          [employee.payrollNumber, companyId]
        );

        if (existing.rows.length > 0) {
          skipCount++;
          continue;
        }

        // Find manager
        let managerId = null;
        if (employee.managerEmail) {
          const mgr = managerMap[employee.managerEmail];
          if (mgr) {
            // Find manager for the department
            const deptId = employee.department ? departmentMap[employee.department.toLowerCase()] : null;
            if (deptId && mgr[deptId]) {
              managerId = mgr[deptId];
            } else if (Object.keys(mgr).length > 0) {
              managerId = Object.values(mgr)[0];
            }
          }
        } else if (employee.department) {
          // Find any manager for this department
          const deptId = departmentMap[employee.department.toLowerCase()];
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

        // Get department ID
        const deptId = employee.department ? departmentMap[employee.department.toLowerCase()] : null;

        const employeeResult = await query(
          `INSERT INTO users (name, payroll_number, national_id, role, department, department_id, position, employment_date, manager_id, company_id)
           VALUES ($1, $2, $3, 'employee', $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            employee.name,
            employee.payrollNumber,
            employee.nationalId,
            employee.department || null,
            deptId,
            employee.position || null,
            employee.employmentDate || null,
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

// Get departments for a company
router.get('/:companyId/departments', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.params;

    const result = await query(
      'SELECT id, name, description FROM departments WHERE company_id = $1 ORDER BY name',
      [companyId]
    );

    res.json({ departments: result.rows });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

