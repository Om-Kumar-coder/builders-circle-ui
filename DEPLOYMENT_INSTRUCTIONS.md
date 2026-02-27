# Deployment Instructions - Fix Activity Submission Issues

## Problem Summary
Your app is experiencing "Route not found" errors when submitting activities. This is likely due to:
1. Environment variables not being loaded properly in the browser
2. Possible SDK compatibility issues
3. stallEvaluator function timing out

## Quick Diagnosis

### Step 1: Test Environment Variables
1. Start your dev server: `npm run dev`
2. Open your browser and go to: `http://localhost:3000/api/test-env`
3. Check the JSON response:
   - If `success: true` → Environment variables are loaded correctly
   - If `success: false` → Some variables are missing

### Step 2: Check Browser Console
1. Open your app in the browser
2. Press F12 to open DevTools
3. Go to Console tab
4. Type and run:
```javascript
console.log({
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
  activityCollectionId: process.env.NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID
});
```

If any values show as `undefined`, your environment variables aren't being loaded.

## Solution Steps

### 1. Verify .env.local File
Make sure your `.env.local` file has these exact lines (no extra spaces):

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=69948407003ab1a59d8d
NEXT_PUBLIC_APPWRITE_DATABASE_ID=builder_circle
NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID=activity_events
NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID=build_cycles
NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID=cycle_participation
```

### 2. Restart Development Server (CRITICAL!)
```bash
# Stop the server completely (Ctrl+C)
# Then start it again:
npm run dev
```

**Important:** Environment variables are only loaded when the server starts!

### 3. Clear Browser Cache
- Press Ctrl+Shift+Delete
- Clear cached images and files
- Hard refresh: Ctrl+F5

### 4: Check Appwrite Collection Permissions
1. Go to https://cloud.appwrite.io/console
2. Navigate to: Database → builder_circle → activity_events
3. Click Settings → Permissions
4. Ensure these permissions exist:
   - Role: "Any" or "Users" with "Create" permission checked
   - If missing, click "Add Role" → Select "Any" → Check "Create" → Update

### 5. Test Activity Submission
1. Go to a build cycle in your app
2. Try submitting an activity with a valid proof link
3. Check browser console (F12) for any errors

## Deploy stallEvaluator Function

The function is timing out because it needs to be redeployed with updated dependencies.

### Option A: Using Appwrite CLI (Recommended)
```bash
cd functions/stallEvaluator
npm install
appwrite deploy function
```

### Option B: Manual Deployment
1. Go to Appwrite Console → Functions → stallEvaluator
2. Click "Create Deployment"
3. Upload the entire `functions/stallEvaluator` folder
4. Wait for deployment to complete (2-3 minutes)
5. Test by clicking "Execute" in the Executions tab

## Common Issues & Fixes

### Issue: "Route not found" Error
**Cause:** Environment variables not loaded or incorrect collection ID

**Fix:**
1. Verify `.env.local` has correct values
2. Restart dev server
3. Check `/api/test-env` endpoint
4. Verify collection ID in Appwrite Console matches `activity_events`

### Issue: "Permission denied" Error
**Cause:** Collection doesn't have proper permissions

**Fix:**
1. Go to Appwrite Console → activity_events → Settings → Permissions
2. Add "Any" role with "Create" permission
3. Or add "Users" role with "Create" permission

### Issue: stallEvaluator Times Out
**Cause:** Function needs redeployment with updated dependencies

**Fix:**
1. Redeploy the function (see steps above)
2. Check function logs in Appwrite Console
3. Verify environment variables are set in function settings

### Issue: Variables Show as Undefined in Browser
**Cause:** Next.js only exposes variables prefixed with `NEXT_PUBLIC_`

**Fix:**
- All client-side variables MUST start with `NEXT_PUBLIC_`
- Server-side variables (like `APPWRITE_API_KEY`) don't need the prefix
- Restart dev server after adding/changing variables

## Debugging Tips

### Add Temporary Logging
In `src/lib/activity.ts`, add this before the `createDocument` call:

```typescript
console.log('DEBUG - Submitting activity:', {
  DATABASE_ID,
  ACTIVITY_COLLECTION_ID,
  userId,
  cycleId,
  activityType,
  proofLink
});
```

This will show you exactly what values are being used.

### Check Network Tab
1. Open DevTools (F12) → Network tab
2. Try submitting an activity
3. Look for failed requests (red)
4. Click on the failed request
5. Check the "Response" tab for detailed error message

## Expected Results After Fix

- Activity submission works without errors
- Activities appear in the timeline immediately
- Participation status updates to "active"
- stallEvaluator function completes successfully (status 200)
- No timeout errors in function logs

## Still Having Issues?

If problems persist after following all steps:

1. Share the output from `/api/test-env`
2. Share browser console errors (F12 → Console tab)
3. Share Network tab response for failed requests
4. Check Appwrite Console → Database → activity_events → Documents to see if any documents were created
