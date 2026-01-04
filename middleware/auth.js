const jwt = require('jsonwebtoken');
const { query } = require('../database/db');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
    
    // Get user from database
    const result = await query(
      'SELECT id, name, email, role, payroll_number, department, position FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = result.rows[0];
    
    // Super admin doesn't need company association
    if (req.user.role === 'super_admin') {
      req.user.company_id = null; // Super admin has access to all companies
    } else {
      // Use company_id from token (selected company)
      req.user.company_id = decoded.companyId;
      
      // Verify user has access to this company
      if (decoded.companyId) {
        const companyCheck = await query(
          'SELECT company_id FROM user_companies WHERE user_id = $1 AND company_id = $2',
          [req.user.id, decoded.companyId]
        );

        if (companyCheck.rows.length === 0) {
          return res.status(403).json({ error: 'User does not have access to this company' });
        }
      } else {
        return res.status(403).json({ error: 'Company must be selected' });
      }
    }
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

module.exports = { authenticateToken, authorizeRoles };

