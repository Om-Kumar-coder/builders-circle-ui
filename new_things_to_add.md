# New Things To Add — Builder's Circle

## Overview

Five additions that complete the platform's missing layers. Nothing here touches the ownership engine, scoring, multipliers, stall detection, or decay — those are correct and must not be modified.

```
WHAT'S MISSING TODAY          WHAT WE'RE ADDING
─────────────────────         ──────────────────────────────
No external entry point   →   1. Triage Entry System
No functional grouping    →   2. Group System
No cycle creation flow    →   3. Idea → Build Cycle Pipeline
Loose task-activity link  →   4. Task ↔ Activity Strict Linking
No structured first work  →   5. Starter Task Auto-Assignment
```

---

## Build Order (strict — each depends on the previous)

```
1. Group System          (no dependencies)
2. Triage Entry System   (needs Groups for auto-assignment)
3. Task ↔ Activity Fix   (needs existing Task + Activity models)
4. Starter Task Logic    (needs Groups + Task ↔ Activity fix)
5. Idea Pipeline         (needs Cycles + Groups + Starter Tasks)
```

---

---

# 1. GROUP SYSTEM

## Purpose

Groups are a task-routing and organizational layer sitting between roles and cycles. A user has one role (permissions) and one group (functional team). Tasks can be scoped to a group so every member sees relevant work without manual assignment.

Groups do NOT affect: scoring, ownership, multipliers, stall detection, or participation logic.

---

## Database Changes

### New model: Group

```prisma
model Group {
  id          String   @id @default(cuid())
  name        String
  description String?
  isDefault   Boolean  @default(false)  // fallback group for unmatched triage
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users User[]
  tasks Task[]

  @@map("groups")
}
```

### Update: User

```prisma
model User {
  // ... existing fields unchanged ...
  groupId String?
  group   Group?  @relation(fields: [groupId], references: [id])
}
```

### Update: Task

```prisma
model Task {
  // ... existing fields unchanged ...
  groupId   String?
  group     Group?  @relation(fields: [groupId], references: [id])
  isStarter Boolean @default(false)  // marks task as auto-assignable on join
}
```

---

## Backend

### New file: `backend/src/routes/groups.ts`

```
POST   /api/admin/groups              create group (admin/founder, step-up)
GET    /api/admin/groups              list all groups with user count
PATCH  /api/admin/groups/:id          update name/description/isDefault
DELETE /api/admin/groups/:id          delete group (only if no users assigned)
PATCH  /api/admin/users/:id/group     assign user to group (admin/founder)
GET    /api/groups/my                 current user's group info (agreementGuard)
```

### Logic

**getUserTasks resolution** — update existing task fetch query in `backend/src/routes/tasks.ts`:

```typescript
// When fetching tasks for a user, include group-scoped tasks
const tasks = await prisma.task.findMany({
  where: {
    cycleId,
    OR: [
      { assignments: { some: { userId } } },
      { groupId: user.groupId ?? undefined }
    ]
  }
})
```

**mapRoleToGroup** — used by triage approval:

```typescript
async function mapRoleToGroup(roleType: string): Promise<Group> {
  // roleType from triage: "dev" | "business" | "marketing" | ...
  // Try to find a group whose name matches (case-insensitive)
  const group = await prisma.group.findFirst({
    where: { name: { equals: roleType, mode: 'insensitive' } }
  })
  // Fallback to default group if no match
  if (!group) {
    return prisma.group.findFirstOrThrow({ where: { isDefault: true } })
  }
  return group
}
```

**Guard:** Only admin/founder can create/edit/delete groups and assign users. Regular users can only read their own group.

---

## Permissions — additions to `src/lib/permissions.ts`

```typescript
// Add to Permission type
| 'groups:view'
| 'groups:manage'

// Add to MATRIX
observer:     ['groups:view']
contributor:  ['groups:view']
employee:     ['groups:view']
admin:        ['groups:view', 'groups:manage']
founder:      ['groups:view', 'groups:manage']
```

---

## Frontend

### New pages

```
app/admin/groups/page.tsx       — admin group management
```

### New components

```
src/components/groups/GroupCard.tsx           — group name, description, member count
src/components/groups/CreateGroupModal.tsx    — create/edit group form
src/components/groups/AssignGroupModal.tsx    — assign user to group (from admin users page)
src/components/dashboard/GroupBadge.tsx       — shows user's group on dashboard
```

### New hook

