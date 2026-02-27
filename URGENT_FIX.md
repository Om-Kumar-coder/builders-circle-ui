# URGENT FIX - Environment Variables Not Loading

## The Actual Problem

Your request shows the collection ID is **EMPTY**:
```
/v1/databases/builder_circle/collections//documents
                                         ^^
                                    EMPTY HERE!
```

This means `NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID` is not being loaded in the browser.

## Root Cause

You're using **Turbopack** (Next.js's new bundler), which sometimes has issues with environment variables not being properly injected into the client bundle.

## Solution (Choose One)

### Option 1: Disable Turbopack (Recommended - Fastest Fix)

**Step 1:** Update your `package.json` dev script:

```json
"scripts": {
  "dev": "next dev --turbo=false",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

**Step 2:** Stop your dev server (Ctrl+C)

**Step 3:** Delete the `.next` folder:
```bash
rmdir /s /q .next
```

**Step 4:** Start dev server:
```bash
npm run dev
```

**Step 5:** Hard refresh browser (Ctrl+F5)

### Option 2: Force Environment Variables in next.config.ts

Update `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_APPWRITE_ENDPOINT: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID: process.env.NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID,
    NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID: process.env.NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID,
    NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID: process.env.NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID,
  },
};

export default nextConfig;
```

Then:
1. Stop dev server (Ctrl+C)
2. Delete `.next` folder: `rmdir /s /q .next`
3. Start dev server: `npm run dev`
4. Hard refresh browser (Ctrl+F5)

### Option 3: Use Webpack Instead of Turbopack

Remove the turbopack config from `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed turbopack config
};

export default nextConfig;
```

Then follow the same steps: stop server, delete `.next`, restart, refresh.

## Verify the Fix

After applying any option above:

1. **Check browser console** - You should see a debug log:
   ```
   🔍 Activity.ts Environment Check: {
     DATABASE_ID: "builder_circle",
     ACTIVITY_COLLECTION_ID: "activity_events",
     ...
   }
   ```

2. **Test the API endpoint**: Visit `http://localhost:3000/api/test-env`
   - Should show `success: true`

3. **Try submitting an activity** - Should work without "Route not found" error

## Why This Happened

Turbopack is Next.js's new bundler (still in beta). It's faster but has some edge cases with environment variables, especially when:
- Variables are defined after the server starts
- The `.next` cache gets out of sync
- Hot reload doesn't properly update environment variables

## If Still Not Working

### Nuclear Option - Complete Reset

```bash
# Stop dev server (Ctrl+C)

# Delete all caches
rmdir /s /q .next
rmdir /s /q node_modules

# Reinstall
npm install

# Start fresh
npm run dev
```

### Check for Typos in .env.local

Open `.env.local` and verify **exact** spelling (no extra spaces):

```bash
NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID=activity_events
```

NOT:
- ❌ `NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID =activity_events` (space before =)
- ❌ `NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID= activity_events` (space after =)
- ❌ `NEXT_PUBLIC_APPWRITE_ACTIVITIES_COLLECTION_ID=activity_events` (wrong name)

## Expected Result

After the fix, the request URL should be:
```
/v1/databases/builder_circle/collections/activity_events/documents
                                         ^^^^^^^^^^^^^^^^
                                         SHOULD BE FILLED!
```

And activity submission should work perfectly.
