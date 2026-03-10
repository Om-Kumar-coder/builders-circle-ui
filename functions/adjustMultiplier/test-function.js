/**
 * Test script for adjustMultiplier function
 * 
 * Usage: node test-function.js
 */

import { Client, Databases } from "node-appwrite";

// Mock environment variables for testing
process.env.APPWRITE_ENDPOINT = "https://cloud.appwrite.io/v1";
process.env.APPWRITE_PROJECT_ID = "69adee6a00043e4e9c46";
process.env.APPWRITE_API_KEY = "YOUR_API_KEY_HERE";
process.env.APPWRITE_DATABASE_ID = "69b008400000b872c17a";
process.env.PARTICIPATION_COLLECTION_ID = "cycle_participation";
process.env.MULTIPLIERS_COLLECTION_ID = "multipliers";
process.env.LEDGER_COLLECTION_ID = "ownership_ledger";
process.env.CYCLES_COLLECTION_ID = "build_cycles";

// Import the function
import adjustMultiplier from "./src/main.js";

// Mock context
const mockContext = {
  req: {
    bodyJson: {},
    body: {},
  },
  res: {
    json: (data, status) => {
      console.log("\n=== RESPONSE ===");
      console.log(`Status: ${status || 200}`);
      console.log(JSON.stringify(data, null, 2));
      return data;
    },
  },
  log: (...args) => {
    console.log("[LOG]", ...args);
  },
  error: (...args) => {
    console.error("[ERROR]", ...args);
  },
};

// Run the test
console.log("=== Testing adjustMultiplier Function ===\n");

adjustMultiplier(mockContext)
  .then(() => {
    console.log("\n=== Test Complete ===");
  })
  .catch((error) => {
    console.error("\n=== Test Failed ===");
    console.error(error);
    process.exit(1);
  });
