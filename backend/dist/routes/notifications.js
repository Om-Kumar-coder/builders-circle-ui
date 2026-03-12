"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get user's notifications
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        console.log('🔔 Fetching notifications for user:', req.user?.id);
        const { unread } = req.query;
        const where = { userId: req.user.id };
        if (unread === 'true') {
            where.read = false;
        }
        const notifications = await database_1.prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit to 50 most recent
        });
        console.log('✅ Notifications fetched:', {
            userId: req.user?.id,
            count: notifications.length,
            unreadOnly: unread === 'true'
        });
        res.json({
            success: true,
            data: notifications,
            error: null
        });
    }
    catch (error) {
        console.error('❌ Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: 'Failed to fetch notifications'
        });
    }
});
// Mark notification as read
router.patch('/:id/read', auth_1.authMiddleware, async (req, res) => {
    try {
        console.log('🔔 Marking notification as read:', {
            notificationId: req.params.id,
            userId: req.user?.id
        });
        const notification = await database_1.prisma.notification.update({
            where: {
                id: Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
                userId: req.user.id // Ensure user can only update their own notifications
            },
            data: {
                read: true
            }
        });
        console.log('✅ Notification marked as read');
        res.json({
            success: true,
            data: notification,
            error: null
        });
    }
    catch (error) {
        console.error('❌ Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: 'Failed to mark notification as read'
        });
    }
});
// Mark all notifications as read
router.patch('/read-all', auth_1.authMiddleware, async (req, res) => {
    try {
        console.log('🔔 Marking all notifications as read for user:', req.user?.id);
        const result = await database_1.prisma.notification.updateMany({
            where: {
                userId: req.user.id,
                read: false
            },
            data: {
                read: true
            }
        });
        console.log('✅ All notifications marked as read:', { count: result.count });
        res.json({
            success: true,
            data: { message: 'All notifications marked as read', count: result.count },
            error: null
        });
    }
    catch (error) {
        console.error('❌ Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: 'Failed to mark all notifications as read'
        });
    }
});
// Get unread count
router.get('/unread-count', auth_1.authMiddleware, async (req, res) => {
    try {
        console.log('🔔 Fetching unread count for user:', req.user?.id);
        const count = await database_1.prisma.notification.count({
            where: {
                userId: req.user.id,
                read: false
            }
        });
        console.log('✅ Unread count fetched:', { count });
        res.json({
            success: true,
            data: { count },
            error: null
        });
    }
    catch (error) {
        console.error('❌ Error fetching unread count:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: 'Failed to fetch unread count'
        });
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map