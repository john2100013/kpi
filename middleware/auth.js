import jwt from 'jsonwebtoken';
import { query } from '../database/db.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
    console.log('🔍 [auth] JWT decoded:', JSON.stringify(decoded, null, 2));
    console.log('🔍 [auth] decoded.userId:', decoded.userId);
    console.log('🔍 [auth] decoded.companyId:', decoded.companyId);
    console.log('🔍 [auth] decoded.companyId type:', typeof decoded.companyId);
    
    // Get user from database
    const result = await query(
      'SELECT id, name, email, role, payroll_number, department, position FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      console.error('❌ [auth] User not found in database for userId:', decoded.userId);
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = result.rows[0];
    console.log('🔍 [auth] User from database:', JSON.stringify(req.user, null, 2));
    
    // Super admin doesn't need company association
    if (req.user.role === 'super_admin') {
      req.user.company_id = null; // Super admin has access to all companies
      console.log('🔍 [auth] Super admin detected, setting company_id to null');
    } else {
      // Use company_id from token (selected company)
      req.user.company_id = decoded.companyId;
      console.log('🔍 [auth] Regular user, company_id from token:', decoded.companyId);
      console.log('🔍 [auth] req.user.company_id set to:', req.user.company_id);
      
      // Verify user has access to this company
      if (decoded.companyId) {
        // First check if user's primary company_id matches
        const userResult = await query(
          'SELECT company_id FROM users WHERE id = $1',
          [req.user.id]
        );
        
        const userCompanyId = userResult.rows[0]?.company_id;
        console.log('🔍 [auth] User primary company_id:', userCompanyId);
        
        // Check if decoded company matches user's primary company OR user_companies table (for HR with multiple companies)
        if (userCompanyId && userCompanyId === decoded.companyId) {
          console.log('✅ [auth] User has access via primary company_id');
        } else {
          // Check user_companies table (for HR users with multi-company access)
          const companyCheck = await query(
            'SELECT company_id FROM user_companies WHERE user_id = $1 AND company_id = $2',
            [req.user.id, decoded.companyId]
          );
          console.log('🔍 [auth] Company check result:', companyCheck.rows.length, 'rows');

          if (companyCheck.rows.length === 0) {
            console.error('❌ [auth] User does not have access to company:', decoded.companyId);
            return res.status(403).json({ error: 'User does not have access to this company' });
          }
          console.log('✅ [auth] User has access via user_companies table');
        }
      } else {
        console.error('❌ [auth] Company ID is missing from token');
        return res.status(403).json({ error: 'Company must be selected' });
      }
    }
    console.log('🔍 [auth] Final req.user.company_id:', req.user.company_id);
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

export const authorizeRoles = (...roles) => {
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

export default { authenticateToken, authorizeRoles };