```
src/hooks/useGroups.ts
  - fetchGroups()         → GET /api/admin/groups
  - createGroup(data)     → POST /api/admin/groups
  - updateGroup(id, data) → PATCH /api/admin/groups/:id
  - assignUserGroup(userId, groupId) → PATCH /api/admin/users/:id/group
  - fetchMyGroup()        → GET /api/groups/my
```

### Dashboard change

Add `GroupBadge` to `DashboardGrid.tsx` — shows current user's group name next to their role badge. No other dashboard changes.

### Admin users page change

Add "Assign Group" button per user row in `app/admin/access/page.tsx` — opens `AssignGroupModal`.

---

## Edge Cases

| Case | Handling |
|---|---|
| User has no group | Tasks with `groupId` are not shown; only directly assigned tasks appear |
| Group deleted with users | Block deletion — return 400 with count of affected users |
| Group deleted with tasks | Null out `task.groupId` (tasks become direct-assign only) |
| No default group exists | Triage approval fails gracefully with error: "No default group configured" |

---

---

# 2. TRIAGE ENTRY SYSTEM

## Purpose

The only way external people currently enter the system is if an admin manually creates their account. Triage is a public intake form that creates a controlled funnel: submit → admin reviews → approve → user account created → group assigned → starter tasks assigned → onboarding begins.

---

## Database Changes

### New model: TriageSubmission

```prisma
model TriageSubmission {
  id             String       @id @default(cuid())
  name           String
  email          String
  roleType       String       // "dev" | "business" | "marketing" | "design" | "other"
  submissionType String       // "join" | "project" | "other"
  description    String
  proofLinks     Json?        // string[] of URLs
  availability   String?      // free-text e.g. "20h/week"
  status         TriageStatus @default(PENDING)
  reviewedBy     String?      // admin userId
  reviewedAt     DateTime?
  rejectionNote  String?      // optional note shown to applicant
  createdAt      DateTime     @default(now())

  @@map("triage_submissions")
}

enum TriageStatus {
  PENDING
  APPROVED
  REJECTED
}
```

No relation to User intentionally — triage exists before a user account does.

---

## Backend

### New file: `backend/src/routes/triage.ts`

#### Public endpoints (no auth required)

```
POST /api/triage/submit
```

Body:
```json
{
  "name": "string (required, 2-100 chars)",
  "email": "string (required, valid email)",
  "roleType": "dev | business | marketing | design | other",
  "submissionType": "join | project | other",
  "description": "string (required, 50-2000 chars)",
  "proofLinks": ["https://..."],
  "availability": "string (optional)"
}
```

Response: `{ success: true, data: { id, status: "PENDING" } }`

Rate limit: 3 submissions per IP per hour (separate limiter, not the global one).

#### Admin endpoints (onboardingGuard + admin/founder role)

```
GET  /api/admin/triage                    list all (filter: ?status=PENDING|APPROVED|REJECTED)
GET  /api/admin/triage/:id                single submission detail
POST /api/admin/triage/:id/approve        approve + create user
POST /api/admin/triage/:id/reject         reject with optional note
```

---

### Approval Logic — `approveSubmission(submissionId, adminId)`

```typescript
async function approveSubmission(submissionId: string, adminId: string) {
  const submission = await prisma.triageSubmission.findUniqueOrThrow({
    where: { id: submissionId }
  })

  // 1. Guard: already processed
  if (submission.status !== 'PENDING') {
    throw new Error('Submission already reviewed')
  }

  // 2. Guard: duplicate email
  const existingUser = await prisma.user.findUnique({
    where: { email: submission.email }
  })
  if (existingUser) {
    throw new Error('A user with this email already exists')
  }

  // 3. Create user account (no password — they set it via email link)
  const tempToken = crypto.randomBytes(32).toString('hex')
  const user = await prisma.user.create({
    data: {
      email: submission.email,
      name: submission.name,
      password: '',                    // empty — must be set via welcome email link
      emailVerified: false,
      emailVerifyToken: tempToken,
      emailVerifyExpiry: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h
      onboardingStep: 0,
      onboardingCompleted: false,
      profile: {
        create: { role: 'contributor' }
      }
    }
  })

  // 4. Assign group based on roleType
  const group = await mapRoleToGroup(submission.roleType)
  await prisma.user.update({
    where: { id: user.id },
    data: { groupId: group.id }
  })

  // 5. Assign starter tasks
  await assignStarterTasks(user.id, group.id)

  // 6. Send welcome email with password-set link
  await triggerEmail(submission.email, 'triage_approved', {
    name: submission.name,
    setPasswordUrl: `${env.FRONTEND_URL}/set-password?token=${tempToken}`
  })

  // 7. Mark submission approved
  await prisma.triageSubmission.update({
    where: { id: submissionId },
    data: { status: 'APPROVED', reviewedBy: adminId, reviewedAt: new Date() }
  })

  // 8. Log admin action
  await prisma.adminActionLog.create({
    data: {
      adminId,
      action: 'triage_approved',
      targetId: submissionId,
      metadata: JSON.stringify({ createdUserId: user.id, email: submission.email })
    }
  })

  return { userId: user.id, groupId: group.id }
}
```

