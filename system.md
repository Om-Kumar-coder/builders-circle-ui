# Builder's Circle — System Documentation

## Project Overview

Builder's Circle is a contribution-based ownership economy platform for distributed teams. It tracks work contributions, calculates ownership stakes, manages participation cycles, and distributes earnings based on verified activities. The system enforces accountability through stall detection, multiplier adjustments, and ownership decay.

---

## Tech Stack

- Frontend: Next.js (App Router), TypeScript, Tailwind CSS
  - Note: logic.md states "Next.js 14" but package.json shows Next.js 15.x
- Backend: Node.js + Express, TypeScript
- Database: PostgreSQL via Prisma ORM
- Auth: JWT (HttpOnly cookie + client-accessible cookie — see Auth section), TOTP 2FA via speakeasy
- Background Jobs: node-cron
- Email: Custom emailService.ts
- File Storage: Local disk at backend/uploads/
- Logging: Winston (backend/logs/, logs/)

---

## Repository Structure

```
/                        — Next.js frontend root
  app/                   — App Router pages
  src/
    components/          — React components (grouped by feature)
    context/             — AuthContext, CycleContext
    hooks/               — Custom React hooks
    lib/                 — API client, auth helpers, utilities
    types/               — TypeScript type definitions
  public/                — Static assets

backend/
  src/
    routes/              — Express route handlers
    middleware/          — Auth, 2FA, onboarding, agreement guards
    services/            — Business logic services
    jobs/                — Background cron jobs
    config/              — Database and env config
    utils/               — Logger, pagination, performance monitor
  prisma/
    schema.prisma        — Database schema
    migrations/          — Migration history
  uploads/docs/          — Uploaded document files
```

---

## Environment Configuration

