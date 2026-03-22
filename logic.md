# Builder's Circle — Full Project Logic

## What Is This Project?

Builder's Circle is a **contribution-based ownership economy platform** for distributed teams. It tracks work contributions, calculates ownership stakes, manages participation cycles, and distributes earnings based on verified activities. The system enforces accountability through stall detection, multiplier adjustments, and ownership decay.

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Node.js + Express, TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: JWT (HttpOnly cookies), TOTP 2FA (speakeasy)
- **Jobs**: node-cron scheduled background jobs
- **Email**: Custom email service (emailService.ts)
- **File Storage**: Local disk (`backend/uploads/`)

---

## 1. Authentication & Authorization

### Signup Flow
1. User submits email + password → account created with `emailVerified: false`
2. Verification email sent with 24h token
3. User clicks link → `POST /auth/verify-email` → `emailVerified: true`

### Login Flow
1. `POST /auth/login` with email + password
2. If 2FA enabled → must provide TOTP code
3. On success → JWT issued, stored in **HttpOnly cookie** (7-day expiry)
4. JWT payload: `{ userId, jti, iat, twoFactorVerified }`

### JWT Security
- Per-token revocation via `jti` stored in `RevokedToken` table (logout)
- Per-user revocation via `tokenRevokedAt` (force-logout all devices)
- Token NOT accepted from query params — only `Authorization` header or cookie

### Step-Up Authentication
- Sensitive operations (overrides, role changes, doc access grants) require a step-up token
- `POST /auth/step-up` → re-verify password → short-lived step-up token
- Passed as `X-Step-Up-Token` header

### Middleware Chain (in order)
```
authMiddleware           → validates JWT, checks revocation, populates req.user
requireEmailVerified     → blocks unverified users
require2FA               → blocks users without 2FA enabled
requireOnboarding        → blocks users who haven't completed onboarding
requireAgreement         → blocks users who haven't accepted active agreement
stepUpMiddleware         → requires X-Step-Up-Token for sensitive ops
requireFullAccess        → blocks view-only access grant holders from mutations
```

**Route guard groups:**
- `onboardingGuard` = auth + emailVerified + 2FA + onboarding
- `agreementGuard` = onboardingGuard + agreement

---

## 2. User Roles & Permissions

### Roles (least → most privileged)
```
observer < contributor = employee < admin < founder
```

### Permission Matrix

| Permission | observer | contributor/employee | admin | founder |
|---|---|---|---|---|
| activity:submit | | ✓ | ✓ | ✓ |
| activity:verify | | | ✓ | ✓ |
| activity:delete | | | ✓ | ✓ |
| cycle:create | | | ✓ | ✓ |
| cycle:delete | | | | ✓ |
| cycle:join | | ✓ | ✓ | ✓ |
| ownership:view_own | ✓ | ✓ | ✓ | ✓ |
| ownership:view_all | | | ✓ | ✓ |
| ownership:override | | | ✓ | ✓ |
| docs:view | ✓ | ✓ | ✓ | ✓ |
| docs:upload | | | ✓ | ✓ |
| docs:grant_access | | | ✓ | ✓ |
| users:change_role | | | ✓ | ✓ |
| admin:audit/disputes/overrides/weights | | | ✓ | ✓ |
| founder:manage_founders/system_config | | | | ✓ |

All permission checks go through `src/lib/permissions.ts` — no role strings scattered in components.

---

## 3. Onboarding Flow

Steps (tracked via `onboardingStep` int on User):
1. Email verification
2. 2FA setup (TOTP via speakeasy)
3. Profile completion (bio, avatar)
4. Agreement acceptance
5. Cycle selection / joining

Routes: `GET /onboarding/status`, `POST /onboarding/step`

Until all steps complete, `requireOnboarding` middleware blocks access to protected routes.

---

## 4. Build Cycles

### States
```
planned → active → paused → closed
```

