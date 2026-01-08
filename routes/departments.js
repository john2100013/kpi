import express from 'express';
import DepartmentsController from '../controllers/DepartmentsController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Get department statistics
router.get('/statistics', authenticateToken, authorizeRoles('hr', 'manager'), DepartmentsController.asyncHandler(DepartmentsController.getStatistics.bind(DepartmentsController)));

// Get employees by department and category
router.get('/statistics/:department/:category', authenticateToken, authorizeRoles('hr', 'manager'), DepartmentsController.asyncHandler(DepartmentsController.getEmployeesByCategory.bind(DepartmentsController)));

// Get managers with employees
router.get('/managers', authenticateToken, authorizeRoles('hr'), DepartmentsController.asyncHandler(DepartmentsController.getManagers.bind(DepartmentsController)));

// Get departments assigned to logged-in manager
router.get('/manager-departments', authenticateToken, authorizeRoles('manager'), DepartmentsController.asyncHandler(DepartmentsController.getManagerDepartments.bind(DepartmentsController)));

export default router;
