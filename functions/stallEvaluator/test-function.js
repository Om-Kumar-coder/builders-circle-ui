/**
 * Local test script for Stall Evaluator function
 * Run with: node test-function.js
 */

import { Client, Databases, Query } from "node-appwrite";
import fs from "fs";

// Load environment variables from .env file
function loadEnv() {
  if (fs.existsSync("../../.env.local")) {
    const envContent = fs.readFileSync("../../.env.local", "utf8");
    envContent.split("\n").forEach((line) => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

// Mock request/response objects
const mockReq = {};
const mockRes = {
  json: (data, status = 200) => {
    console.log("\n=== RESPONSE ===");
    console.log(`Status: ${status}`);
    console.log(JSON.stringify(data, null, 2));
    return data;
  },
};
const mockLog = (...args) => console.log("[LOG]", ...args);
const mockError = (...args) => console.error("[ERROR]", ...args);

// Import and run the function
async function testFunction() {
  console.log("=== Stall Evaluator Test ===\n");

  try {
    // Import the main function
    const module = await import("./src/main.js");
    const stallEvaluator = module.default;

    // Set test environment variables
    process.env.APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://148.230.90.1:9501/v1";
    process.env.APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    process.env.APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "YOUR_API_KEY_HERE";
    process.env.APPWRITE_DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    process.env.PARTICIPATION_COLLECTION_ID = "cycle_participation";
    process.env.CYCLES_COLLECTION_ID = "build_cycles";

    console.log("Environment:");
    console.log(`  Endpoint: ${process.env.APPWRITE_ENDPOINT}`);
    console.log(`  Project: ${process.env.APPWRITE_PROJECT_ID}`);
    console.log(`  Database: ${process.env.APPWRITE_DATABASE_ID}`);
    console.log(`  API Key: ${process.env.APPWRITE_API_KEY ? "***" + process.env.APPWRITE_API_KEY.slice(-4) : "NOT SET"}`);
    console.log("");

    if (!process.env.APPWRITE_API_KEY || process.env.APPWRITE_API_KEY === "YOUR_API_KEY_HERE") {
      console.error("ERROR: APPWRITE_API_KEY not set!");
      console.log("\nTo test this function:");
      console.log("1. Create an API key in Appwrite Console");
      console.log("2. Add it to your .env.local file:");
      console.log("   APPWRITE_API_KEY=your_api_key_here");
      console.log("3. Run this test again");
      return;
    }

    // Execute the function
    await stallEvaluator({
      req: mockReq,
      res: mockRes,
      log: mockLog,
      error: mockError,
    });
  } catch (err) {
    console.error("\n=== TEST FAILED ===");
    console.error(err);
  }
}

testFunction();