### Rejection Logic — `rejectSubmission(submissionId, adminId, note?)`

```typescript
async function rejectSubmission(submissionId: string, adminId: string, note?: string) {
  const submission = await prisma.triageSubmission.findUniqueOrThrow({
    where: { id: submissionId }
  })

  if (submission.status !== 'PENDING') {
    throw new Error('Submission already reviewed')
  }

  await prisma.triageSubmission.update({
    where: { id: submissionId },
    data: {
      status: 'REJECTED',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      rejectionNote: note ?? null
    }
  })

  // Optional: send rejection email
  await triggerEmail(submission.email, 'triage_rejected', {
    name: submission.name,
    note: note ?? ''
  })
}
```

---

## Validation Rules

| Field | Rule |
|---|---|
| name | 2–100 chars, no HTML |
| email | valid email format |
| roleType | must be one of the enum values |
| submissionType | must be one of the enum values |
| description | 50–2000 chars |
| proofLinks | array of valid HTTPS URLs, max 5 |
| availability | optional, max 200 chars |

---

## Frontend

### New public page: `app/submit-to-triage/page.tsx`

No auth required. Accessible to anyone.

Fields:
- Name (text input)
- Email (email input)
- Role Type (select: Developer / Business / Marketing / Design / Other)
- Submission Type (select: Join the team / Propose a project / Other)
- Description (textarea, 50–2000 chars with live counter)
- Proof Links (dynamic list — add/remove URL fields, max 5)
- Availability (text input, optional)

On submit: show success state with "We'll review your application and reach out via email."

Rate limit feedback: if 429 returned, show "You've submitted recently. Please wait before trying again."

### New admin page: `app/admin/triage/page.tsx`

Table of submissions with columns: Name, Email, Role Type, Type, Submitted, Status, Actions

Filters: status tabs (All / Pending / Approved / Rejected)

Actions per row:
- View detail (modal with full description + proof links)
- Approve button → confirmation dialog → calls approve endpoint
- Reject button → modal with optional rejection note field → calls reject endpoint

### New components

```
src/components/triage/TriageSubmissionForm.tsx   — public form
src/components/triage/TriageTable.tsx            — admin list
src/components/triage/TriageDetailModal.tsx      — full submission view
src/components/triage/RejectModal.tsx            — rejection note input
```

### New hook

```
src/hooks/useTriage.ts
  - submitTriage(data)           → POST /api/triage/submit  (no auth)
  - fetchTriageList(status?)     → GET /api/admin/triage
  - fetchTriageDetail(id)        → GET /api/admin/triage/:id
  - approveSubmission(id)        → POST /api/admin/triage/:id/approve
  - rejectSubmission(id, note?)  → POST /api/admin/triage/:id/reject
```

---

## Integration Points

```
Triage Submit (public)
  ↓
Admin reviews in /admin/triage
  ↓
approveSubmission()
  ↓ creates User (role: contributor)
  ↓ assigns Group (via mapRoleToGroup)
  ↓ assigns Starter Tasks (via assignStarterTasks)
  ↓ sends welcome email with set-password link
  ↓
User sets password → email verified → 2FA setup → onboarding → cycle join
```

---

## Edge Cases

| Case | Handling |
|---|---|
| Duplicate email on approve | Block with 409 — "User with this email already exists" |
| No default group configured | Block approval with 500 — "Configure a default group first" |
| Submission already approved/rejected | Block with 400 — "Already reviewed" |
| Spam submissions | Rate limit: 3/hour per IP at route level |
| Proof links with non-HTTPS URLs | Validation rejects on submit |
| Admin approves then tries again | Idempotency guard on status check |

---

---

# 3. TASK ↔ ACTIVITY STRICT LINKING

## Purpose

Currently `ActivityEvent` has a `taskReference` field (free text). This means anyone can type anything and claim task completion. The fix makes the link a real foreign key with assignment enforcement — you can only submit a task-linked activity if you are actually assigned to that task.

