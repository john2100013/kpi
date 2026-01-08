import express from 'express';
import RatingOptionsController from '../controllers/RatingOptionsController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Get all rating options for HR management (must come before /:id)
router.get('/manage', authenticateToken, authorizeRoles('hr'), RatingOptionsController.asyncHandler(RatingOptionsController.getAllForManagement.bind(RatingOptionsController)));

// Get rating options for company
router.get('/', authenticateToken, RatingOptionsController.asyncHandler(RatingOptionsController.getAll.bind(RatingOptionsController)));

// Create rating option (HR only)
router.post('/', authenticateToken, authorizeRoles('hr'), RatingOptionsController.asyncHandler(RatingOptionsController.create.bind(RatingOptionsController)));

// Update rating option (HR only)
router.put('/:id', authenticateToken, authorizeRoles('hr'), RatingOptionsController.asyncHandler(RatingOptionsController.update.bind(RatingOptionsController)));

// Delete rating option (HR only)
router.delete('/:id', authenticateToken, authorizeRoles('hr'), RatingOptionsController.asyncHandler(RatingOptionsController.delete.bind(RatingOptionsController)));

export default router;
