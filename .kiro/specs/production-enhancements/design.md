# Design Document: Production Enhancements

## Overview

This design specifies the architecture and implementation approach for production-grade enhancements to Builder's Circle. The enhancements maintain the existing Next.js + Appwrite architecture while adding security hardening, automated operations, monitoring, analytics, contribution weighting, governance controls, and system automation capabilities.

The design follows a layered approach:
- **Security Layer**: Rate limiting, input validation, RBAC enforcement
- **Data Layer**: New collections for logs, disputes, audit trails, notifications
- **Business Logic Layer**: Enhanced ownership calculations, admin overrides, analytics computations
- **Automation Layer**: Background workers for maintenance and notifications
- **Presentation Layer**: New admin dashboards and analytics views

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Activity │  │ Analytics│  │  Admin   │  │Monitoring│   │
│  │   Pages  │  │   Pages  │  │  Pages   │  │Dashboard │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Security Middleware                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │Rate Limiter  │  │Input Validator│  │  RBAC Guard  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Appwrite Backend                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Collections                              │  │
│  │  • system_logs        • disputes                      │  │
│  │  • audit_trail        • notifications                 │  │
│  │  • archived_activities • rate_limits (cache)          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Appwrite Functions (Node.js)                │  │
│  │  • backupJob          • activityDecayEngine           │  │
│  │  • stallEvaluator     • notificationDispatcher        │  │
│  │  • multiplierAdjuster                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Activity Submission Flow**:
   - User submits activity → Rate limiter checks → Input validator sanitizes → Business logic applies contribution weight → Store in database → Log event

2. **Admin Override Flow**:
   - Admin initiates override → Confirmation dialog → RBAC verification → Execute override → Create audit trail entry → Log action

3. **Background Worker Flow**:
   - Scheduled trigger → Function executes → Process records → Update database → Log results → Send notifications if needed

4. **Analytics Flow**:
   - User requests analytics → Query database for metrics → Compute aggregations → Return formatted data → Render charts

## Components and Interfaces

### Security Components

#### Rate Limiter

```typescript
interface RateLimitConfig {
  maxRequests: number;      // 10
  windowMs: number;         // 3600000 (1 hour)
}

interface RateLimitEntry {
  userId: string;
  count: number;
  resetAt: Date;
}

class RateLimiter {
  checkLimit(userId: string, action: string): Promise<RateLimitResult>;
  incrementCount(userId: string, action: string): Promise<void>;
  getRemainingTime(userId: string, action: string): Promise<number>;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}
```

#### Input Validator

```typescript
interface ValidationRule {
  field: string;
  type: 'url' | 'text' | 'number' | 'enum';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowedValues?: string[];
}

class InputValidator {
  validateActivity(data: ActivityInput): ValidationResult;
  validateOwnershipAdjustment(data: OwnershipInput): ValidationResult;
  sanitizeHtml(text: string): string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
}
```

#### RBAC Guard

```typescript
interface RolePermissions {
  role: 'founder' | 'admin' | 'contributor' | 'employee' | 'observer';
  allowedRoutes: string[];
  allowedActions: string[];
}

class RBACGuard {
  checkRouteAccess(userId: string, route: string): Promise<boolean>;
  checkActionPermission(userId: string, action: string): Promise<boolean>;
  getUserRole(userId: string): Promise<string>;
}
```

### Data Models

#### System Log

```typescript
interface SystemLog {
  $id: string;
  event: string;
  severity: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}
```

#### Audit Trail

```typescript
interface AuditTrailEntry {
  $id: string;
  adminId: string;
  action: 'ownership_override' | 'stall_clear' | 'multiplier_restore' | 'dispute_resolution';
  targetUserId: string;
  previousValue: any;
  newValue: any;
  reason: string;
  timestamp: Date;
}
```

#### Dispute

```typescript
interface Dispute {
  $id: string;
  userId: string;
  activityId: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  resolution?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}
```

#### Notification

```typescript
interface Notification {
  $id: string;
  userId: string;
  type: 'stall_change' | 'activity_status' | 'dispute_resolved';
  message: string;
  metadata: Record<string, any>;
  sent: boolean;
  createdAt: Date;
  sentAt?: Date;
}
```

