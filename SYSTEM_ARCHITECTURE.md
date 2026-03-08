# Builder's Circle - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                    (Next.js Frontend)                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTPS/HTTP
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    APPWRITE SERVER                               │
│                   (Self-Hosted Backend)                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Account    │  │   Database   │  │  Functions   │         │
│  │   Service    │  │   Service    │  │   Service    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Database: builder_circle                     │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │ ownership_   │  │ multipliers  │  │ build_cycles │   │  │
│  │  │   ledger     │  │              │  │              │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │   cycle_     │  │  activity_   │  │notifications │   │  │
│  │  │participation │  │   events     │  │              │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐                      │  │
│  │  │    user_     │  │  audit_logs  │                      │  │
│  │  │  profiles    │  │              │                      │  │
│  │  └──────────────┘  └──────────────┘                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Serverless Functions                         │  │
│  │                                                            │  │
│  │  ┌──────────────────┐  ┌──────────────────┐             │  │
│  │  │ computeOwnership │  │ stallEvaluator   │             │  │
│  │  │  (On-Demand)     │  │  (Cron: 2 AM)    │             │  │
│  │  └──────────────────┘  └──────────────────┘             │  │
│  │                                                            │  │
│  │  ┌──────────────────┐                                     │  │
│  │  │adjustMultiplier  │                                     │  │
│  │  │  (Cron: 3 AM)    │                                     │  │
│  │  └──────────────────┘                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### User Activity Submission Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │ 1. Submit Activity
     │    (proofLink, description)
     ▼
┌─────────────────┐
│  Frontend Form  │
└────┬────────────┘
     │ 2. POST to Appwrite
     │    databases.createDocument()
     ▼
┌──────────────────────┐
│ activity_events      │
│ Collection           │
│ - userId             │
│ - cycleId            │
│ - activityType       │
│ - proofLink          │
│ - verified: pending  │
└────┬─────────────────┘
     │ 3. Update participation
     │    (lastActivityDate)
     ▼
┌──────────────────────┐
│ cycle_participation  │
│ Collection           │
│ - lastActivityDate   │
│ - stallStage: active │
│ - status: active     │
└──────────────────────┘
```

### Ownership Computation Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │ 1. View Dashboard
     ▼
┌─────────────────┐
│  Frontend       │
│  useOwnership   │
│  Hook           │
└────┬────────────┘
     │ 2. Execute Function
     │    functions.createExecution()
     ▼
┌──────────────────────┐
│ computeOwnership     │
│ Function             │
│                      │
│ 1. Query ledger      │◄──┐
│ 2. Sum ownership     │   │
│ 3. Get multiplier    │◄──┤
│ 4. Calculate total   │   │
└────┬─────────────────┘   │
     │                      │
     │ 3. Read from         │
     ▼                      │
┌──────────────────────┐   │
│ ownership_ledger     │───┘
│ Collection           │
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│ multipliers          │───┘
│ Collection           │
└──────────────────────┘
     │
     │ 4. Return result
     ▼
┌─────────────────┐
│  Frontend       │
│  Display        │
│  Ownership      │
└─────────────────┘
```

### Stall Evaluation Flow (Automated)

```
┌──────────────────────┐
│  Cron Trigger        │
│  Daily at 2 AM UTC   │
└────┬─────────────────┘
     │ 1. Execute
     ▼
┌──────────────────────┐
│ stallEvaluator       │
│ Function             │
│                      │
│ 1. Get active cycles │◄──┐
│ 2. Get participants  │◄──┤
│ 3. Calculate days    │   │
│    inactive          │   │
│ 4. Determine stage   │   │
│ 5. Update records    │───┤
└────┬─────────────────┘   │
     │                      │
     │ 2. Read from         │
     ▼                      │
┌──────────────────────┐   │
│ build_cycles         │───┘
│ Collection           │
│ (state: active)      │
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│ cycle_participation  │───┘
│ Collection           │
│ (optedIn: true)      │
└────┬─────────────────┘
     │ 3. Update
     │    stallStage
     │    participationStatus
     ▼
┌──────────────────────┐
│ Updated Records      │
│ - stallStage         │
│ - participationStatus│
└──────────────────────┘
```

### Multiplier Adjustment Flow (Automated)