### Cycle Model
- `id, name, description, state, startDate, endDate, participantCount`
- Owns all activities, ownership ledger entries, multipliers, messages, tasks, leaves

### Participation Record
Each user in a cycle has a `CycleParticipation` record:
- `participationStatus`: active | at-risk | paused | grace
- `stallStage`: none | grace | active | at_risk | diminishing | paused
- `lastActivityDate` — updated on every verified activity submission
- `optedIn` boolean

### Cycle Lifecycle
- **Planned** — setup phase, no participation
- **Active** — accepting activities, stall evaluation runs daily
- **Paused** — temporarily halted
- **Closed** — finalized by `CycleFinalizerJob`, ownership locked, notifications sent

---

## 5. Activity Tracking & Validation

### Activity Types
`code | documentation | review | task_completion | hours_logged | meeting | research`

### Activity Statuses
`pending → verified | rejected | changes_requested`

### Validation Rules (activityValidationService.ts)
- **Proof URL** — type-specific patterns enforced:
  - `code` → GitHub/GitLab/Bitbucket commit, PR, or issue URL
  - `documentation` → GitHub PR, Notion, Confluence, Google Docs
  - `review` → GitHub/GitLab PR review URL
  - `hours_logged / meeting / research` → any valid HTTPS URL
  - `task_completion` → GitHub issue/PR, Jira, Linear, Notion
- **Duplicate detection** — same proof URL within 72 hours rejected
- **Spam detection** — max 3 same-type activities per 30 minutes
- **Quality checks** — minimum description/summary length
- **Hours sanity** — 0.1–12 hours per activity
- **Daily limits** — max 10 activities or 12 hours per day

### Activity Fields
`proofLink, description, hoursLogged, workSummary, taskReference, contributionType, contributionWeight (default 1.0), status, verifiedBy, verifiedAt, rejectionReason, feedbackComment, scoreContribution (computed), calculatedOwnership (computed)`

---

## 6. Ownership Economy Engine

### Core Formula
```
effectiveOwnership = vestedOwnership + (provisionalOwnership × multiplier)
```

### Vesting
Linear from 0% at cycle start → 100% at cycle end:
```
vestedPercentage = (now - cycleStart) / (cycleEnd - cycleStart)
vestedOwnership = totalOwnership × vestedPercentage
provisionalOwnership = totalOwnership - vestedOwnership
```

### Ownership Ledger
Every ownership event creates an `OwnershipLedger` entry:
- `userId, cycleId, eventType, ownershipAmount, multiplierSnapshot, sourceReference`
- `normalizedOwnershipPct` — computed by normalization job

### Normalized Ownership
```
normalizedOwnershipPct = (userScore / totalScore) × contributorPoolPct
```
- Stored in latest ledger entry
- Falls back to 0 if totalScore = 0
- Does NOT modify vesting/multiplier logic (additive design)

### System Pool Config
- `totalValue` — total pool value
- `contributorPoolPct` = 40%
- `founderPoolPct` = 50%
- `investorPoolPct` = 10%
- `decayRate` = 0.01 (used in time-decay scoring)

---

## 7. Contribution Scoring

### Score Formula
```
scoreContribution = contributionWeight × hoursFactor × timeDecay

hoursFactor = 1 + log(1 + hoursLogged) / log(5)
  → ~1.0 at 0h, ~2.0 at 4h (diminishing returns above 4h)

timeDecay = e^(-decayRate × daysSinceActivity)
  → exponential decay incentivizes consistent recent activity
```

### Aggregation
- Per-user, per-cycle `ContributionScore` = sum of all verified activities' `scoreContribution`
- Recomputed hourly by aggregation job
- Only verified activities count

---

## 8. Multipliers

- Each user has a `Multiplier` record per cycle
- Default multiplier = 1.0
- Adjusted daily by `AdjustMultiplierJob` based on stall stage:
  - `none / grace / active` → multiplier stays at or returns toward 1.0
  - `at_risk` → multiplier reduced
  - `diminishing` → multiplier further reduced
  - `paused` → multiplier at minimum