#### Enhanced Activity Model

```typescript
interface Activity {
  $id: string;
  userId: string;
  cycleId: string;
  description: string;
  url?: string;
  contributionType: 'code' | 'documentation' | 'review' | 'hours_logged';
  contributionWeight: number;
  baseReward: number;
  calculatedOwnership: number;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  reviewedAt?: Date;
}
```

### Business Logic Components

#### Contribution Weight Calculator

```typescript
const CONTRIBUTION_WEIGHTS = {
  code: 1.0,
  documentation: 0.6,
  review: 0.5,
  hours_logged: 0.4
};

class ContributionCalculator {
  calculateOwnership(baseReward: number, contributionType: string): number {
    const weight = CONTRIBUTION_WEIGHTS[contributionType];
    return baseReward * weight;
  }
  
  getContributionWeight(contributionType: string): number;
}
```

#### Admin Override Service

```typescript
class AdminOverrideService {
  adjustOwnership(
    adminId: string,
    targetUserId: string,
    newAmount: number,
    reason: string
  ): Promise<void>;
  
  clearStallPenalty(
    adminId: string,
    targetUserId: string,
    reason: string
  ): Promise<void>;
  
  restoreMultiplier(
    adminId: string,
    targetUserId: string,
    reason: string
  ): Promise<void>;
}
```

#### Analytics Engine

```typescript
interface ContributorMetrics {
  userId: string;
  activityFrequency: number;      // activities per week
  approvalRate: number;            // percentage
  totalContributions: number;
  averageWeight: number;
}

interface ParticipationMetrics {
  activeCount: number;
  atRiskCount: number;
  diminishingCount: number;
  pausedCount: number;
  averageInactivityDays: number;
}

interface CycleMetrics {
  cycleId: string;
  engagementRate: number;          // percentage of active participants
  completionSuccessRate: number;   // percentage of completed activities
  totalActivities: number;
  totalParticipants: number;
}

class AnalyticsEngine {
  computeContributorMetrics(userId: string, dateRange: DateRange): Promise<ContributorMetrics>;
  computeParticipationMetrics(cycleId?: string): Promise<ParticipationMetrics>;
  computeCycleMetrics(cycleId: string): Promise<CycleMetrics>;
}
```

### Background Workers

#### Backup Job

```typescript
interface BackupConfig {
  schedule: string;              // "0 2 * * *" (daily at 2 AM UTC)
  collections: string[];
  outputPath: string;
  retentionDays: number;         // 30
}

class BackupJob {
  async execute(): Promise<void> {
    // 1. Query all records from target collections
    // 2. Serialize to JSON
    // 3. Compress using gzip
    // 4. Save with timestamp filename
    // 5. Delete backups older than retention period
    // 6. Log results
  }
}
```

#### Activity Decay Engine

```typescript
class ActivityDecayEngine {
  async execute(): Promise<void> {
    // 1. Find activities older than 365 days in closed cycles
    // 2. Copy to archived_activities collection
    // 3. Verify ownership_ledger references preserved
    // 4. Delete from activity collection
    // 5. Log count of archived activities
  }
}
```

#### Notification Dispatcher

```typescript
class NotificationDispatcher {
  async execute(): Promise<void> {
    // 1. Query unsent notifications
    // 2. Group by user
    // 3. Send email via Appwrite messaging
    // 4. Mark as sent
    // 5. Log delivery status
  }
}
```

### Frontend Components

#### Confirmation Dialog

```typescript
interface ConfirmationDialogProps {
  title: string;
  message: string;
  confirmText: string;
  requireTypedConfirmation?: boolean;
  confirmationPhrase?: string;
  onConfirm: () => void;
  onCancel: () => void;
}
```

#### Monitoring Dashboard

```typescript
interface MonitoringMetrics {
  avgResponseTime: number;
  functionFailures: number;
  activitySubmissions: ChartData[];
  stallDistribution: {
    active: number;
    atRisk: number;
    diminishing: number;
    paused: number;
  };
}
```

#### Analytics Dashboard

```typescript
interface AnalyticsDashboardProps {
  dateRange: DateRange;
  cycleFilter?: string;
}

interface ChartData {
  date: string;
  value: number;
}
```

## Data Models

