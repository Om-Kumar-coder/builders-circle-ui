# Activity Verification & Work Logging System

This document describes the implementation of the Activity Verification & Work Logging system for the Builder's Circle platform.

## 🎯 System Overview

The Activity Verification system adds a governance layer that:
- Allows contributors to submit work with proof
- Requires admin verification before ownership rewards
- Supports hour logging and work tracking
- Prevents self-verification and abuse
- Maintains audit transparency

## 🧩 Key Features

### Activity Submission
- **Enhanced Form**: New submission form with hour logging, work summary, and task references
- **Multiple Types**: Support for code, documentation, review, meetings, research, and task completion
- **Proof Requirements**: All activities must include verifiable proof links
- **Anti-Abuse**: Daily limits (10 activities, 12 hours) and cooldown periods

### Admin Verification
- **Review Interface**: Dedicated admin page at `/admin/activity-review`
- **Verification Actions**: Approve, reject, or request changes
- **Ownership Calculation**: Automatic calculation based on contribution type and hours
- **Self-Verification Prevention**: Admins cannot verify their own activities

### Work Hour Tracking
- **Hour Logging**: Optional hour tracking for all activities
- **Summary Dashboard**: Visual breakdown of total, verified, pending, and rejected hours
- **Progress Tracking**: Real-time verification progress indicators

### Status Management
- **Four States**: `pending`, `verified`, `rejected`, `changes_requested`
- **Detailed Feedback**: Rejection reasons and change requests
- **Audit Trail**: Complete verification history with timestamps

## 📊 Database Schema Changes

### ActivityEvent Model Updates
```prisma
model ActivityEvent {
  // New fields added:
  hoursLogged         Float?    // Hours worked on this activity
  workSummary         String?   // Summary of work done
  taskReference       String?   // Reference to task/issue
  status              String    @default("pending") // New status field
  verifiedBy          String?   // Admin who verified
  verifiedAt          DateTime? // When verification happened
  rejectionReason     String?   // Reason for rejection
  updatedAt           DateTime  @updatedAt // Track updates
  
  // Relations
  verifier   User? @relation("ActivityVerifier", fields: [verifiedBy], references: [id])
}
```

### User Model Updates
```prisma
model User {
  // New relation added:
  verifiedActivities   ActivityEvent[] @relation("ActivityVerifier")
}
```

## 🔧 API Endpoints

### New Endpoints
- `GET /api/activities/pending` - Get pending activities for admin review
- `PATCH /api/activities/:id/verify` - Verify an activity (admin only)

### Updated Endpoints
- `POST /api/activities` - Enhanced with new fields and validation
- `GET /api/activities` - Returns activities with verification info

## 🎨 Frontend Components

### New Components
- `ActivityReviewPage` - Admin interface for reviewing activities
- `WorkHoursSummary` - Dashboard showing hour tracking statistics
- Enhanced `SubmitActivityForm` - Form with hour logging and detailed fields
- Updated `ActivityItem` - Shows verification status and details

### Updated Pages
- `/admin/activity-review` - New admin review interface
- `/activity` - Enhanced with work hours summary and new filters
- `/admin` - Updated with navigation to activity review

## 🏗️ Contribution Weighting System

Different activity types have different base weights:

```typescript
const CONTRIBUTION_WEIGHTS = {
  code: 1.0,              // Full weight for code contributions
  documentation: 0.6,     // 60% weight for documentation
  review: 0.5,            // 50% weight for code reviews
  hours_logged: 0.4,      // 40% weight for general hour logging
  research: 0.5,          // 50% weight for research activities
  meeting: 0.2,           // 20% weight for meetings
  task_completion: 0.8,   // 80% weight for task completion
};
```

### Ownership Calculation Formula
```
ownership = baseReward × contributionWeight × hoursFactor
```

Where:
- `baseReward` = 0.1 (configurable)
- `contributionWeight` = type-specific weight from table above
- `hoursFactor` = min(hoursLogged / 4, 2) // Caps at 2x for 4+ hours

## 🛡️ Anti-Abuse Measures

### Daily Limits
- Maximum 10 activities per day per user
- Maximum 12 hours logged per day per user
- 1-minute cooldown between submissions

