import express from 'express';
import NotificationsController from '../controllers/NotificationsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get unread notification count (must come before /:id)
router.get('/unread/count', authenticateToken, NotificationsController.asyncHandler(NotificationsController.getUnreadCount.bind(NotificationsController)));

// Get recent activity (must come before /:id)
router.get('/activity', authenticateToken, NotificationsController.asyncHandler(NotificationsController.getActivity.bind(NotificationsController)));

// Mark all notifications as read (must come before /:id)
router.patch('/read-all', authenticateToken, NotificationsController.asyncHandler(NotificationsController.markAllAsRead.bind(NotificationsController)));

// Get all notifications for current user
router.get('/', authenticateToken, NotificationsController.asyncHandler(NotificationsController.getAll.bind(NotificationsController)));

// Mark notification as read
router.patch('/:id/read', authenticateToken, NotificationsController.asyncHandler(NotificationsController.markAsRead.bind(NotificationsController)));

export default router;
