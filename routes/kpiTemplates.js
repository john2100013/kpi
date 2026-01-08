import express from 'express';
import KpiTemplatesController from '../controllers/KpiTemplatesController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Get all templates for the current manager
router.get('/', authenticateToken, authorizeRoles('manager'), KpiTemplatesController.asyncHandler(KpiTemplatesController.getAll.bind(KpiTemplatesController)));

// Get a specific template with its items
router.get('/:id', authenticateToken, authorizeRoles('manager'), KpiTemplatesController.asyncHandler(KpiTemplatesController.getById.bind(KpiTemplatesController)));

// Create a new template
router.post('/', authenticateToken, authorizeRoles('manager'), KpiTemplatesController.asyncHandler(KpiTemplatesController.create.bind(KpiTemplatesController)));

// Update a template
router.put('/:id', authenticateToken, authorizeRoles('manager'), KpiTemplatesController.asyncHandler(KpiTemplatesController.update.bind(KpiTemplatesController)));

// Delete a template
router.delete('/:id', authenticateToken, authorizeRoles('manager'), KpiTemplatesController.asyncHandler(KpiTemplatesController.delete.bind(KpiTemplatesController)));

// Use a template to create KPIs for multiple employees
router.post('/:id/apply', authenticateToken, authorizeRoles('manager'), KpiTemplatesController.asyncHandler(KpiTemplatesController.apply.bind(KpiTemplatesController)));

export default router;
