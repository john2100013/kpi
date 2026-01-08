import express from 'express';
import CompaniesController from '../controllers/CompaniesController.js';
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

// Get all companies for current user
router.get('/my-companies', authenticateToken, CompaniesController.asyncHandler(CompaniesController.getMyCompanies.bind(CompaniesController)));

// Get all companies with statistics (super admin only)
router.get('/', authenticateToken, authorizeRoles('super_admin'), CompaniesController.asyncHandler(CompaniesController.getAllCompanies.bind(CompaniesController)));

// Get all HR users with their companies
router.get('/hr-users', authenticateToken, authorizeRoles('super_admin'), CompaniesController.asyncHandler(CompaniesController.getHRUsers.bind(CompaniesController)));

// Get available companies for HR user
router.get('/available-companies-for-hr/:userId', authenticateToken, authorizeRoles('super_admin'), CompaniesController.asyncHandler(CompaniesController.getAvailableCompaniesForHR.bind(CompaniesController)));

// Assign HR to company
router.post('/assign-hr-to-company', authenticateToken, authorizeRoles('super_admin'), CompaniesController.asyncHandler(CompaniesController.assignHRToCompany.bind(CompaniesController)));

// Create company
router.post('/', authenticateToken, authorizeRoles('super_admin'), CompaniesController.asyncHandler(CompaniesController.createCompany.bind(CompaniesController)));

// Bulk upload users
router.post('/:companyId/bulk-upload-users', authenticateToken, authorizeRoles('super_admin', 'hr'), upload.single('file'), CompaniesController.asyncHandler(CompaniesController.bulkUploadUsers.bind(CompaniesController)));

// Update company
router.put('/:id', authenticateToken, authorizeRoles('super_admin'), CompaniesController.asyncHandler(CompaniesController.updateCompany.bind(CompaniesController)));

// Delete company
router.delete('/:id', authenticateToken, authorizeRoles('super_admin'), CompaniesController.asyncHandler(CompaniesController.deleteCompany.bind(CompaniesController)));

export default router;
