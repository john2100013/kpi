import express from 'express';
import KpisController from '../controllers/KpisController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Get paginated KPIs (must come before /:id)
router.get('/paginated', authenticateToken, authorizeRoles('hr'), KpisController.asyncHandler(KpisController.getPaginated.bind(KpisController)));

// Get acknowledged KPIs without reviews (must come before /:id)
router.get('/acknowledged-review-pending', authenticateToken, authorizeRoles('manager', 'hr'), KpisController.asyncHandler(KpisController.getAcknowledgedReviewPending.bind(KpisController)));

// Get KPIs where setting is completed (must come before /:id)
router.get('/setting-completed', authenticateToken, authorizeRoles('manager', 'hr', 'employee'), KpisController.asyncHandler(KpisController.getSettingCompleted.bind(KpisController)));

// Get KPIs with completed reviews (must come before /:id)
router.get('/review-completed', authenticateToken, authorizeRoles('manager', 'hr', 'employee'), KpisController.asyncHandler(KpisController.getReviewCompleted.bind(KpisController)));

// Get dashboard stats (must come before /:id)
router.get('/dashboard/stats', authenticateToken, KpisController.asyncHandler(KpisController.getStats.bind(KpisController)));

// Get employee performance (must come before /:id)
router.get('/employee-performance/:employeeId', authenticateToken, authorizeRoles('hr', 'manager'), KpisController.asyncHandler(KpisController.getEmployeePerformance.bind(KpisController)));

// Download PDF for acknowledged KPI (must come before /:id)
router.get('/:kpiId/download-pdf', authenticateToken, authorizeRoles('manager', 'hr', 'employee'), KpisController.asyncHandler(KpisController.downloadPDF.bind(KpisController)));

// Download PDF for completed review (must come before /:id)
router.get('/:kpiId/review-download-pdf', authenticateToken, authorizeRoles('manager', 'hr', 'employee'), KpisController.asyncHandler(KpisController.downloadReviewPDF.bind(KpisController)));

// Get all KPIs
router.get('/', authenticateToken, KpisController.asyncHandler(KpisController.getAll.bind(KpisController)));

// Create KPI
router.post('/', authenticateToken, authorizeRoles('manager'), KpisController.asyncHandler(KpisController.create.bind(KpisController)));

// Get KPI by ID
router.get('/:id', authenticateToken, KpisController.asyncHandler(KpisController.getById.bind(KpisController)));

// Update KPI
router.patch('/:id', authenticateToken, authorizeRoles('manager'), KpisController.asyncHandler(KpisController.update.bind(KpisController)));

export default router;
