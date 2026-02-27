# Testing Guide - adjustMultiplier Function

## Testing Strategy

This guide covers unit testing, integration testing, and production validation for the Multiplier Adjustment Engine.

## Local Testing

### Setup

```bash
cd functions/adjustMultiplier
npm install
```

### Update Test Configuration

Edit `test-function.js` and add your API key:

```javascript
process.env.APPWRITE_API_KEY = "your_actual_api_key_here";
```

### Run Test

```bash
npm test
```

### Expected Output

```
=== Testing adjustMultiplier Function ===

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

=== RESPONSE ===
Status: 200
{
  "success": true,
  "message": "Multiplier adjustment completed successfully",
  "timestamp": "2026-02-28T03:30:00.000Z",
  "results": {
    "totalEvaluated": 45,
    "updated": 8,
    "skipped": 37,
    "errors": 0
  }
}

=== Test Complete ===
```

## Unit Tests

### Test Multiplier Mapping

```javascript
import { getMultiplierForStage } from './src/main.js';

describe('getMultiplierForStage', () => {
  test('returns 1.0 for active stage', () => {
    expect(getMultiplierForStage('active')).toBe(1.0);
  });

  test('returns 0.75 for at_risk stage', () => {
    expect(getMultiplierForStage('at_risk')).toBe(0.75);
  });

  test('returns 0.5 for diminishing stage', () => {
    expect(getMultiplierForStage('diminishing')).toBe(0.5);
  });

  test('returns 0 for paused stage', () => {
    expect(getMultiplierForStage('paused')).toBe(0);
  });

  test('returns 1.0 for grace stage', () => {
    expect(getMultiplierForStage('grace')).toBe(1.0);
  });

  test('returns 1.0 for unknown stage', () => {
    expect(getMultiplierForStage('unknown')).toBe(1.0);
  });
});
```

## Integration Tests

### Test 1: Full Adjustment Flow

```javascript
describe('adjustMultiplier integration', () => {
  let testUserId;
  let testCycleId;

  beforeAll(async () => {
    // Setup: Create test cycle
    const cycle = await databases.createDocument(
      'builder_circle',
      'build_cycles',
      ID.unique(),
      {
        name: 'Test Cycle',
        state: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    );
    testCycleId = cycle.$id;

    // Create test user participation
    const participation = await databases.createDocument(
      'builder_circle',
      'cycle_participation',
      ID.unique(),
      {
        userId: 'test_user_123',
        cycleId: testCycleId,
        optedIn: true,
        stallStage: 'at_risk',
        lastActivityDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      }
    );
    testUserId = participation.userId;
  });

  test('creates multiplier record when stage changes', async () => {
    // Execute function
    const result = await adjustMultiplier(mockContext);

    // Verify success
    expect(result.success).toBe(true);
    expect(result.results.updated).toBeGreaterThan(0);

    // Verify multiplier record created
    const multipliers = await databases.listDocuments(
      'builder_circle',
      'multipliers',
      [
        Query.equal('userId', testUserId),
        Query.equal('cycleId', testCycleId),
        Query.orderDesc('$createdAt'),
        Query.limit(1)
      ]
    );

    expect(multipliers.documents.length).toBe(1);
    expect(multipliers.documents[0].multiplier).toBe(0.75);
    expect(multipliers.documents[0].reason).toContain('at_risk');
  });

  test('creates ledger event for audit trail', async () => {
    // Verify ledger event created
    const ledger = await databases.listDocuments(
      'builder_circle',
      'ownership_ledger',
      [
        Query.equal('userId', testUserId),
        Query.equal('cycleId', testCycleId),
        Query.equal('eventType', 'multiplier_adjustment'),
        Query.orderDesc('$createdAt'),
        Query.limit(1)
      ]
    );

    expect(ledger.documents.length).toBe(1);
    expect(ledger.documents[0].multiplierSnapshot).toBe(0.75);
    expect(ledger.documents[0].ownershipAmount).toBe(0);
  });

  test('skips when multiplier unchanged', async () => {
    // Execute function again (no stage change)
    const result = await adjustMultiplier(mockContext);

    // Should skip this participant
    expect(result.results.skipped).toBeGreaterThan(0);

    // Verify no new multiplier record
    const multipliers = await databases.listDocuments(
      'builder_circle',
      'multipliers',
      [
        Query.equal('userId', testUserId),
        Query.equal('cycleId', testCycleId)
      ]
    );

    // Should still be 1 record (not 2)
    expect(multipliers.documents.length).toBe(1);
  });

  afterAll(async () => {
    // Cleanup test data
    await databases.deleteDocument('builder_circle', 'build_cycles', testCycleId);
    // Note: Participation, multipliers, and ledger records cascade delete
  });
});
```

### Test 2: Edge Cases