### New Appwrite Collections

#### system_logs Collection

```
Fields:
- event: string (required)
- severity: string (required, enum: DEBUG|INFO|WARNING|ERROR|CRITICAL)
- message: string (required)
- timestamp: datetime (required, indexed)
- userId: string (optional, indexed)
- metadata: string (JSON serialized)

Indexes:
- timestamp (DESC)
- severity + timestamp
- userId + timestamp
```

#### audit_trail Collection

```
Fields:
- adminId: string (required, indexed)
- action: string (required, indexed)
- targetUserId: string (required, indexed)
- previousValue: string (JSON serialized)
- newValue: string (JSON serialized)
- reason: string (required)
- timestamp: datetime (required, indexed)

Indexes:
- timestamp (DESC)
- adminId + timestamp
- targetUserId + timestamp
- action + timestamp
```

#### disputes Collection

```
Fields:
- userId: string (required, indexed)
- activityId: string (required, indexed)
- reason: string (required)
- status: string (required, enum: pending|approved|denied, indexed)
- resolution: string (optional)
- createdAt: datetime (required, indexed)
- resolvedAt: datetime (optional)
- resolvedBy: string (optional)

Indexes:
- status + createdAt
- userId + status
```

#### notifications Collection

```
Fields:
- userId: string (required, indexed)
- type: string (required, indexed)
- message: string (required)
- metadata: string (JSON serialized)
- sent: boolean (required, indexed)
- createdAt: datetime (required, indexed)
- sentAt: datetime (optional)

Indexes:
- sent + createdAt
- userId + sent
```

#### archived_activities Collection

```
Fields:
- (same structure as activity collection)
- archivedAt: datetime (required, indexed)
- originalId: string (required, indexed)

Indexes:
- archivedAt (DESC)
- userId + archivedAt
```

### Enhanced Existing Collections

#### activity Collection (add fields)

```
New Fields:
- contributionType: string (required, enum: code|documentation|review|hours_logged)
- contributionWeight: number (required)
- calculatedOwnership: number (required)
```

## Error Handling

### Error Types

```typescript
class RateLimitError extends Error {
  code = 429;
  resetAt: Date;
}

class ValidationError extends Error {
  code = 400;
  errors: ValidationError[];
}

class UnauthorizedError extends Error {
  code = 403;
  requiredRole: string;
}

class BackupError extends Error {
  code = 500;
  collection: string;
}
```

### Error Handling Strategy

1. **Client-Side Validation**: Validate inputs before submission to provide immediate feedback
2. **Server-Side Validation**: Always validate on server regardless of client validation
3. **Graceful Degradation**: Log errors but continue operation when non-critical failures occur
4. **User Feedback**: Provide clear, actionable error messages to users
5. **Admin Alerts**: Send critical errors to admin notification channel
6. **Retry Logic**: Implement exponential backoff for transient failures in background workers

### Logging Strategy

```typescript
class Logger {
  debug(event: string, message: string, metadata?: any): void;
  info(event: string, message: string, metadata?: any): void;
  warning(event: string, message: string, metadata?: any): void;
  error(event: string, message: string, error: Error, metadata?: any): void;
  critical(event: string, message: string, error: Error, metadata?: any): void;
}

// Usage examples:
logger.info('activity_submitted', 'User submitted activity', { userId, activityId });
logger.warning('rate_limit_exceeded', 'User exceeded rate limit', { userId, limit: 10 });
logger.error('backup_failed', 'Backup job failed', error, { collection: 'activity' });
```

## Testing Strategy

This feature requires both unit testing and property-based testing to ensure correctness across all scenarios.

### Unit Testing Approach

Unit tests will focus on:
- Specific validation rules (URL format, text length, number ranges)
- RBAC permission checks for known roles
- Confirmation dialog interactions
- Error handling for specific failure scenarios
- Integration between components (e.g., admin override creates audit trail)

### Property-Based Testing Approach

Property tests will verify universal correctness properties across randomized inputs using a property-based testing library (fast-check for TypeScript/JavaScript).

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: **Feature: production-enhancements, Property {N}: {property text}**

### Testing Libraries