```
┌──────────────────────┐
│  Cron Trigger        │
│  Daily at 3 AM UTC   │
└────┬─────────────────┘
     │ 1. Execute
     ▼
┌──────────────────────┐
│ adjustMultiplier     │
│ Function             │
│                      │
│ 1. Get participants  │◄──┐
│ 2. Check stallStage  │   │
│ 3. Calculate new     │   │
│    multiplier        │   │
│ 4. Create records    │───┤
└────┬─────────────────┘   │
     │                      │
     │ 2. Read from         │
     ▼                      │
┌──────────────────────┐   │
│ cycle_participation  │───┘
│ Collection           │
│ (stallStage)         │
└──────────────────────┘
     │
     │ 3. Write to
     ▼
┌──────────────────────┐
│ multipliers          │
│ Collection           │
│ - userId             │
│ - cycleId            │
│ - multiplier         │
│ - reason             │
└──────────────────────┘
     │
     │ 4. Audit trail
     ▼
┌──────────────────────┐
│ ownership_ledger     │
│ Collection           │
│ - eventType:         │
│   multiplier_adj     │
│ - multiplierSnapshot │
└──────────────────────┘
```

## Collection Relationships

```
┌──────────────────┐
│   Appwrite       │
│   Users          │
│   (Built-in)     │
└────┬─────────────┘
     │
     │ userId
     │
     ├─────────────────────────────────────────────────┐
     │                                                   │
     ▼                                                   ▼
┌──────────────────┐                          ┌──────────────────┐
│  user_profiles   │                          │ cycle_           │
│                  │                          │ participation    │
│  - userId (FK)   │                          │                  │
│  - role          │                          │  - userId (FK)   │
│  - status        │                          │  - cycleId (FK)  │
│  - bio           │                          │  - optedIn       │
└──────────────────┘                          │  - stallStage    │
                                              │  - lastActivity  │
                                              └────┬─────────────┘
                                                   │
                                                   │ cycleId
                                                   │
     ┌─────────────────────────────────────────────┤
     │                                              │
     ▼                                              ▼
┌──────────────────┐                          ┌──────────────────┐
│  build_cycles    │                          │  activity_       │
│                  │                          │  events          │
│  - name          │                          │                  │
│  - state         │                          │  - userId (FK)   │
│  - startDate     │                          │  - cycleId (FK)  │
│  - endDate       │                          │  - activityType  │
└──────────────────┘                          │  - proofLink     │
                                              │  - verified      │
                                              └──────────────────┘

     ┌─────────────────────────────────────────────┐
     │                                              │
     ▼                                              ▼
┌──────────────────┐                          ┌──────────────────┐
│  ownership_      │                          │  multipliers     │
│  ledger          │                          │                  │
│                  │                          │  - userId (FK)   │
│  - userId (FK)   │                          │  - cycleId (FK)  │
│  - cycleId (FK)  │                          │  - multiplier    │
│  - eventType     │                          │  - reason        │
│  - ownership     │                          └──────────────────┘
│  - multiplier    │
└──────────────────┘

     │
     ▼
┌──────────────────┐
│  notifications   │
│                  │
│  - userId (FK)   │
│  - type          │
│  - message       │
│  - read          │
└──────────────────┘
```

## Stall Stage State Machine

```
┌─────────────┐
│   GRACE     │  (0 days, no activity yet)
│ Multiplier: │  New participants start here
│    1.0      │
└──────┬──────┘
       │ First activity submitted
       ▼
┌─────────────┐
│   ACTIVE    │  (1-6 days since last activity)
│ Multiplier: │  Participant is engaged
│    1.0      │
└──────┬──────┘
       │ 7 days inactive
       ▼
┌─────────────┐
│  AT_RISK    │  (7-13 days since last activity)
│ Multiplier: │  Warning: reduced multiplier
│    0.75     │
└──────┬──────┘
       │ 14 days inactive
       ▼
┌─────────────┐
│ DIMINISHING │  (14-20 days since last activity)
│ Multiplier: │  Significant reduction
│    0.5      │
└──────┬──────┘
       │ 21 days inactive
       ▼
┌─────────────┐
│   PAUSED    │  (21+ days since last activity)
│ Multiplier: │  No ownership accrual
│    0.0      │
└─────────────┘
       │
       │ Submit activity
       │ (returns to ACTIVE)
       └──────────────────┐
                          │
                          ▼
                    ┌─────────────┐
                    │   ACTIVE    │
                    │ Multiplier: │
                    │    1.0      │
                    └─────────────┘
```

## Function Execution Timeline

```
Time (UTC)    Function              Action
─────────────────────────────────────────────────────────────
00:00         (none)                Normal operation
01:00         (none)                Normal operation
02:00         stallEvaluator        Evaluate all participants
              ├─ Get active cycles
              ├─ Get participants
              ├─ Calculate days inactive
              ├─ Update stall stages
              └─ Update participation status
03:00         adjustMultiplier      Adjust multipliers
              ├─ Get participants
              ├─ Check stall stages
              ├─ Calculate new multipliers
              ├─ Create multiplier records
              └─ Create ledger events
04:00         (none)                Normal operation
...
On-Demand     computeOwnership      Calculate ownership
              ├─ Query ledger
              ├─ Sum ownership
              ├─ Get latest multiplier
              └─ Return effective ownership
```

## Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    PERMISSION LAYERS                         │
└─────────────────────────────────────────────────────────────┘

Layer 1: Authentication
┌──────────────────────────────────────────────────────────────┐
│  Appwrite Account Service                                     │
│  - Email/Password authentication                              │
│  - JWT tokens                                                 │
│  - Session management                                         │
└──────────────────────────────────────────────────────────────┘

Layer 2: Collection Permissions
┌──────────────────────────────────────────────────────────────┐
│  ownership_ledger:    read("users")                           │
│  multipliers:         read("users")                           │
│  build_cycles:        read("users")                           │
│  cycle_participation: read("users")                           │
│  activity_events:     read("users"), create("users")         │
│  notifications:       read("users"), create("users")         │
└──────────────────────────────────────────────────────────────┘

Layer 3: Document Security
┌──────────────────────────────────────────────────────────────┐
│  ownership_ledger:    Enabled (users see own records)        │
│  multipliers:         Enabled (users see own records)        │
│  notifications:       Enabled (users see own notifications)  │
│  user_profiles:       Enabled (users see own profile)        │
└──────────────────────────────────────────────────────────────┘

Layer 4: Server-Only Operations
┌──────────────────────────────────────────────────────────────┐
│  Functions with API Key:                                      │
│  - Create ownership ledger entries                            │
│  - Create multiplier records                                  │
│  - Update participation records                               │
│  - Create notifications                                       │
└──────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         INTERNET                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS (443)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    NGINX REVERSE PROXY                       │
│                    (SSL Termination)                         │
└────────┬───────────────────────────────┬────────────────────┘
         │                               │
         │ HTTP (80)                     │ HTTP (3000)
         │                               │
┌────────▼────────────────┐    ┌─────────▼──────────────────┐
│   APPWRITE DOCKER       │    │   NEXT.JS APPLICATION      │
│   CONTAINERS            │    │   (PM2 Process Manager)    │
│                         │    │                            │
│  ┌──────────────────┐   │    │  ┌──────────────────────┐ │
│  │  appwrite        │   │    │  │  Node.js Server      │ │
│  │  (main)          │   │    │  │  Port: 3000          │ │
│  └──────────────────┘   │    │  └──────────────────────┘ │
│                         │    │                            │
│  ┌──────────────────┐   │    │  ┌──────────────────────┐ │
│  │  mariadb         │   │    │  │  Static Assets       │ │
│  │  (database)      │   │    │  │  (.next/static)      │ │
│  └──────────────────┘   │    │  └──────────────────────┘ │
│                         │    └────────────────────────────┘
│  ┌──────────────────┐   │
│  │  redis           │   │
│  │  (cache)         │   │
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │  functions       │   │
│  │  (executor)      │   │
│  └──────────────────┘   │
└─────────────────────────┘
```

## Technology Stack Details

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND STACK                          │
├─────────────────────────────────────────────────────────────┤
│  Framework:      Next.js 16.1.6 (App Router)                │
│  UI Library:     React 19.2.3                               │
│  Language:       TypeScript 5.9.3                           │
│  Styling:        Tailwind CSS 4                             │
│  SDK:            Appwrite 16.0.2                            │
│  Charts:         Recharts 2.15.4                            │
│  Icons:          Lucide React 0.564.0                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      BACKEND STACK                           │
├─────────────────────────────────────────────────────────────┤
│  Platform:       Appwrite (Self-Hosted)                     │
│  Database:       MariaDB (via Appwrite)                     │
│  Cache:          Redis (via Appwrite)                       │
│  Functions:      Node.js 22                                 │
│  SDK:            node-appwrite 14.1.0 / 15.0.0              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE STACK                       │
├─────────────────────────────────────────────────────────────┤
│  Containerization: Docker                                   │
│  Orchestration:    Docker Compose                           │
│  Web Server:       Nginx (reverse proxy)                    │
│  Process Manager:  PM2                                      │
│  SSL:              Let's Encrypt (Certbot)                  │
│  OS:               Ubuntu 20.04+ / Debian 10+               │
└─────────────────────────────────────────────────────────────┘
```

---

This architecture provides:
- **Scalability**: Can handle growing user base
- **Reliability**: Automated processes with error handling
- **Security**: Multi-layer permission system
- **Maintainability**: Clear separation of concerns
- **Transparency**: Audit trail for all ownership changes