This is a critical integrity fix. It prevents fake contributions and makes scoring reliable.

---

## Database Changes

### Update: ActivityEvent

```prisma
model ActivityEvent {
  // ... all existing fields unchanged ...

  // NEW: optional hard link to a Task
  // If set, the task assignment is verified on submit
  linkedTaskId String?
  linkedTask   Task?   @relation(fields: [linkedTaskId], references: [id])
}
```

```prisma
model Task {
  // ... all existing fields unchanged ...

  // NEW: back-relation
  linkedActivities ActivityEvent[]
}
```

The existing `taskReference` (free text) field stays — it's used for external references (Jira, Linear, etc.). `linkedTaskId` is the internal hard link.

---

## Backend Changes

### Update: `backend/src/routes/activities.ts` — POST /activities

Add validation block after existing validation, before saving:

```typescript
// Task link validation
if (body.linkedTaskId) {
  const task = await prisma.task.findUnique({
    where: { id: body.linkedTaskId },
    include: { assignments: { where: { userId: req.user.id } } }
  })

  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found' })
  }

  if (task.cycleId !== body.cycleId) {
    return res.status(400).json({
      success: false,
      error: 'Task does not belong to the selected cycle'
    })
  }

  if (task.assignments.length === 0) {
    return res.status(403).json({
      success: false,
      error: 'You are not assigned to this task'
    })
  }

  if (task.status === 'completed') {
    return res.status(400).json({
      success: false,
      error: 'Task is already completed'
    })
  }
}
```

### Update: `backend/src/services/activityValidationService.ts`

Add to `ValidationResult` warnings (not errors — soft guidance):

```typescript
// If contributionType is task_completion but no linkedTaskId provided
if (body.contributionType === 'task_completion' && !body.linkedTaskId) {
  warnings.push(
    'task_completion activities should be linked to a task. ' +
    'Use linkedTaskId to connect this to an assigned task.'
  )
}
```

This is a warning not an error — allows flexibility for external task systems while nudging toward proper linking.

### Rule: Task completion ≠ contribution

A task being marked `completed` in the kanban does NOT create an activity or ownership entry. Only a verified `ActivityEvent` with `linkedTaskId` counts toward scoring. This is enforced by keeping the two systems separate — task status is UI state, activity verification is the scoring gate.

---

## Frontend Changes

### Update: `src/components/activity/SubmitActivityForm.tsx`

When `contributionType === 'task_completion'`:
- Show a "Link to Task" dropdown populated from the user's assigned tasks in the selected cycle
- Dropdown fetches from `GET /tasks/my?cycleId=<id>`
- Selection sets `linkedTaskId` in the form payload
- If no tasks assigned: show info message "You have no assigned tasks in this cycle. You can still submit without linking."
- If task selected: show task title + acceptance criteria as reference

### Update: `src/hooks/useActivity.ts`

Add `linkedTaskId?: string` to the submit payload type.

### Update: `src/components/tasks/TaskDetailPanel.tsx`

Add "Activities" section at the bottom of the task detail panel:
- Lists all `ActivityEvent` records where `linkedTaskId === task.id`
- Shows: contributor name, activity type, status (pending/verified/rejected), date
- Fetches from `GET /activities?linkedTaskId=<id>` (new query param)

### Update: `backend/src/routes/activities.ts` — GET /activities

Add support for `?linkedTaskId=` query param filter.

---

## Edge Cases

| Case | Handling |
|---|---|
| linkedTaskId provided but task not found | 404 |
| Task belongs to different cycle | 400 |
| User not assigned to task | 403 |
| Task already completed | 400 — prevents double-claiming |
| contributionType is not task_completion but linkedTaskId provided | Allow — any activity type can be linked to a task |
| Admin submitting activity for another user | Admin bypass: skip assignment check if `req.user.role === 'admin' or 'founder'` |

---

---

# 4. STARTER TASK AUTO-ASSIGNMENT

## Purpose

New users (from triage approval or cycle join) currently land in the system with no structured first work. Starter tasks give them immediate, relevant things to do based on their group, reducing drop-off and ensuring their first activity submissions are meaningful.

---

## Database Changes

No new models. Uses the `isStarter` boolean added to `Task` in the Group System section:

```prisma
model Task {
  // ... existing fields ...
  isStarter Boolean @default(false)
}
```

Starter tasks are regular tasks with `isStarter: true`. They are group-scoped (`groupId` set) and cycle-scoped (`cycleId` set). Admins create them like any other task — just toggle the "Starter Task" flag.