- Admin can manually override multiplier (step-up required, logged to AuditTrail)

---

## 9. Stall Detection

### Stall Stages
```
none → grace → active → at_risk → diminishing → paused
```

### Logic (StallEvaluatorJob — runs daily at 2 AM)
- Grace period: first 3 days after joining
- After grace:
  - ≤6 days since last activity → `active`
  - 7–13 days → `at_risk`
  - 14–20 days → `diminishing`
  - >20 days → `paused`
- Stage changes trigger notifications and multiplier adjustments
- Batch-updated to avoid N+1 queries

---

## 10. Ownership Decay

Runs weekly (Sunday 1 AM) via `OwnershipDecayJob`:
- `diminishing` stage → 5% decay per week on provisional ownership
- `paused` stage → 10% decay per week on provisional ownership
- Minimum 7 days between decays per user
- Creates a negative `OwnershipLedger` entry with `eventType: 'decay'`
- Vested ownership is NOT decayed

---

## 11. Tasks System (Kanban)

### Task Model
`title, description, acceptanceCriteria, proofLink, securityNote, restricted (bool), cycleId, createdBy, dueDate`

`status`: `open | completed | overdue`

`restricted` tasks hide details from non-admins (security-sensitive work).

### Task Assignment
`TaskAssignment`: `taskId, userId, status (assigned | in_progress | completed), completedAt`

### Routes
- `GET /tasks?cycleId=` — all tasks in cycle
- `GET /tasks/my` — current user's assignments
- `POST /tasks` — create (admin/founder)
- `POST /tasks/assign` — assign to users (admin/founder)
- `PATCH /tasks/:id/status` — update status
- `PATCH /tasks/:id/complete` — mark complete

Overdue tasks auto-marked daily at 1 AM by scheduler.

---

## 12. Leave System

### Leave Model
`userId, cycleId, status (active | paused | left), leaveStart, leaveEnd, reason, grantedBy`

### Behavior
- User requests leave → participation paused, `stallStage` set to `paused`
- Auto-resume when `leaveEnd` expires (checked hourly by scheduler)
- Admin can grant/override participation status directly

---

## 13. Agreements System

### Agreement Model
`version (unique), title, content (markdown), isActive`

`UserAgreement` tracks acceptance per user with IP + userAgent.

### Enforcement
- Active agreement required to access participation/activities/ownership routes
- Admins/founders exempt (can manage agreements without being locked out)
- `requireAgreement` middleware triggers `agreement:required` event if not accepted

---

## 14. Docs Vault

### Document Model
`title, filePath (server-side only), mimeType, size, securityLabel (internal | restricted | confidential), folderId, createdBy, isActive`

### Access Control
`DocumentAccess`: `userId, documentId, accessType (view | download), expiresAt, grantedBy, revokedAt`

### Document Versions
Track upload history: `versionNumber, uploadedBy, filePath`

### Document Activity (Audit Trail)
Events: `view, download, request_access, grant_access, revoke_access, upload_version`

### Routes
- `GET /docs` — list (with folder/label/search filters)
- `GET /docs/view/:id` — download blob (Authorization header required)
- `POST /docs/upload` — admin uploads (multipart)
- `POST /docs/request-access` — user requests access
- `POST /docs/grant-access` — admin grants (step-up required)
- `POST /docs/revoke-access` — admin revokes

---

## 15. Notifications

### Types
`stall_warning, participation_paused, activity_verified, multiplier_changed, cycle_started, cycle_finalized, admin_message, ownership_decay, participation_resumed`

### Model
`userId, type, message, read, metadata (JSON), sent, sentAt`

User preferences stored as JSON on `UserProfile.notificationPrefs`.

---

## 16. Messaging

### Cycle Messages
`cycleId, authorId, message, editedAt`

- `MessageRead` — tracks who read each message
- `MessageMention` — tags users in messages

