import express from 'express';
import SettingsController from '../controllers/SettingsController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// ========== KPI Period Settings ==========

// Get all period settings for company
router.get('/period-settings', authenticateToken, authorizeRoles('hr', 'manager'), SettingsController.asyncHandler(SettingsController.getPeriodSettings.bind(SettingsController)));

// Create or update period setting
router.post('/period-settings', authenticateToken, authorizeRoles('hr'), SettingsController.asyncHandler(SettingsController.savePeriodSetting.bind(SettingsController)));

// Delete period setting
router.delete('/period-settings/:id', authenticateToken, authorizeRoles('hr'), SettingsController.asyncHandler(SettingsController.deletePeriodSetting.bind(SettingsController)));

// Get available KPI periods for managers/employees (active periods only)
router.get('/available-periods', authenticateToken, authorizeRoles('manager', 'employee'), SettingsController.asyncHandler(SettingsController.getAvailablePeriods.bind(SettingsController)));

// ========== Reminder Settings ==========

// Get all reminder settings for company
router.get('/reminder-settings', authenticateToken, authorizeRoles('hr'), SettingsController.asyncHandler(SettingsController.getReminderSettings.bind(SettingsController)));

// Create or update reminder setting
router.post('/reminder-settings', authenticateToken, authorizeRoles('hr'), SettingsController.asyncHandler(SettingsController.saveReminderSetting.bind(SettingsController)));

// Delete reminder setting
router.delete('/reminder-settings/:id', authenticateToken, authorizeRoles('hr'), SettingsController.asyncHandler(SettingsController.deleteReminderSetting.bind(SettingsController)));

// ========== Daily Reminder Settings ==========

// Get daily reminder settings for company
router.get('/daily-reminders', authenticateToken, authorizeRoles('hr'), SettingsController.asyncHandler(SettingsController.getDailyReminderSettings.bind(SettingsController)));

// Create or update daily reminder settings
router.post('/daily-reminders', authenticateToken, authorizeRoles('hr'), SettingsController.asyncHandler(SettingsController.saveDailyReminderSettings.bind(SettingsController)));

// Get HR email notification settings
router.get('/hr-email-notifications', authenticateToken, authorizeRoles('hr'), SettingsController.asyncHandler(SettingsController.getHREmailNotifications.bind(SettingsController)));

// Update HR email notification settings
router.post('/hr-email-notifications', authenticateToken, authorizeRoles('hr'), SettingsController.asyncHandler(SettingsController.saveHREmailNotifications.bind(SettingsController)));

export default router;
