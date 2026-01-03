const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../database/db');
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

    // Ensure user has company_id
    if (!user.company_id) {
      return res.status(403).json({ error: 'User must be associated with a company' });
    }

    // Generate JWT token (including company_id for multi-tenancy)
    const token = jwt.sign(
      { userId: user.id, role: user.role, companyId: user.company_id },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Return user data (without password)
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
    
    const result = await query(
      'SELECT id, name, email, role, payroll_number, national_id, department, position, employment_date, manager_id, company_id FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password_hash, ...user } = result.rows[0];
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

