import { Client, Databases, Query, ID } from "node-appwrite";

/**
 * Multiplier Adjustment Engine for Builder's Circle
 * 
 * Adjusts participation multipliers based on stall stage:
 * - active → 1.0
 * - at_risk → 0.75
 * - diminishing → 0.5
 * - paused → 0
 * 
 * Creates audit trail in ownership ledger for transparency.
 * Runs after stallEvaluator to process stage changes.
 */

// Multiplier mapping by stall stage
const MULTIPLIER_MAP = {
  active: 1.0,
  at_risk: 0.75,
  diminishing: 0.5,
  paused: 0,
  grace: 1.0,
  none: 1.0,
};

// Ledger event types
const LEDGER_EVENT_TYPES = {
  MULTIPLIER_ADJUSTMENT: "multiplier_adjustment",
};

/**
 * Get multiplier value for stall stage
 */
function getMultiplierForStage(stallStage) {
  return MULTIPLIER_MAP[stallStage] ?? 1.0;
}

/**
 * Get all active cycles
 */
async function getActiveCycles(databases, databaseId, cyclesCollectionId) {
  try {
    const response = await databases.listDocuments(databaseId, cyclesCollectionId, [
      Query.equal("state", "active"),
      Query.limit(100),
    ]);

    return response.documents;
  } catch (error) {
    console.error("Error fetching active cycles:", error);
    throw error;
  }
}

/**
 * Get all opted-in participants for active cycles
 */
async function getActiveParticipants(databases, databaseId, participationCollectionId, activeCycleIds) {
  try {
    const response = await databases.listDocuments(databaseId, participationCollectionId, [
      Query.equal("optedIn", true),
      Query.equal("cycleId", activeCycleIds),
      Query.limit(1000),
    ]);

    return response.documents;
  } catch (error) {
    console.error("Error fetching active participants:", error);
    throw error;
  }
}

/**
 * Get latest multiplier for user in cycle
 */
