/**
 * Integration Tests — Entry Control Layer (Phase 1)
 *
 * Tests the full prefilter → intake → gatekeeper flow:
 * 1. Prefilter event logging
 * 2. Prefilter ack JWT signing
 * 3. Intake submission with valid prefilter token
 * 4. Intake rejection for missing/invalid prefilter ack
 * 5. Gatekeeper review auto-creation
 * 6. Funnel analytics query
 * 7. CAPTCHA fail-closed in production
 *
 * These are pure function / service-level tests — no DB, no network.
 * Prisma calls are mocked via jest. SuperTest tests the Express router.
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';

// ── Mock Prisma ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFn = () => jest.fn<any>();

const mockPrisma = {
  entryIntake: {
    findFirst: mockFn(),
    create: mockFn(),
    findMany: mockFn(),
    count: mockFn(),
    findUnique: mockFn(),
  },
  eventLog: {
    create: mockFn(),
    count: mockFn(),
  },
  systemLog: {
    create: mockFn(),
  },
  gatekeeperReview: {
    create: mockFn(),
    update: mockFn(),
    count: mockFn(),
  },
  applicationScore: {
    findUnique: mockFn(),
  },
};

jest.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

// ── Mock env ─────────────────────────────────────────────────────────────

const mockEnv = {
  JWT_SECRET: 'test-jwt-secret-for-integration-tests-min-32-chars!!',
  NODE_ENV: 'test',
  FRONTEND_URL: 'http://localhost:3000',
};

jest.mock('../config/env', () => ({
  env: mockEnv,
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

// ── Imports under test ──────────────────────────────────────────────────

import jwt from 'jsonwebtoken';
import request from 'supertest';
import express from 'express';
import entryIntakeRoutes from '../routes/entry-intake';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/triage', entryIntakeRoutes);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEnv.NODE_ENV = 'test';

  // Default mock for eventLog.create — succeeds silently
  mockPrisma.eventLog.create.mockResolvedValue({ id: 'evt-1' });
  mockPrisma.systemLog.create.mockResolvedValue({ id: 'sys-1' });
  mockPrisma.gatekeeperReview.create.mockResolvedValue({ id: 'entry-1' });
  mockPrisma.gatekeeperReview.update.mockResolvedValue({ id: 'entry-1' });
  mockPrisma.applicationScore.findUnique.mockResolvedValue(null);
});

// ── TEST GROUP 1: PREFILTER EVENT LOGGING ───────────────────────────────

describe('Prefilter Event Logging [Flow 1]', () => {
  test('logs prefilter_page_view event', async () => {
    mockPrisma.eventLog.create.mockResolvedValue({ id: 'evt-page-view' });

    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/event')
      .send({ event: 'prefilter_page_view', sessionId: 'pref_test_123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'prefilter_page_view',
          sessionId: 'pref_test_123',
        }),
      })
    );
  });

  test('logs prefilter_scrolled_50 event', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/event')
      .send({
        event: 'prefilter_scrolled_50',
        sessionId: 'pref_test_456',
        metadata: { scrollProgress: 0.55 },
      });

    expect(res.status).toBe(201);
    expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'prefilter_scrolled_50',
          metadata: expect.stringContaining('scrollProgress'),
        }),
      })
    );
  });

  test('rejects invalid event name', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/event')
      .send({ event: 'invalid_event_name' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── TEST GROUP 2: PREFILTER ACK JWT ────────────────────────────────────

describe('Prefilter Ack JWT [Flow 2]', () => {
  test('issues signed JWT with valid sessionId', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/prefilter/ack')
      .send({ sessionId: 'pref_test_session_789' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.expiresIn).toBe('2h');

    // Verify token can be decoded
    const decoded = jwt.verify(res.body.data.token, mockEnv.JWT_SECRET) as Record<string, unknown>;
    expect(decoded.sessionId).toBe('pref_test_session_789');
    expect(decoded.type).toBe('prefilter_ack');
    expect(decoded.jti).toBeDefined();
  });

  test('rejects request without sessionId', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/prefilter/ack')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Session ID is required');
  });

  test('verify endpoint validates a good token', async () => {
    // First get a token
    const app = createTestApp();
    const ackRes = await request(app)
      .post('/api/triage/prefilter/ack')
      .send({ sessionId: 'pref_test_verify' });
    const token = ackRes.body.data.token;

    // Then verify it
    const verifyRes = await request(app)
      .post('/api/triage/prefilter/verify')
      .send({ token });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.valid).toBe(true);
    expect(verifyRes.body.data.sessionId).toBe('pref_test_verify');
  });

  test('verify endpoint rejects expired/invalid token', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/prefilter/verify')
      .send({ token: 'invalid-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('expired prefilter token');
    expect(res.body.data).toBeNull();
  });
});

// ── TEST GROUP 3: INTAKE SUBMISSION ────────────────────────────────────

describe('Intake Submission [Flow 3]', () => {
  const validIntakePayload = {
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    intentType: 'join',
    valueProposition: 'I want to build open source tools for community management. I have experience building similar systems.',
    prefilterAck: true,
    prefilterSessionId: 'pref_intake_test',
    prefilterToken: '',
  };

  test('accepts valid submission with prefilter token', async () => {
    // Issue a real prefilter token
    const token = jwt.sign(
      { sessionId: 'pref_intake_test', type: 'prefilter_ack', jti: 'test-jti' },
      mockEnv.JWT_SECRET,
      { expiresIn: '2h' }
    );

    mockPrisma.entryIntake.findFirst.mockResolvedValue(null);
    mockPrisma.entryIntake.create.mockResolvedValue({
      id: 'entry-intake-1',
      status: 'PENDING',
    });

    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/intake')
      .send({ ...validIntakePayload, prefilterToken: token });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('PENDING');

    // GatekeeperReview should be auto-created
    expect(mockPrisma.gatekeeperReview.create).toHaveBeenCalled();
  });

  test('rejects submission without prefilterAck: true', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/intake')
      .send({ ...validIntakePayload, prefilterAck: false });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('acknowledge the prefilter agreement');
  });

  test('rejects submission with invalid prefilterToken', async () => {
    mockPrisma.entryIntake.findFirst.mockResolvedValue(null);

    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/intake')
      .send({ ...validIntakePayload, prefilterToken: 'invalid-jwt-token' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('expired prefilter session');
  });

  test('rejects submission with mismatched sessionId', async () => {
    // Token says session X but payload says session Y
    const token = jwt.sign(
      { sessionId: 'session_X', type: 'prefilter_ack', jti: 'test-jti' },
      mockEnv.JWT_SECRET,
      { expiresIn: '2h' }
    );

    mockPrisma.entryIntake.findFirst.mockResolvedValue(null);

    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/intake')
      .send({ ...validIntakePayload, prefilterSessionId: 'session_Y', prefilterToken: token });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Prefilter session mismatch');
  });

  test('rejects duplicate email (PENDING status)', async () => {
    mockPrisma.entryIntake.findFirst.mockResolvedValue({ id: 'existing-1', status: 'PENDING' });

    const token = jwt.sign(
      { sessionId: 'pref_intake_test', type: 'prefilter_ack', jti: 'test-jti' },
      mockEnv.JWT_SECRET,
      { expiresIn: '2h' }
    );

    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/intake')
      .send({ ...validIntakePayload, prefilterToken: token });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already exists');
  });

  test('validates required fields', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/intake')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

// ── TEST GROUP 4: CAPTCHA FAIL-CLOSED ──────────────────────────────────

describe('CAPTCHA Fail-Closed [Flow 4]', () => {
  const validPayload = {
    fullName: 'CAPTCHA Test',
    email: 'captcha@example.com',
    intentType: 'join',
    valueProposition: 'Testing CAPTCHA fail-closed behavior in the entry control flow.',
    prefilterAck: true,
    prefilterSessionId: 'pref_captcha_test',
    prefilterToken: '',
  };

  test('allows submission without CAPTCHA in non-production (dev/test)', async () => {
    mockEnv.NODE_ENV = 'test';
    delete (process.env as any).CAPTCHA_SECRET_KEY;

    const token = jwt.sign(
      { sessionId: 'pref_captcha_test', type: 'prefilter_ack', jti: 'test-jti' },
      mockEnv.JWT_SECRET,
      { expiresIn: '2h' }
    );

    mockPrisma.entryIntake.findFirst.mockResolvedValue(null);
    mockPrisma.entryIntake.create.mockResolvedValue({ id: 'entry-captcha-1', status: 'PENDING' });

    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/intake')
      .send({ ...validPayload, prefilterToken: token });

    expect(res.status).toBe(201);
  });

  test('rejects submission without CAPTCHA in production', async () => {
    mockEnv.NODE_ENV = 'production';
    delete (process.env as any).CAPTCHA_SECRET_KEY;

    const token = jwt.sign(
      { sessionId: 'pref_captcha_test', type: 'prefilter_ack', jti: 'test-jti' },
      mockEnv.JWT_SECRET,
      { expiresIn: '2h' }
    );

    mockPrisma.entryIntake.findFirst.mockResolvedValue(null);

    const app = createTestApp();
    const res = await request(app)
      .post('/api/triage/intake')
      .send({ ...validPayload, prefilterToken: token });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('CAPTCHA is required');
  });
});

// ── TEST GROUP 5: FUNNEL ANALYTICS ─────────────────────────────────────

describe('Funnel Analytics [Flow 5]', () => {
  test('returns funnel counts and conversion rates', async () => {
    mockPrisma.eventLog.count
      .mockResolvedValueOnce(100)  // views
      .mockResolvedValueOnce(60)   // scrolled
      .mockResolvedValueOnce(40)   // checked
      .mockResolvedValueOnce(35)   // cta clicked
      .mockResolvedValueOnce(25);  // submitted

    const app = createTestApp();
    const res = await request(app).get('/api/triage/funnel');

    expect(res.status).toBe(200);
    expect(res.body.data.funnel.prefilter_page_view).toBe(100);
    expect(res.body.data.funnel.intake_submitted).toBe(25);
    expect(res.body.data.conversionRates.viewToSubmit).toBe('25.0%');
    expect(res.body.data.conversionRates.checkToSubmit).toBe('62.5%');
  });

  test('handles zero views gracefully', async () => {
    mockPrisma.eventLog.count
      .mockResolvedValueOnce(0)  // views
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const app = createTestApp();
    const res = await request(app).get('/api/triage/funnel');

    expect(res.status).toBe(200);
    expect(res.body.data.conversionRates.viewToScroll).toBe('0%');
    expect(res.body.data.conversionRates.viewToSubmit).toBe('0%');
  });

  test('supports date range filtering', async () => {
    mockPrisma.eventLog.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    const app = createTestApp();
    const res = await request(app)
      .get('/api/triage/funnel?startDate=2025-01-01&endDate=2025-01-31');

    expect(res.status).toBe(200);
    expect(res.body.data.funnel.prefilter_page_view).toBe(10);
  });
});

// ── TEST GROUP 6: GATEKEEPER REVIEW AUTO-CREATION ──────────────────────

describe('Gatekeeper Review Auto-Creation [Flow 6]', () => {
  test('creates GatekeeperReview on successful intake', async () => {
    const token = jwt.sign(
      { sessionId: 'pref_review_test', type: 'prefilter_ack', jti: 'test-jti' },
      mockEnv.JWT_SECRET,
      { expiresIn: '2h' }
    );

    mockPrisma.entryIntake.findFirst.mockResolvedValue(null);
    mockPrisma.entryIntake.create.mockResolvedValue({
      id: 'entry-review-1',
      status: 'PENDING',
    });

    const app = createTestApp();
    await request(app)
      .post('/api/triage/intake')
      .send({
        fullName: 'Review Test',
        email: 'review@example.com',
        intentType: 'join',
        valueProposition: 'Testing gatekeeper review auto-creation flow integration.',
        prefilterAck: true,
        prefilterSessionId: 'pref_review_test',
        prefilterToken: token,
      });

    expect(mockPrisma.gatekeeperReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'user_intake',
          queue: 'new_users',
          status: 'PENDING',
        }),
      })
    );
  });
});
