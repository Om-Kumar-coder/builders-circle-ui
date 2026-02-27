# Architecture - Multiplier Adjustment Engine

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Builder's Circle                             │
│                  Ownership Management System                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│stallEvaluator│    │adjustMulti-  │    │computeOwner- │
│              │───▶│plier         │───▶│ship          │
│Daily 00:00   │    │Daily 00:15   │    │On-demand     │
└──────────────┘    └──────────────┘    └──────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ACTIVITY TRACKING                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    User submits activity
                              │
                              ▼
                  Updates lastActivityDate
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. STALL EVALUATION (stallEvaluator)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              Calculate days since last activity
                              │
                              ▼
                    Determine stall stage
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
           0-6 days      7-13 days     14-20 days    21+ days
           "active"      "at_risk"   "diminishing"   "paused"
                │             │             │             │
                └─────────────┴─────────────┴─────────────┘
                              │
                              ▼
                Update cycle_participation.stallStage
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. MULTIPLIER ADJUSTMENT (adjustMultiplier)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  Read stallStage changes
                              │
                              ▼
                  Map stage to multiplier
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
           active=1.0    at_risk=0.75  diminishing=0.5  paused=0
                │             │             │             │
                └─────────────┴─────────────┴─────────────┘
                              │
                              ▼
                  Fetch latest multiplier
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
              No change            Changed
                    │                   │
                    ▼                   ▼
                  Skip          Create records
                                        │
                        ┌───────────────┴───────────────┐
                        │                               │
                        ▼                               ▼
              Create multiplier record      Create ledger event
                        │                               │
                        └───────────────┬───────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. OWNERSHIP CALCULATION (computeOwnership)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  Fetch ownership ledger
                              │
                              ▼
                  Sum ownershipAmount
                              │
                              ▼
                  Fetch latest multiplier
                              │
                              ▼
          effectiveOwnership = total × multiplier
                              │
                              ▼
                    Return to application
```

## Collection Relationships

```
┌──────────────────────┐
│   build_cycles       │
│                      │
│ - $id (cycleId)      │
│ - state              │
│ - startDate          │
│ - endDate            │
└──────────┬───────────┘
           │
           │ Referenced by
           │
           ▼
┌──────────────────────┐
│ cycle_participation  │◀─── Read by stallEvaluator
│                      │◀─── Read by adjustMultiplier
│ - userId             │
│ - cycleId            │
│ - stallStage         │───┐
│ - lastActivityDate   │   │
│ - optedIn            │   │
└──────────────────────┘   │
                           │ Determines
                           │
                           ▼
┌──────────────────────┐
│    multipliers       │◀─── Written by adjustMultiplier
│                      │◀─── Read by computeOwnership
│ - userId             │
│ - cycleId            │
│ - multiplier         │
│ - reason             │
│ - createdAt          │
└──────────────────────┘
           │
           │ Audit trail
           │
           ▼
┌──────────────────────┐
│  ownership_ledger    │◀─── Written by adjustMultiplier
│                      │◀─── Read by computeOwnership
│ - userId             │
│ - cycleId            │
│ - eventType          │
│ - ownershipAmount    │
│ - multiplierSnapshot │
│ - reason             │
└──────────────────────┘
```

## Function Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    adjustMultiplier Function                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Main Entry Point                            │
│  - Validate environment variables                                │
│  - Initialize Appwrite client                                    │
│  - Call adjustMultipliers()                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   adjustMultipliers()                            │
│  - Get active cycles                                             │
│  - Get active participants                                       │
│  - Process each participant                                      │
│  - Return results                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   processParticipant()                           │
│  - Read stallStage                                               │
│  - Calculate target multiplier                                   │
│  - Fetch latest multiplier                                       │
│  - Compare and decide                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
          ┌─────────────────┐  ┌─────────────────┐
          │ Skip (no change)│  │ Update needed   │
          └─────────────────┘  └─────────────────┘
                                        │
                        ┌───────────────┴───────────────┐
                        │                               │
                        ▼                               ▼
          ┌─────────────────────┐         ┌─────────────────────┐
          │createMultiplierRecord│         │ createLedgerEvent   │
          └─────────────────────┘         └─────────────────────┘
```