### Routes
- `GET /messages/cycle/:cycleId` — all messages
- `POST /messages` — send with mentions
- `PATCH /messages/:id` — edit
- `DELETE /messages/:id` — delete
- `POST /messages/:id/read` — mark read
- `GET /messages/unread-count` — unread count
- `GET /messages/mentions` — user's mentions

---

## 17. Analytics & Insights

### Reputation Score
```
reputationScore = (verifiedActivities × 5)
                + (activeCycles × 10)
                - (rejectedActivities × 3)
                + (consistencyScore × 8)
                + min(totalHoursLogged / 10, 20)
```

### Cycle Engagement Score
```
engagementScore = (activityCount × 0.5)
                + (participationRate × 30)
                + (verifiedRatio × 20)
                + (messageCount × 0.1)
                + (avgHours × 2)
```

### Routes
- `GET /analytics/dashboard?cycleId=` — earnings, ownership, engagement
- `GET /analytics/contributors?limit=5` — top contributors
- `GET /analytics/reputation/:userId` — user reputation
- `GET /analytics/engagement/:cycleId` — cycle engagement
- `GET /analytics/cycle/:cycleId` — cycle-level analytics

---

## 18. Admin Panel

### Access Grants
`type`: `role | feature | cycle_access | view_only`

`expiresAt, revokedAt, revokedBy` — auto-revoked when expired (every 30 min by scheduler)

### Overrides (step-up required)
- `POST /admin/override/ownership` — override ownership amount
- `POST /admin/override/multiplier` — override multiplier
- `POST /admin/override/stall-clear` — clear stall status

All overrides logged to `AuditTrail` with `previousValue` / `newValue`.

### Bulk Actions (step-up required)
`POST /admin/bulk-action` — grant/revoke/force-logout/remove-cycle/assign-task

### Disputes
- Users can dispute rejected activities
- `GET /admin/disputes` — all disputes
- `POST /admin/resolve-dispute` — approve/deny with resolution (step-up required)

### Contribution Weights
- Per-type weights stored in DB (default 1.0)
- `GET /weights` — all weights
- `PATCH /weights/:type` — update weight
- `POST /weights/reset` — reset to defaults

### User Management
- `GET /admin/users` — all users
- `PATCH /admin/users/:id/role` — change role (step-up required)
- `POST /admin/grant-access` / `revoke-access` — manage access grants (step-up required)

### Manual Job Execution
`POST /admin/jobs/execute` — run any job by ID on demand

---

## 19. Background Jobs

| Job | Schedule | Purpose |
|---|---|---|
| Stall Evaluator | Daily 2 AM | Evaluate participation status based on inactivity |
| Multiplier Adjustment | Daily 3 AM | Adjust multipliers based on stall stage |
| Cycle Finalizer | Daily 4 AM | Close ended cycles, lock ownership |
| Activity Archiver | Weekly Sun 5 AM | Archive old activities |
| Ownership Decay | Weekly Sun 1 AM | Decay provisional ownership for stalled users |
| Score Computation | Every 30 min | Write scoreContribution on newly-verified activities |
| Aggregation | Hourly at :15 | Recompute per-user contribution score totals |
| Normalization | Hourly at :20 | Compute normalized ownership % |
| Leave Auto-Resume | Hourly | Resume participation when leave period ends |
| Task Overdue Marking | Daily 1 AM | Mark overdue tasks |
| Stale Session Cleanup | Every 15 min | Close sessions without heartbeat for 10+ min |
| Access Grant Expiry | Every 30 min | Auto-revoke expired access grants |
| Revoked Token Cleanup | Daily midnight | Delete expired revoked token records |

---

## 20. Security

### Threat Detection
`SecurityEvent` model tracks: `new_login, new_device, password_changed, 2fa_enabled, 2fa_disabled, reauth`

Stores IP, userAgent, metadata per event.

