# Activity System Setup Guide

Quick setup guide for the Activity Submission system.

## 1. Environment Variables

Add to your `.env.local` file:

```bash
NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID=activity_events
```

## 2. Database Setup

Ensure your Appwrite `activity_events` collection has these attributes:

| Attribute | Type | Size | Required | Default |
|-----------|------|------|----------|---------|
| userId | string | 999 | Yes | - |
| cycleId | string | 999 | Yes | - |
| activityType | string | 999 | Yes | - |
| proofLink | string | 9999 | Yes | - |
| description | string | 9999 | No | - |
| verified | string | 999 | Yes | 'pending' |

System fields (auto-managed):
- `$id` - Document ID
- `$createdAt` - Creation timestamp
- `$updatedAt` - Update timestamp

## 3. Collection Permissions

Set these permissions on `activity_events`:

**Create:**
- Any authenticated user (they can only create their own activities)

**Read:**
- Any authenticated user (to view activities)

**Update:**
- Admin role only (for verification)

**Delete:**
- Admin role only

## 4. Indexes (Optional but Recommended)

Create these indexes for better performance:

1. **userId_cycleId_index**
   - Attributes: `userId`, `cycleId`
   - Type: Key
   - Order: ASC, ASC

2. **cycleId_created_index**
   - Attributes: `cycleId`, `$createdAt`
   - Type: Key
   - Order: ASC, DESC

3. **userId_created_index**
   - Attributes: `userId`, `$createdAt`
   - Type: Key
   - Order: ASC, DESC

## 5. Test the System

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to an active build cycle

3. Join the cycle if not already participating

4. Submit a test activity:
   - Activity Type: Task Completed
   - Proof Link: https://github.com/test/repo/pull/1
   - Description: Test activity submission

5. Verify:
   - Activity appears in timeline
   - Last activity updates on dashboard
   - Participation status changes to "active"
   - Stall stage resets to "none"

## 6. Troubleshooting

### "Unknown attribute" errors
- Verify collection attribute names match exactly
- Check that you're not setting `createdAt` manually (use `$createdAt`)

### Activities not appearing
- Check browser console for errors
- Verify `NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID` is set
- Confirm collection permissions allow reads

### Cooldown not working
- Cooldown is in-memory and resets on page reload
- This is intentional for development
- For production, implement server-side cooldown

### Participation not updating
- Verify `NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID` is set
- Check that participation record exists for user/cycle
- Confirm update permissions on participation collection

## 7. Next Steps

After basic setup works:

1. **Add Admin Verification UI**
   - Create admin page to review pending activities
   - Add approve/reject buttons
   - Update `verified` field

2. **Implement Activity Notifications**
   - Notify users when activities are verified/rejected
   - Add email/push notifications

3. **Add Activity Analytics**
   - Track activity trends
   - Show activity heatmaps
   - Generate participation reports

4. **Enhance Validation**
   - Validate proof link domains (GitHub, GitLab, etc.)
   - Check for duplicate proof links
   - Implement server-side cooldown

5. **Add Activity Types**
   - Custom activity types per cycle
   - Activity type icons and colors
   - Activity type multipliers

## Files Created

```
src/
├── lib/
│   └── activity.ts                          # Core activity functions
├── components/
│   └── activity/
│       ├── SubmitActivityForm.tsx           # Activity submission form
│       ├── ActivityTimeline.tsx             # Activity list display
│       └── ActivityItem.tsx                 # Individual activity card
└── hooks/
    └── useActivity.ts                       # Activity React hooks

app/
└── build-cycles/
    └── [id]/
        └── page.tsx                         # Updated with activity integration

.env.example                                 # Environment variables template
ACTIVITY_SYSTEM.md                           # Complete system documentation
ACTIVITY_SETUP.md                            # This setup guide
```

## Support

For issues or questions:
1. Check `ACTIVITY_SYSTEM.md` for detailed documentation
2. Review Appwrite console for collection setup
3. Check browser console for client-side errors
4. Review Appwrite logs for server-side errors
