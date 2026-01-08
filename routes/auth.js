import express from 'express';
import AuthController from '../controllers/AuthController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Login endpoint - supports email+password or payroll+password
router.post('/login', AuthController.asyncHandler(AuthController.login.bind(AuthController)));

// Select company (for users with multiple companies)
router.post('/select-company', authenticateToken, AuthController.asyncHandler(AuthController.selectCompany.bind(AuthController)));

// Get current user
router.get('/me', authenticateToken, AuthController.asyncHandler(AuthController.getCurrentUser.bind(AuthController)));

// Update user profile (including signature and other fields for HR/Manager)
router.put('/profile', authenticateToken, AuthController.asyncHandler(AuthController.updateProfile.bind(AuthController)));

// Change password (for all authenticated users)
router.put('/change-password', authenticateToken, AuthController.asyncHandler(AuthController.changePassword.bind(AuthController)));

export default router;

