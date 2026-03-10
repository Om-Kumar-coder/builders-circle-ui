# Stall Evaluator Function

Automated stall countdown engine for Builder's Circle that monitors participant inactivity and updates stall stages.

## Overview

This Appwrite Function runs daily (via cron) to evaluate all active participants and update their stall stages based on inactivity periods.

## Stall Stage Logic

| Days Inactive | Stall Stage | Participation Status |
|---------------|-------------|---------------------|
| 0-6 days | `active` | `active` |
| 7-13 days | `at_risk` | `at-risk` |
| 14-20 days | `diminishing` | `at-risk` |
| 21+ days | `paused` | `paused` |
| No activity yet | `grace` | `grace` |

## How It Works

1. **Fetch Active Cycles** - Gets all cycles with `state: "active"`
2. **Fetch Participants** - Gets all participants with `optedIn: true` in active cycles
3. **Calculate Inactivity** - For each participant, calculates days since `lastActivityDate`
4. **Determine Stage** - Applies stall stage rules based on inactivity
5. **Update Records** - Updates `stallStage` and `participationStatus` if changed
6. **Log Results** - Returns summary of updates

## Schedule

Runs automatically every 24 hours at midnight UTC:
```
0 0 * * *
```

## Environment Variables

Required in Appwrite Function settings:

```bash
APPWRITE_ENDPOINT=http://148.230.90.1:9501/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
APPWRITE_DATABASE_ID=your_database_id
PARTICIPATION_COLLECTION_ID=cycle_participation
CYCLES_COLLECTION_ID=build_cycles
```

## API Key Permissions

The API key must have these permissions:
- Read access to `build_cycles` collection
- Read access to `cycle_participation` collection
- Write access to `cycle_participation` collection

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Stall evaluation completed successfully",
  "timestamp": "2024-01-15T00:00:00.000Z",
  "results": {
    "totalEvaluated": 50,
    "updated": 12,
    "skipped": 38,
    "errors": 0,
    "stageChanges": {
      "toActive": 3,
      "toAtRisk": 5,
      "toDiminishing": 2,
      "toPaused": 2
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-01-15T00:00:00.000Z"
}
```

## Deployment

### 1. Install Dependencies
```bash
cd functions/stallEvaluator
npm install
```

### 2. Configure Appwrite
Update `appwrite.json` with your project details:
- `projectId`
- Environment variables

### 3. Deploy Function
```bash
appwrite deploy function
```

Or use Appwrite Console:
1. Go to Functions
2. Create new function
3. Upload code
4. Set environment variables
5. Set schedule: `0 0 * * *`
6. Enable function

## Testing

### Local Test
```bash
cd functions/stallEvaluator
npm install
node test-function.js
```

Make sure to set `APPWRITE_API_KEY` in your `.env.local` file first.

### Manual Execution
You can manually trigger the function in Appwrite Console:
1. Go to Functions > stallEvaluator
2. Click "Execute Now"
3. View execution logs

## Monitoring

### Check Logs
View function execution logs in Appwrite Console:
- Functions > stallEvaluator > Executions

### Key Metrics to Monitor
- Total participants evaluated
- Number of updates made
- Stage change distribution
- Error count
- Execution time

## Error Handling

The function handles these error scenarios:
- Missing environment variables
- Database connection failures
- Invalid participant records
- Missing date fields
- Update failures

All errors are logged and the function continues processing remaining participants.

## Future Extensions

This function is designed to support:

### 1. Multiplier Adjustments
```javascript
// Add to updateParticipant function
if (newStallStage === STALL_STAGES.PAUSED) {
  await adjustMultiplier(userId, cycleId, 0.5); // 50% reduction
}
```

### 2. Decay Events Logging
```javascript
// Log to ownership_ledger
await databases.createDocument(databaseId, "ownership_ledger", ID.unique(), {
  userId: participant.userId,
  cycleId: participant.cycleId,
  eventType: "stall_decay",
  ownershipAmount: -5,
  multiplierSnapshot: 0.5,
  sourceReference: "stall_evaluator",
  createdBy: "system"
});
```

### 3. Notifications
```javascript
// Send notification when stage changes
if (newStallStage === STALL_STAGES.AT_RISK) {
  await sendNotification(participant.userId, {
    title: "Activity Required",
    message: "You're at risk of being paused. Submit activity soon!"
  });
}
```

### 4. Grace Period Logic
```javascript
// Check if user joined recently
const joinedDate = new Date(participant.$createdAt);
const daysSinceJoined = calculateDaysInactive(joinedDate);

if (daysSinceJoined < 7 && !participant.lastActivityDate) {
  // Still in grace period, skip evaluation
  continue;
}
```

## Troubleshooting

### Function not running
- Check schedule is enabled
- Verify function is enabled
- Check API key permissions

### No updates happening
- Verify active cycles exist
- Check participants have `optedIn: true`
- Verify `lastActivityDate` format

### Permission errors
- Ensure API key has correct permissions
- Check collection IDs are correct

### High error count
- Review execution logs
- Check database schema matches expected format
- Verify all required fields exist

## Security

- Function runs with server-side API key
- Users cannot directly modify stall stages
- All updates are logged
- Function has timeout protection (5 minutes)

## Performance

- Processes up to 1000 participants per execution
- Typical execution time: 5-30 seconds
- Batched database queries for efficiency
- Only updates records that changed

## Integration

This function integrates with:
- Activity submission system (resets `lastActivityDate`)
- Dashboard (displays stall stage)
- Participation tracking (updates status)
- Future: Multiplier system
- Future: Notification system
- Future: Ownership ledger

## Support

For issues:
1. Check execution logs in Appwrite Console
2. Verify environment variables
3. Test locally with `test-function.js`
4. Review database schema
