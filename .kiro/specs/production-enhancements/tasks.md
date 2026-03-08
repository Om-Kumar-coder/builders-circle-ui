# Implementation Plan: Production Enhancements

## Overview

This implementation plan breaks down the production enhancements into discrete, incremental coding tasks. Each task builds on previous work and includes testing sub-tasks to validate functionality early. The plan follows a layered approach: security infrastructure first, then data models, business logic, automation workers, and finally UI components.

## Tasks

- [-] 1. Set up testing infrastructure and new collections
  - [x] 1.1 Install and configure fast-check for property-based testing
    - Add fast-check to package.json
    - Configure Jest to support property tests
    - Create test utilities and generators in tests/utils/generators.ts
    - _Requirements: Testing Strategy_
  
  - [x] 1.2 Create new Appwrite collections
    - Create system_logs collection with schema (event, severity, message, timestamp, userId, metadata)
    - Create audit_trail collection with schema (adminId, action, targetUserId, previousValue, newValue, reason, timestamp)
    - Create disputes collection with schema (userId, activityId, reason, status, resolution, createdAt, resolvedAt, resolvedBy)
    - Create notifications collection with schema (userId, type, message, metadata, sent, createdAt, sentAt)
    - Create archived_activities collection with schema (same as activity + archivedAt, originalId)
    - Add indexes as specified in design document
    - _Requirements: 6.1, 11.2, 12.3, 16.1, 16.2, 16.3_
  
  - [x] 1.3 Update activity collection schema
    - Add contributionType field (enum: code, documentation, review, hours_logged)
    - Add contributionWeight field (number)
    - Add calculatedOwnership field (number)
    - Create migration script to add fields to existing activities with default values
    - _Requirements: 9.1, 9.4_