- **Unit Tests**: Jest + React Testing Library
- **Property Tests**: fast-check
- **Integration Tests**: Playwright for end-to-end flows
- **API Tests**: Supertest for API endpoint testing


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, several redundancies were identified:
- Requirements 3.2, 3.3, 3.4 all test admin route protection and can be combined into one comprehensive property
- Requirements 5.2, 5.3, 5.4 all test backup collection export and can be combined
- Requirements 15.1, 15.2, 15.3 all test notification creation and can be combined

### Rate Limiting Properties

**Property 1: Rate limit tracking accuracy**
*For any* user and sequence of activity submissions, the rate limiter's tracked count should equal the number of submissions within the current hourly window.
**Validates: Requirements 1.1**

**Property 2: Rate limit reset time calculation**
*For any* rate-limited user, the returned reset time should equal the timestamp when the hourly window expires.
**Validates: Requirements 1.3**

**Property 3: Rate limit window reset**
*For any* user with a rate limit count, when the hourly window expires, the count should reset to zero.
**Validates: Requirements 1.4**

### Input Validation Properties

**Property 4: URL validation correctness**
*For any* string input, the URL validator should accept it if and only if it matches the pattern https?://[valid-domain] and reject all other inputs.
**Validates: Requirements 2.1**

**Property 5: Description length validation**
*For any* string input, the description validator should accept it if and only if its length is between 10 and 2000 characters inclusive.
**Validates: Requirements 2.2**

**Property 6: HTML sanitization completeness**
*For any* string containing HTML tags or script elements, the sanitizer should remove all tags and script content while preserving plain text.
**Validates: Requirements 2.3**

**Property 7: Ownership amount validation**
*For any* numeric input, the ownership validator should accept it if and only if it is positive and has at most 2 decimal places.
**Validates: Requirements 2.4**

**Property 8: Validation error messages**
*For any* invalid input, the validation error should contain the name of the invalid field in the error message.
**Validates: Requirements 2.5**

### Access Control Properties

