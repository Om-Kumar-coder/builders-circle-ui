# Integration Guide - Multiplier Adjustment Engine

## System Architecture

```
┌─────────────────┐
│ stallEvaluator  │  Daily 00:00 - Updates stall stages
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│adjustMultiplier │  Daily 00:15 - Adjusts multipliers
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│computeOwnership │  On-demand - Calculates effective ownership
└─────────────────┘
```

## Data Flow

### 1. Stall Stage Updates (stallEvaluator)

```javascript
// Updates cycle_participation records
{
  userId: "user123",
  cycleId: "cycle456",
  stallStage: "at_risk",  // ← Updated by stallEvaluator
  lastActivityDate: "2026-02-20T00:00:00.000Z",
  optedIn: true
}
```

### 2. Multiplier Adjustments (adjustMultiplier)

```javascript
// Creates multipliers record
{
  userId: "user123",
  cycleId: "cycle456",
  multiplier: 0.75,  // ← Based on stallStage
  reason: "stall stage adjustment: at_risk",
  createdAt: "2026-02-28T00:15:00.000Z"
}

// Creates ledger event
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

### 3. Ownership Calculation (computeOwnership)

```javascript
// Queries multipliers for latest value
// Applies to ownership calculation
effectiveOwnership = totalOwnership × 0.75
```

## Collection Schemas

### cycle_participation

```javascript
{
  $id: string,
  userId: string,
  cycleId: string,
  optedIn: boolean,
  stallStage: "active" | "at_risk" | "diminishing" | "paused" | "grace",
  participationStatus: string,
  lastActivityDate: ISO8601,
  $createdAt: ISO8601,
  $updatedAt: ISO8601
}
```

### multipliers

```javascript
{
  $id: string,
  userId: string,
  cycleId: string,
  multiplier: number,  // 0, 0.5, 0.75, or 1.0
  reason: string,
  createdAt: ISO8601,
  $createdAt: ISO8601
}
```

### ownership_ledger

```javascript
{
  $id: string,
  userId: string,
  cycleId: string,
  eventType: "multiplier_adjustment" | "activity_submitted" | "vesting",
  ownershipAmount: number,
  multiplierSnapshot: number,
  reason: string,
  createdAt: ISO8601,
  $createdAt: ISO8601
}
```

## API Integration Examples

### Trigger Multiplier Adjustment

```javascript
// After stallEvaluator completes
const adjustMultipliers = async () => {
  const response = await fetch(
    'https://cloud.appwrite.io/v1/functions/[FUNCTION_ID]/executions',
    {
      method: 'POST',
      headers: {
        'X-Appwrite-Project': '69adee6a00043e4e9c46',
        'X-Appwrite-Key': 'your_api_key',
      }
    }
  );
  
  const result = await response.json();
  console.log(`Adjusted ${result.results.updated} multipliers`);
};
```

### Calculate Effective Ownership

```javascript
// Call computeOwnership for a user
const getOwnership = async (userId, cycleId) => {
  const response = await fetch(
    'https://cloud.appwrite.io/v1/functions/[COMPUTE_FUNCTION_ID]/executions',
    {
      method: 'POST',
      headers: {
        'X-Appwrite-Project': '69adee6a00043e4e9c46',
        'X-Appwrite-Key': 'your_api_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, cycleId })
    }
  );
  
  const result = await response.json();
  return result.effectiveOwnership;
};
```

## Frontend Integration

### Display Multiplier Status

```typescript
// Fetch user's current multiplier
const getUserMultiplier = async (userId: string, cycleId: string) => {
  const multipliers = await databases.listDocuments(
    '69b008400000b872c17a',
    'multipliers',
    [
      Query.equal('userId', userId),
      Query.equal('cycleId', cycleId),
      Query.orderDesc('$createdAt'),
      Query.limit(1)
    ]
  );
  
  return multipliers.documents[0]?.multiplier ?? 1.0;
};

// Display in UI
const MultiplierBadge = ({ multiplier }) => {
  const getColor = (m) => {
    if (m === 1.0) return 'green';
    if (m === 0.75) return 'yellow';
    if (m === 0.5) return 'orange';
    return 'red';
  };
  
  return (
    <Badge color={getColor(multiplier)}>
      {multiplier}× multiplier
    </Badge>
  );
};
```

### Show Multiplier History

```typescript
// Fetch multiplier history
const getMultiplierHistory = async (userId: string, cycleId: string) => {
  const history = await databases.listDocuments(
    '69b008400000b872c17a',
    'multipliers',
    [
      Query.equal('userId', userId),
      Query.equal('cycleId', cycleId),
      Query.orderDesc('$createdAt'),
      Query.limit(10)
    ]
  );
  
  return history.documents;
};

// Display timeline
const MultiplierTimeline = ({ history }) => (
  <div>
    {history.map(record => (
      <div key={record.$id}>
        <span>{new Date(record.createdAt).toLocaleDateString()}</span>
        <span>{record.multiplier}×</span>
        <span>{record.reason}</span>
      </div>
    ))}
  </div>
);
```

## Webhook Integration (Future)

### Notify Users on Multiplier Change

```javascript
// Add to adjustMultiplier function
async function notifyUser(userId, oldMultiplier, newMultiplier, reason) {
  // Send email/notification
  await fetch('https://your-notification-service.com/notify', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      type: 'multiplier_change',
      data: {
        oldMultiplier,
        newMultiplier,
        reason
      }
    })
  });
}
```

## Monitoring & Alerts

### Key Metrics to Track

1. **Adjustment Rate**: Number of multipliers adjusted per execution
2. **Error Rate**: Failed adjustments / total participants
3. **Stage Distribution**: Count of participants per stall stage
4. **Multiplier Distribution**: Count of participants per multiplier value

### Example Monitoring Query

```javascript
// Get multiplier distribution
const getMultiplierStats = async (cycleId) => {
  const participants = await databases.listDocuments(
    '69b008400000b872c17a',
    'cycle_participation',
    [Query.equal('cycleId', cycleId), Query.equal('optedIn', true)]
  );
  
  const stats = {
    active: 0,
    at_risk: 0,
    diminishing: 0,
    paused: 0
  };
  
  participants.documents.forEach(p => {
    stats[p.stallStage]++;
  });
  
  return stats;
};
```

## Testing Strategy

### Unit Tests

```javascript
// Test multiplier calculation
test('getMultiplierForStage returns correct values', () => {
  expect(getMultiplierForStage('active')).toBe(1.0);
  expect(getMultiplierForStage('at_risk')).toBe(0.75);
  expect(getMultiplierForStage('diminishing')).toBe(0.5);
  expect(getMultiplierForStage('paused')).toBe(0);
});
```

### Integration Tests

```javascript
// Test full adjustment flow
test('adjusts multiplier when stage changes', async () => {
  // Setup: Create participant with at_risk stage
  const participant = await createTestParticipant({
    stallStage: 'at_risk'
  });
  
  // Execute function
  await adjustMultiplier();
  
  // Verify: Multiplier record created
  const multiplier = await getLatestMultiplier(
    participant.userId,
    participant.cycleId
  );
  
  expect(multiplier.multiplier).toBe(0.75);
  expect(multiplier.reason).toContain('at_risk');
});
```

## Troubleshooting Common Issues

### Issue: Multipliers Not Updating

**Check:**
1. stallEvaluator ran successfully
2. Participants are opted in
3. Cycles are active
4. Function has correct permissions

### Issue: Duplicate Multiplier Records

**Cause:** Function running multiple times simultaneously

**Solution:** Ensure only one execution at a time (use locks or queues)

### Issue: Ledger Events Missing

**Check:**
1. Ledger collection ID is correct
2. API key has write permissions
3. Function logs for errors

## Performance Optimization

### Batch Processing

For large datasets (>1000 participants):

```javascript
// Process in batches
const BATCH_SIZE = 100;
for (let i = 0; i < participants.length; i += BATCH_SIZE) {
  const batch = participants.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(p => processParticipant(p)));
}
```

### Caching

Cache active cycles to reduce queries:

```javascript
let cachedCycles = null;
let cacheExpiry = null;

const getActiveCyclesWithCache = async () => {
  if (cachedCycles && Date.now() < cacheExpiry) {
    return cachedCycles;
  }
  
  cachedCycles = await getActiveCycles();
  cacheExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes
  return cachedCycles;
};
```

## Security Considerations

1. **API Key Permissions**: Limit to database read/write only
2. **Function Execution**: No public execute permissions
3. **Data Validation**: Validate all inputs before processing
4. **Audit Trail**: All changes logged in ledger
5. **Idempotency**: Safe to run multiple times without side effects
