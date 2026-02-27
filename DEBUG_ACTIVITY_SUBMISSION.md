# Debug Activity Submission Error

## The Problem

You're getting "Route not found" even though the `description` field exists in the database.

## Most Likely Cause

**The environment variable `NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID` is not loaded.**

When this variable is empty or undefined, the code tries to create a document at an invalid path, causing "Route not found".

## Quick Fix

### Step 1: Verify .env.local Exists
Check that `.env.local` file exists in your project root with this line:
```bash
NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID=activity_events
```

### Step 2: RESTART Dev Server (IMPORTANT!)
```bash
# Stop your dev server completely (Ctrl+C)
# Then start it again:
npm run dev
```

**Environment variables are only loaded when the server starts!**

### Step 3: Verify in Browser Console
1. Open your app
2. Press F12 to open browser console
3. Type this and press Enter:
```javascript
console.log(process.env.NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID)
```

**Expected output:** `"activity_events"`
**If you see:** `undefined` → Environment variable not loaded, restart server

### Step 4: Check for Typos
Open `.env.local` and verify the exact line:
```bash
NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID=activity_events
```

Common mistakes:
- ❌ Extra spaces: `NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID = activity_events`
- ❌ Wrong name: `NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLLECTION_ID`
- ❌ Missing NEXT_PUBLIC prefix
- ❌ Quotes around value: `"activity_events"` (should be without quotes)

---

## Alternative Debugging

### Check What's Being Sent

Add this temporary debug code to see what's happening:

**File:** `src/lib/activity.ts`

Find this line (around line 52):
```typescript
const activity = await databases.createDocument(
  DATABASE_ID,
  ACTIVITY_COLLECTION_ID,
  ID.unique(),
```

Add console.log BEFORE it:
```typescript
console.log('DEBUG - Database ID:', DATABASE_ID);
console.log('DEBUG - Activity Collection ID:', ACTIVITY_COLLECTION_ID);
console.log('DEBUG - Data:', { userId, cycleId, activityType, proofLink });

const activity = await databases.createDocument(
  DATABASE_ID,
  ACTIVITY_COLLECTION_ID,
  ID.unique(),
```

Then check browser console when you submit. You should see:
```
DEBUG - Database ID: builder_circle
DEBUG - Activity Collection ID: activity_events
DEBUG - Data: { userId: "...", cycleId: "...", ... }
```

If `Activity Collection ID` shows empty string `""`, that's your problem!

---

## Other Possible Issues

### 1. Collection Permissions
Go to Appwrite Console → activity_events → Settings → Permissions

**Create permission must include:**
- Role: Any
- OR Role: Users

If missing, add it:
1. Click "Add Role"
2. Select "Any" or "Users"
3. Check "Create"
4. Click "Update"

### 2. Wrong Collection ID in Database
Verify the collection ID is exactly `activity_events` (not `activity_event` or something else)

In Appwrite Console, the collection ID should show as `activity_events` in the URL:
```
https://cloud.appwrite.io/console/project-.../database/builder_circle/collection/activity_events
```

### 3. API Endpoint Issue
Verify in `.env.local`:
```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
```

Not:
- ❌ `https://cloud.appwrite.io` (missing /v1)
- ❌ `https://cloud.appwrite.io/v1/` (extra slash)

---

## Complete .env.local Check

Your `.env.local` should have these lines:

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=69948407003ab1a59d8d
NEXT_PUBLIC_APPWRITE_DATABASE_ID=builder_circle
NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID=activity_events
```

**No spaces around the `=` sign!**

---

## Test After Fix

1. Restart dev server
2. Clear browser cache (Ctrl+Shift+Delete)
3. Hard refresh page (Ctrl+F5)
4. Open browser console (F12)
5. Try submitting activity
6. Check console for any errors

---

## If Still Not Working

Share the output from browser console (F12) when you click submit. Look for:
- The actual error message
- Network tab → Failed request → Response
- Console tab → Any red errors

The actual error message will tell us exactly what's wrong.
