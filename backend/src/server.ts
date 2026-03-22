import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { JobScheduler } from './jobs/scheduler';
import logger from './utils/logger';

// Import routes
import authRoutes from './routes/auth';
import cycleRoutes from './routes/cycles';
import participationRoutes from './routes/participation';
import activityRoutes from './routes/activities';
import ownershipRoutes from './routes/ownership';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';
import analyticsRoutes from './routes/analytics';
import sessionRoutes from './routes/sessions';
import weightRoutes from './routes/weights';
import messageRoutes from './routes/messages';
import securityRoutes from './routes/security';
import agreementRoutes from './routes/agreements';
import taskRoutes from './routes/tasks';
import leaveRoutes from './routes/leave';
import logsRoutes from './routes/logs';
import onboardingRoutes from './routes/onboarding';
import docsRoutes from './routes/docs';
import backupRoutes from './routes/backup';
import triageRoutes from './routes/triage';
import groupRoutes from './routes/groups';
import ideaRoutes from './routes/ideas';
import { authMiddleware } from './middleware/auth';
import { requireEmailVerified } from './middleware/requireEmailVerified';
import { requireOnboarding } from './middleware/requireOnboarding';
import { require2FA } from './middleware/require2FA';
import { requireAgreement } from './middleware/requireAgreement';

const app = express();

// Security middleware — strict CSP
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", env.FRONTEND_URL],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));

// CORS — only allow the configured frontend origin
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Step-Up-Token'],
  preflightContinue: false,
  optionsSuccessStatus: 200,
}));

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,
  message: {
    success: false,
    data: null,
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,
  message: {
    success: false,
    data: null,
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ISSUE 9: tight rate limit for public spam-prone endpoints
// 5 submissions per IP per 10 minutes (triage submit is already 3/hour in its own router)
const publicSubmitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    data: null,
    error: 'Too many submissions. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    origin: req.headers.origin,
    userAgent: req.get('User-Agent'),
    authorization: req.headers.authorization ? 'Bearer ***' : 'none'
  });
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/agreements', agreementRoutes);

// Protected routes — require auth + 2FA enabled + completed onboarding
const onboardingGuard = [authMiddleware, requireEmailVerified, require2FA, requireOnboarding];

// Routes that additionally require the active agreement to be accepted.
// Admins/founders are exempt so they can manage agreements without being locked out.
const agreementGuard = [authMiddleware, requireEmailVerified, require2FA, requireOnboarding, requireAgreement];

app.use('/api/cycles', onboardingGuard, cycleRoutes);
app.use('/api/participation', agreementGuard, participationRoutes);
app.use('/api/activities', agreementGuard, activityRoutes);
app.use('/api/ownership', agreementGuard, ownershipRoutes);
app.use('/api/analytics', agreementGuard, analyticsRoutes);
app.use('/api/docs', agreementGuard, docsRoutes);
app.use('/api/tasks', agreementGuard, taskRoutes);
app.use('/api/leave', agreementGuard, leaveRoutes);
app.use('/api/messages', agreementGuard, messageRoutes);
app.use('/api/notifications', onboardingGuard, notificationRoutes);
app.use('/api/admin', onboardingGuard, adminRoutes);
app.use('/api/sessions', onboardingGuard, sessionRoutes);
app.use('/api/weights', onboardingGuard, weightRoutes);
app.use('/api/security', onboardingGuard, securityRoutes);
app.use('/api/logs', onboardingGuard, logsRoutes);
app.use('/api/admin/backup', onboardingGuard, backupRoutes);

// Triage — public submit + admin review (submit has its own 3/hour limiter in the router)
app.use('/api/triage', triageRoutes);
// Groups — user read + admin manage
app.use('/api/groups', agreementGuard, groupRoutes);
// Ideas — user submit (rate-limited) + admin review
// ISSUE 9: apply publicSubmitLimiter to POST /api/ideas only
app.post('/api/ideas', publicSubmitLimiter);
app.use('/api/ideas', agreementGuard, ideaRoutes);

// Central error handling middleware — standard API error format
app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500;
  logger.error('Unhandled error:', { message: err.message, stack: err.stack, status });
  res.status(status).json({
    success: false,
    data: null,
    error: status < 500 ? err.message : 'Internal server error',
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Listen on all network interfaces
const PORT = parseInt(env.PORT);

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);

  // Start job scheduler
  JobScheduler.start();
});

export default app;
