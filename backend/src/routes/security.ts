import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { SecurityService } from '../services/securityService';

const router = Router();

// GET /api/security/events — last 20 security events for the current user
router.get('/events', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const events = await SecurityService.getEvents(req.user!.id);
    res.json(events);
  } catch {
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

export default router;