```javascript
describe('edge cases', () => {
  test('handles participant with no stall stage', async () => {
    // Create participant without stallStage
    const participation = await databases.createDocument(
      'builder_circle',
      'cycle_participation',
      ID.unique(),
      {
        userId: 'test_user_no_stage',
        cycleId: testCycleId,
        optedIn: true
        // stallStage missing
      }
    );

    const result = await adjustMultiplier(mockContext);

    // Should skip this participant
    expect(result.results.skipped).toBeGreaterThan(0);
  });

  test('handles participant not opted in', async () => {
    // Create participant with optedIn=false
    const participation = await databases.createDocument(
      'builder_circle',
      'cycle_participation',
      ID.unique(),
      {
        userId: 'test_user_not_opted',
        cycleId: testCycleId,
        optedIn: false,
        stallStage: 'at_risk'
      }
    );

    const result = await adjustMultiplier(mockContext);

    // Should skip this participant
    expect(result.results.skipped).toBeGreaterThan(0);
  });

  test('handles no active cycles', async () => {
    // Set all cycles to inactive
    const cycles = await databases.listDocuments(
      'builder_circle',
      'build_cycles',
      [Query.equal('state', 'active')]
    );

    for (const cycle of cycles.documents) {
      await databases.updateDocument(
        'builder_circle',
        'build_cycles',
        cycle.$id,
        { state: 'completed' }
      );
    }

    const result = await adjustMultiplier(mockContext);

    // Should evaluate 0 participants
    expect(result.results.totalEvaluated).toBe(0);

    // Restore cycles
    for (const cycle of cycles.documents) {
      await databases.updateDocument(
        'builder_circle',
        'build_cycles',
        cycle.$id,
        { state: 'active' }
      );
    }
  });
});
```

## Production Testing

### Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] API key has correct permissions
- [ ] Collection IDs match production database
- [ ] Function timeout set appropriately (300s)
- [ ] Logging enabled
- [ ] Test data prepared

### Deployment Test Plan

#### Phase 1: Deploy to Staging

1. Deploy function to staging environment
2. Run manual execution
3. Verify logs show no errors
4. Check multiplier records created
5. Check ledger events created
6. Verify computeOwnership integration

#### Phase 2: Smoke Test

```bash
# Execute function manually
curl -X POST \
  https://cloud.appwrite.io/v1/functions/[FUNCTION_ID]/executions \
  -H "X-Appwrite-Project: [PROJECT_ID]" \
  -H "X-Appwrite-Key: [API_KEY]"
```

Expected response:
```json
{
  "success": true,
  "results": {
    "totalEvaluated": 50,
    "updated": 12,
    "skipped": 38,
    "errors": 0
  }
}
```

#### Phase 3: Validation Queries

```javascript
// 1. Verify multiplier records
const multipliers = await databases.listDocuments(
  'builder_circle',
  'multipliers',
  [
    Query.orderDesc('$createdAt'),
    Query.limit(10)
  ]
);

console.log('Recent multipliers:', multipliers.documents);

// 2. Verify ledger events
const ledger = await databases.listDocuments(
  'builder_circle',
  'ownership_ledger',
  [
    Query.equal('eventType', 'multiplier_adjustment'),
    Query.orderDesc('$createdAt'),
    Query.limit(10)
  ]
);

console.log('Recent ledger events:', ledger.documents);

// 3. Test computeOwnership integration
const ownership = await fetch(
  'https://cloud.appwrite.io/v1/functions/[COMPUTE_FUNCTION_ID]/executions',
  {
    method: 'POST',
    headers: {
      'X-Appwrite-Project': projectId,
      'X-Appwrite-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: 'test_user_id',
      cycleId: 'test_cycle_id'
    })
  }
);

const result = await ownership.json();
console.log('Ownership calculation:', result);
// Should show multiplier being applied
```

#### Phase 4: Monitor First Scheduled Run

1. Wait for scheduled execution (00:15)
2. Check execution logs
3. Verify expected number of updates
4. Check for any errors
5. Validate data consistency

### Production Validation Checklist

- [ ] Function executes successfully
- [ ] Multiplier records created correctly
- [ ] Ledger events created for audit
- [ ] No errors in logs
- [ ] Performance within acceptable range
- [ ] computeOwnership uses new multipliers
- [ ] Frontend displays updated multipliers

## Performance Testing

### Load Test

```javascript
// Create test data
const createTestParticipants = async (count) => {
  const participants = [];
  
  for (let i = 0; i < count; i++) {
    const participant = await databases.createDocument(
      'builder_circle',
      'cycle_participation',
      ID.unique(),
      {
        userId: `test_user_${i}`,
        cycleId: testCycleId,
        optedIn: true,
        stallStage: ['active', 'at_risk', 'diminishing', 'paused'][i % 4],
        lastActivityDate: new Date().toISOString()
      }
    );
    participants.push(participant);
  }
  
  return participants;
};

// Test with different loads
describe('performance tests', () => {
  test('handles 100 participants', async () => {
    await createTestParticipants(100);
    
    const startTime = Date.now();
    const result = await adjustMultiplier(mockContext);
    const duration = Date.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(30000); // 30 seconds
  });

  test('handles 1000 participants', async () => {
    await createTestParticipants(1000);
    
    const startTime = Date.now();
    const result = await adjustMultiplier(mockContext);
    const duration = Date.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(300000); // 5 minutes
  });
});
```