### Audit Trail
- All admin actions logged to `AuditTrail` with `previousValue` / `newValue`
- `AdminActionLog` tracks bulk operations
- `SystemLog` tracks system events (cycle finalization, errors)

### Security Middleware
- **Helmet.js** — strict CSP (no inline scripts, no frame embedding)
- **CORS** — restricted to frontend origin only
- **Rate limiting** — 10,000 req/15 min global, 20 req/15 min for auth endpoints
- **HttpOnly cookies** — JWT not accessible from JS
- **Token revocation** — per-token (jti) + per-user (tokenRevokedAt)

---

## 21. API Structure

**Base URL:** `http://localhost:3001/api`

**Standard Response Format:**
```json
{ "success": true, "data": { ... }, "error": null }
```

### Route Map

| Route | Guard | Description |
|---|---|---|
| `/api/auth` | none | Login, signup, 2FA, password reset |
| `/api/onboarding` | none | Onboarding steps |
| `/api/agreements` | none | Agreement management |
| `/api/cycles` | onboardingGuard | Cycle CRUD |
| `/api/participation` | agreementGuard | Join/leave cycles |
| `/api/activities` | agreementGuard | Submit/verify activities |
| `/api/ownership` | agreementGuard | Ownership data + ledger |
| `/api/analytics` | agreementGuard | Dashboard, reputation, engagement |
| `/api/docs` | agreementGuard | Docs vault |
| `/api/tasks` | agreementGuard | Task management |
| `/api/leave` | agreementGuard | Leave requests |
| `/api/messages` | agreementGuard | Cycle messaging |
| `/api/notifications` | onboardingGuard | Notifications |
| `/api/admin` | onboardingGuard | Admin panel |
| `/api/sessions` | onboardingGuard | Session tracking |
| `/api/weights` | onboardingGuard | Contribution weights |
| `/api/security` | onboardingGuard | Security events |
| `/api/logs` | onboardingGuard | System logs |
| `/api/backup` | onboardingGuard | Backup status |

---

## 22. Frontend Architecture

### State Management
- `AuthContext` — user session, login/logout, session timers
- `CycleContext` — active cycle selection, cycle list

### Session Timers
- Inactivity warning modal after idle period
- Auto-logout on session expiry
- Activity listeners (mouse/keyboard) reset idle timer

### API Client (src/lib/api-client.ts)
- All requests use `credentials: 'include'` (sends HttpOnly cookie)
- 401 on non-auth endpoints → triggers re-auth modal, retries once after refresh
- Step-up token attached via `X-Step-Up-Token` header automatically

### Key Hooks
- `useActivity` — submit/fetch activities
- `useCycles` — cycle list + state
- `useOwnershipData` — ownership + ledger
- `useParticipation` — join/leave cycles
- `useTasks` — kanban board data
- `useLeave` — leave requests
- `useNotifications` — notification bell + panel
- `usePermissions` — check permissions client-side
- `useStepUpAuth` — trigger step-up flow
- `useThreatAlerts` — security event banner
- `useAnalytics` — dashboard analytics

---

## 23. Key Architectural Patterns

1. **Additive Design** — new features (normalized ownership, contribution scores) add new fields/tables without modifying existing ones
2. **Atomic Transactions** — race condition prevention on cycle participation and finalization
3. **Batch Queries** — background jobs use batch queries to avoid N+1 patterns
4. **Centralized Permissions** — single permission matrix, no role strings scattered in components
5. **Step-Up Auth** — password re-verification gates all destructive/sensitive operations
6. **Agreement Enforcement** — active agreement blocks participation routes (admins/founders exempt)
7. **Time-Decay Scoring** — exponential decay incentivizes consistent recent activity over bursts
8. **Stall → Multiplier → Decay pipeline** — inactivity progressively reduces ownership earning potential
9. **Full Audit Trail** — every admin action logged with before/after values
10. **HttpOnly Cookie Auth** — JWT never exposed to JavaScript, preventing XSS token theft
