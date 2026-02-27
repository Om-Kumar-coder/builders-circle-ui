# Stall Evaluator Deployment Guide

Step-by-step guide to deploy the Stall Evaluator function to Appwrite.

## Prerequisites

- Appwrite project set up
- Appwrite CLI installed (`npm install -g appwrite-cli`)
- Database and collections created
- Admin access to Appwrite Console

## Step 1: Create API Key

1. Go to Appwrite Console
2. Navigate to your project
3. Go to **Settings** > **API Keys**
4. Click **Add API Key**
5. Configure:
   - **Name**: `Stall Evaluator Function`
   - **Expiration**: Never (or set appropriate date)
   - **Scopes**: Select these permissions:
     - `databases.read`
     - `databases.write`
     - `collections.read`
     - `documents.read`
     - `documents.write`
6. Click **Create**
7. **Copy the API key** (you won't see it again!)

## Step 2: Install Dependencies

```bash
cd functions/stallEvaluator
npm install
```

## Step 3: Configure Function

### Option A: Using Appwrite Console (Recommended)

1. Go to **Functions** in Appwrite Console
2. Click **Add Function**
3. Configure:
   - **Name**: `stallEvaluator`
   - **Runtime**: `Node.js 18.0`
   - **Entrypoint**: `src/main.js`
   - **Build Commands**: `npm install`
   - **Execute Access**: Leave empty (function runs automatically)
   - **Events**: Leave empty
   - **Schedule**: `0 0 * * *` (daily at midnight UTC)
   - **Timeout**: `300` seconds (5 minutes)
   - **Enabled**: ✓ Check this box

4. Click **Create**

5. Go to **Settings** tab and add **Environment Variables**:
   ```
   APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   APPWRITE_PROJECT_ID=your_project_id
   APPWRITE_API_KEY=your_api_key_from_step_1
   APPWRITE_DATABASE_ID=your_database_id
   PARTICIPATION_COLLECTION_ID=cycle_participation
   CYCLES_COLLECTION_ID=build_cycles
   ```

6. Go to **Code** tab
7. Upload your function code:
   - Zip the `src` folder and `package.json`
   - Or use Git integration
   - Or use Appwrite CLI (see Option B)

### Option B: Using Appwrite CLI

1. Login to Appwrite CLI:
   ```bash
   appwrite login
   ```

2. Initialize project (if not already done):
   ```bash
   appwrite init project
   ```

3. Update `appwrite.json` with your project details:
   ```json
   {
     "projectId": "your_project_id",
     "projectName": "Builder's Circle",
     "functions": [
       {
         "name": "stallEvaluator",
         "runtime": "node-18.0",
         "execute": [],
         "events": [],
         "schedule": "0 0 * * *",
         "timeout": 300,
         "enabled": true,
         "logging": true,
         "entrypoint": "src/main.js",
         "commands": "npm install",
         "path": "functions/stallEvaluator",
         "variables": {
           "APPWRITE_ENDPOINT": "https://cloud.appwrite.io/v1",
           "APPWRITE_PROJECT_ID": "your_project_id",
           "APPWRITE_API_KEY": "your_api_key_from_step_1",
           "APPWRITE_DATABASE_ID": "your_database_id",
           "PARTICIPATION_COLLECTION_ID": "cycle_participation",
           "CYCLES_COLLECTION_ID": "build_cycles"
         }
       }
     ]
   }
   ```

4. Deploy function:
   ```bash
   appwrite deploy function
   ```

5. Select `stallEvaluator` when prompted

## Step 4: Verify Deployment

1. Go to **Functions** > **stallEvaluator** in Appwrite Console
2. Check **Status**: Should show "Ready"
3. Check **Schedule**: Should show `0 0 * * *`
4. Check **Environment Variables**: All should be set

## Step 5: Test Function

### Manual Test Execution

1. In Appwrite Console, go to **Functions** > **stallEvaluator**
2. Click **Execute Now**
3. Wait for execution to complete
4. Check **Executions** tab for results
5. Review logs for any errors

### Expected Output

```json
{
  "success": true,
  "message": "Stall evaluation completed successfully",
  "timestamp": "2024-01-15T12:34:56.789Z",
  "results": {
    "totalEvaluated": 10,
    "updated": 3,
    "skipped": 7,
    "errors": 0,
    "stageChanges": {
      "toActive": 1,
      "toAtRisk": 1,
      "toDiminishing": 0,
      "toPaused": 1
    }
  }
}
```

## Step 6: Monitor First Scheduled Run

1. Wait for the next scheduled execution (midnight UTC)
2. Check **Executions** tab the next day
3. Verify execution completed successfully
4. Review logs for any issues

## Troubleshooting

### Function fails to deploy
- Check Node.js version compatibility
- Verify `package.json` is valid
- Ensure `src/main.js` exists
- Check build commands

### Permission errors during execution
- Verify API key has correct scopes
- Check API key hasn't expired
- Ensure collections exist

### Function times out
- Check database has indexes on:
  - `cycle_participation.optedIn`
  - `cycle_participation.cycleId`
  - `build_cycles.state`
- Increase timeout if needed (max 900 seconds)

### No participants evaluated
- Verify active cycles exist (`state: "active"`)
- Check participants have `optedIn: true`
- Review function logs for errors

### Updates not happening
- Check API key has write permissions
- Verify collection IDs are correct
- Ensure field names match schema

## Schedule Configuration

The cron schedule `0 0 * * *` means:
- Minute: 0
- Hour: 0 (midnight)
- Day of month: * (every day)
- Month: * (every month)
- Day of week: * (every day)

### Alternative Schedules

Run every 12 hours:
```
0 */12 * * *
```

Run every 6 hours:
```
0 */6 * * *
```

Run daily at 2 AM UTC:
```
0 2 * * *
```

Run twice daily (6 AM and 6 PM UTC):
```
0 6,18 * * *
```

## Monitoring

### Set Up Alerts

1. Monitor execution failures
2. Track error rates
3. Alert on timeout issues
4. Monitor update counts

### Key Metrics

- Execution success rate
- Average execution time
- Number of participants evaluated
- Number of updates made
- Error count

### Logs to Watch

- "Stall Evaluator started" - Function began
- "Found X active cycle(s)" - Cycles detected
- "Found X active participant(s)" - Participants found
- "Updated participant..." - Stage changes
- "Evaluation complete" - Function finished

## Rollback

If you need to rollback:

1. Go to **Functions** > **stallEvaluator**
2. Go to **Deployments** tab
3. Find previous working deployment
4. Click **Activate**

Or disable the function:
1. Go to **Settings** tab
2. Uncheck **Enabled**
3. Click **Update**

## Updates

To update the function:

1. Make code changes locally
2. Test with `node test-function.js`
3. Deploy using CLI: `appwrite deploy function`
4. Or upload new code in Console
5. Monitor first execution after update

## Security Best Practices

- ✓ Use API key with minimal required permissions
- ✓ Set API key expiration date
- ✓ Rotate API keys periodically
- ✓ Don't commit API keys to version control
- ✓ Use environment variables for sensitive data
- ✓ Enable function logging for audit trail
- ✓ Monitor execution logs regularly

## Cost Considerations

- Function executions are counted toward your plan limits
- Daily execution = 30 executions/month
- Typical execution time: 5-30 seconds
- Monitor usage in Appwrite Console

## Next Steps

After successful deployment:

1. ✓ Monitor first few executions
2. ✓ Verify participant stages update correctly
3. ✓ Check dashboard displays updated stages
4. ✓ Test activity submission resets stages
5. ✓ Set up monitoring/alerts
6. ✓ Document any custom configurations

## Support

For deployment issues:
- Check Appwrite documentation: https://appwrite.io/docs/functions
- Review function logs in Console
- Test locally first with `test-function.js`
- Check Appwrite Discord/Forum for help