## Monitoring Tests

### Test Metrics Collection

```javascript
describe('monitoring', () => {
  test('returns detailed results', async () => {
    const result = await adjustMultiplier(mockContext);
    
    expect(result.results).toHaveProperty('totalEvaluated');
    expect(result.results).toHaveProperty('updated');
    expect(result.results).toHaveProperty('skipped');
    expect(result.results).toHaveProperty('errors');
    expect(result.results).toHaveProperty('adjustments');
  });

  test('includes adjustment details', async () => {
    const result = await adjustMultiplier(mockContext);
    
    if (result.results.updated > 0) {
      const adjustment = result.results.adjustments[0];
      
      expect(adjustment).toHaveProperty('userId');
      expect(adjustment).toHaveProperty('cycleId');
      expect(adjustment).toHaveProperty('stallStage');
      expect(adjustment).toHaveProperty('previousMultiplier');
      expect(adjustment).toHaveProperty('newMultiplier');
    }
  });
});
```

## Error Handling Tests

```javascript
describe('error handling', () => {
  test('handles missing environment variables', async () => {
    const originalApiKey = process.env.APPWRITE_API_KEY;
    delete process.env.APPWRITE_API_KEY;
    
    const result = await adjustMultiplier(mockContext);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required environment variables');
    
    process.env.APPWRITE_API_KEY = originalApiKey;
  });

  test('handles database connection errors', async () => {
    // Mock database error
    const originalEndpoint = process.env.APPWRITE_ENDPOINT;
    process.env.APPWRITE_ENDPOINT = 'https://invalid-endpoint.com';
    
    const result = await adjustMultiplier(mockContext);
    
    expect(result.success).toBe(false);
    
    process.env.APPWRITE_ENDPOINT = originalEndpoint;
  });

  test('continues on single participant error', async () => {
    // This test verifies that one participant error doesn't stop processing
    // Implementation depends on your error handling strategy
  });
});
```

## Regression Tests

### Test Backward Compatibility

```javascript
describe('backward compatibility', () => {
  test('handles participants with no existing multiplier', async () => {
    // Create new participant (no multiplier record yet)
    const participation = await databases.createDocument(
      'builder_circle',
      'cycle_participation',
      ID.unique(),
      {
        userId: 'new_user',
        cycleId: testCycleId,
        optedIn: true,
        stallStage: 'active'
      }
    );
    
    const result = await adjustMultiplier(mockContext);
    
    // Should create first multiplier record
    expect(result.success).toBe(true);
    
    const multipliers = await databases.listDocuments(
      'builder_circle',
      'multipliers',
      [
        Query.equal('userId', 'new_user'),
        Query.equal('cycleId', testCycleId)
      ]
    );
    
    expect(multipliers.documents.length).toBe(1);
    expect(multipliers.documents[0].multiplier).toBe(1.0);
  });
});
```

## Test Data Cleanup

```javascript
// Cleanup script
const cleanupTestData = async () => {
  // Delete test multipliers
  const multipliers = await databases.listDocuments(
    'builder_circle',
    'multipliers',
    [Query.search('userId', 'test_user')]
  );
  
  for (const doc of multipliers.documents) {
    await databases.deleteDocument('builder_circle', 'multipliers', doc.$id);
  }
  
  // Delete test ledger events
  const ledger = await databases.listDocuments(
    'builder_circle',
    'ownership_ledger',
    [Query.search('userId', 'test_user')]
  );
  
  for (const doc of ledger.documents) {
    await databases.deleteDocument('builder_circle', 'ownership_ledger', doc.$id);
  }
  
  // Delete test participations
  const participations = await databases.listDocuments(
    'builder_circle',
    'cycle_participation',
    [Query.search('userId', 'test_user')]
  );
  
  for (const doc of participations.documents) {
    await databases.deleteDocument('builder_circle', 'cycle_participation', doc.$id);
  }
};
```

## Continuous Testing

### Automated Test Schedule

1. **Pre-deployment**: Run all unit and integration tests
2. **Post-deployment**: Run smoke tests
3. **Daily**: Monitor production executions
4. **Weekly**: Run performance tests
5. **Monthly**: Review and update test cases

### Test Coverage Goals

- Unit tests: 90%+ coverage
- Integration tests: All critical paths
- Edge cases: All known scenarios
- Performance: Load tested to 2x expected capacity
- Error handling: All error paths tested
