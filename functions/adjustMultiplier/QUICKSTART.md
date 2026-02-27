# Quick Start - adjustMultiplier Function

## 5-Minute Deployment

### Step 1: Install Dependencies (1 min)

```bash
cd functions/adjustMultiplier
npm install
```

### Step 2: Configure API Key (1 min)

Edit `appwrite.json` and update:

```json
"APPWRITE_API_KEY": "your_actual_api_key_here"
```

### Step 3: Deploy (2 min)

```bash
appwrite login
appwrite deploy function
```

### Step 4: Test (1 min)

```bash
appwrite functions execute --functionId [FUNCTION_ID]
```

Or via Appwrite Console:
1. Go to Functions → adjustMultiplier
2. Click "Execute Now"
3. Check execution logs

## Expected Output

```json
{
  "success": true,
  "message": "Multiplier adjustment completed successfully",
  "results": {
    "totalEvaluated": 50,
    "updated": 12,
    "skipped": 38,
    "errors": 0
  }
}
```

## Verify It Works

### Check 1: Multiplier Records Created

```javascript
// Query multipliers collection
const multipliers = await databases.listDocuments(
  'builder_circle',
  'multipliers',
  [Query.orderDesc('$createdAt'), Query.limit(5)]
);

console.log(multipliers.documents);
// Should show recent multiplier adjustments
```

### Check 2: Ledger Events Created

```javascript
// Query ownership_ledger collection
const ledger = await databases.listDocuments(
  'builder_circle',
  'ownership_ledger',
  [
    Query.equal('eventType', 'multiplier_adjustment'),
    Query.orderDesc('$createdAt'),
    Query.limit(5)
  ]
);

console.log(ledger.documents);
// Should show multiplier_adjustment events
```

### Check 3: computeOwnership Integration

```javascript
// Test ownership calculation
const ownership = await fetch(
  'https://cloud.appwrite.io/v1/functions/[COMPUTE_FUNCTION_ID]/executions',
  {
    method: 'POST',
    headers: {
      'X-Appwrite-Project': 'your_project_id',
      'X-Appwrite-Key': 'your_api_key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: 'test_user_id',
      cycleId: 'test_cycle_id'
    })
  }
);

const result = await ownership.json();
console.log(result);
// Should show multiplier being applied
```

## Schedule Daily Execution

Update `appwrite.json`:

```json
"schedule": "15 0 * * *"
```

Redeploy:

```bash
appwrite deploy function
```

## Troubleshooting

### "Missing environment variables"

→ Check all variables in `appwrite.json` are set

### "No active cycles found"

→ Ensure you have cycles with `state: "active"`

### "No multipliers updated"

→ Run `stallEvaluator` first to set stall stages

### Function timeout

→ Increase timeout in `appwrite.json`: `"timeout": 600`

## Next Steps

1. ✅ Function deployed and tested
2. ✅ Schedule daily execution
3. ✅ Monitor first few executions
4. ✅ Integrate with frontend UI
5. ✅ Set up monitoring/alerts

## Documentation

- `README.md` - Full function documentation
- `DEPLOYMENT.md` - Detailed deployment guide
- `INTEGRATION.md` - API integration examples
- `../MULTIPLIER_ADJUSTMENT_ENGINE.md` - System overview

## Support

Check function logs in Appwrite Console for detailed execution information.
