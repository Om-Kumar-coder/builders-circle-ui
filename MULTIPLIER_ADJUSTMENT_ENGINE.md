# Multiplier Adjustment Engine - Implementation Summary

## Overview

The Multiplier Adjustment Engine is a production-ready Appwrite Function that automatically adjusts participant ownership multipliers based on activity levels in Builder's Circle.

## What Was Built

### Core Function: `adjustMultiplier`

Location: `functions/adjustMultiplier/`

**Purpose**: Automatically adjust participation multipliers when stall stages change, maintaining complete audit transparency.

**Key Features**:
- ✅ Deterministic multiplier calculation based on stall stage
- ✅ Complete audit trail in ownership ledger
- ✅ Idempotent and safe to run multiple times
- ✅ Error handling and logging
- ✅ Integration with existing ownership system
- ✅ No reduction of vested ownership

## Multiplier Rules

| Stall Stage | Multiplier | Impact |
|-------------|-----------|---------|
| `active` | 1.0 | Full ownership influence |
| `at_risk` | 0.75 | 25% reduction |
| `diminishing` | 0.5 | 50% reduction |
| `paused` | 0.0 | No influence |

## System Integration

```
Daily Automation Flow:
┌─────────────────────────────────────────────────────────┐
│ 1. stallEvaluator (00:00)                               │
│    - Evaluates participant inactivity                   │
│    - Updates stallStage in cycle_participation          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 2. adjustMultiplier (00:15 or on-demand)                │
│    - Reads stallStage changes                           │
│    - Creates multiplier records                         │
│    - Logs ledger events for audit                       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 3. computeOwnership (on-demand)                         │
│    - Fetches latest multiplier                          │
│    - Calculates: effectiveOwnership = total × multiplier│
└─────────────────────────────────────────────────────────┘
```

## Files Created

```
functions/adjustMultiplier/
├── src/
│   └── main.js                 # Core function logic
├── appwrite.json               # Function configuration
├── package.json                # Dependencies
├── .gitignore                  # Git exclusions
├── .prettierrc.json            # Code formatting
├── test-function.js            # Local testing script
├── README.md                   # Function documentation
├── DEPLOYMENT.md               # Deployment instructions
└── INTEGRATION.md              # Integration guide
```

## Data Collections Used

### Input Collections
- `cycle_participation` - Source of stall stage data
- `build_cycles` - Active cycle filtering

### Output Collections
- `multipliers` - Stores multiplier history
- `ownership_ledger` - Audit trail of changes

## Function Logic

```javascript
For each opted-in participant in active cycles:
  1. Read current stallStage
  2. Calculate target multiplier
  3. Fetch latest multiplier record
  4. If multiplier unchanged → skip
  5. If changed:
     - Create new multiplier record
     - Create ledger event for audit
     - Log change
```

## Safety Guarantees

The function will NOT update when:
- ✅ No stage change detected
- ✅ User not opted in
- ✅ Cycle not active
- ✅ Stall stage missing or invalid

## Deployment Steps

### Quick Start

```bash
# 1. Navigate to function directory
cd functions/adjustMultiplier

# 2. Install dependencies
npm install

# 3. Update API key in appwrite.json
# Edit: variables.APPWRITE_API_KEY

# 4. Deploy to Appwrite
appwrite deploy function

# 5. Test execution
appwrite functions execute --functionId [FUNCTION_ID]
```

### Configuration

Update `appwrite.json` with your values:

```json
{
  "variables": {
    "APPWRITE_ENDPOINT": "https://cloud.appwrite.io/v1",
    "APPWRITE_PROJECT_ID": "your_project_id",
    "APPWRITE_API_KEY": "your_api_key",
    "APPWRITE_DATABASE_ID": "builder_circle",
    "PARTICIPATION_COLLECTION_ID": "cycle_participation",
    "MULTIPLIERS_COLLECTION_ID": "multipliers",
    "LEDGER_COLLECTION_ID": "ownership_ledger",
    "CYCLES_COLLECTION_ID": "build_cycles"
  }
}
```