**Property 9: Admin route protection**
*For any* user without admin role and any route matching /admin/*, the system should return HTTP 403 Forbidden.
**Validates: Requirements 3.2, 3.3, 3.4**

### Confirmation Dialog Properties

**Property 10: Confirmation dialog data display**
*For any* admin override action, the confirmation dialog should display both the current value and the new value.
**Validates: Requirements 4.2, 4.3**

**Property 11: Cancellation preserves state**
*For any* sensitive action, when the confirmation dialog is cancelled, the system state should remain unchanged from before the action was initiated.
**Validates: Requirements 4.4**

### Backup Properties

**Property 12: Backup collection completeness**
*For any* backup execution, the output file should contain all records from ownership_ledger, cycle_participation, and activity collections serialized as JSON.
**Validates: Requirements 5.2, 5.3, 5.4**

**Property 13: Backup filename format**
*For any* completed backup, the filename should match the pattern backup_YYYYMMDD_HHMMSS.json.gz where the timestamp reflects the backup execution time.
**Validates: Requirements 5.5**

**Property 14: Backup retention cleanup**
*For any* backup older than 30 days, when the backup job runs, that backup file should be deleted.
**Validates: Requirements 5.7**

### Logging Properties

**Property 15: Slow request logging**
*For any* API request that takes longer than 1000ms to complete, the system should create a log entry with the response time.
**Validates: Requirements 6.2**

**Property 16: Activity submission logging**
*For any* activity submission, the system should create a log entry with severity INFO containing the userId and activityId.
**Validates: Requirements 6.4**

### Analytics Properties

**Property 17: Contributor productivity calculation**
*For any* user and date range, the activity frequency metric should equal the total number of activities divided by the number of weeks in the range, and the approval rate should equal approved activities divided by total activities.
**Validates: Requirements 8.2**

**Property 18: Participation health calculation**
*For any* set of participants, the active vs stalled ratio should equal the count of active participants divided by total participants, and average inactivity should equal the sum of inactivity days divided by participant count.
**Validates: Requirements 8.3**

**Property 19: Cycle health calculation**
*For any* build cycle, the engagement rate should equal active participants divided by total participants, and completion success rate should equal approved activities divided by total activities.
**Validates: Requirements 8.4**

**Property 20: Analytics filtering**
*For any* date range filter applied to analytics, all returned data points should have timestamps within the specified range.
**Validates: Requirements 8.6**

### Contribution Weighting Properties

**Property 21: Weighted ownership calculation**
*For any* activity with base reward R and contribution type T, the calculated ownership should equal R × weight(T) where weight(code)=1.0, weight(documentation)=0.6, weight(review)=0.5, weight(hours_logged)=0.4.
**Validates: Requirements 9.2**

**Property 22: Contribution type validation**
*For any* activity submission, if the contribution type is not one of {code, documentation, review, hours_logged}, the system should reject the submission.
**Validates: Requirements 9.3**

**Property 23: Contribution type persistence**
*For any* submitted activity, querying the activity record should return the same contribution type that was submitted.
**Validates: Requirements 9.4**

**Property 24: Ownership display completeness**
*For any* displayed ownership calculation, the rendered output should contain both the contribution type and the applied weight value.
**Validates: Requirements 9.5**

### Admin Override Properties

**Property 25: Override audit trail creation**
*For any* admin ownership adjustment, the system should create an ownership_ledger entry with reason "admin_override" containing the adminId, targetUserId, and new amount.
**Validates: Requirements 10.1**

**Property 26: Stall penalty clearing**
*For any* participant with stall stage not equal to "active", when an admin clears stall penalties, the participant's stall stage should become "active".
**Validates: Requirements 10.2**

**Property 27: Multiplier restoration**
*For any* participant with multiplier not equal to 1.0, when an admin restores multipliers, the participant's multiplier should become 1.0.
**Validates: Requirements 10.3**

**Property 28: Admin action logging**
*For any* admin override action, the system should create a system_log entry with severity INFO containing the action type and targetUserId.
**Validates: Requirements 10.4**

**Property 29: Override reason requirement**
*For any* admin override action submitted without a reason text, the system should reject the action.
**Validates: Requirements 10.5**

### Audit Trail Properties

**Property 30: Audit trail completeness**
*For any* admin override action, the system should create an audit_trail entry containing adminId, action, targetUserId, previousValue, newValue, reason, and timestamp.
**Validates: Requirements 11.1**

**Property 31: Audit trail ordering**
*For any* audit trail query, the returned entries should be ordered by timestamp in descending order (newest first).
**Validates: Requirements 11.4**

**Property 32: Audit trail filtering**
*For any* audit trail filter by adminId, action type, or date range, all returned entries should match the filter criteria.
**Validates: Requirements 11.5**

### Dispute Properties

**Property 33: Dispute creation**
*For any* user submitting a dispute for an activity, the system should create a dispute record with status "pending" containing userId, activityId, and reason.
**Validates: Requirements 12.2**

**Property 34: Pending dispute visibility**
*For any* dispute with status "pending", when an admin views the disputes page, that dispute should appear in the displayed list.
**Validates: Requirements 12.4**

**Property 35: Dispute resolution**
*For any* dispute being resolved by an admin, the dispute status should be updated to either "approved" or "denied" and the resolution text should be stored.
**Validates: Requirements 12.5**

### Activity Decay Properties

**Property 36: Decay activity identification**
*For any* activity in a closed build cycle, if the activity is older than 365 days, the decay engine should identify it for archival.
**Validates: Requirements 14.1**

**Property 37: Activity archival transfer**
*For any* activity identified for archival, the decay engine should create a corresponding record in archived_activities and remove it from the activity collection.
**Validates: Requirements 14.2**

**Property 38: Archival data preservation**
*For any* archived activity, all fields from the original activity record should be preserved in the archived_activities record with identical values.
**Validates: Requirements 14.3**

**Property 39: Archival reference integrity**
*For any* archived activity referenced by an ownership_ledger entry, the ledger entry's activityId reference should remain valid and queryable.
**Validates: Requirements 14.4**

### Notification Properties

**Property 40: Event notification creation**
*For any* event of type {stall_stage_change, activity_status_change, dispute_resolved}, the system should create a notification record for the affected user.
**Validates: Requirements 15.1, 15.2, 15.3**

**Property 41: Notification dispatch**
*For any* notification with sent=false, when the notification dispatcher runs, the system should send the notification via email.
**Validates: Requirements 15.4**

**Property 42: Notification sent flag update**
*For any* notification successfully sent, the system should update the sent field to true and record the sentAt timestamp.
**Validates: Requirements 15.5**

### Data Export Properties

**Property 43: Export data structure**
*For any* export API endpoint call, the returned data should be valid JSON containing all required fields for the requested data type (activity patterns, participation health, or ownership distribution).
**Validates: Requirements 16.4**


## Testing Strategy

### Overview

This feature requires a dual testing approach combining unit tests for specific scenarios and property-based tests for universal correctness guarantees. Both testing approaches are complementary and necessary for comprehensive coverage.

### Unit Testing

Unit tests will focus on:

1. **Specific Examples**
   - Rate limit rejection at exactly 11 submissions (Requirement 1.2)
   - Admin route access returns 403 for non-admin (Requirement 3.1)
   - Cycle closure confirmation dialog appears (Requirement 4.1)
   - Typed confirmation phrase required for cycle closure (Requirement 4.5)
   - Backup failure logging (Requirement 5.6)
   - Function execution failure logging (Requirement 6.3)
   - Participant stall stage logging (Requirement 6.5)
   - Severity level support (Requirement 6.6)
   - Monitoring dashboard page exists (Requirement 7.1)
   - Monitoring dashboard displays specific metrics (Requirements 7.2-7.5)
   - Analytics page exists (Requirement 8.1)
   - Audit trail page exists (Requirement 11.3)
   - Dispute button appears on rejected activities (Requirement 12.1)
   - Background worker failure and retry (Requirement 13.5)
   - Activity decay logging (Requirement 14.5)

2. **Edge Cases**
   - Empty strings, null values, undefined inputs
   - Boundary values (exactly 10 characters, exactly 2000 characters)
   - Maximum decimal places (2.00, 2.001)
   - Expired rate limit windows
   - Concurrent admin overrides
   - Backup with empty collections

3. **Integration Points**
   - Admin override creates both ledger entry and audit trail
   - Activity submission creates log entry and updates rate limit
   - Dispute resolution creates notification
   - Archival maintains ownership ledger references

### Property-Based Testing

Property tests will verify universal correctness properties across randomized inputs using **fast-check** library for TypeScript/JavaScript.

**Configuration Requirements**:
- Minimum 100 iterations per property test
- Each test must be tagged with: **Feature: production-enhancements, Property {N}: {property text}**
- Use appropriate generators for each data type (strings, numbers, dates, enums)

**Property Test Implementation Pattern**:

```typescript
import fc from 'fast-check';

// Feature: production-enhancements, Property 21: Weighted ownership calculation
test('weighted ownership calculation', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0.01, max: 1000 }), // base reward
      fc.constantFrom('code', 'documentation', 'review', 'hours_logged'), // contribution type
      (baseReward, contributionType) => {
        const weights = {
          code: 1.0,
          documentation: 0.6,
          review: 0.5,
          hours_logged: 0.4
        };
        
        const result = calculateOwnership(baseReward, contributionType);
        const expected = baseReward * weights[contributionType];
        
        expect(result).toBeCloseTo(expected, 2);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Generator Strategies**:

1. **String Generators**
   - Valid URLs: `fc.webUrl()`
   - Invalid URLs: `fc.string()` filtered to exclude valid patterns
   - HTML content: `fc.string()` with HTML tag injection
   - Descriptions: `fc.string({ minLength: 0, maxLength: 3000 })`

2. **Number Generators**
   - Ownership amounts: `fc.double({ min: 0, max: 10000 })`
   - Decimal places: `fc.integer({ min: 0, max: 5 })`
   - Timestamps: `fc.date()`

3. **Enum Generators**
   - Contribution types: `fc.constantFrom('code', 'documentation', 'review', 'hours_logged')`
   - Stall stages: `fc.constantFrom('active', 'at_risk', 'diminishing', 'paused')`
   - Severity levels: `fc.constantFrom('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')`

4. **Complex Object Generators**
   - Activities: `fc.record({ userId, cycleId, description, contributionType, ... })`
   - Users: `fc.record({ id, role, ... })`
   - Date ranges: `fc.tuple(fc.date(), fc.date()).filter(([start, end]) => start < end)`

### Property Test Coverage Map

Each correctness property maps to specific property-based tests:

| Property | Test Focus | Generator Strategy |
|----------|-----------|-------------------|
| 1 | Rate limit count accuracy | User sequences, submission timestamps |
| 2 | Reset time calculation | Current time, window expiry |
| 3 | Window reset behavior | Time progression simulation |
| 4 | URL validation | Valid/invalid URL strings |
| 5 | Length validation | Strings of varying lengths |
| 6 | HTML sanitization | Strings with HTML/script tags |
| 7 | Number validation | Numbers with varying decimal places |
| 8 | Error message content | Invalid inputs of all types |
| 9 | Admin route protection | Users with different roles, admin routes |
| 10 | Dialog data display | Override actions with values |
| 11 | Cancellation state preservation | Actions with state snapshots |
| 12 | Backup completeness | Collection records |
| 13 | Filename format | Backup timestamps |
| 14 | Retention cleanup | Backup files with ages |
| 15 | Slow request logging | Request durations |
| 16 | Activity logging | Activity submissions |
| 17 | Productivity calculation | User activities over time |
| 18 | Health calculation | Participant states |
| 19 | Cycle health calculation | Cycle activities and participants |
| 20 | Analytics filtering | Date ranges, data points |
| 21 | Weighted calculation | Base rewards, contribution types |
| 22 | Type validation | Valid/invalid contribution types |
| 23 | Type persistence | Activity submissions and queries |
| 24 | Display completeness | Ownership calculations |
| 25 | Audit trail creation | Override actions |
| 26 | Stall clearing | Participants with various stall stages |
| 27 | Multiplier restoration | Participants with various multipliers |
| 28 | Action logging | Admin actions |
| 29 | Reason requirement | Override actions with/without reasons |
| 30 | Audit completeness | Admin actions |
| 31 | Audit ordering | Audit entries with timestamps |
| 32 | Audit filtering | Filter criteria, audit entries |
| 33 | Dispute creation | Dispute submissions |
| 34 | Dispute visibility | Pending disputes |
| 35 | Dispute resolution | Resolution actions |
| 36 | Decay identification | Activities with various ages |
| 37 | Archival transfer | Activities to archive |
| 38 | Data preservation | Original and archived activities |
| 39 | Reference integrity | Archived activities, ledger entries |
| 40 | Notification creation | Various event types |
| 41 | Notification dispatch | Pending notifications |
| 42 | Sent flag update | Sent notifications |
| 43 | Export structure | Export requests |

### Test Organization

```
tests/
├── unit/
│   ├── security/
│   │   ├── rateLimiter.test.ts
│   │   ├── inputValidator.test.ts
│   │   └── rbacGuard.test.ts
│   ├── business/
│   │   ├── contributionCalculator.test.ts
│   │   ├── adminOverride.test.ts
│   │   └── analyticsEngine.test.ts
│   ├── workers/
│   │   ├── backupJob.test.ts
│   │   ├── activityDecay.test.ts
│   │   └── notificationDispatcher.test.ts
│   └── ui/
│       ├── confirmationDialog.test.tsx
│       ├── monitoringDashboard.test.tsx
│       └── analyticsPage.test.tsx
├── property/
│   ├── security.properties.test.ts
│   ├── validation.properties.test.ts
│   ├── calculations.properties.test.ts
│   ├── audit.properties.test.ts
│   └── workers.properties.test.ts
└── integration/
    ├── adminOverrideFlow.test.ts
    ├── disputeFlow.test.ts
    └── activitySubmissionFlow.test.ts
```

### Testing Tools and Libraries

- **Unit Testing**: Jest (test runner and assertions)
- **Property Testing**: fast-check (property-based testing)
- **React Testing**: React Testing Library (component testing)
- **API Testing**: Supertest (HTTP endpoint testing)
- **E2E Testing**: Playwright (end-to-end flows)
- **Mocking**: Jest mocks for Appwrite SDK

### Continuous Integration

All tests must pass before merging:
1. Unit tests (fast feedback)
2. Property tests (comprehensive coverage)
3. Integration tests (component interaction)
4. E2E tests (critical user flows)

Property tests run with 100 iterations in CI, can be increased to 1000 for release builds.
