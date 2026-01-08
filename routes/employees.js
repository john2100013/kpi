import express from 'express';
import EmployeesController from '../controllers/EmployeesController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import multer from 'multer';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

// Get managers for a company
router.get('/managers', authenticateToken, authorizeRoles('hr', 'super_admin', 'manager'), EmployeesController.asyncHandler(EmployeesController.getManagers.bind(EmployeesController)));

// Get total employee count
router.get('/count', authenticateToken, authorizeRoles('hr', 'super_admin'), EmployeesController.asyncHandler(EmployeesController.getEmployeeCount.bind(EmployeesController)));

// Get employees by manager
router.get('/manager/:managerId', authenticateToken, EmployeesController.asyncHandler(EmployeesController.getEmployeesByManager.bind(EmployeesController)));

// Bulk upload employees from Excel
router.post('/upload', authenticateToken, authorizeRoles('hr', 'super_admin'), upload.single('file'), EmployeesController.asyncHandler(EmployeesController.bulkUploadEmployees.bind(EmployeesController)));

// Get all employees with pagination
router.get('/', authenticateToken, authorizeRoles('manager', 'hr', 'super_admin'), EmployeesController.asyncHandler(EmployeesController.getAllEmployees.bind(EmployeesController)));

// Create new employee
router.post('/', authenticateToken, authorizeRoles('hr', 'super_admin'), EmployeesController.asyncHandler(EmployeesController.createEmployee.bind(EmployeesController)));

// Get single employee by ID
router.get('/:id', authenticateToken, EmployeesController.asyncHandler(EmployeesController.getEmployeeById.bind(EmployeesController)));

// Update employee
router.put('/:id', authenticateToken, authorizeRoles('hr', 'super_admin'), EmployeesController.asyncHandler(EmployeesController.updateEmployee.bind(EmployeesController)));

// Delete employee
router.delete('/:id', authenticateToken, authorizeRoles('hr', 'super_admin'), EmployeesController.asyncHandler(EmployeesController.deleteEmployee.bind(EmployeesController)));

export default router;
