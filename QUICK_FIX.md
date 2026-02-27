# Quick Fix for Activity Submission Error

## The Problem
"Route not found" error when submitting activities.

## Most Likely Cause
Environment variables aren't loaded in the browser.

## Quick Fix (3 Steps)

### 1. Test Environment Variables
Open in browser: `http://localhost:3000/api/test-env`

If you see `success: false`, continue to step 2.

### 2. Restart Dev Server
```bash
# Press Ctrl+C to stop
npm run dev
```

### 3. Clear Browser Cache & Test
- Press Ctrl+Shift+Delete → Clear cache
- Press Ctrl+F5 to hard refresh
- Try submitting an activity again

## If Still Not Working

### Check Collection Permissions
1. Go to: https://cloud.appwrite.io/console
2. Navigate to: Database → builder_circle → activity_events
3. Settings → Permissions
4. Add "Any" role with "Create" permission if missing

### Deploy stallEvaluator Function
```bash
cd functions/stallEvaluator
npm install
# Then deploy via Appwrite Console or CLI
```

## Need More Help?
See `DEPLOYMENT_INSTRUCTIONS.md` for detailed troubleshooting.
