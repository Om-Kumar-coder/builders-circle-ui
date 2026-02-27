# Multiplier Adjustment Engine

Automated multiplier adjustment function for Builder's Circle that adjusts participation multipliers based on stall stage changes.

## Overview

This Appwrite Function monitors participant stall stages and automatically adjusts their ownership multipliers according to activity levels. It creates a complete audit trail in the ownership ledger for transparency.

## Multiplier Rules

The function applies the following multiplier mapping:

| Stall Stage | Multiplier | Description |
|-------------|-----------|-------------|
| `active` | 1.0 | Full ownership influence |
| `at_risk` | 0.75 | Reduced influence (7-13 days inactive) |
| `diminishing` | 0.5 | Significantly reduced (14-20 days inactive) |
| `paused` | 0.0 | No influence (21+ days inactive) |
| `grace` | 1.0 | Initial grace period |

## Function Logic

For each opted-in participant in active cycles:

1. Read current `stallStage` from participation record
2. Determine correct multiplier based on stage
3. Fetch latest multiplier record for user/cycle
4. Skip if multiplier unchanged
5. If changed:
   - Create new multiplier record with reason
   - Create ledger event for audit trail

## Data Collections

- `cycle_participation` - Source of stall stage data
- `multipliers` - Stores multiplier history
- `ownership_ledger` - Audit trail of all changes
- `build_cycles` - Active cycle filtering

## Multiplier Record Schema

```javascript
{
  userId: string,
  cycleId: string,
  multiplier: number,
  reason: string,
  createdAt: ISO8601 timestamp
}
```

## Ledger Event Schema

```javascript
{
  userId: string,
  cycleId: string,
  eventType: "multiplier_adjustment",
  ownershipAmount: 0,
  multiplierSnapshot: number,
  reason: string,
  createdAt: ISO8601 timestamp
}
```

## Execution Flow

This function is designed to run after `stallEvaluator`:

1. `stallEvaluator` runs daily (cron: `0 0 * * *`)
2. Updates stall stages based on inactivity
3. `adjustMultiplier` can be triggered:
   - Manually via API call
   - Via scheduled execution
   - Via event trigger (future enhancement)

## Safety Rules

The function will skip updates when:

- ✅ No stage change detected
- ✅ User not opted in
- ✅ Cycle not active
- ✅ Stall stage missing

## Environment Variables

Required variables (configured in `appwrite.json`):

```
APPWRITE_ENDPOINT
APPWRITE_PROJECT_ID
APPWRITE_API_KEY
APPWRITE_DATABASE_ID
PARTICIPATION_COLLECTION_ID
MULTIPLIERS_COLLECTION_ID
LEDGER_COLLECTION_ID
CYCLES_COLLECTION_ID
```

## Error Handling

The function handles:

- Missing multiplier records (treats as first-time adjustment)
- Database connection errors
- Invalid stage values (defaults to 1.0)
- Document creation failures

All errors are logged with context for debugging.

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Multiplier adjustment completed successfully",
  "timestamp": "2026-02-28T03:30:00.000Z",
  "results": {
    "totalEvaluated": 50,
    "updated": 12,
    "skipped": 38,
    "errors": 0,
    "adjustments": [
      {
        "userId": "user123",
        "cycleId": "cycle456",
        "stallStage": "at_risk",
        "previousMultiplier": 1.0,
        "newMultiplier": 0.75
      }
    ]
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2026-02-28T03:30:00.000Z"
}
```

## Deployment

### Install Dependencies

```bash
cd functions/adjustMultiplier
npm install
```

### Deploy to Appwrite

```bash
appwrite deploy function
```

Or deploy from Appwrite Console:
1. Navigate to Functions
2. Create new function or update existing
3. Upload function code
4. Configure environment variables
5. Enable function

### Test Locally

```bash
npm test
```

Update `test-function.js` with your API key before testing.

## Integration with computeOwnership

The `computeOwnership` function automatically uses the latest multiplier when calculating effective ownership:

```javascript
effectiveOwnership = totalOwnership × latestMultiplier
```

No changes needed to `computeOwnership` - it already queries the `multipliers` collection.

## Future Extensions

The system is prepared for:

- ✅ Decay event triggers
- ✅ User notifications on multiplier changes
- ✅ Automatic multiplier restoration when activity resumes
- ✅ Custom multiplier rules per cycle
- ✅ Grace period extensions

## Audit Trail

Every multiplier change creates two records:

1. **Multiplier Record** - Historical snapshot of multiplier value
2. **Ledger Event** - Audit entry with `multiplier_adjustment` event type

This ensures complete transparency and allows reconstruction of ownership history at any point in time.

## Important Notes

- Vested ownership is never reduced (handled by ledger event types)
- Multipliers only affect provisional ownership calculations
- All changes are logged for audit compliance
- Function is idempotent - safe to run multiple times
- Skips participants with no stage changes for efficiency
