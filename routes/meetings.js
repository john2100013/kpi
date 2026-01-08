import express from 'express';
import MeetingsController from '../controllers/MeetingsController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Get meetings for a specific KPI (must come before /:id)
router.get('/by-kpi/:kpiId', authenticateToken, authorizeRoles('manager'), MeetingsController.asyncHandler(MeetingsController.getByKpiId.bind(MeetingsController)));

// Get all meeting schedules
router.get('/', authenticateToken, authorizeRoles('manager'), MeetingsController.asyncHandler(MeetingsController.getAll.bind(MeetingsController)));

// Get a specific meeting
router.get('/:id', authenticateToken, authorizeRoles('manager', 'hr'), MeetingsController.asyncHandler(MeetingsController.getById.bind(MeetingsController)));

// Create meeting schedule
router.post('/', authenticateToken, authorizeRoles('manager'), MeetingsController.asyncHandler(MeetingsController.create.bind(MeetingsController)));

// Update meeting schedule
router.patch('/:id', authenticateToken, authorizeRoles('manager'), MeetingsController.asyncHandler(MeetingsController.update.bind(MeetingsController)));

// Delete meeting schedule
router.delete('/:id', authenticateToken, authorizeRoles('manager'), MeetingsController.asyncHandler(MeetingsController.delete.bind(MeetingsController)));

export default router;
