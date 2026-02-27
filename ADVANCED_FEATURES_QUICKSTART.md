# Advanced Features - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Install Dependencies (1 min)

```bash
npm install recharts
```

### Step 2: Create Notifications Collection (2 min)

In Appwrite Console:

1. Go to Databases → `builder_circle`
2. Create new collection: `notifications`
3. Add attributes:
   - `userId` (string, required)
   - `type` (string, required)
   - `message` (string, required)
   - `read` (boolean, required, default: false)
   - `metadata` (string, optional) // JSON object
   - `createdAt` (string, required)

4. Set permissions:
   - Read: Users (own documents)
   - Create: Server-side only
   - Update: Users (own documents)
   - Delete: Server-side only

### Step 3: Update Environment Variables (1 min)

Add to `.env.local`:

```env
NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID=notifications
```

### Step 4: Test Features (1 min)

```bash
npm run dev
```

Visit:
- `/dashboard` - See onboarding tour
- Header - Click bell icon for notifications
- `/insights` - View analytics (admin only)
- `/admin/audit` - View audit log (admin only)

---

## 📋 Feature Checklist

### Notifications
- [x] Bell icon in header
- [x] Unread count badge
- [x] Dropdown panel
- [x] Mark as read
- [x] Auto-refresh (30s)
- [ ] Create test notification

### Analytics
- [x] Participation health cards
- [x] Activity insights
- [x] Cycle performance
- [x] Pie chart (stall stages)
- [x] Bar chart (activity)
- [x] Admin access control

### Audit Log
- [x] Event timeline
- [x] Event type filter
- [x] User ID search
- [x] Detailed event info
- [x] Admin access control

### Onboarding
- [x] 5-step tour
- [x] Progress bar
- [x] Skip functionality
- [x] Local storage persistence
- [x] Auto-trigger on first login

---

## 🧪 Quick Tests

### Test Notification System

```typescript
// In browser console or test file
import { createNotification } from '@/lib/notifications';

// Create test notification
await createNotification(
  'your-user-id',
  'stall_warning',
  'Test notification message'
);

// Refresh page and check bell icon
```

### Test Analytics

1. Navigate to `/insights`
2. Verify you see participation metrics
3. Check charts render correctly
4. Click refresh button

### Test Audit Log

1. Navigate to `/admin/audit`
2. Try different filters
3. Search by user ID
4. Verify events display

### Test Onboarding

1. Open browser DevTools
2. Console: `localStorage.removeItem('builders-circle-onboarding-completed')`
3. Refresh page
4. Onboarding tour should appear

---

## 🔗 Integration Examples

### Trigger Notification from Function

```javascript
// In Appwrite Function (e.g., adjustMultiplier)
import { Client, Databases, ID } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

// Create notification
await databases.createDocument(
  process.env.APPWRITE_DATABASE_ID,
  'notifications',
  ID.unique(),
  {
    userId: 'user123',
    type: 'multiplier_changed',
    message: 'Your multiplier has been adjusted to 0.75× due to inactivity.',
    read: false,
    metadata: JSON.stringify({ oldMultiplier: 1.0, newMultiplier: 0.75 }),
    createdAt: new Date().toISOString()
  }
);
```

### Use Notifications in Component

```typescript
import { useNotifications } from '@/hooks/useNotifications';

function MyComponent() {
  const { notifications, unreadCount, markRead } = useNotifications(userId);

  return (
    <div>
      <p>You have {unreadCount} unread notifications</p>
      {notifications.map(notif => (
        <div key={notif.$id} onClick={() => markRead(notif.$id)}>
          {notif.message}
        </div>
      ))}
    </div>
  );
}
```

### Reset Onboarding

```typescript
import { useOnboarding } from '@/components/onboarding/OnboardingTour';

function SettingsPage() {
  const { resetOnboarding } = useOnboarding();

  return (
    <button onClick={resetOnboarding}>
      Show Onboarding Tour Again
    </button>
  );
}
```

