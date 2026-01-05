const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Login endpoint - supports both methods
router.post('/login', async (req, res) => {
  try {
    const { email, password, payrollNumber, nationalId } = req.body;

    let user;
    let result;

    // Method 1: Email + Password (for admin/initial setup)
    if (email && password) {
      result = await query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      user = result.rows[0];

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    }
    // Method 2: Payroll Number + National ID (for employees/managers)
    else if (payrollNumber && nationalId) {
      result = await query(
        'SELECT * FROM users WHERE payroll_number = $1 AND national_id = $2',
        [payrollNumber, nationalId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      user = result.rows[0];

      // If password is provided, verify it
      if (password) {
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      }
    } else {
      return res.status(400).json({ 
        error: 'Either (email + password) or (payroll number + national ID) is required' 
      });
    }

    // Super admin doesn't need company association
    let userCompanies = [];
    let selectedCompanyId = null;

    if (user.role !== 'super_admin') {
      // Get all companies for this user
      const companiesResult = await query(
        `SELECT c.id, c.name, c.domain, uc.is_primary
         FROM companies c
         INNER JOIN user_companies uc ON c.id = uc.company_id
         WHERE uc.user_id = $1
         ORDER BY uc.is_primary DESC, c.name`,
        [user.id]
      );

      userCompanies = companiesResult.rows;

      if (userCompanies.length === 0) {
        return res.status(403).json({ error: 'User must be associated with at least one company' });
      }

      // Determine primary company (first one if no primary set)
      const primaryCompany = userCompanies.find(c => c.is_primary) || userCompanies[0];
      selectedCompanyId = primaryCompany.id;
    }

    // Generate JWT token (including company_id for multi-tenancy)
    const token = jwt.sign(
      { userId: user.id, role: user.role, companyId: selectedCompanyId },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Return user data (without password)
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      token,
      user: {
        ...userWithoutPassword,
        company_id: selectedCompanyId,
      },
      companies: userCompanies,
      hasMultipleCompanies: userCompanies.length > 1,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Select company (for users with multiple companies)
router.post('/select-company', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    // Verify user has access to this company
    const result = await query(
      'SELECT company_id FROM user_companies WHERE user_id = $1 AND company_id = $2',
      [req.user.id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this company' });
    }

    // Generate new token with selected company
    const token = jwt.sign(
      { userId: req.user.id, role: req.user.role, companyId: parseInt(companyId) },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token, companyId: parseInt(companyId) });
  } catch (error) {
    console.error('Select company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Get user companies
    const companiesResult = await query(
      `SELECT c.id, c.name, c.domain, uc.is_primary
       FROM companies c
       INNER JOIN user_companies uc ON c.id = uc.company_id
       WHERE uc.user_id = $1
       ORDER BY uc.is_primary DESC, c.name`,
      [req.user.id]
    );

    const userCompanies = companiesResult.rows;

    const result = await query(
      'SELECT id, name, email, role, payroll_number, national_id, department, position, employment_date, manager_id, company_id, signature FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password_hash, ...user } = result.rows[0];
    res.json({ 
      user,
      companies: userCompanies,
      hasMultipleCompanies: userCompanies.length > 1,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile (including signature)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { signature } = req.body;
    const userId = req.user.id;

    // Update user signature
    if (signature !== undefined) {
      await query(
        'UPDATE users SET signature = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [signature, userId]
      );
    }

    // Fetch updated user
    const result = await query(
      'SELECT id, name, email, role, payroll_number, national_id, department, position, employment_date, manager_id, company_id, signature FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password_hash, ...user } = result.rows[0];
    res.json({ 
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password (for HR, Manager, and Super Admin only)
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    // Validate role - only HR, Manager, and Super Admin can change passwords
    if (!['hr', 'manager', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Password change is only available for HR, Manager, and Super Admin roles' });
    }

    // Validate input
    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Old password, new password, and confirm password are required' });
    }

    // Check if new password and confirm password match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirm password do not match' });
    }

    // Validate new password strength (minimum 6 characters)
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Check if new password is different from old password
    if (oldPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from old password' });
    }

    // Get current user with password hash
    const userResult = await query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify old password
    if (!user.password_hash) {
      return res.status(400).json({ error: 'No password set for this account. Please contact administrator.' });
    }

    const validPassword = await bcrypt.compare(oldPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Old password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({ 
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

