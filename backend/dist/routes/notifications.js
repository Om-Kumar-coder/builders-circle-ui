"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get user's notifications
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
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
        res.json(notifications);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Mark notification as read
router.patch('/:id/read', auth_1.authMiddleware, async (req, res) => {
    try {
        const notification = await database_1.prisma.notification.update({
            where: {
                id: Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
                userId: req.user.id // Ensure user can only update their own notifications
            },
            data: {
                read: true
            }
        });
        res.json(notification);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Mark all notifications as read
router.patch('/read-all', auth_1.authMiddleware, async (req, res) => {
    try {
        await database_1.prisma.notification.updateMany({
            where: {
                userId: req.user.id,
                read: false
            },
            data: {
                read: true
            }
        });
        res.json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get unread count
router.get('/unread-count', auth_1.authMiddleware, async (req, res) => {
    try {
        const count = await database_1.prisma.notification.count({
            where: {
                userId: req.user.id,
                read: false
            }
        });
        res.json({ count });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map