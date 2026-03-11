"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("./config/env");
const scheduler_1 = require("./jobs/scheduler");
const logger_1 = __importDefault(require("./utils/logger"));
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const cycles_1 = __importDefault(require("./routes/cycles"));
const participation_1 = __importDefault(require("./routes/participation"));
const activities_1 = __importDefault(require("./routes/activities"));
const ownership_1 = __importDefault(require("./routes/ownership"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const admin_1 = __importDefault(require("./routes/admin"));
const app = (0, express_1.default)();
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Logging middleware
app.use((req, res, next) => {
    logger_1.default.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API routes
app.use('/api/auth', auth_1.default);
app.use('/api/cycles', cycles_1.default);
app.use('/api/participation', participation_1.default);
app.use('/api/activities', activities_1.default);
app.use('/api/ownership', ownership_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/admin', admin_1.default);
// Error handling middleware
app.use((err, req, res, next) => {
    logger_1.default.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
const PORT = parseInt(env_1.env.PORT);
app.listen(PORT, () => {
    logger_1.default.info(`Server running on port ${PORT}`);
    // Start job scheduler
    scheduler_1.JobScheduler.start();
});
exports.default = app;
//# sourceMappingURL=server.js.map