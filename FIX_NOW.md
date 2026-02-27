# Fix Activity Submission - Do This Now

## What I Found
Your environment variables aren't loading because of a Turbopack issue. The request shows an empty collection ID:
```
/collections//documents  ← Empty collection ID!
```

## What I Fixed
Updated `next.config.ts` to explicitly expose environment variables to the browser.

## What You Need To Do (3 Steps)

### 1. Stop Your Dev Server
Press `Ctrl+C` in your terminal

### 2. Delete the .next Cache
```bash
rmdir /s /q .next
```

### 3. Start Dev Server Again
```bash
npm run dev
```

### 4. Hard Refresh Browser
Press `Ctrl+F5` (or Ctrl+Shift+R)

## Test It Works

### Check 1: Browser Console
Open DevTools (F12) → Console tab

You should see:
```
🔍 Activity.ts Environment Check: {
  DATABASE_ID: "builder_circle",
  ACTIVITY_COLLECTION_ID: "activity_events",
  ...
}
```

If you see empty strings, the fix didn't work yet.

### Check 2: Try Submitting Activity
1. Go to a build cycle
2. Fill in the activity form
3. Submit

Should work without "Route not found" error!

### Check 3: Network Tab
Open DevTools (F12) → Network tab → Try submitting

The request URL should be:
```
/v1/databases/builder_circle/collections/activity_events/documents
```

NOT:
```
/v1/databases/builder_circle/collections//documents  ← BAD!
```

## If It Still Doesn't Work

Try the nuclear option:

```bash
# Stop server (Ctrl+C)
rmdir /s /q .next
rmdir /s /q node_modules
npm install
npm run dev
```

Then hard refresh browser (Ctrl+F5).

## Files I Modified
1. ✅ `next.config.ts` - Added explicit env vars
2. ✅ `src/lib/activity.ts` - Added debug logging
3. ✅ `app/api/test-env/route.ts` - Created test endpoint
4. ✅ `functions/stallEvaluator/package.json` - Updated SDK version

## After It Works

You can remove the debug logging from `src/lib/activity.ts` (the console.log block).
