import express from 'express';
import PowerAutomateController from '../controllers/PowerAutomateController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Get Power Automate configuration (HR only)
router.get('/config', authenticateToken, authorizeRoles('hr'), PowerAutomateController.asyncHandler(PowerAutomateController.getConfig.bind(PowerAutomateController)));

// Create or update Power Automate configuration (HR only)
router.post('/config', authenticateToken, authorizeRoles('hr'), PowerAutomateController.asyncHandler(PowerAutomateController.saveConfig.bind(PowerAutomateController)));

// Test Power Automate connection (HR only)
router.post('/test', authenticateToken, authorizeRoles('hr'), PowerAutomateController.asyncHandler(PowerAutomateController.testConnection.bind(PowerAutomateController)));

export default router;
