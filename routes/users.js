import express from 'express';
import UsersController from '../controllers/UsersController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Get user counts by role
router.get('/counts', authenticateToken, authorizeRoles('super_admin'), UsersController.asyncHandler(UsersController.getCounts.bind(UsersController)));

// Get paginated users list
router.get('/', authenticateToken, authorizeRoles('super_admin'), UsersController.asyncHandler(UsersController.getAll.bind(UsersController)));

// Update user
router.put('/:userId', authenticateToken, authorizeRoles('super_admin'), UsersController.asyncHandler(UsersController.update.bind(UsersController)));

// Add HR to multiple companies
router.post('/add-hr-to-companies', authenticateToken, authorizeRoles('super_admin'), UsersController.asyncHandler(UsersController.addHRToCompanies.bind(UsersController)));

// Get manager's departments
router.get('/:userId/departments', authenticateToken, authorizeRoles('super_admin'), UsersController.asyncHandler(UsersController.getManagerDepartments.bind(UsersController)));

// Assign manager to departments
router.post('/assign-manager-departments', authenticateToken, authorizeRoles('super_admin'), UsersController.asyncHandler(UsersController.assignManagerDepartments.bind(UsersController)));

export default router;
