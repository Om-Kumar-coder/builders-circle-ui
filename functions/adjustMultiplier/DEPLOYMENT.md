# Deployment Guide - adjustMultiplier Function

## Prerequisites

- Appwrite CLI installed (`npm install -g appwrite-cli`)
- Appwrite project access
- API key with appropriate permissions

## Step 1: Install Dependencies

```bash
cd functions/adjustMultiplier
npm install
```

## Step 2: Verify Configuration

Check `appwrite.json` contains correct values:

```json
{
  "projectId": "69948407003ab1a59d8d",
  "projectName": "Builder's Circle",
  "functions": [{
    "name": "adjustMultiplier",
    "runtime": "node-22",
    "variables": {
      "APPWRITE_ENDPOINT": "https://cloud.appwrite.io/v1",
      "APPWRITE_PROJECT_ID": "69948407003ab1a59d8d",
      "APPWRITE_API_KEY": "your_api_key_here",
      "APPWRITE_DATABASE_ID": "builder_circle",
      "PARTICIPATION_COLLECTION_ID": "cycle_participation",
      "MULTIPLIERS_COLLECTION_ID": "multipliers",
      "LEDGER_COLLECTION_ID": "ownership_ledger",
      "CYCLES_COLLECTION_ID": "build_cycles"
    }
  }]
}
```

## Step 3: Deploy Function

### Option A: Using Appwrite CLI

```bash
# Login to Appwrite
appwrite login

# Deploy function
appwrite deploy function
```

### Option B: Manual Deployment via Console

1. Go to Appwrite Console → Functions
2. Click "Create Function"
3. Configure:
   - Name: `adjustMultiplier`
   - Runtime: `Node.js 22`
   - Entrypoint: `src/main.js`
   - Build Commands: `npm install`
4. Upload function code (zip the folder)
5. Add environment variables from `appwrite.json`
6. Enable function

## Step 4: Verify Deployment

Test the function:

```bash
# Via CLI
appwrite functions execute --functionId [FUNCTION_ID]

# Via API
curl -X POST \
  https://cloud.appwrite.io/v1/functions/[FUNCTION_ID]/executions \
  -H "X-Appwrite-Project: 69948407003ab1a59d8d" \
  -H "X-Appwrite-Key: [API_KEY]"
```

## Step 5: Configure Execution Trigger

### Option A: Manual Trigger
Leave schedule empty - call via API when needed

### Option B: Scheduled Execution
Run after stallEvaluator (e.g., daily at 00:15):

```json
"schedule": "15 0 * * *"
```

### Option C: Event Trigger (Future)
Trigger on participation updates:

```json
"events": [
  "databases.builder_circle.collections.cycle_participation.documents.*.update"
]
```

## Step 6: Monitor Execution

Check function logs in Appwrite Console:

1. Navigate to Functions → adjustMultiplier
2. Click "Executions" tab
3. Review logs for each execution

Expected log output:

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

## Integration with Existing Functions

### Execution Order

1. **stallEvaluator** (daily at 00:00)
   - Updates stall stages based on inactivity
   
2. **adjustMultiplier** (daily at 00:15 or on-demand)
   - Adjusts multipliers based on new stages
   
3. **computeOwnership** (on-demand)
   - Calculates effective ownership using latest multipliers

### API Integration

Call from your application:

```javascript
const response = await fetch(
  `https://cloud.appwrite.io/v1/functions/${functionId}/executions`,
  {
    method: 'POST',
    headers: {
      'X-Appwrite-Project': projectId,
      'X-Appwrite-Key': apiKey,
    }
  }
);

const result = await response.json();
console.log(result);
```

## Troubleshooting

### Function Fails to Start

- Verify all environment variables are set
- Check API key has database read/write permissions
- Ensure Node.js 22 runtime is available

### No Multipliers Updated

- Verify stallEvaluator ran first
- Check participants are opted in
- Confirm cycles are in "active" state
- Review logs for skip reasons

### Database Errors

- Verify collection IDs match your database
- Check API key permissions
- Ensure collections have correct schema

## Rollback Procedure

If issues occur:

1. Disable function in Appwrite Console
2. Review execution logs
3. Fix issues in code
4. Redeploy function
5. Re-enable function

## Performance Considerations

- Function processes up to 1000 participants per execution
- Timeout set to 300 seconds (5 minutes)
- For larger datasets, consider pagination or batch processing

## Security Notes

- API key stored in environment variables (encrypted by Appwrite)
- Function has no public execute permissions
- All database operations use server-side SDK
- Audit trail maintained in ledger for compliance
