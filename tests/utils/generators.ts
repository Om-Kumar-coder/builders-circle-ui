import * as fc from 'fast-check';

/**
 * Property-based test generators for Builder's Circle
 * Feature: production-enhancements
 */

// User ID generator
export const userIdArb = () => fc.string({ minLength: 20, maxLength: 36 });

// Cycle ID generator
export const cycleIdArb = () => fc.string({ minLength: 20, maxLength: 36 });

// Activity ID generator
export const activityIdArb = () => fc.string({ minLength: 20, maxLength: 36 });

// URL generator - valid URLs
export const validUrlArb = () => fc.webUrl();

// URL generator - invalid URLs
export const invalidUrlArb = () => 
  fc.string().filter(s => !s.match(/^https?:\/\/.+/));

// Description generator - valid length (10-2000 chars)
export const validDescriptionArb = () => 
  fc.string({ minLength: 10, maxLength: 2000 });

// Description generator - invalid length
export const invalidDescriptionArb = () => 
  fc.oneof(
    fc.string({ maxLength: 9 }),
    fc.string({ minLength: 2001, maxLength: 3000 })
  );

// HTML content generator
export const htmlContentArb = () => 
  fc.string().map(s => `<script>alert('xss')</script>${s}<div>${s}</div>`);

// Ownership amount generator - valid (positive, max 2 decimals)
export const validOwnershipArb = () => 
  fc.double({ min: 0.01, max: 10000, noNaN: true })
    .map(n => Math.round(n * 100) / 100);

// Ownership amount generator - invalid
export const invalidOwnershipArb = () => 
  fc.oneof(
    fc.double({ max: 0 }), // negative
    fc.double({ min: 0.001, max: 10 }).map(n => n + 0.001) // too many decimals
  );

// Contribution type generator
export const contributionTypeArb = () => 
  fc.constantFrom('code', 'documentation', 'review', 'hours_logged');

// Invalid contribution type generator
export const invalidContributionTypeArb = () => 
  fc.string().filter(s => !['code', 'documentation', 'review', 'hours_logged'].includes(s));

// Base reward generator
export const baseRewardArb = () => 
  fc.double({ min: 0.01, max: 1000, noNaN: true });

// Timestamp generator
export const timestampArb = () => 
  fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

// Date range generator
export const dateRangeArb = () => 
  fc.tuple(timestampArb(), timestampArb())
    .map(([d1, d2]) => d1 < d2 ? { start: d1, end: d2 } : { start: d2, end: d1 });

// Stall stage generator
export const stallStageArb = () => 
  fc.constantFrom('none', 'grace', 'active', 'at_risk', 'diminishing', 'paused');

// User role generator
export const userRoleArb = () => 
  fc.constantFrom('founder', 'admin', 'contributor', 'employee', 'observer');

// Admin role generator (only admin/founder)
export const adminRoleArb = () => 
  fc.constantFrom('founder', 'admin');

// Non-admin role generator
export const nonAdminRoleArb = () => 
  fc.constantFrom('contributor', 'employee', 'observer');

// Admin route generator
export const adminRouteArb = () => 
  fc.constantFrom('/admin', '/admin/audit', '/admin/settings', '/admin/monitoring', '/admin/disputes');

// Severity level generator
export const severityArb = () => 
  fc.constantFrom('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL');

// Dispute status generator
export const disputeStatusArb = () => 
  fc.constantFrom('pending', 'approved', 'denied');

// Notification type generator
export const notificationTypeArb = () => 
  fc.constantFrom('stall_change', 'activity_status', 'dispute_resolved');

// Activity submission sequence generator (for rate limiting tests)
export const activitySubmissionSequenceArb = (maxCount: number = 15) => 
  fc.array(
    fc.record({
      timestamp: fc.integer({ min: 0, max: 7200000 }), // 0-2 hours in ms
      userId: userIdArb(),
      cycleId: cycleIdArb()
    }),
    { minLength: 1, maxLength: maxCount }
  );

// Backup filename generator
export const backupFilenameArb = () => 
  fc.date().map(d => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');
    return `backup_${year}${month}${day}_${hour}${minute}${second}.json.gz`;
  });
