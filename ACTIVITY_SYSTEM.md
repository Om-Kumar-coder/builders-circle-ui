# Activity Submission System

Complete activity tracking and submission system for Builder's Circle.

## Overview

The Activity Submission system enables participants to:
- Submit verifiable work activities
- Track activity timeline
- Reset inactivity timers
- Maintain active participation status
- Prevent stall countdown progression

## Components Created

### Core Library (`src/lib/activity.ts`)
- `submitActivity()` - Submit new activity with validation and cooldown
- `updateParticipationActivity()` - Update participation timestamps
- `getUserCycleActivity()` - Get user activities for a cycle
- `getCycleActivity()` - Get all cycle activities (admin)
- `getLastActivity()` - Get user's most recent activity
- `getActivityCount()` - Count activities for user in cycle

### UI Components

#### `SubmitActivityForm.tsx`
- Activity type dropdown (Task, PR, Documentation, Review, Hours)
- Proof link input (required)
- Description textarea (optional)
- 30-second cooldown protection
- Success animation
- Loading states
- Error handling

#### `ActivityTimeline.tsx`
- Displays user activities for a cycle
- Auto-refreshes on new submissions
- Loading skeleton
- Empty state
- Newest first ordering

#### `ActivityItem.tsx`
- Individual activity display
- Verification status badge (pending/verified/rejected)
- Time ago formatting
- Proof link with external icon
- Activity type icons

### Hooks (`src/hooks/useActivity.ts`)
- `useActivity()` - Fetch and manage cycle activities
- `useLastActivity()` - Fetch user's last activity

## Integration Points

### Build Cycle Detail Page (`app/build-cycles/[id]/page.tsx`)
- Shows activity form only if:
  - User is participating (opted in)
  - Cycle is active
- Shows activity timeline for all participants
- Real-time updates after submission

### Dashboard (`app/dashboard/page.tsx`)
- Displays last activity timestamp
- Shows participation status
- Time ago formatting (e.g., "2h ago")

## Database Schema

### Collection: `activity_events`

```typescript
{
  $id: string;
  userId: string;           // User who submitted
  cycleId: string;          // Build cycle
  activityType: string;     // task_completed, pr_submitted, etc.
  proofLink: string;        // Required verification URL
  description?: string;     // Optional details
  verified: string;         // 'pending' | 'verified' | 'rejected'
  $createdAt: string;       // Auto-managed by Appwrite
  $updatedAt: string;       // Auto-managed by Appwrite
}
```

## Activity Types

1. **Task Completed** - General task completion
2. **PR Submitted** - Pull request submitted
3. **Documentation** - Documentation work
4. **Review Work** - Code review or feedback
5. **Hours Logged** - Time tracking entry

## Validation Rules

✅ Proof link is required
✅ 30-second cooldown between submissions
✅ Only participants can submit
✅ Only active cycles accept submissions
✅ URL validation for proof links

## Submission Flow

1. User fills out activity form
2. System validates inputs
3. Checks cooldown timer
4. Creates activity document with `verified: 'pending'`
5. Updates participation record:
   - `lastActivityDate` = now
   - `participationStatus` = 'active'
   - `stallStage` = 'none'
6. Shows success animation
7. Refreshes timeline and participation status

## Security

- Only authenticated users can submit
- Only cycle participants can submit activities
- Cooldown prevents spam
- Proof links required for verification
- Admin verification workflow ready (future)

## Future Compatibility

The system is designed to support:
- ✅ Stall evaluator reading `lastActivityDate`
- ✅ Inactivity decay using timestamps
- ✅ Admin verification workflow
- ✅ Ownership contribution approval
- ✅ Activity-based multipliers
- ✅ Automated verification via webhooks

## Environment Variables

Add to your `.env.local`:

```bash
NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID=activity_events
```

## Usage Examples

### Submit Activity
```typescript
import { submitActivity } from '@/lib/activity';

const result = await submitActivity(
  userId,
  cycleId,
  'pr_submitted',
  'https://github.com/user/repo/pull/123',
  'Added authentication feature'
);

if (result.success) {
  console.log('Activity submitted:', result.activity);
}
```

### Get User Activities
```typescript
import { getUserCycleActivity } from '@/lib/activity';

const activities = await getUserCycleActivity(userId, cycleId);
```

### Use Activity Hook
```typescript
import { useActivity } from '@/hooks/useActivity';

const { activities, loading, error, refetch } = useActivity(userId, cycleId);
```

## UI/UX Features

- ✅ Loading spinners during submission
- ✅ Success animation with checkmark
- ✅ Disabled submit while processing
- ✅ Mobile-friendly responsive layout
- ✅ Real-time UI updates
- ✅ Time ago formatting (2h ago, 3d ago)
- ✅ Empty states with helpful messages
- ✅ Error messages with retry options
- ✅ Verification status badges

## Testing

To test the activity system:

1. Join an active build cycle
2. Navigate to the cycle detail page
3. Fill out the activity submission form
4. Submit with a valid proof link
5. Verify the activity appears in the timeline
6. Check dashboard shows updated last activity
7. Try submitting again within 30 seconds (should show cooldown)

## Notes

- Activities are created with `verified: 'pending'` status
- Admin verification UI can be added later
- Proof links should point to verifiable work (GitHub, etc.)
- Messages or intent statements do NOT count as valid activity
- System automatically resets stall stage on submission