---

## Backend

### New utility: `backend/src/services/starterTaskService.ts`

```typescript
/**
 * Assigns up to 5 starter tasks from the user's group to the user.
 * Called on: triage approval, cycle join.
 * Safe to call multiple times — skips already-assigned tasks.
 */
export async function assignStarterTasks(
  userId: string,
  groupId: string,
  cycleId?: string   // if provided, only assign tasks in that cycle
): Promise<number> {
  const where: Prisma.TaskWhereInput = {
    isStarter: true,
    groupId,
    status: 'open',
    ...(cycleId ? { cycleId } : {})
  }

  const starterTasks = await prisma.task.findMany({
    where,
    take: 5,
    orderBy: { createdAt: 'asc' }
  })

  if (starterTasks.length === 0) return 0

  // Get already-assigned task IDs to avoid duplicates
  const existingAssignments = await prisma.taskAssignment.findMany({
    where: { userId, taskId: { in: starterTasks.map(t => t.id) } },
    select: { taskId: true }
  })
  const alreadyAssigned = new Set(existingAssignments.map(a => a.taskId))

  const toAssign = starterTasks.filter(t => !alreadyAssigned.has(t.id))

  if (toAssign.length === 0) return 0

  await prisma.taskAssignment.createMany({
    data: toAssign.map(task => ({
      taskId: task.id,
      userId,
      status: 'assigned'
    }))
  })

  // Send notification
  await prisma.notification.create({
    data: {
      userId,
      type: 'admin_message',
      message: `You've been assigned ${toAssign.length} starter task${toAssign.length > 1 ? 's' : ''} to get you started.`,
      metadata: JSON.stringify({ taskIds: toAssign.map(t => t.id) })
    }
  })

  return toAssign.length
}
```

---

## Trigger Points

### Trigger 1: Triage Approval

Already included in `approveSubmission()` above:

```typescript
await assignStarterTasks(user.id, group.id)
// No cycleId here — assigns across all open cycles in the group
```

### Trigger 2: Cycle Join

Update `backend/src/routes/participation.ts` — POST /participation/join:

```typescript
// After creating CycleParticipation record:
if (user.groupId) {
  await assignStarterTasks(user.id, user.groupId, cycleId)
}
```

---

## Admin Controls

### Update: `backend/src/routes/tasks.ts`

- `POST /tasks` — add `isStarter: boolean` to create body (admin/founder only)
- `PATCH /tasks/:id` — allow toggling `isStarter`
- `GET /tasks?isStarter=true` — filter for starter tasks (admin view)

### Update: `src/components/tasks/KanbanBoard.tsx`

Add a "Starter" badge on task cards where `isStarter === true` (visible to admins only).

### Update: `src/components/admin/tasks` (admin tasks page)

Add "Starter Task" toggle in task creation/edit form.

---

## Frontend — User Facing

### Update: `src/components/dashboard/AssignedTasksWidget.tsx`

Starter tasks shown with a distinct "Starter" label so new users know these are their entry point.

### Update: `src/components/onboarding/OnboardingTour.tsx`

Add a step that highlights the AssignedTasksWidget and explains starter tasks when `onboardingStep === 4` (cycle join step).

---

## Edge Cases

| Case | Handling |
|---|---|
| No starter tasks exist for group | assignStarterTasks returns 0, no error — silent |
| User already assigned to all starter tasks | Skip duplicates via existing assignment check |
| Starter task is overdue | Still assign — user can see it and submit activity |
| User has no group | Skip starter task assignment entirely |
| Starter task in closed cycle | Filter by `status: 'open'` on task, not cycle state — admin should manage this |

---

---

# 5. IDEA → BUILD CYCLE PIPELINE

## Purpose

Currently cycles are created directly by admins with no structured proposal process. The Idea pipeline gives contributors a way to propose work, and gives admins a review gate before a cycle is created. Approved ideas automatically become planned cycles with the proposer as lead participant.

---

## Database Changes

### New model: Idea

```prisma
model Idea {
  id           String     @id @default(cuid())
  submittedBy  String
  title        String     // becomes cycle name on approval
  description  String     // becomes cycle description on approval
  attachments  Json?      // string[] of URLs or doc references
  status       IdeaStatus @default(PENDING)
  reviewedBy   String?
  reviewedAt   DateTime?
  rejectionNote String?
  cycleId      String?    // set on approval — links to created cycle
  createdAt    DateTime   @default(now())

  submitter User       @relation(fields: [submittedBy], references: [id])
  cycle     BuildCycle? @relation(fields: [cycleId], references: [id])

  @@map("ideas")
}

