const sdk = require("node-appwrite");

module.exports = async function (context) {
  try {
    // Parse payload from request body
    const payload = context.req.bodyJson || context.req.body || {};
    const userId = payload.userId;
    const cycleId = payload.cycleId;

    context.log(`Received request with userId: ${userId}, cycleId: ${cycleId}`);

    if (!userId || !cycleId) {
      return context.res.json({
        success: false,
        error: "Missing userId or cycleId"
      });
    }

    // Validate environment variables
    const requiredEnvVars = [
      'APPWRITE_FUNCTION_API_ENDPOINT',
      'APPWRITE_FUNCTION_PROJECT_ID',
      'APPWRITE_API_KEY',
      'DATABASE_ID',
      'LEDGER_COLLECTION_ID',
      'MULTIPLIER_COLLECTION_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      return context.res.json({
        success: false,
        error: `Missing environment variables: ${missingVars.join(', ')}`
      });
    }

    const client = new sdk.Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new sdk.Databases(client);

    const databaseId = process.env.DATABASE_ID;
    const ledgerCollection = process.env.LEDGER_COLLECTION_ID;
    const multiplierCollection = process.env.MULTIPLIER_COLLECTION_ID;

    // 🔹 Fetch ledger events
    const ledgerDocs = await databases.listDocuments(
      databaseId,
      ledgerCollection,
      [
        sdk.Query.equal("userId", userId),
        sdk.Query.equal("cycleId", cycleId)
      ]
    );

    // 🔹 Sum ownership
    const totalOwnership = ledgerDocs.documents.reduce(
      (sum, doc) => sum + (doc.ownershipAmount || 0),
      0
    );

    // 🔹 Fetch latest multiplier
    const multiplierDocs = await databases.listDocuments(
      databaseId,
      multiplierCollection,
      [
        sdk.Query.equal("userId", userId),
        sdk.Query.equal("cycleId", cycleId),
        sdk.Query.orderDesc("$createdAt"),
        sdk.Query.limit(1)
      ]
    );

    const multiplier =
      multiplierDocs.documents.length > 0
        ? multiplierDocs.documents[0].multiplier
        : 1;

    const effectiveOwnership = totalOwnership * multiplier;

    return context.res.json({
      success: true,
      totalOwnership,
      multiplier,
      effectiveOwnership,
      entriesCount: ledgerDocs.total
    });

  } catch (error) {
    context.error("ComputeOwnership Error:", error);

    return context.res.json({
      success: false,
      error: error.message
    });
  }
};