## Execution Flow

```
START
  │
  ▼
Validate Environment Variables
  │
  ├─ Missing? ──▶ Return Error
  │
  ▼
Initialize Appwrite Client
  │
  ▼
Fetch Active Cycles
  │
  ├─ None found? ──▶ Return (0 evaluated)
  │
  ▼
Fetch Active Participants (optedIn=true)
  │
  ├─ None found? ──▶ Return (0 evaluated)
  │
  ▼
FOR EACH Participant:
  │
  ├─ Not opted in? ──▶ Skip
  │
  ├─ No stallStage? ──▶ Skip
  │
  ▼
  Calculate Target Multiplier
  │
  ▼
  Fetch Latest Multiplier
  │
  ▼
  Compare Values
  │
  ├─ Same? ──▶ Skip
  │
  ├─ Different? ──▶ Create Records
  │                  │
  │                  ├─ Create multiplier record
  │                  │
  │                  └─ Create ledger event
  │
  ▼
END LOOP
  │
  ▼
Return Results Summary
  │
  ▼
END
```

## Error Handling Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                         Error Levels                             │
└─────────────────────────────────────────────────────────────────┘

Level 1: Fatal Errors (Stop execution)
  ├─ Missing environment variables
  ├─ Appwrite client initialization failure
  └─ Database connection failure

Level 2: Recoverable Errors (Log and continue)
  ├─ Single participant processing failure
  ├─ Multiplier record creation failure
  └─ Ledger event creation failure

Level 3: Expected Conditions (Skip silently)
  ├─ No active cycles
  ├─ No active participants
  ├─ No stage change
  └─ Participant not opted in
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Security Layers                             │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Function Execution
  ├─ No public execute permissions
  ├─ API key required
  └─ Project-scoped access

Layer 2: Data Access
  ├─ Server-side SDK only
  ├─ API key with limited permissions
  └─ Database read/write only

Layer 3: Data Validation
  ├─ Validate stallStage values
  ├─ Validate multiplier ranges
  └─ Validate user/cycle existence

Layer 4: Audit Trail
  ├─ All changes logged
  ├─ Immutable ledger events
  └─ Timestamp all records
```

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────────────┐
│                    Performance Profile                           │
└─────────────────────────────────────────────────────────────────┘

Execution Time:
  ├─ 10 participants: ~2 seconds
  ├─ 100 participants: ~15 seconds
  ├─ 1000 participants: ~120 seconds
  └─ Timeout: 300 seconds (5 minutes)

Database Queries:
  ├─ 1 query: Active cycles
  ├─ 1 query: Active participants
  ├─ N queries: Latest multipliers (per participant)
  ├─ M creates: New multiplier records (per change)
  └─ M creates: Ledger events (per change)

Optimization Opportunities:
  ├─ Batch multiplier queries
  ├─ Cache active cycles
  ├─ Parallel participant processing
  └─ Pagination for large datasets
```

## Scalability Considerations

```
Current Limits:
  ├─ 100 cycles per query
  ├─ 1000 participants per query
  └─ 300 second timeout

Scaling Strategies:
  ├─ Pagination for >1000 participants
  ├─ Batch processing in chunks
  ├─ Parallel execution per cycle
  └─ Queue-based processing for large datasets
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                    External Integrations                         │
└─────────────────────────────────────────────────────────────────┘

Upstream (Triggers):
  ├─ Scheduled execution (cron)
  ├─ Manual API call
  └─ Event trigger (future)

Downstream (Consumers):
  ├─ computeOwnership function
  ├─ Frontend dashboard
  ├─ Analytics/reporting
  └─ Notification system (future)

Data Dependencies:
  ├─ Requires: stallEvaluator output
  ├─ Produces: multiplier records
  └─ Produces: ledger events
```