enum IdeaStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### Update: User

```prisma
model User {
  // ... existing fields ...
  submittedIdeas Idea[]
}
```

### Update: BuildCycle

```prisma
model BuildCycle {
  // ... existing fields ...
  idea Idea?  // back-relation — cycle may have originated from an idea
}
```

### Update: CycleParticipation

```prisma
model CycleParticipation {
  // ... existing fields unchanged ...
  isLead Boolean @default(false)  // NEW: marks the idea proposer as cycle lead
}
```

---

## Backend

### New file: `backend/src/routes/ideas.ts`

#### User endpoints (agreementGuard)

```
POST /api/ideas              submit idea
GET  /api/ideas/my           current user's submitted ideas
GET  /api/ideas/:id          single idea detail (own ideas only, or admin)
```

POST /api/ideas body:
```json
{
  "title": "string (required, 5-200 chars)",
  "description": "string (required, 100-5000 chars)",
  "attachments": ["https://..."]
}
```

#### Admin endpoints (onboardingGuard + admin/founder)

```
GET  /api/admin/ideas                    list all ideas (filter: ?status=)
GET  /api/admin/ideas/:id                full detail
POST /api/admin/ideas/:id/approve        approve → create cycle
POST /api/admin/ideas/:id/reject         reject with note
```

POST /api/admin/ideas/:id/approve body (optional overrides):
```json
{
  "cycleName": "string (optional — defaults to idea.title)",
  "startDate": "ISO date string (required)",
  "endDate": "ISO date string (required)"
}
```

---

### Approval Logic — `approveIdea(ideaId, adminId, options)`

```typescript
async function approveIdea(
  ideaId: string,
  adminId: string,
  options: { cycleName?: string; startDate: Date; endDate: Date }
) {
  const idea = await prisma.idea.findUniqueOrThrow({
    where: { id: ideaId },
    include: { submitter: true }
  })

  if (idea.status !== 'PENDING') {
    throw new Error('Idea already reviewed')
  }

  // 1. Create cycle in planned state
  const cycle = await prisma.buildCycle.create({
    data: {
      name: options.cycleName ?? idea.title,
      description: idea.description,
      state: 'planned',
      startDate: options.startDate,
      endDate: options.endDate,
      participantCount: 1
    }
  })

  // 2. Add proposer as lead participant
  await prisma.cycleParticipation.create({
    data: {
      userId: idea.submittedBy,
      cycleId: cycle.id,
      optedIn: true,
      isLead: true,
      participationStatus: 'active',
      stallStage: 'none'
    }
  })

  // 3. Assign starter tasks to proposer in this cycle
  const proposer = idea.submitter
  if (proposer.groupId) {
    await assignStarterTasks(proposer.id, proposer.groupId, cycle.id)
  }

  // 4. Mark idea approved + link to cycle
  await prisma.idea.update({
    where: { id: ideaId },
    data: {
      status: 'APPROVED',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      cycleId: cycle.id
    }
  })

  // 5. Notify proposer
  await prisma.notification.create({
    data: {
      userId: idea.submittedBy,
      type: 'cycle_started',
      message: `Your idea "${idea.title}" was approved and a new build cycle has been created. You are the lead.`,
      metadata: JSON.stringify({ cycleId: cycle.id })
    }
  })

  // 6. Log admin action
  await prisma.adminActionLog.create({
    data: {
      adminId,
      action: 'idea_approved',
      targetId: ideaId,
      metadata: JSON.stringify({ cycleId: cycle.id })
    }
  })

  return { cycleId: cycle.id }
}
```

### Rejection Logic

```typescript
async function rejectIdea(ideaId: string, adminId: string, note?: string) {
  const idea = await prisma.idea.findUniqueOrThrow({ where: { id: ideaId } })

  if (idea.status !== 'PENDING') throw new Error('Idea already reviewed')

  await prisma.idea.update({
    where: { id: ideaId },
    data: {
      status: 'REJECTED',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      rejectionNote: note ?? null
    }
  })

  await prisma.notification.create({
    data: {
      userId: idea.submittedBy,
      type: 'admin_message',
      message: `Your idea "${idea.title}" was not approved.${note ? ' Reason: ' + note : ''}`,
      metadata: JSON.stringify({ ideaId })
    }
  })
}
```

---

## Permissions — additions to `src/lib/permissions.ts`