- [ ] 2. Implement security layer components
  - [ ] 2.1 Create rate limiter service
    - Implement RateLimiter class with in-memory storage
    - Implement checkLimit, incrementCount, getRemainingTime methods
    - Configure for 10 requests per hour per user
    - _Requirements: 1.1, 1.3, 1.4, 1.5_
  
  - [ ] 2.2 Write property tests for rate limiter
    - **Property 1: Rate limit tracking accuracy**
    - **Property 2: Rate limit reset time calculation**
    - **Property 3: Rate limit window reset**
    - **Validates: Requirements 1.1, 1.3, 1.4**
  
  - [ ] 2.3 Create input validator service
    - Implement InputValidator class
    - Implement validateActivity method with URL, description, and type validation
    - Implement validateOwnershipAdjustment method
    - Implement sanitizeHtml method using DOMPurify or similar
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ] 2.4 Write property tests for input validator
    - **Property 4: URL validation correctness**
    - **Property 5: Description length validation**
    - **Property 6: HTML sanitization completeness**
    - **Property 7: Ownership amount validation**
    - **Property 8: Validation error messages**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
  
  - [ ] 2.5 Create RBAC guard middleware
    - Implement RBACGuard class
    - Implement checkRouteAccess method for admin routes
    - Implement getUserRole method using Appwrite auth
    - Create Next.js middleware to protect /admin/* routes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ] 2.6 Write property tests for RBAC guard
    - **Property 9: Admin route protection**
    - **Validates: Requirements 3.2, 3.3, 3.4**
  
  - [ ] 2.7 Integrate security layer into activity submission endpoint
    - Add rate limiter check before processing submissions
    - Add input validation before database operations
    - Return appropriate error codes (429, 400, 403)
    - _Requirements: 1.2, 2.5_

- [ ] 3. Implement logging and monitoring infrastructure
  - [ ] 3.1 Create logger service
    - Implement Logger class with methods for each severity level
    - Implement log writing to system_logs collection
    - Add automatic userId capture from request context
    - _Requirements: 6.1, 6.6_
  
  - [ ] 3.2 Add logging to critical operations
    - Log activity submissions (INFO)
    - Log slow API requests >1000ms (WARNING)
    - Log function execution failures (ERROR)
    - Log stall stage changes (WARNING)
    - _Requirements: 6.2, 6.3, 6.4, 6.5_
  
  - [ ] 3.3 Write property tests for logging
    - **Property 15: Slow request logging**
    - **Property 16: Activity submission logging**
    - **Validates: Requirements 6.2, 6.4**
  
  - [ ] 3.4 Create monitoring dashboard page
    - Create /admin/monitoring route with RBAC protection
    - Implement MonitoringMetrics component
    - Query system_logs for metrics (avg response time, failure count)
    - Query cycle_participation for stall distribution
    - Display metrics with auto-refresh every 60 seconds
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 4. Checkpoint - Ensure security and logging tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement contribution weighting system
  - [ ] 5.1 Create contribution calculator service
    - Define CONTRIBUTION_WEIGHTS constant
    - Implement ContributionCalculator class
    - Implement calculateOwnership method
    - Implement getContributionWeight method
    - _Requirements: 9.1, 9.2_
  
  - [ ] 5.2 Write property tests for contribution calculator
    - **Property 21: Weighted ownership calculation**
    - **Validates: Requirements 9.2**
  
  - [ ] 5.3 Update activity submission to use contribution weights
    - Add contributionType field to submission form
    - Validate contributionType is required and valid
    - Calculate weighted ownership using ContributionCalculator
    - Store contributionType, contributionWeight, and calculatedOwnership
    - _Requirements: 9.3, 9.4_
  
  - [ ] 5.4 Write property tests for contribution type handling
    - **Property 22: Contribution type validation**
    - **Property 23: Contribution type persistence**
    - **Validates: Requirements 9.3, 9.4**
  
  - [ ] 5.5 Update activity display to show contribution details
    - Display contribution type badge on activity cards
    - Display applied weight in ownership calculation tooltip
    - _Requirements: 9.5_
  
  - [ ] 5.6 Write property test for display completeness
    - **Property 24: Ownership display completeness**
    - **Validates: Requirements 9.5**

- [ ] 6. Implement admin override system
  - [ ] 6.1 Create admin override service
    - Implement AdminOverrideService class
    - Implement adjustOwnership method
    - Implement clearStallPenalty method
    - Implement restoreMultiplier method
    - Each method creates ownership_ledger entry and audit_trail entry
    - Each method logs action to system_logs
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.1_
  
  - [ ] 6.2 Write property tests for admin overrides
    - **Property 25: Override audit trail creation**
    - **Property 26: Stall penalty clearing**
    - **Property 27: Multiplier restoration**
    - **Property 28: Admin action logging**
    - **Property 29: Override reason requirement**
    - **Property 30: Audit trail completeness**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 11.1**
  
  - [ ] 6.3 Create confirmation dialog component
    - Implement ConfirmationDialog React component
    - Support standard confirmation and typed confirmation modes
    - Display current and new values for overrides
    - Handle confirm and cancel actions
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 6.4 Write property tests for confirmation dialog
    - **Property 10: Confirmation dialog data display**
    - **Property 11: Cancellation preserves state**
    - **Validates: Requirements 4.2, 4.3, 4.4**
  
  - [ ] 6.5 Create admin override UI
    - Add override buttons to participant management page
    - Wire buttons to AdminOverrideService methods
    - Show confirmation dialogs before executing overrides
    - Display success/error messages
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [ ] 6.6 Create audit trail page
    - Create /admin/audit route with RBAC protection
    - Query audit_trail collection with pagination
    - Display entries in reverse chronological order
    - Implement filters for adminId, action type, and date range
    - _Requirements: 11.3, 11.4, 11.5_
  
  - [ ] 6.7 Write property tests for audit trail
    - **Property 31: Audit trail ordering**
    - **Property 32: Audit trail filtering**
    - **Validates: Requirements 11.4, 11.5**

- [ ] 7. Checkpoint - Ensure admin override tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement dispute system
  - [ ] 8.1 Create dispute service
    - Implement DisputeService class
    - Implement createDispute method
    - Implement resolveDispute method (creates notification)
    - Implement getDisputesByStatus method
    - _Requirements: 12.2, 12.5_
  
  - [ ] 8.2 Write property tests for dispute service
    - **Property 33: Dispute creation**
    - **Property 35: Dispute resolution**
    - **Validates: Requirements 12.2, 12.5**
  
  - [ ] 8.3 Add dispute button to activity cards
    - Show "Dispute" button on rejected activities
    - Open dispute submission modal
    - Submit dispute with reason text
    - _Requirements: 12.1_
  
  - [ ] 8.4 Create admin disputes page
    - Create /admin/disputes route with RBAC protection
    - Display all pending disputes
    - Implement resolve action (approve/deny with resolution text)
    - _Requirements: 12.4, 12.5_
  
  - [ ] 8.5 Write property test for dispute visibility
    - **Property 34: Pending dispute visibility**
    - **Validates: Requirements 12.4**

- [ ] 9. Implement analytics engine
  - [ ] 9.1 Create analytics engine service
    - Implement AnalyticsEngine class
    - Implement computeContributorMetrics method
    - Implement computeParticipationMetrics method
    - Implement computeCycleMetrics method
    - _Requirements: 8.2, 8.3, 8.4_
  
  - [ ] 9.2 Write property tests for analytics calculations
    - **Property 17: Contributor productivity calculation**
    - **Property 18: Participation health calculation**
    - **Property 19: Cycle health calculation**
    - **Validates: Requirements 8.2, 8.3, 8.4**
  
  - [ ] 9.3 Create analytics dashboard page
    - Create /analytics route (accessible to all authenticated users)
    - Implement date range and cycle filter controls
    - Display contributor productivity charts using recharts
    - Display participation health charts
    - Display cycle health charts
    - _Requirements: 8.1, 8.5, 8.6_
  
  - [ ] 9.4 Write property test for analytics filtering
    - **Property 20: Analytics filtering**
    - **Validates: Requirements 8.6**

- [ ] 10. Implement notification system
  - [ ] 10.1 Create notification service
    - Implement NotificationService class
    - Implement createNotification method
    - Implement getUnsentNotifications method
    - Implement markAsSent method
    - _Requirements: 15.1, 15.2, 15.3, 15.5_
  
  - [ ] 10.2 Write property tests for notification service
    - **Property 40: Event notification creation**
    - **Property 42: Notification sent flag update**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.5**
  
  - [ ] 10.3 Integrate notification creation into event handlers
    - Create notification on stall stage change
    - Create notification on activity approval/rejection
    - Create notification on dispute resolution
    - _Requirements: 15.1, 15.2, 15.3_

- [ ] 11. Checkpoint - Ensure dispute, analytics, and notification tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement background workers
  - [ ] 12.1 Create backup job function
    - Create Appwrite function: backupJob
    - Query ownership_ledger, cycle_participation, activity collections
    - Serialize to JSON and compress with gzip
    - Save to storage with timestamp filename
    - Implement retention cleanup (delete backups >30 days)
    - Log results and errors
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ] 12.2 Write property tests for backup job
    - **Property 12: Backup collection completeness**
    - **Property 13: Backup filename format**
    - **Property 14: Backup retention cleanup**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.7**
  
  - [ ] 12.3 Create activity decay engine function
    - Create Appwrite function: activityDecayEngine
    - Query activities >365 days old in closed cycles
    - Copy to archived_activities collection
    - Verify ownership_ledger references preserved
    - Delete from activity collection
    - Log count of archived activities
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [ ] 12.4 Write property tests for activity decay
    - **Property 36: Decay activity identification**
    - **Property 37: Activity archival transfer**
    - **Property 38: Archival data preservation**
    - **Property 39: Archival reference integrity**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4**
  
  - [ ] 12.5 Create notification dispatcher function
    - Create Appwrite function: notificationDispatcher
    - Query unsent notifications
    - Group by user
    - Send emails via Appwrite messaging
    - Mark as sent with timestamp
    - Log delivery status
    - Implement retry logic for failures
    - _Requirements: 15.4, 15.5, 13.5_
  
  - [ ] 12.6 Write property test for notification dispatch
    - **Property 41: Notification dispatch**
    - **Validates: Requirements 15.4**
  
  - [ ] 12.7 Configure Appwrite function schedules
    - Schedule backupJob: daily at 02:00 UTC
    - Schedule activityDecayEngine: weekly
    - Schedule notificationDispatcher: hourly
    - Configure existing stallEvaluator: daily
    - Configure existing multiplierAdjuster: daily
    - _Requirements: 5.1, 13.1, 13.2, 13.3, 13.4, 13.6_

- [ ] 13. Implement AI-ready data export
  - [ ] 13.1 Create data export API endpoints
    - Create /api/export/activity-patterns endpoint
    - Create /api/export/participation-health endpoint
    - Create /api/export/ownership-distribution endpoint
    - Each endpoint returns JSON with required fields
    - Add RBAC protection (admin only)
    - _Requirements: 16.4, 16.5_
  
  - [ ] 13.2 Write property test for export structure
    - **Property 43: Export data structure**
    - **Validates: Requirements 16.4**

- [ ] 14. Final integration and testing
  - [ ] 14.1 Run full test suite
    - Execute all unit tests
    - Execute all property tests (100 iterations)
    - Execute integration tests
    - _Requirements: Testing Strategy_
  
  - [ ] 14.2 Manual testing checklist
    - Test activity submission with rate limiting
    - Test admin overrides with confirmation dialogs
    - Test dispute submission and resolution flow
    - Test monitoring dashboard displays correct metrics
    - Test analytics dashboard with filters
    - Test backup job execution
    - Test notification creation and dispatch
    - _Requirements: All_
  
  - [ ] 14.3 Update documentation
    - Document new API endpoints
    - Document admin features
    - Document background worker schedules
    - Document contribution weighting system
    - _Requirements: All_

- [ ] 15. Final checkpoint - Production readiness
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive production-ready implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical breaks
- Property tests validate universal correctness properties with 100 iterations
- Unit tests validate specific examples and edge cases
- Background workers are implemented as Appwrite functions with scheduled execution
- Security layer is implemented first to protect all subsequent features
- Testing infrastructure is set up early to enable test-driven development