### Verification Rules
- Admins cannot verify their own activities
- All verifications create audit trail entries
- Rejection requires reason/explanation
- Ownership only awarded after verification

### Validation
- Proof links must be valid URLs
- Hours must be between 0.1 and 12
- All required fields validated on submission

## 📋 Admin Workflow

### Activity Review Process
1. Admin navigates to `/admin/activity-review`
2. Views list of pending activities with details:
   - Contributor information
   - Activity type and hours logged
   - Work summary and proof link
   - Calculated potential ownership reward
3. Admin can:
   - **Approve**: Verify activity and award ownership
   - **Reject**: Reject with reason, no ownership awarded
   - **Request Changes**: Ask for modifications before re-review

### Verification Actions
- **Approve**: Sets status to `verified`, creates ownership ledger entry
- **Reject**: Sets status to `rejected`, records rejection reason
- **Request Changes**: Sets status to `changes_requested`, allows resubmission

## 🔍 Audit & Transparency

### Audit Trail
Every verification action creates an audit log entry with:
- Admin who performed the action
- Target user and activity
- Previous and new values
- Reason for the action
- Timestamp

### Notifications
Users receive notifications when their activities are:
- Verified (with ownership amount)
- Rejected (with reason)
- Require changes (with details)

## 🚀 Installation & Setup

### 1. Database Migration
Run the migration script to update your database schema:

**Windows:**
```bash
migrate-activity-verification.bat
```

**Linux/Mac:**
```bash
chmod +x migrate-activity-verification.sh
./migrate-activity-verification.sh
```

### 2. Backend Setup
The backend routes are automatically updated. Ensure your server is running:

```bash
cd backend
npm run dev
```

### 3. Frontend Setup
The frontend components are ready to use. Start the Next.js development server:

```bash
npm run dev
```

### 4. Admin Access
Ensure you have admin privileges:
1. Update your user profile role to `admin` or `founder`
2. Navigate to `/admin/activity-review` to start reviewing activities

## 📈 Usage Examples

### Submitting an Activity
1. Navigate to `/activity`
2. Click "Submit Activity"
3. Fill in the enhanced form:
   - Select contribution type
   - Enter activity description
   - Log hours worked (optional)
   - Provide work summary
   - Add task reference
   - Include proof link
4. Submit for review

### Admin Review
1. Navigate to `/admin/activity-review`
2. Review pending activities
3. For each activity:
   - Check proof link
   - Verify work quality
   - Approve, reject, or request changes
4. System automatically handles ownership rewards

### Tracking Progress
1. View work hours summary on activity page
2. Monitor verification status of submissions
3. Check ownership earnings in dashboard

## 🔧 Configuration

### Contribution Weights
Update `CONTRIBUTION_WEIGHTS` in `src/types/activity.ts` to adjust reward multipliers.

### Daily Limits
Modify `ACTIVITY_LIMITS` in `src/types/activity.ts` to change submission limits.

### Ownership Calculation
Adjust the base reward and formula in the verification endpoint (`backend/src/routes/activities.ts`).

## 🐛 Troubleshooting

### Common Issues

**Activities not appearing for review:**
- Check user has admin/founder role
- Verify activities have `pending` status
- Check backend logs for API errors

**Ownership not being awarded:**
- Ensure activity is verified (not just approved)
- Check ownership ledger for entries
- Verify calculation logic in backend

**Form validation errors:**
- Check proof link is valid URL
- Ensure hours are within limits (0.1-12)
- Verify all required fields are filled

### Debug Mode
Enable debug logging by setting environment variables:
```bash
DEBUG=true
LOG_LEVEL=debug
```

## 🔮 Future Enhancements

Potential improvements for future versions:
- Batch verification for multiple activities
- Custom contribution weights per cycle
- Integration with external project management tools
- Automated verification for certain activity types
- Advanced analytics and reporting
- Mobile app support for activity submission

## 📞 Support

For issues or questions about the Activity Verification system:
1. Check the troubleshooting section above
2. Review the audit logs for verification issues
3. Ensure database schema is up to date
4. Check that all required environment variables are set

The system is designed to be robust and user-friendly while maintaining the integrity of the ownership tracking system.