```typescript
// Add to Permission type
| 'ideas:submit'
| 'ideas:manage'

// Add to MATRIX
observer:     []                          // observers cannot propose
contributor:  ['ideas:submit']
employee:     ['ideas:submit']
admin:        ['ideas:submit', 'ideas:manage']
founder:      ['ideas:submit', 'ideas:manage']
```

---

## Frontend

### New pages

```
app/ideas/page.tsx              — user's submitted ideas list + submit button
app/ideas/submit/page.tsx       — idea submission form
app/admin/ideas/page.tsx        — admin review queue
```

### New components

```
src/components/ideas/IdeaSubmitForm.tsx      — title, description, attachments
src/components/ideas/IdeaCard.tsx            — idea summary card with status badge
src/components/ideas/IdeaStatusBadge.tsx     — PENDING / APPROVED / REJECTED badge
src/components/ideas/IdeaDetailModal.tsx     — full idea view (admin)
src/components/ideas/ApproveIdeaModal.tsx    — set startDate/endDate before approving
src/components/ideas/RejectIdeaModal.tsx     — optional rejection note
```

### New hook

```
src/hooks/useIdeas.ts
  - submitIdea(data)              → POST /api/ideas
  - fetchMyIdeas()                → GET /api/ideas/my
  - fetchAdminIdeas(status?)      → GET /api/admin/ideas
  - fetchIdeaDetail(id)           → GET /api/admin/ideas/:id
  - approveIdea(id, options)      → POST /api/admin/ideas/:id/approve
  - rejectIdea(id, note?)         → POST /api/admin/ideas/:id/reject
```

### Dashboard change

Add "Submit an Idea" CTA button to `DashboardGrid.tsx` for contributor/employee/admin/founder roles (hidden from observers). Links to `/ideas/submit`.

### Navigation change

Add "Ideas" link to the sidebar navigation for users with `ideas:submit` permission.

Add "Ideas" link to admin sidebar for users with `ideas:manage` permission.

---

## Full Flow

```
Contributor submits idea (/ideas/submit)
  ↓
Idea stored as PENDING
  ↓
Admin reviews in /admin/ideas
  ↓
Admin approves with startDate + endDate
  ↓
approveIdea() runs:
  → BuildCycle created (state: planned)
  → CycleParticipation created (isLead: true)
  → Starter tasks assigned to proposer
  → Notification sent to proposer
  → Idea linked to cycle (idea.cycleId)
  ↓
Proposer sees new cycle in their dashboard
  ↓
Cycle transitions: planned → active → closed
  ↓
Activity → Scoring → Ownership (existing engines, untouched)
```

---

## Edge Cases

| Case | Handling |
|---|---|
| Idea already approved/rejected | Block with 400 |
| startDate after endDate | Validate in route handler |
| Proposer account deleted before approval | Check user exists before creating participation |
| Same idea submitted twice | No dedup — admin sees both and can reject duplicate |
| Approved idea's cycle manually deleted | idea.cycleId becomes orphaned — acceptable, idea stays APPROVED |

---

---

# MIGRATION PLAN

## Prisma Schema Changes Summary

All changes are additive. No existing columns are dropped or renamed.

```
New models:    Group, TriageSubmission, Idea
New fields:    User.groupId, Task.groupId, Task.isStarter,
               ActivityEvent.linkedTaskId, CycleParticipation.isLead
New enums:     TriageStatus, IdeaStatus
New relations: User↔Group, Task↔Group, Task↔ActivityEvent, Idea↔BuildCycle, Idea↔User
```

Migration order:
1. Add `Group` model + `User.groupId` + `Task.groupId` + `Task.isStarter`
2. Add `TriageSubmission` model
3. Add `ActivityEvent.linkedTaskId` + `Task.linkedActivities` back-relation
4. Add `CycleParticipation.isLead`
5. Add `Idea` model + `BuildCycle.idea` back-relation

Each step is a separate Prisma migration file. All new fields are nullable or have defaults so existing data is unaffected.

---

# NEW ROUTES SUMMARY

