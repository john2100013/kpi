import express from 'express';
import KpiReviewController from '../controllers/KpiReviewController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Get count of pending reviews for manager
router.get('/pending/count', authenticateToken, authorizeRoles('manager'), KpiReviewController.asyncHandler(KpiReviewController.getPendingCount.bind(KpiReviewController)));

// Get review by KPI ID (must come before /:id)
router.get('/kpi/:kpiId', authenticateToken, KpiReviewController.asyncHandler(KpiReviewController.getByKpiId.bind(KpiReviewController)));

// Get all KPI reviews
router.get('/', authenticateToken, KpiReviewController.asyncHandler(KpiReviewController.getAll.bind(KpiReviewController)));

// Submit employee self-rating
router.post('/:kpiId/self-rating', authenticateToken, KpiReviewController.asyncHandler(KpiReviewController.submitSelfRating.bind(KpiReviewController)));

// Submit manager review
router.post('/:reviewId/manager-review', authenticateToken, authorizeRoles('manager'), KpiReviewController.asyncHandler(KpiReviewController.submitManagerReview.bind(KpiReviewController)));

// Employee confirms or rejects manager rating
router.post('/:reviewId/employee-confirmation', authenticateToken, authorizeRoles('employee'), KpiReviewController.asyncHandler(KpiReviewController.submitEmployeeConfirmation.bind(KpiReviewController)));

// Mark rejection as resolved (HR only)
router.post('/:reviewId/resolve-rejection', authenticateToken, authorizeRoles('hr'), KpiReviewController.asyncHandler(KpiReviewController.resolveRejection.bind(KpiReviewController)));

// Get KPI review by ID
router.get('/:id', authenticateToken, KpiReviewController.asyncHandler(KpiReviewController.getById.bind(KpiReviewController)));

export default router;