Frontend env vars (from .env.example):
- NEXT_PUBLIC_API_URL — backend API base URL (default: http://localhost:3001/api)

Backend env vars (from backend/.env.example):
- DATABASE_URL — PostgreSQL connection string
- JWT_SECRET — secret for signing JWTs
- PORT — server port (default: 3001)
- FRONTEND_URL — allowed CORS origin
- EMAIL_* — email service credentials
- NODE_ENV — environment flag

---

## Backend Server (backend/src/server.ts)

Express app with the following middleware stack (in order):
1. helmet — strict CSP (no inline scripts, no frame embedding, no object embedding)
2. cors — restricted to FRONTEND_URL only, credentials: true
3. rateLimit (global) — 10,000 req / 15 min per IP
4. express.json — body limit 10mb
5. express.urlencoded
6. cookieParser
7. Request logger (Winston)

Auth rate limiter (separate): 20 req / 15 min per IP — applied only to /api/auth

Health check: GET /health — returns { status: 'ok', timestamp }

Central error handler: catches all unhandled errors, returns standard format.
404 handler: catches all unmatched routes.

Server listens on 0.0.0.0:PORT. JobScheduler.start() is called on server startup.

---

## Route Registration (server.ts)

Standard response format for all API routes:
```json
{ "success": true, "data": { ... }, "error": null }
```

Middleware guard groups:
- onboardingGuard = [authMiddleware, requireEmailVerified, require2FA, requireOnboarding]
- agreementGuard = [authMiddleware, requireEmailVerified, require2FA, requireOnboarding, requireAgreement]

Route table:

| Mount Path          | Guard           | Router File         |
|---------------------|-----------------|---------------------|
| /api/auth           | authLimiter     | routes/auth.ts      |
| /api/onboarding     | none            | routes/onboarding.ts|
| /api/agreements     | none            | routes/agreements.ts|
| /api/cycles         | onboardingGuard | routes/cycles.ts    |
| /api/participation  | agreementGuard  | routes/participation.ts |
| /api/activities     | agreementGuard  | routes/activities.ts|
| /api/ownership      | agreementGuard  | routes/ownership.ts |
| /api/analytics      | agreementGuard  | routes/analytics.ts |
| /api/docs           | agreementGuard  | routes/docs.ts      |
| /api/tasks          | agreementGuard  | routes/tasks.ts     |
| /api/leave          | agreementGuard  | routes/leave.ts     |
| /api/messages       | agreementGuard  | routes/messages.ts  |
| /api/notifications  | onboardingGuard | routes/notifications.ts |
| /api/admin          | onboardingGuard | routes/admin.ts     |
| /api/sessions       | onboardingGuard | routes/sessions.ts  |
| /api/weights        | onboardingGuard | routes/weights.ts   |
| /api/security       | onboardingGuard | routes/security.ts  |
| /api/logs           | onboardingGuard | routes/logs.ts      |
| /api/admin/backup   | onboardingGuard | routes/backup.ts    |
| /api/triage         | none            | routes/triage.ts    |
| /api/groups         | agreementGuard  | routes/groups.ts    |
| /api/ideas          | agreementGuard  | routes/ideas.ts     |

---

## Middleware Details

### authMiddleware (backend/src/middleware/auth.ts)
- Reads token from Authorization header (Bearer) OR req.cookies.auth_token
- Query param token is explicitly NOT accepted
- Verifies JWT signature against JWT_SECRET
- Checks per-token revocation: looks up decoded.jti in RevokedToken table
- Fetches user + profile from DB
- Checks per-user revocation: if user.tokenRevokedAt > token.iat, rejects
- Populates req.user = { id, email, role, twoFactorVerified }

### requireEmailVerified (backend/src/middleware/requireEmailVerified.ts)
- Blocks users where emailVerified = false

### require2FA (backend/src/middleware/require2FA.ts)
- Blocks users where twoFactorEnabled = false

### requireOnboarding (backend/src/middleware/requireOnboarding.ts)
- Blocks users where onboardingCompleted = false

### requireAgreement (backend/src/middleware/requireAgreement.ts)
- Admins and founders are exempt
- Checks if user has accepted the currently active Agreement
- If not, returns 403 with error: 'AGREEMENT_NOT_ACCEPTED' and agreementId/agreementVersion

### roleMiddleware(allowedRoles[]) (auth.ts)
- Checks req.user.role against allowed list
- Returns 403 if not in list

### requireFullAccess (auth.ts)
- Admins/founders exempt
- Checks if user has an active AccessGrant of type 'view_only'
- If yes, blocks mutating operations with 403

### stepUpMiddleware (auth.ts)
- Reads X-Step-Up-Token header
- Calls verifyStepUpToken(token, userId) from routes/auth.ts
- Returns 403 with requiresStepUp: true if missing or invalid

---

## Authentication System

### Signup Flow
1. POST /auth/signup — creates user with emailVerified: false
2. Verification email sent with 24h token
3. POST /auth/verify-email with token — sets emailVerified: true

### Login Flow
1. POST /auth/login with { email, password }
2. If 2FA enabled, must include totpCode
3. On success: JWT issued, set as HttpOnly cookie (7-day expiry)
4. JWT payload: { userId, jti, iat, twoFactorVerified }

### Token Storage — IMPORTANT DETAIL
The backend sets the JWT as an HttpOnly cookie. However, AuthContext.tsx also writes the token to a client-accessible cookie:
```js
document.cookie = `auth_token=${response.token}; path=/; max-age=604800; SameSite=Lax`;
```
This is done so the Next.js proxy can verify it for route protection. The comment in the code says this is intentional. The authMiddleware on the backend reads from req.cookies.auth_token, which works for both the HttpOnly cookie set by the server and the client-set cookie.

### Step-Up Authentication
- POST /auth/step-up — re-verify password → returns short-lived step-up token
- Token passed as X-Step-Up-Token header on sensitive requests
- stepUpMiddleware validates it via verifyStepUpToken()
- Used for: overrides, role changes, doc access grants, bulk actions, dispute resolution

### Token Revocation
- Per-token: jti stored in RevokedToken table on logout
- Per-user: tokenRevokedAt on User model — force-logout all devices
- RevokedToken cleanup job runs daily at midnight

### Password Reset
- POST /auth/forgot-password — sends reset email with token
- POST /auth/reset-password — validates token, sets new password
- Fields: passwordResetToken, passwordResetExpiry on User model

### Re-login
- POST /auth/relogin — re-authenticates with password, refreshes cookie
- Used by ForceReAuthModal when session expires

### Other Auth Endpoints
- GET /auth/me — returns current user + profile
- POST /auth/logout — revokes token jti, clears cookie
- POST /auth/change-password
- POST /auth/verify-password — returns { success: boolean }
- POST /auth/2fa/setup — generates TOTP secret + QR code
- POST /auth/2fa/enable — verifies TOTP code, enables 2FA
- POST /auth/2fa/disable — verifies TOTP code, disables 2FA
- POST /auth/resend-verification-by-email

---

## Onboarding Flow

Tracked via onboardingStep (int) and onboardingCompleted (bool) on User model.

Steps:
1. Email verification
2. 2FA setup (TOTP via speakeasy)
3. Profile completion (bio, avatar)
4. Agreement acceptance
5. Cycle selection / joining

Routes:
- GET /onboarding/status — returns { onboardingStep, onboardingCompleted, twoFactorEnabled, role, agreementAccepted, agreementId, agreementVersion }
- POST /onboarding/step — advance step with optional data payload

requireOnboarding middleware blocks all onboardingGuard/agreementGuard routes until onboardingCompleted = true.

---

## User Roles & Permissions

Roles (least to most privileged): observer < contributor = employee < admin < founder

Role stored in UserProfile.role (default: 'contributor').

Permission matrix (from logic.md, enforced via src/lib/permissions.ts):

| Permission              | observer | contributor/employee | admin | founder |
|-------------------------|----------|----------------------|-------|---------|
| activity:submit         |          | ✓                    | ✓     | ✓       |
| activity:verify         |          |                      | ✓     | ✓       |
| activity:delete         |          |                      | ✓     | ✓       |
| cycle:create            |          |                      | ✓     | ✓       |
| cycle:delete            |          |                      |       | ✓       |
| cycle:join              |          | ✓                    | ✓     | ✓       |
| ownership:view_own      | ✓        | ✓                    | ✓     | ✓       |
| ownership:view_all      |          |                      | ✓     | ✓       |
| ownership:override      |          |                      | ✓     | ✓       |
| docs:view               | ✓        | ✓                    | ✓     | ✓       |
| docs:upload             |          |                      | ✓     | ✓       |
| docs:grant_access       |          |                      | ✓     | ✓       |
| users:change_role       |          |                      | ✓     | ✓       |
| admin:audit/disputes/   |          |                      | ✓     | ✓       |
| founder:manage_founders |          |                      |       | ✓       |

All permission checks go through src/lib/permissions.ts.

---

## Database Schema (Prisma Models)

Database: PostgreSQL. ORM: Prisma. Schema at backend/prisma/schema.prisma.

### User
Fields: id, email (unique), password, name, createdAt, updatedAt, emailVerified, emailVerifyToken, emailVerifyExpiry, twoFactorEnabled, twoFactorSecret, onboardingStep, onboardingCompleted, tokenRevokedAt, passwordResetToken, passwordResetExpiry, groupId
Relations: profile (UserProfile), cycleParticipations, activityEvents, verifiedActivities, feedbackGiven, ownershipLedger, multipliers, notifications, disputes, auditTrailAsAdmin, auditTrailAsTarget, systemLogs, archivedActivities, activitySessions, sentMessages, messageReads, messageMentions, reputation, securityEvents, userAgreements, createdTasks, taskAssignments, participationLeaves, accessGrants, grantedAccess, adminActionLogs, createdDocuments, docAccessGrants, docAccessGranted, docVersionUploads, docActivity, contributionScores, submittedIdeas

### UserProfile
Fields: id, userId (unique), role (default: 'contributor'), status (default: 'active'), bio, avatar, notificationPrefs (JSON string, default: stallWarnings/activityReminders/cycleUpdates all true)
Note: role values are founder, admin, contributor, employee, observer (stored as plain string, not enum)

### BuildCycle
Fields: id, name, description, state (planned/active/paused/closed — plain string, not enum), startDate, endDate, participantCount, createdAt, updatedAt
Relations: participations, activityEvents, ownershipLedger, multipliers, archivedActivities, messages, engagement, tasks, participationLeaves, contributionScores, ideas

### CycleParticipation
Fields: id, userId, cycleId, optedIn, participationStatus (plain string), stallStage (plain string), lastActivityDate, isLead, createdAt
Unique constraint: [userId, cycleId]

### ActivityEvent
Fields: id, userId, cycleId, activityType, proofLink, description, hoursLogged, workSummary, taskReference (free text), linkedTaskId (FK to Task), status (default: 'pending'), verifiedBy, verifiedAt, rejectionReason, feedbackComment, feedbackAuthor, feedbackTimestamp, contributionType (default: 'code'), contributionWeight (default: 1.0), calculatedOwnership (default: 0.0), scoreContribution (nullable), createdAt, updatedAt

### OwnershipLedger
Fields: id, userId, cycleId, eventType, ownershipAmount, multiplierSnapshot, sourceReference, createdBy, normalizedOwnershipPct (nullable), createdAt

### Multiplier
Fields: id, userId, cycleId, multiplier, reason, createdAt

### Notification
Fields: id, userId, type, message, read, metadata (JSON string, nullable), sent, createdAt, sentAt

### Dispute
Fields: id, userId, activityId, reason, status (default: 'pending'), resolution, createdAt, resolvedAt, resolvedBy

### AuditTrail
Fields: id, adminId, action, targetUserId, previousValue (JSON string), newValue (JSON string), reason, timestamp

### ArchivedActivity
Fields: id, userId, cycleId, activityType, proofLink, description, verified, contributionType, contributionWeight, calculatedOwnership, archivedAt, originalId

### SystemLog
Fields: id, event, severity (DEBUG/INFO/WARNING/ERROR/CRITICAL), message, timestamp, userId (nullable), metadata (JSON string)

### UserActivitySession
Fields: id, userId, sessionStart, sessionEnd, durationMinutes, pageVisited, lastHeartbeat, ipAddress, userAgent, createdAt

### ContributionWeight
Fields: id, contributionType (unique), weight (default: 1.0), description, updatedBy, updatedAt, createdAt

### CycleMessage
Fields: id, cycleId, authorId, message, mentions (JSON string, legacy), editedAt, createdAt, updatedAt
Relations: reads (MessageRead), mentionedUsers (MessageMention)

### MessageRead
Fields: id, messageId, userId, readAt
Unique: [messageId, userId]

### MessageMention
Fields: id, messageId, userId
Unique: [messageId, userId]

### ContributorReputation
Fields: id, userId (unique), reputationScore, verifiedActivities, rejectedActivities, activeCycles, consistencyScore, totalHoursLogged, lastActivityDate, calculatedAt, updatedAt

### SecurityEvent
Fields: id, userId, eventType (new_login/new_device/password_changed/2fa_enabled/2fa_disabled/reauth), ipAddress, userAgent, metadata (JSON), createdAt

### CycleEngagement
Fields: id, cycleId (unique), engagementScore, activityCount, participationRate, verifiedActivityRatio, averageHoursPerUser, messageCount, calculatedAt, updatedAt

### Agreement
Fields: id, version (unique), title, content (markdown), isActive, createdAt

### UserAgreement
Fields: id, userId, agreementId, acceptedAt, ipAddress, userAgent
Unique: [userId, agreementId]

### Task
Fields: id, title, description, acceptanceCriteria, proofLink, securityNote, restricted (bool), isStarter (bool), cycleId, groupId (nullable), createdBy, dueDate, status (default: 'open'), createdAt, updatedAt

### TaskAssignment
Fields: id, taskId, userId, status (default: 'assigned'), completedAt, createdAt, updatedAt
Unique: [taskId, userId]

### ParticipationLeave
Fields: id, userId, cycleId, status (default: 'active'), leaveStart, leaveEnd, reason, grantedBy, createdAt, updatedAt

### AccessGrant
Fields: id, userId, grantedBy, type (role/feature/cycle_access), value, expiresAt, revokedAt, revokedBy, createdAt

### AdminActionLog
Fields: id, adminId, action, targetUserIds (JSON array string), metadata (JSON string), createdAt

### RevokedToken
Fields: id, jti (unique), userId, expiresAt, revokedAt
Indexes: jti, expiresAt

### DocFolder
Fields: id, name, parentId (nullable, self-referential), createdAt
Relations: parent, children (FolderTree), documents

### Document
Fields: id, title, filePath (server-side only, never exposed in API), mimeType, size (bytes), securityLabel (internal/restricted/confidential), folderId, createdBy, isActive, createdAt, updatedAt

### DocumentAccess
Fields: id, userId, documentId, accessType (view/download), expiresAt, grantedBy, revokedAt, createdAt

### DocumentVersion
Fields: id, documentId, filePath (server-side only), mimeType, versionNumber, uploadedBy, createdAt

### DocumentActivity
Fields: id, userId, documentId, action (view/download/request_access/grant_access/revoke_access/upload_version), timestamp, metadata (JSON)

### ContributionScore
Fields: id, userId, cycleId, score (default: 0.0), lastUpdatedAt
Unique: [userId, cycleId]

### SystemPool
Fields: id, totalValue, contributorPoolPct (default: 0.4), founderPoolPct (default: 0.5), investorPoolPct (default: 0.1), decayRate (default: 0.01), isActive, updatedAt, createdAt

### Group
Fields: id, name, description, isDefault, createdAt, updatedAt
Relations: users (User[]), tasks (Task[])

### TriageSubmission
Fields: id, name, email, roleType, submissionType, description, proofLinks (JSON), availability, status (PENDING/APPROVED/REJECTED enum), reviewedBy, reviewedAt, rejectionNote, createdAt

### Idea
Fields: id, submittedBy, title, description, attachments (JSON), status (PENDING/APPROVED/REJECTED enum), reviewedBy, reviewedAt, rejectionNote, cycleId (nullable), createdAt
Relations: submitter (User), cycle (BuildCycle nullable)

---

## API Surface (All Routes)

Base URL: http://localhost:3001/api

### /api/auth

| Method | Path                              | Description                                      |
|--------|-----------------------------------|--------------------------------------------------|
| POST   | /auth/signup                      | Create account                                   |
| POST   | /auth/login                       | Login (with optional totpCode for 2FA)           |
| POST   | /auth/logout                      | Logout, revoke token jti                         |
| GET    | /auth/me                          | Get current user + profile                       |
| POST   | /auth/verify-email                | Verify email with token                          |
| POST   | /auth/resend-verification-by-email| Resend verification email                        |
| POST   | /auth/forgot-password             | Request password reset email                     |
| POST   | /auth/reset-password              | Reset password with token                        |
| POST   | /auth/change-password             | Change password (authenticated)                  |
| POST   | /auth/verify-password             | Verify password (for re-auth)                    |
| POST   | /auth/relogin                     | Re-authenticate, refresh cookie                  |
| POST   | /auth/step-up                     | Request step-up token                            |
| POST   | /auth/2fa/setup                   | Generate TOTP secret + QR code                   |
| POST   | /auth/2fa/enable                  | Enable 2FA with TOTP code                        |
| POST   | /auth/2fa/disable                 | Disable 2FA with TOTP code                       |

### /api/onboarding

| Method | Path                | Description                          |
|--------|---------------------|--------------------------------------|
| GET    | /onboarding/status  | Get onboarding state                 |
| POST   | /onboarding/step    | Advance onboarding step              |

### /api/agreements

| Method | Path                          | Description                              |
|--------|-------------------------------|------------------------------------------|
| GET    | /agreements/current           | Get active agreement                     |
| GET    | /agreements/history           | All agreements                           |
| GET    | /agreements/user-status       | Current user's acceptance status         |
| POST   | /agreements/accept            | Accept agreement                         |
| POST   | /agreements                   | Create agreement (admin)                 |
| PATCH  | /agreements/:id/activate      | Set agreement as active (admin)          |
| GET    | /agreements/acceptance-log    | All user acceptances (admin)             |

### /api/cycles (onboardingGuard)

| Method | Path           | Description                                    |
|--------|----------------|------------------------------------------------|
| GET    | /cycles        | List all cycles                                |
| GET    | /cycles/:id    | Get single cycle                               |
| POST   | /cycles        | Create cycle (admin/founder)                   |
| PATCH  | /cycles/:id    | Update cycle state/name/description (admin)    |
| DELETE | /cycles/:id    | Delete cycle (founder only)                    |

### /api/participation (agreementGuard)

| Method | Path                          | Description                                  |
|--------|-------------------------------|----------------------------------------------|
| POST   | /participation/join           | Join a cycle                                 |
| GET    | /participation/:cycleId       | Get current user's participation in cycle    |
| GET    | /participation/user/:userId   | Get all participations for a user            |
| GET    | /participation/:cycleId/all   | Get all participants in a cycle              |

### /api/activities (agreementGuard)

| Method | Path                          | Description                                  |
|--------|-------------------------------|----------------------------------------------|
| GET    | /activities                   | List activities (filter: cycleId, userId, linkedTaskId) |
| POST   | /activities                   | Submit activity                              |
| GET    | /activities/pending           | List pending activities (admin)              |
| PATCH  | /activities/:id/verify        | Verify/reject/request-changes (admin)        |
| POST   | /activities/:id/dispute       | Submit dispute on rejected activity          |

### /api/ownership (agreementGuard)

| Method | Path                                  | Description                              |
|--------|---------------------------------------|------------------------------------------|
| GET    | /ownership/:userId/:cycleId           | Get ownership for user+cycle             |
| GET    | /ownership/summary                    | Summary for current user                 |
| GET    | /ownership/normalized/:userId/:cycleId| Normalized ownership %                   |
| GET    | /ownership/effective/:userId/:cycleId | Effective ownership (vested + provisional)|
| GET    | /ownership/export                     | Export ownership data (CSV/JSON)         |

### /api/analytics (agreementGuard)

| Method | Path                              | Description                              |
|--------|-----------------------------------|------------------------------------------|
| GET    | /analytics/dashboard              | Dashboard analytics (optional cycleId)   |
| GET    | /analytics/contributors           | Top contributors (limit param)           |
| GET    | /analytics/reputation/:userId     | User reputation score                    |
| GET    | /analytics/engagement/:cycleId    | Cycle engagement score                   |
| GET    | /analytics/cycle/:cycleId         | Cycle-level analytics                    |

### /api/docs (agreementGuard)

| Method | Path                          | Description                                  |
|--------|-------------------------------|----------------------------------------------|
| GET    | /docs                         | List documents (filter: folderId, label, search) |
| GET    | /docs/:id                     | Get document metadata                        |
| PATCH  | /docs/:id                     | Update document metadata (admin)             |
| GET    | /docs/view/:id                | Download/view document blob                  |
| GET    | /docs/download/:id            | Download document (triggers download)        |
| POST   | /docs/upload                  | Upload document (admin, multipart)           |
| POST   | /docs/version                 | Upload new version (admin, multipart)        |
| POST   | /docs/request-access          | Request access to document                   |
| POST   | /docs/grant-access            | Grant access (admin, step-up)                |
| POST   | /docs/revoke-access           | Revoke access (admin, step-up)               |
| GET    | /docs/folders                 | List folders                                 |
| POST   | /docs/folders                 | Create folder (admin)                        |
| GET    | /docs/:id/activity            | Document activity log                        |
| GET    | /docs/:id/access              | Document access grants                       |

### /api/tasks (agreementGuard)

| Method | Path                  | Description                                      |
|--------|-----------------------|--------------------------------------------------|
| GET    | /tasks                | List tasks (filter: cycleId)                     |
| GET    | /tasks/my             | Current user's assigned tasks                    |
| GET    | /tasks/:id            | Get single task                                  |
| POST   | /tasks                | Create task (admin/founder)                      |
| POST   | /tasks/assign         | Assign task to users (admin/founder)             |
| PATCH  | /tasks/:id/status     | Update task status                               |
| PATCH  | /tasks/:id/complete   | Mark task complete                               |
| PATCH  | /tasks/:id/progress   | Mark task in-progress                            |

### /api/leave (agreementGuard)

| Method | Path                      | Description                              |
|--------|---------------------------|------------------------------------------|
| POST   | /leave/request            | Request leave                            |
| GET    | /leave/my                 | Current user's leaves                    |
| GET    | /leave/status/:cycleId    | Leave status for cycle                   |
| POST   | /leave/admin/grant        | Admin grant leave                        |
| PATCH  | /leave/admin/override     | Admin override participation status      |
| GET    | /leave/admin/all          | All leaves (admin)                       |

### /api/messages (agreementGuard)

| Method | Path                          | Description                              |
|--------|-------------------------------|------------------------------------------|
| GET    | /messages/cycle/:cycleId      | Get all messages in cycle                |
| POST   | /messages                     | Send message with mentions               |
| PATCH  | /messages/:id                 | Edit message                             |
| DELETE | /messages/:id                 | Delete message                           |
| POST   | /messages/:id/read            | Mark message as read                     |
| GET    | /messages/unread-count        | Unread message count                     |
| GET    | /messages/mentions            | Current user's mentions                  |

### /api/notifications (onboardingGuard)

| Method | Path                              | Description                          |
|--------|-----------------------------------|--------------------------------------|
| GET    | /notifications                    | List notifications                   |
| PATCH  | /notifications/:id/read           | Mark notification read               |
| PATCH  | /notifications/read-all           | Mark all read                        |
| GET    | /notifications/unread-count       | Unread count                         |
| POST   | /notifications/:id/dismiss-threat | Dismiss threat alert                 |
| GET    | /notifications/preferences        | Get notification preferences         |
| PUT    | /notifications/preferences        | Update notification preferences      |

### /api/sessions (onboardingGuard)

| Method | Path                      | Description                              |
|--------|---------------------------|------------------------------------------|
| POST   | /sessions/start           | Start session tracking                   |
| POST   | /sessions/heartbeat       | Send heartbeat                           |
| POST   | /sessions/end             | End current session                      |
| GET    | /sessions/analytics       | Session analytics (days param)           |
| GET    | /sessions/list            | List user's sessions                     |
| POST   | /sessions/end/:id         | End specific session                     |
| POST   | /sessions/end-all         | End all other sessions                   |

### /api/weights (onboardingGuard)

| Method | Path              | Description                              |
|--------|-------------------|------------------------------------------|
| GET    | /weights          | List all contribution weights            |
| PATCH  | /weights/:type    | Update weight for type (admin)           |
| POST   | /weights/reset    | Reset all weights to defaults (admin)    |

### /api/security (onboardingGuard)

| Method | Path              | Description                              |
|--------|-------------------|------------------------------------------|
| GET    | /security/events  | Get current user's security events       |

### /api/logs (onboardingGuard)

| Method | Path                          | Description                              |
|--------|-------------------------------|------------------------------------------|
| GET    | /logs                         | List system logs (filter: userId, type, dates, pagination) |
| GET    | /logs/export                  | Export logs (CSV/JSON)                   |
| POST   | /logs/access-request          | Submit access request                    |
| GET    | /logs/access-requests         | List access requests (admin)             |
| PATCH  | /logs/access-request/:id      | Review access request (admin)            |

### /api/admin (onboardingGuard)

| Method | Path                              | Description                                      |
|--------|-----------------------------------|--------------------------------------------------|
| GET    | /admin/users                      | List all users                                   |
| PATCH  | /admin/users/:id/role             | Change user role (step-up)                       |
| GET    | /admin/disputes                   | List all disputes                                |
| POST   | /admin/resolve-dispute            | Resolve dispute (step-up)                        |
| GET    | /admin/audit                      | Audit trail (filter: action, adminSearch, targetSearch, dates, pagination) |
| POST   | /admin/override/ownership         | Override ownership amount (step-up)              |
| POST   | /admin/override/multiplier        | Override multiplier (step-up)                    |
| POST   | /admin/override/stall-clear       | Clear stall status (step-up)                     |
| POST   | /admin/bulk-action                | Bulk action on users (step-up)                   |
| POST   | /admin/grant-access               | Grant access to user (step-up)                   |
| POST   | /admin/revoke-access              | Revoke access from user (step-up)                |
| GET    | /admin/access-grants/:userId      | Get access grants for user                       |
| GET    | /admin/action-logs                | Admin action logs                                |
| POST   | /admin/jobs/execute               | Execute job manually (step-up)                   |
| GET    | /admin/accountability/status      | Accountability status                            |

### /api/admin/backup (onboardingGuard)

| Method | Path                  | Description                              |
|--------|-----------------------|------------------------------------------|
| GET    | /admin/backup/status  | Backup and DB health status              |

### /api/triage (no guard)

| Method | Path                          | Description                              |
|--------|-------------------------------|------------------------------------------|
| POST   | /triage/submit                | Submit triage application (public)       |
| GET    | /triage/admin                 | List triage submissions (admin, filter: status) |
| GET    | /triage/admin/:id             | Get triage detail (admin)                |
| POST   | /triage/admin/:id/approve     | Approve triage submission (admin)        |
| POST   | /triage/admin/:id/reject      | Reject triage submission (admin)         |

### /api/groups (agreementGuard)

| Method | Path                              | Description                              |
|--------|-----------------------------------|------------------------------------------|
| GET    | /groups/my                        | Get current user's group                 |
| GET    | /groups/admin                     | List all groups (admin)                  |
| POST   | /groups/admin                     | Create group (admin)                     |
| PATCH  | /groups/admin/:id                 | Update group (admin)                     |
| DELETE | /groups/admin/:id                 | Delete group (admin)                     |
| PATCH  | /groups/admin/users/:userId/group | Assign user to group (admin)             |

### /api/ideas (agreementGuard)

| Method | Path                      | Description                              |
|--------|---------------------------|------------------------------------------|
| POST   | /ideas                    | Submit idea                              |
| GET    | /ideas/my                 | Current user's ideas                     |
| GET    | /ideas/:id                | Get idea detail                          |
| GET    | /ideas/admin/list         | List all ideas (admin, filter: status)   |
| POST   | /ideas/admin/:id/approve  | Approve idea (admin)                     |
| POST   | /ideas/admin/:id/reject   | Reject idea (admin)                      |

---

## Ownership Economy Engine

### Core Formula
```
effectiveOwnership = vestedOwnership + (provisionalOwnership × multiplier)
```

### Vesting (linear)
```
vestedPercentage = (now - cycleStart) / (cycleEnd - cycleStart)
vestedOwnership = totalOwnership × vestedPercentage
provisionalOwnership = totalOwnership - vestedOwnership
```

### Ownership Ledger
Every ownership event creates an OwnershipLedger entry with:
- eventType, ownershipAmount, multiplierSnapshot, sourceReference
- normalizedOwnershipPct (nullable, computed by normalization job)

### Normalized Ownership
```
normalizedOwnershipPct = (userScore / totalScore) × contributorPoolPct
```
- Stored in latest ledger entry
- Falls back to 0 if totalScore = 0
- Does NOT modify vesting/multiplier logic (additive design)

### System Pool Config (SystemPool model)
- totalValue — total pool value
- contributorPoolPct = 0.4 (40%)
- founderPoolPct = 0.5 (50%)
- investorPoolPct = 0.1 (10%)
- decayRate = 0.01 (exponential decay rate for scoring)

---

## Contribution Scoring

### Score Formula
```
scoreContribution = contributionWeight × hoursFactor × timeDecay

hoursFactor = 1 + log(1 + hoursLogged) / log(5)
  → ~1.0 at 0h, ~2.0 at 4h (diminishing returns above 4h)

timeDecay = e^(-decayRate × daysSinceActivity)
  → exponential decay, incentivizes consistent recent activity
```

### Aggregation
- Per-user, per-cycle ContributionScore = sum of all verified activities' scoreContribution
- Recomputed hourly by AggregationJob
- Only verified activities count

### Reputation Score Formula
```
reputationScore = (verifiedActivities × 5)
                + (activeCycles × 10)
                - (rejectedActivities × 3)
                + (consistencyScore × 8)
                + min(totalHoursLogged / 10, 20)
```

### Cycle Engagement Score Formula
```
engagementScore = (activityCount × 0.5)
                + (participationRate × 30)
                + (verifiedRatio × 20)
                + (messageCount × 0.1)
                + (avgHours × 2)
```

---

## Multipliers

- Each user has a Multiplier record per cycle
- Default multiplier = 1.0
- Adjusted daily by AdjustMultiplierJob (runs at 3 AM) based on stallStage:
  - none / grace / active → multiplier stays at or returns toward 1.0
  - at_risk → multiplier reduced
  - diminishing → multiplier further reduced
  - paused → multiplier at minimum
- Admin can manually override multiplier (step-up required, logged to AuditTrail)

---

## Stall Detection

### Stall Stages
```
none → grace → active → at_risk → diminishing → paused
```

### Logic (StallEvaluatorJob — runs daily at 2 AM)
- Grace period: first 3 days after joining
- After grace:
  - ≤6 days since last activity → active
  - 7–13 days → at_risk
  - 14–20 days → diminishing
  - >20 days → paused
- Stage changes trigger notifications and multiplier adjustments
- Batch-updated to avoid N+1 queries

---

## Ownership Decay

Runs weekly (Sunday 1 AM) via OwnershipDecayJob:
- diminishing stage → 5% decay per week on provisional ownership
- paused stage → 10% decay per week on provisional ownership
- Minimum 7 days between decays per user
- Creates a negative OwnershipLedger entry with eventType: 'decay'
- Vested ownership is NOT decayed

---

## Background Jobs (scheduler.ts)

| Job                    | Schedule           | Description                                          |
|------------------------|--------------------|------------------------------------------------------|
| StallEvaluatorJob      | Daily 2 AM         | Evaluate participation status based on inactivity    |
| AdjustMultiplierJob    | Daily 3 AM         | Adjust multipliers based on stall stage              |
| CycleFinalizerJob      | Daily 4 AM         | Close ended cycles, lock ownership                   |
| ActivityArchiverJob    | Weekly Sun 5 AM    | Archive old activities                               |
| OwnershipDecayJob      | Weekly Sun 1 AM    | Decay provisional ownership for stalled users        |
| Leave Auto-Resume      | Hourly             | Resume participation when leaveEnd expires           |
| Task Overdue Marking   | Daily 1 AM         | Mark open tasks with past dueDate as overdue         |
| Stale Session Cleanup  | Every 15 min       | Close sessions without heartbeat for 10+ min         |
| Access Grant Expiry    | Every 30 min       | Auto-revoke expired access grants                    |
| Revoked Token Cleanup  | Daily midnight     | Delete expired RevokedToken rows                     |
| ScoreComputationJob    | Every 30 min       | Write scoreContribution on newly-verified activities |
| AggregationJob         | Hourly at :15      | Recompute per-user ContributionScore totals          |
| NormalizationJob       | Hourly at :20      | Compute normalizedOwnershipPct                       |

Manual triggers available via JobScheduler static methods and POST /admin/jobs/execute.

---

## Activity Tracking & Validation

### Activity Types
code | documentation | review | task_completion | hours_logged | meeting | research

### Activity Statuses
pending → verified | rejected | changes_requested

### Validation Rules (activityValidationService.ts)
- Proof URL — type-specific patterns:
  - code → GitHub/GitLab/Bitbucket commit, PR, or issue URL
  - documentation → GitHub PR, Notion, Confluence, Google Docs
  - review → GitHub/GitLab PR review URL
  - hours_logged / meeting / research → any valid HTTPS URL
  - task_completion → GitHub issue/PR, Jira, Linear, Notion
- Duplicate detection — same proof URL within 72 hours rejected
- Spam detection — max 3 same-type activities per 30 minutes
- Quality checks — minimum description/summary length
- Hours sanity — 0.1–12 hours per activity
- Daily limits — max 10 activities or 12 hours per day

---

## Build Cycles

### States
planned → active → paused → closed

### Cycle Lifecycle
- Planned — setup phase, no participation
- Active — accepting activities, stall evaluation runs daily
- Paused — temporarily halted
- Closed — finalized by CycleFinalizerJob, ownership locked, notifications sent

### Participation Record (CycleParticipation)
- participationStatus: active | at-risk | paused | grace
- stallStage: none | grace | active | at_risk | diminishing | paused
- lastActivityDate — updated on every verified activity submission
- optedIn boolean
- isLead boolean

---

## Leave System

### Leave Model (ParticipationLeave)
- status: active | paused | left
- leaveStart, leaveEnd, reason, grantedBy

### Behavior
- User requests leave → participation paused, stallStage set to paused
- Auto-resume when leaveEnd expires (checked hourly by scheduler)
- Admin can grant/override participation status directly

---

## Agreements System

### Agreement Model
- version (unique), title, content (markdown), isActive

### UserAgreement
- Tracks acceptance per user with IP + userAgent

### Enforcement
- Active agreement required to access participation/activities/ownership routes
- Admins/founders exempt
- requireAgreement middleware triggers agreement:required event if not accepted

---

## Docs Vault

### Document Model
- filePath is server-side only — NEVER exposed in API responses
- securityLabel: internal | restricted | confidential
- Supports folder hierarchy via DocFolder (self-referential parentId)

### Access Control
- DocumentAccess: userId, documentId, accessType (view | download), expiresAt, grantedBy, revokedAt

### Document Versions
- DocumentVersion tracks upload history with versionNumber

### Document Activity (Audit Trail)
- Events: view, download, request_access, grant_access, revoke_access, upload_version

---

## Tasks System (Kanban)

### Task Model
- status: open | completed | overdue
- restricted (bool) — hides details from non-admins
- isStarter (bool) — starter tasks for new contributors
- groupId (nullable) — tasks can be scoped to a group

### Task Assignment (TaskAssignment)
- status: assigned | in_progress | completed

### Overdue Marking
- Tasks with status 'open' and dueDate in the past are auto-marked 'overdue' daily at 1 AM

---

## Groups System

### Group Model
- name, description, isDefault
- Users can be assigned to one group (User.groupId)
- Tasks can be scoped to a group (Task.groupId)

### Routes
- GET /groups/my — current user's group
- Admin CRUD via /groups/admin
- Admin user assignment via /groups/admin/users/:userId/group

---

## Triage System

### TriageSubmission Model
- name, email, roleType, submissionType, description, proofLinks (JSON), availability
- status: PENDING | APPROVED | REJECTED (Prisma enum)
- Public submission endpoint (no auth required)

---

## Ideas System

### Idea Model
- submittedBy, title, description, attachments (JSON)
- status: PENDING | APPROVED | REJECTED (Prisma enum)
- cycleId (nullable) — approved ideas can be linked to a cycle

---

## Notifications

### Types
stall_warning, participation_paused, activity_verified, multiplier_changed, cycle_started, cycle_finalized, admin_message, ownership_decay, participation_resumed

### Model
- userId, type, message, read, metadata (JSON string), sent, sentAt

### User Preferences
- Stored as JSON in UserProfile.notificationPrefs
- Keys: stallWarnings, activityReminders, cycleUpdates (all boolean)

---

## Messaging

### CycleMessage Model
- cycleId, authorId, message, mentions (JSON string — legacy field), editedAt
- MessageRead tracks who read each message
- MessageMention tracks @mentions (proper relation, replaces legacy mentions field)

---

## Security

### Threat Detection
SecurityEvent model tracks: new_login, new_device, password_changed, 2fa_enabled, 2fa_disabled, reauth
Stores IP, userAgent, metadata per event.

### Audit Trail
- AuditTrail — all admin override actions with previousValue/newValue
- AdminActionLog — bulk operations
- SystemLog — system events (cycle finalization, errors)

### Security Middleware
- Helmet.js — strict CSP (no inline scripts, no frame embedding)
- CORS — restricted to FRONTEND_URL only
- Rate limiting — 10,000 req/15 min global, 20 req/15 min for auth endpoints
- HttpOnly cookies — JWT not accessible from JS (but see Auth section note)
- Token revocation — per-token (jti) + per-user (tokenRevokedAt)

---

## Session Tracking

### UserActivitySession Model
- sessionStart, sessionEnd, durationMinutes, pageVisited, lastHeartbeat, ipAddress, userAgent

### Flow
1. Frontend calls POST /sessions/start with pageVisited
2. Sends POST /sessions/heartbeat periodically
3. Calls POST /sessions/end on page unload
4. Stale sessions (no heartbeat for 10+ min) auto-closed every 15 min by scheduler

---

## Frontend Architecture

### Framework
Next.js App Router. All pages in app/ directory. TypeScript + Tailwind CSS.

### Entry Points
- app/layout.tsx — root layout, wraps with Providers (AuthProvider + CycleProvider)
- app/page.tsx — root redirect (checks auth, redirects to /dashboard or /login)
- app/login/page.tsx — login form
- app/signup/page.tsx — signup form
- app/onboarding/page.tsx — onboarding wizard
- app/dashboard/page.tsx — main user dashboard
- app/admin/page.tsx — admin dashboard
- app/admin/layout.tsx — admin layout with sidebar

### State Management
- AuthContext (src/context/AuthContext.tsx) — user session, login/logout, session timers
- CycleContext (src/context/CycleContext.tsx) — active cycle selection, cycle list

### AuthContext Details
- Calls GET /auth/me on mount to restore session
- login() — calls POST /auth/login, sets user state, writes auth_token cookie, starts session timers, redirects based on role
- signup() — calls POST /auth/signup, redirects to /onboarding
- logout() — clears timers, clears cookie, calls POST /auth/logout, redirects to /login
- refreshUser() — re-fetches current user
- Exposes: { user, loading, login, signup, logout, refreshUser }

### CycleContext Details
- refreshCycles() — fetches all cycles, auto-selects first active cycle or first cycle
- setActiveCycle() — manually set active cycle
- Exposes: { activeCycle, allCycles, loading, error, setActiveCycle, refreshCycles }

### API Client (src/lib/api-client.ts)
- Singleton: export const apiClient = new ApiClient()
- All requests use credentials: 'include' (sends cookies)
- Content-Type: application/json set on all requests
- 401 on non-auth endpoints → calls handleTokenExpiry(), retries once after re-auth
- 403 with AGREEMENT_NOT_ACCEPTED → dispatches agreement:required CustomEvent
- 5xx and network errors → retries up to 2 times with 500ms backoff
- Step-up token attached via X-Step-Up-Token header (read from in-memory store via getStepUpToken())
- Blob downloads use raw fetch() with triggerBlobDownload() helper

### Session Timers (src/lib/session-timer.ts)
- startSessionTimers() — starts inactivity timer and absolute timer
- clearSessionTimers() — clears all timers
- attachActivityListeners() — mouse/keyboard events reset idle timer
- Inactivity warning modal shown before auto-logout

### Auth Expiry Handler (src/lib/auth-expiry-handler.ts)
- handleTokenExpiry() — shows re-auth modal, waits for user to re-login
- onReAuthDismissed() — called when user dismisses modal
- setCachedEmail() / getCachedEmail() — caches email for re-auth modal pre-fill

### Step-Up (src/lib/step-up.ts)
- getStepUpToken() — returns current in-memory step-up token
- setStepUpToken() — stores step-up token in memory
- clearStepUpToken() — clears it

### Permissions (src/lib/permissions.ts)
- Centralized permission checks
- hasPermission(user, permission) — checks role against permission matrix
- No role strings scattered in components

### Key Hooks
- useActivity — submit/fetch activities
- useCycles — cycle list + state
- useOwnershipData — ownership + ledger
- useParticipation — join/leave cycles
- useTasks — kanban board data
- useLeave — leave requests
- useNotifications — notification bell + panel
- usePermissions — check permissions client-side
- useStepUpAuth — trigger step-up flow
- useThreatAlerts — security event banner
- useAnalytics — dashboard analytics
- useGroups — group management
- useIdeas — idea submission/review
- useTriage — triage management
- useDocs — docs vault
- useFilters — filter state management
- useLogs — system logs
- useSessionTracking — session heartbeat
- useOptimizedQueries — batched/cached queries

### Key Components (by feature)
- activity/ — ActivityFeedback, ActivityItem, ActivityTimeline, DisputeSubmissionModal, SubmitActivityForm, WorkHoursSummary
- admin/ — BackupStatusPanel, GrantAccessModal, JobExecutionPanel
- agreements/ — AgreementGate, AgreementModal, AgreementViewerModal
- auth/ — AccessOverviewWidget, ForceReAuthModal, LoadingScreen, SessionWarningModal, StepUpModal, UserProfile
- cycles/ — CreateCycleModal, CycleCard, CycleCardSkeleton, CycleDetails, CycleStatusBadge
- dashboard/ — AccessExpiryWidget, AccountabilityStatus, AssignedTasksWidget, ContributionHeatmap, ContributorProgressTracker, DashboardGrid, EarningsProjectionCard, EngagementScore, ErrorState, GroupBadge, NotificationWidget, OwnershipCards, OwnershipCardsSkeleton, ParticipationCard, RulesBanner, SecurityNoticesWidget, StallWarningAlert, StatsCard, TierBadge, TopContributors
- docs/ — DocumentCard, FolderTree, GrantDocAccessModal, RequestAccessModal, SecurityLabelBadge
- groups/ — AssignGroupModal, CreateGroupModal, GroupCard
- ideas/ — ApproveIdeaModal, IdeaCard, IdeaDetailModal, IdeaStatusBadge, IdeaSubmitForm, RejectIdeaModal
- notifications/ — NotificationBell, NotificationPanel
- participation/ — JoinBuildButton, ParticipationBadge, ParticipationStatusCard, ParticipationSummary, StallStageIndicator
- security/ — ThreatBanner, WatermarkOverlay
- settings/ — ActiveSessionsModal, ReAuthModal, TwoFactorSetup
- tasks/ — KanbanBoard, TaskDetailPanel
- triage/ — RejectModal, TriageDetailModal, TriageSubmissionForm, TriageTable
- ui/ — ConfirmDialog, ExportButton, FilterBar
- messaging/ — CycleDiscussion
- onboarding/ — OnboardingTour
- layout/ — (closed folder, not read)
- providers/ — Providers.tsx (wraps AuthProvider + CycleProvider)
- debug/ — DebugPanel

### Admin Pages
- /admin — main admin dashboard
- /admin/access — access grant management
- /admin/accountability — accountability status
- /admin/activity-review — pending activity review
- /admin/agreements — agreement management
- /admin/analytics — analytics
- /admin/audit — audit trail
- /admin/disputes — dispute resolution
- /admin/docs — docs vault admin
- /admin/groups — group management
- /admin/ideas — idea review
- /admin/leave — leave management
- /admin/overrides — ownership/multiplier/stall overrides
- /admin/roles — role management
- /admin/tasks — task management
- /admin/triage — triage review
- /admin/weights — contribution weight management

### Other Pages
- /activity — activity feed
- /build-cycles — cycle browser
- /dashboard — user dashboard
- /docs — docs vault
- /docs/view/[id] — document viewer
- /earnings — earnings view
- /ideas — idea browser
- /ideas/submit — idea submission
- /insights — analytics insights
- /onboarding — onboarding wizard
- /profile — user profile
- /settings — user settings
- /setup-2fa — 2FA setup
- /signup — signup
- /submit-to-triage — triage submission
- /team — team view
- /verify-email — email verification

---

## Architectural Patterns

1. Additive Design — new features add new fields/tables without modifying existing ones (e.g. normalizedOwnershipPct is nullable and additive)
2. Atomic Transactions — race condition prevention on cycle participation and finalization
3. Batch Queries — background jobs use batch queries to avoid N+1 patterns
4. Centralized Permissions — single permission matrix in src/lib/permissions.ts
5. Step-Up Auth — password re-verification gates all destructive/sensitive operations
6. Agreement Enforcement — active agreement blocks participation routes (admins/founders exempt)
7. Time-Decay Scoring — exponential decay incentivizes consistent recent activity over bursts
8. Stall → Multiplier → Decay pipeline — inactivity progressively reduces ownership earning potential
9. Full Audit Trail — every admin action logged with before/after values
10. Standard API Response Format — all routes return { success, data, error }

---

## Errors and Issues Found

The following issues were found during code reading. They are documented here without correction.

### 1. session-timer.ts — Absolute timer never fires
File: src/lib/session-timer.ts
The scheduleAbsoluteTimer() function reads the JWT from localStorage.getItem('auth_token') to determine the token's expiry time. However, the auth system stores the JWT in an HttpOnly cookie (set by the backend) and a client-accessible cookie (set by AuthContext via document.cookie). The token is never stored in localStorage. As a result, localStorage.getItem('auth_token') always returns null, the function returns early, and the absolute session expiry timer never fires.

### 2. admin/page.tsx — Hardcoded rejection reason
File: app/admin/page.tsx
The quick-review panel on the admin dashboard calls handleVerification() with a hardcoded rejection reason string 'Needs more information'. There is no UI input for a custom rejection reason in this panel. Admins cannot provide a specific reason when rejecting activities from the dashboard quick-review.

### 3. backend/src/routes/admin.ts — Unreachable job IDs in switch statement
File: backend/src/routes/admin.ts
The POST /admin/jobs/execute route has a Zod schema that only allows jobId values: ['stall-evaluator', 'multiplier-adjustment', 'ownership-decay', 'cycle-finalizer']. However, the switch statement inside the handler also has cases for 'score-computation', 'aggregation', and 'normalization'. These three cases are unreachable because the Zod validation will reject those jobId values before the switch is reached. The three economy engine jobs cannot be triggered via the admin API endpoint.

### 4. CycleContext.tsx — Potential infinite loop risk
File: src/context/CycleContext.tsx
The refreshCycles function is wrapped in useCallback with [activeCycle] in its dependency array. This means refreshCycles is recreated whenever activeCycle changes. The useEffect that calls refreshCycles has [refreshCycles] as its dependency. When refreshCycles runs and calls setActiveCycle(), activeCycle changes, which recreates refreshCycles, which triggers the useEffect again. This creates a potential infinite re-render loop. In practice it may be throttled by React's batching, but the dependency chain is structurally incorrect.

### 5. backend/src/routes/sessions.ts — Misleading field repurposing
File: backend/src/routes/sessions.ts
The GET /sessions/list route formats the response by repurposing the pageVisited field from UserActivitySession as "device" context in the returned object. The pageVisited field is intended to store the page URL the user was on, not device information. This makes the sessions list response misleading — the "device" field actually contains a page URL string.

### 6. backend/src/routes/participation.ts — Invalid participationStatus value
File: backend/src/routes/participation.ts
The bulk-action handler for remove_from_cycle sets participationStatus: 'removed' on the CycleParticipation record. However, 'removed' is not a documented valid value for participationStatus. The documented valid values are: active | at-risk | paused | grace. Setting an undocumented status value may cause issues in any code that checks participationStatus against the known set of values.

### 7. backend/src/routes/ideas.ts — Route ordering bug
File: backend/src/routes/ideas.ts
The route GET /ideas/admin/list is registered AFTER GET /ideas/:id in the router. Express matches routes in registration order, so when a request comes in for /ideas/admin/list, Express will match it against GET /ideas/:id first, treating 'admin' as the :id parameter value. The GET /ideas/admin/list route will never be reached. The admin list route should be registered before the parameterized :id route.

### 8. backend/src/routes/tasks.ts — Route ordering bug
File: backend/src/routes/tasks.ts
The route GET /tasks/my is registered AFTER GET /tasks/:id in the router. Express will match /tasks/my against GET /tasks/:id first, with id = 'my'. The GET /tasks/my route will never be reached. The /tasks/my route should be registered before the parameterized :id route.

### 9. src/lib/api-client.ts — Formatting issue on submitAccessRequest
File: src/lib/api-client.ts (around line 858)
The submitAccessRequest method has a formatting issue where the return statement and the opening of the request call are on the same line as the closing of the function signature, with no newline separation:
```
async submitAccessRequest(accessType: string, reason: string): Promise<any> {    return this.request<any>('/logs/access-request', {
```
This is a code style/formatting issue. The code is functionally correct but the lack of newline makes it appear as if the function body starts on the same line as the signature with extra spaces.