| Route | Auth | Description |
|---|---|---|
| POST /api/triage/submit | none (rate limited) | Public triage form submission |
| GET /api/admin/triage | onboardingGuard + admin | List triage submissions |
| GET /api/admin/triage/:id | onboardingGuard + admin | Single submission detail |
| POST /api/admin/triage/:id/approve | onboardingGuard + admin | Approve → create user |
| POST /api/admin/triage/:id/reject | onboardingGuard + admin | Reject with note |
| POST /api/admin/groups | onboardingGuard + admin | Create group |
| GET /api/admin/groups | onboardingGuard + admin | List groups |
| PATCH /api/admin/groups/:id | onboardingGuard + admin | Update group |
| DELETE /api/admin/groups/:id | onboardingGuard + admin | Delete group |
| PATCH /api/admin/users/:id/group | onboardingGuard + admin | Assign user to group |
| GET /api/groups/my | agreementGuard | Current user's group |
| POST /api/ideas | agreementGuard | Submit idea |
| GET /api/ideas/my | agreementGuard | User's ideas |
| GET /api/ideas/:id | agreementGuard | Single idea (own or admin) |
| GET /api/admin/ideas | onboardingGuard + admin | List all ideas |
| GET /api/admin/ideas/:id | onboardingGuard + admin | Idea detail |
| POST /api/admin/ideas/:id/approve | onboardingGuard + admin | Approve → create cycle |
| POST /api/admin/ideas/:id/reject | onboardingGuard + admin | Reject with note |

---

# NEW FILES SUMMARY

## Backend

```
backend/src/routes/triage.ts
backend/src/routes/groups.ts
backend/src/routes/ideas.ts
backend/src/services/starterTaskService.ts
```

## Frontend — Pages

```
app/submit-to-triage/page.tsx
app/admin/triage/page.tsx
app/admin/groups/page.tsx
app/admin/ideas/page.tsx
app/ideas/page.tsx
app/ideas/submit/page.tsx
```

## Frontend — Components

```
src/components/triage/TriageSubmissionForm.tsx
src/components/triage/TriageTable.tsx
src/components/triage/TriageDetailModal.tsx
src/components/triage/RejectModal.tsx
src/components/groups/GroupCard.tsx
src/components/groups/CreateGroupModal.tsx
src/components/groups/AssignGroupModal.tsx
src/components/dashboard/GroupBadge.tsx
src/components/ideas/IdeaSubmitForm.tsx
src/components/ideas/IdeaCard.tsx
src/components/ideas/IdeaStatusBadge.tsx
src/components/ideas/IdeaDetailModal.tsx
src/components/ideas/ApproveIdeaModal.tsx
src/components/ideas/RejectIdeaModal.tsx
```

## Frontend — Hooks

```
src/hooks/useTriage.ts
src/hooks/useGroups.ts
src/hooks/useIdeas.ts
```

---

# EXISTING FILES TO MODIFY

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add all new models/fields |
| `backend/src/server.ts` | Register triage, groups, ideas routes |
| `backend/src/routes/activities.ts` | Add linkedTaskId validation + ?linkedTaskId filter |
| `backend/src/routes/tasks.ts` | Add isStarter field support + group-scoped task query |
| `backend/src/routes/participation.ts` | Call assignStarterTasks on cycle join |
| `backend/src/jobs/scheduler.ts` | No changes needed |
| `src/lib/permissions.ts` | Add groups:view, groups:manage, ideas:submit, ideas:manage |
| `src/components/activity/SubmitActivityForm.tsx` | Add linkedTaskId task picker |
| `src/components/tasks/TaskDetailPanel.tsx` | Add linked activities section |
| `src/components/tasks/KanbanBoard.tsx` | Add Starter badge on task cards |
| `src/components/dashboard/AssignedTasksWidget.tsx` | Add Starter label on starter tasks |
| `src/components/dashboard/DashboardGrid.tsx` | Add GroupBadge + Submit Idea CTA |
| `src/components/onboarding/OnboardingTour.tsx` | Add starter tasks step |
| `src/hooks/useActivity.ts` | Add linkedTaskId to submit payload type |

---

# WHAT MUST NOT BE TOUCHED

```
backend/src/services/ownershipService.ts       ← ownership formula
backend/src/services/contributionScoreService.ts ← scoring formula
backend/src/services/aggregationService.ts     ← score aggregation
backend/src/services/reputationService.ts      ← reputation scoring
backend/src/jobs/stallEvaluator.ts             ← stall detection
backend/src/jobs/adjustMultiplier.ts           ← multiplier logic
backend/src/jobs/ownershipDecay.ts             ← decay logic
backend/src/jobs/cycleFinalizer.ts             ← cycle finalization
backend/src/jobs/normalizationJob.ts           ← normalization
backend/src/middleware/auth.ts                 ← JWT validation
backend/src/middleware/requireAgreement.ts     ← agreement enforcement
```

These systems are correct. The five additions plug in around them without modifying them.