## Execution Options

### Option 1: Scheduled (Recommended)

Run daily after stallEvaluator:

```json
"schedule": "15 0 * * *"
```

### Option 2: Manual Trigger

Call via API when needed:

```bash
curl -X POST \
  https://cloud.appwrite.io/v1/functions/[FUNCTION_ID]/executions \
  -H "X-Appwrite-Project: [PROJECT_ID]" \
  -H "X-Appwrite-Key: [API_KEY]"
```

### Option 3: Event-Driven (Future)

Trigger on participation updates:

```json
"events": [
  "databases.*.collections.cycle_participation.documents.*.update"
]
```

## Response Format

### Success

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

## Audit Trail

Every multiplier change creates:

1. **Multiplier Record** (in `multipliers` collection)
   ```javascript
   {
     userId: "user123",
     cycleId: "cycle456",
     multiplier: 0.75,
     reason: "stall stage adjustment: at_risk",
     createdAt: "2026-02-28T00:15:00.000Z"
   }
   ```

2. **Ledger Event** (in `ownership_ledger` collection)
   ```javascript
   {
     userId: "user123",
     cycleId: "cycle456",
     eventType: "multiplier_adjustment",
     ownershipAmount: 0,
     multiplierSnapshot: 0.75,
     reason: "stall stage adjustment: at_risk",
     createdAt: "2026-02-28T00:15:00.000Z"
   }
   ```

## Compatibility

### Works With Existing System

- ✅ `computeOwnership` already queries multipliers collection
- ✅ No changes needed to existing functions
- ✅ Backward compatible (defaults to 1.0 if no multiplier)
- ✅ Preserves vested ownership (ledger event type distinction)

## Future Extensions

The system is prepared for:

1. **Decay Events**: Trigger notifications when multiplier drops
2. **User Notifications**: Email/push when multiplier changes
3. **Automatic Restoration**: Restore multiplier when activity resumes
4. **Custom Rules**: Per-cycle multiplier configurations
5. **Grace Periods**: Temporary multiplier protection

## Testing

### Local Testing

```bash
cd functions/adjustMultiplier
npm test
```

Update `test-function.js` with your API key before running.

### Production Testing

1. Deploy function
2. Trigger manual execution
3. Check logs in Appwrite Console
4. Verify multiplier records created
5. Verify ledger events created
6. Test computeOwnership integration

## Monitoring

### Key Metrics

- Total participants evaluated
- Multipliers updated
- Records skipped (no change)
- Errors encountered
- Execution time

### Log Output

```
[LOG] Multiplier Adjustment Engine started
[LOG] Environment variables validated
[LOG] Appwrite client initialized
[LOG] Starting multiplier adjustment...
[LOG] Fetching active cycles...
[LOG] Found 2 active cycle(s)
[LOG] Fetching active participants...
[LOG] Found 45 active participant(s)
[LOG] Adjusted multiplier for user user123: 1 -> 0.75 (stage: at_risk)
[LOG] Adjustment complete
[LOG] Results: { totalEvaluated: 45, updated: 8, skipped: 37, errors: 0 }
```

## Documentation

- **README.md**: Function overview and usage
- **DEPLOYMENT.md**: Step-by-step deployment guide
- **INTEGRATION.md**: System integration and API examples
- **This file**: Complete implementation summary

## Support

For issues or questions:

1. Check function logs in Appwrite Console
2. Review DEPLOYMENT.md for common issues
3. Verify environment variables are correct
4. Ensure API key has proper permissions
5. Check collection IDs match your database

## Summary

The Multiplier Adjustment Engine is production-ready and provides:

✅ Automated multiplier adjustments based on activity
✅ Complete audit transparency via ledger events
✅ Safe, idempotent operation
✅ Integration with existing ownership system
✅ Comprehensive documentation and testing
✅ Future-proof architecture for extensions

Deploy and run to start automatically managing participant influence based on engagement levels.