async function getLatestMultiplier(databases, databaseId, multipliersCollectionId, userId, cycleId) {
  try {
    const response = await databases.listDocuments(databaseId, multipliersCollectionId, [
      Query.equal("userId", userId),
      Query.equal("cycleId", cycleId),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);

    return response.documents.length > 0 ? response.documents[0] : null;
  } catch (error) {
    console.error(`Error fetching multiplier for user ${userId}, cycle ${cycleId}:`, error);
    return null;
  }
}

/**
 * Create new multiplier record
 */
async function createMultiplierRecord(databases, databaseId, multipliersCollectionId, userId, cycleId, multiplier, reason) {
  try {
    const document = await databases.createDocument(databaseId, multipliersCollectionId, ID.unique(), {
      userId,
      cycleId,
      multiplier,
      reason,
      createdAt: new Date().toISOString(),
    });

    return document;
  } catch (error) {
    console.error(`Error creating multiplier record for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Create ledger event for audit trail
 */
async function createLedgerEvent(databases, databaseId, ledgerCollectionId, userId, cycleId, multiplier, reason) {
  try {
    const document = await databases.createDocument(databaseId, ledgerCollectionId, ID.unique(), {
      userId,
      cycleId,
      eventType: LEDGER_EVENT_TYPES.MULTIPLIER_ADJUSTMENT,
      ownershipAmount: 0,
      multiplierSnapshot: multiplier,
      reason,
      createdAt: new Date().toISOString(),
    });

    return document;
  } catch (error) {
    console.error(`Error creating ledger event for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Process multiplier adjustment for a participant
 */
async function processParticipant(
  databases,
  databaseId,
  multipliersCollectionId,
  ledgerCollectionId,
  participant
) {
  const { userId, cycleId, stallStage } = participant;

  // Safety check: skip if no stall stage
  if (!stallStage) {
    return { skipped: true, reason: "no_stall_stage" };
  }

  // Determine correct multiplier for current stage
  const targetMultiplier = getMultiplierForStage(stallStage);

  // Fetch latest multiplier record
  const latestMultiplier = await getLatestMultiplier(databases, databaseId, multipliersCollectionId, userId, cycleId);

  const currentMultiplier = latestMultiplier ? latestMultiplier.multiplier : null;

  // Skip if multiplier unchanged
  if (currentMultiplier === targetMultiplier) {
    return { skipped: true, reason: "no_change" };
  }

  // Create new multiplier record
  const reason = `stall stage adjustment: ${stallStage}`;
  await createMultiplierRecord(databases, databaseId, multipliersCollectionId, userId, cycleId, targetMultiplier, reason);

  // Create ledger event for audit trail
  await createLedgerEvent(databases, databaseId, ledgerCollectionId, userId, cycleId, targetMultiplier, reason);

  return {
    updated: true,
    userId,
    cycleId,
    previousMultiplier: currentMultiplier,
    newMultiplier: targetMultiplier,
    stallStage,
  };
}

/**
 * Main adjustment logic
 */
async function adjustMultipliers(
  databases,
  databaseId,
  participationCollectionId,
  multipliersCollectionId,
  ledgerCollectionId,
  cyclesCollectionId
) {
  const results = {
    totalEvaluated: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    adjustments: [],
  };

  try {
    // Get all active cycles
    console.log("Fetching active cycles...");
    const activeCycles = await getActiveCycles(databases, databaseId, cyclesCollectionId);
    console.log(`Found ${activeCycles.length} active cycle(s)`);

    if (activeCycles.length === 0) {
      console.log("No active cycles found. Exiting.");
      return results;
    }

    // Get cycle IDs
    const activeCycleIds = activeCycles.map((cycle) => cycle.$id);

    // Get all opted-in participants for active cycles
    console.log("Fetching active participants...");
    const participants = await getActiveParticipants(databases, databaseId, participationCollectionId, activeCycleIds);
    console.log(`Found ${participants.length} active participant(s)`);

    results.totalEvaluated = participants.length;

    // Process each participant
    for (const participant of participants) {
      try {
        // Safety check: skip if not opted in
        if (!participant.optedIn) {
          results.skipped++;
          continue;
        }

        const result = await processParticipant(
          databases,
          databaseId,
          multipliersCollectionId,
          ledgerCollectionId,
          participant
        );

        if (result.skipped) {
          results.skipped++;
        } else if (result.updated) {
          results.updated++;
          results.adjustments.push({
            userId: result.userId,
            cycleId: result.cycleId,
            stallStage: result.stallStage,
            previousMultiplier: result.previousMultiplier,
            newMultiplier: result.newMultiplier,
          });

          console.log(
            `Adjusted multiplier for user ${result.userId}: ${result.previousMultiplier} -> ${result.newMultiplier} (stage: ${result.stallStage})`
          );
        }
      } catch (error) {
        console.error(`Error processing participant ${participant.$id}:`, error);
        results.errors++;
      }
    }
  } catch (error) {
    console.error("Error in adjustment process:", error);
    throw error;
  }

  return results;
}

/**
 * Main function entry point
 */
export default async ({ req, res, log, error }) => {
  log("Multiplier Adjustment Engine started");

  try {
    // Validate environment variables
    const endpoint = process.env.APPWRITE_ENDPOINT;
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;
    const databaseId = process.env.APPWRITE_DATABASE_ID;
    const participationCollectionId = process.env.PARTICIPATION_COLLECTION_ID || "cycle_participation";
    const multipliersCollectionId = process.env.MULTIPLIERS_COLLECTION_ID || "multipliers";
    const ledgerCollectionId = process.env.LEDGER_COLLECTION_ID || "ownership_ledger";
    const cyclesCollectionId = process.env.CYCLES_COLLECTION_ID || "build_cycles";

    if (!endpoint || !projectId || !apiKey || !databaseId) {
      throw new Error("Missing required environment variables");
    }

    log("Environment variables validated");

    // Initialize Appwrite client
    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

    const databases = new Databases(client);

    log("Appwrite client initialized");

    // Run adjustment
    log("Starting multiplier adjustment...");
    const results = await adjustMultipliers(
      databases,
      databaseId,
      participationCollectionId,
      multipliersCollectionId,
      ledgerCollectionId,
      cyclesCollectionId
    );

    log("Adjustment complete");
    log(`Results: ${JSON.stringify(results, null, 2)}`);

    // Return success response
    return res.json({
      success: true,
      message: "Multiplier adjustment completed successfully",
      timestamp: new Date().toISOString(),
      results: results,
    });
  } catch (err) {
    error("Multiplier Adjustment Engine failed:", err);

    return res.json(
      {
        success: false,
        error: err.message || "Unknown error occurred",
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
};