---

## 🎯 Common Use Cases

### 1. Notify User of Stall Warning

```typescript
// When stallEvaluator detects at_risk stage
await createNotification(
  userId,
  'stall_warning',
  'Your activity is declining. Submit work within 6 days to maintain full influence.',
  { stallStage: 'at_risk', daysInactive: 8 }
);
```

### 2. Notify User of Multiplier Change

```typescript
// When adjustMultiplier reduces multiplier
await createNotification(
  userId,
  'multiplier_changed',
  `Your multiplier has been reduced to ${newMultiplier}× due to ${reason}.`,
  { oldMultiplier, newMultiplier, reason }
);
```

### 3. Notify User of Activity Verification

```typescript
// When admin verifies activity
await createNotification(
  userId,
  'activity_verified',
  'Your activity has been verified! +2.5% ownership added.',
  { activityId, ownershipAdded: 2.5 }
);
```

### 4. Announce New Cycle

```typescript
// When new cycle starts
const participants = await getParticipants(cycleId);

for (const participant of participants) {
  await createNotification(
    participant.userId,
    'cycle_started',
    `New build cycle "${cycleName}" has started! Submit your first activity.`,
    { cycleId, cycleName }
  );
}
```

---

## 🐛 Troubleshooting

### Notifications Not Showing

**Check:**
1. Collection created in Appwrite
2. Environment variable set correctly
3. User is logged in
4. Browser console for errors

**Fix:**
```bash
# Verify env var
echo $NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID

# Restart dev server
npm run dev
```

### Charts Not Rendering

**Check:**
1. Recharts installed: `npm list recharts`
2. Data is loading correctly
3. Browser console for errors

**Fix:**
```bash
# Reinstall recharts
npm install recharts --save
```

### Onboarding Not Showing

**Check:**
1. localStorage flag: `localStorage.getItem('builders-circle-onboarding-completed')`
2. Component imported in layout
3. User is authenticated

**Fix:**
```javascript
// Reset in browser console
localStorage.removeItem('builders-circle-onboarding-completed');
location.reload();
```

### Admin Pages Access Denied

**Check:**
1. User role is 'admin' or 'founder'
2. User object has role property
3. Authentication is working

**Fix:**
```javascript
// Check user role in console
console.log(user?.role);

// Update user role in Appwrite Console
// Users → Select User → Update role attribute
```

---

## 📊 Performance Tips

### Optimize Notification Fetching

```typescript
// Increase refresh interval for less active users
const { notifications } = useNotifications(userId, false); // Disable auto-refresh

// Manual refresh only
<button onClick={refetch}>Refresh</button>
```

### Lazy Load Charts

```typescript
// Dynamic import for Recharts
import dynamic from 'next/dynamic';

const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), {
  ssr: false,
  loading: () => <div>Loading chart...</div>
});
```

### Paginate Audit Log

```typescript
// Add pagination to audit log
const [page, setPage] = useState(1);
const limit = 50;

const queries = [
  Query.orderDesc('$createdAt'),
  Query.limit(limit),
  Query.offset((page - 1) * limit)
];
```

---

## ✅ Production Checklist

- [ ] Recharts installed
- [ ] Notifications collection created
- [ ] Environment variables set
- [ ] Test notifications work
- [ ] Test analytics load
- [ ] Test audit log filters
- [ ] Test onboarding tour
- [ ] Mobile responsive verified
- [ ] Performance tested
- [ ] Error handling tested
- [ ] Admin access controls verified
- [ ] Documentation reviewed

---

## 🎉 You're Ready!

All advanced features are now implemented and ready to use. The platform now has:

✅ Real-time notifications
✅ Comprehensive analytics
✅ Complete audit trail
✅ Guided onboarding
✅ Optimized performance

Start using these features to improve communication, transparency, and user experience in Builder's Circle!
