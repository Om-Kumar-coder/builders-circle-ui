import { Client, Databases, Query } from "node-appwrite";

/**
 * Stall Countdown Engine for Builder's Circle
 * 
 * Monitors participant inactivity and updates stall stages:
 * - active: 0-6 days inactive
 * - at_risk: 7-13 days inactive
 * - diminishing: 14-20 days inactive
 * - paused: 21+ days inactive
 * 
 * Runs daily via cron schedule
 */

// Stall stage thresholds (in days)
const STALL_THRESHOLDS = {
  ACTIVE: 6,
  AT_RISK: 13,
  DIMINISHING: 20,
  PAUSED: 21,
};

// Stall stage names
const STALL_STAGES = {
  ACTIVE: "active",
  AT_RISK: "at_risk",
  DIMINISHING: "diminishing",
  PAUSED: "paused",
  GRACE: "grace",
  NONE: "none",
};

// Participation status
const PARTICIPATION_STATUS = {
  ACTIVE: "active",
  AT_RISK: "at-risk",
  PAUSED: "paused",
  GRACE: "grace",
};

/**
 * Calculate days since last activity
 */
function calculateDaysInactive(lastActivityDate) {
  if (!lastActivityDate) {
    return null;
  }

  const now = new Date();
  const lastActivity = new Date(lastActivityDate);
  const diffTime = Math.abs(now - lastActivity);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Determine stall stage based on days inactive
 */
function determineStallStage(daysInactive) {
  if (daysInactive === null) {
    return STALL_STAGES.GRACE;
  }

  if (daysInactive <= STALL_THRESHOLDS.ACTIVE) {
    return STALL_STAGES.ACTIVE;
  } else if (daysInactive <= STALL_THRESHOLDS.AT_RISK) {
    return STALL_STAGES.AT_RISK;
  } else if (daysInactive <= STALL_THRESHOLDS.DIMINISHING) {
    return STALL_STAGES.DIMINISHING;
  } else {
    return STALL_STAGES.PAUSED;
  }
}

/**
 * Determine participation status based on stall stage
 */
function determineParticipationStatus(stallStage) {
  switch (stallStage) {
    case STALL_STAGES.ACTIVE:
    case STALL_STAGES.NONE:
      return PARTICIPATION_STATUS.ACTIVE;
    case STALL_STAGES.AT_RISK:
    case STALL_STAGES.DIMINISHING:
      return PARTICIPATION_STATUS.AT_RISK;
    case STALL_STAGES.PAUSED:
      return PARTICIPATION_STATUS.PAUSED;
    case STALL_STAGES.GRACE:
      return PARTICIPATION_STATUS.GRACE;
    default:
      return PARTICIPATION_STATUS.ACTIVE;
  }
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
 * Update participant stall stage and status
 */
async function updateParticipant(databases, databaseId, participationCollectionId, participantId, newStallStage, newStatus) {
  try {
    await databases.updateDocument(databaseId, participationCollectionId, participantId, {
      stallStage: newStallStage,
      participationStatus: newStatus,
    });

    return true;
  } catch (error) {
    console.error(`Error updating participant ${participantId}:`, error);
    return false;
  }
}

/**
 * Main evaluation logic
 */
async function evaluateParticipants(databases, databaseId, participationCollectionId, cyclesCollectionId) {
  const results = {
    totalEvaluated: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    stageChanges: {
      toActive: 0,
      toAtRisk: 0,
      toDiminishing: 0,
      toPaused: 0,
    },
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

    // Evaluate each participant
    for (const participant of participants) {
      try {
        // Skip if not opted in (safety check)
        if (!participant.optedIn) {
          results.skipped++;
          continue;
        }

        // Calculate days inactive
        const daysInactive = calculateDaysInactive(participant.lastActivityDate);

        // Determine new stall stage
        const newStallStage = determineStallStage(daysInactive);
        const newStatus = determineParticipationStatus(newStallStage);

        // Check if stage changed
        const currentStallStage = participant.stallStage || STALL_STAGES.GRACE;
        const currentStatus = participant.participationStatus || PARTICIPATION_STATUS.GRACE;

        if (newStallStage !== currentStallStage || newStatus !== currentStatus) {
          // Update participant
          const updated = await updateParticipant(
            databases,
            databaseId,
            participationCollectionId,
            participant.$id,
            newStallStage,
            newStatus
          );

          if (updated) {
            results.updated++;

            // Track stage changes
            switch (newStallStage) {
              case STALL_STAGES.ACTIVE:
                results.stageChanges.toActive++;
                break;
              case STALL_STAGES.AT_RISK:
                results.stageChanges.toAtRisk++;
                break;
              case STALL_STAGES.DIMINISHING:
                results.stageChanges.toDiminishing++;
                break;
              case STALL_STAGES.PAUSED:
                results.stageChanges.toPaused++;
                break;
            }

            console.log(
              `Updated participant ${participant.userId}: ${currentStallStage} -> ${newStallStage} (${daysInactive} days inactive)`
            );
          } else {
            results.errors++;
          }
        } else {
          results.skipped++;
        }
      } catch (error) {
        console.error(`Error evaluating participant ${participant.$id}:`, error);
        results.errors++;
      }
    }
  } catch (error) {
    console.error("Error in evaluation process:", error);
    throw error;
  }

  return results;
}

/**
 * Main function entry point
 */
export default async ({ req, res, log, error }) => {
  log("Stall Evaluator started");

  try {
    // Validate environment variables
    const endpoint = process.env.APPWRITE_ENDPOINT;
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;
    const databaseId = process.env.APPWRITE_DATABASE_ID;
    const participationCollectionId = process.env.PARTICIPATION_COLLECTION_ID || "cycle_participation";
    const cyclesCollectionId = process.env.CYCLES_COLLECTION_ID || "build_cycles";

    if (!endpoint || !projectId || !apiKey || !databaseId) {
      throw new Error("Missing required environment variables");
    }

    log("Environment variables validated");

    // Initialize Appwrite client
    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

    const databases = new Databases(client);

    log("Appwrite client initialized");

    // Run evaluation
    log("Starting participant evaluation...");
    const results = await evaluateParticipants(databases, databaseId, participationCollectionId, cyclesCollectionId);

    log("Evaluation complete");
    log(`Results: ${JSON.stringify(results, null, 2)}`);

    // Return success response
    return res.json({
      success: true,
      message: "Stall evaluation completed successfully",
      timestamp: new Date().toISOString(),
      results: results,
    });
  } catch (err) {
    error("Stall Evaluator failed:", err);

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
