/**
 * Builder's Circle - Setup Verification Script
 * 
 * This script verifies that your Appwrite infrastructure is properly configured.
 * Run this after completing the setup to ensure everything is working.
 * 
 * Usage: node scripts/verify-setup.js
 */

const sdk = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

// Configuration from environment
const CONFIG = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
};

// Expected collections
const EXPECTED_COLLECTIONS = [
  'ownership_ledger',
  'multipliers',
  'build_cycles',
  'cycle_participation',
  'activity_events',
  'notifications',
  'user_profiles',
  'audit_logs',
];

// Expected functions
const EXPECTED_FUNCTIONS = [
  'computeOwnership', // computeOwnership
  '69b026500015eb784443', // stallEvaluator
  '69b02eed00387c6c0414', // adjustMultiplier
];

// Verification results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

function logSuccess(message) {
  console.log(`✅ ${message}`);
  results.passed.push(message);
}

function logError(message) {
  console.log(`❌ ${message}`);
  results.failed.push(message);
}

function logWarning(message) {
  console.log(`⚠️  ${message}`);
  results.warnings.push(message);
}

async function verifyEnvironmentVariables() {
  console.log('\n📋 Verifying Environment Variables...\n');

  const requiredVars = [
    'NEXT_PUBLIC_APPWRITE_ENDPOINT',
    'NEXT_PUBLIC_APPWRITE_PROJECT_ID',
    'NEXT_PUBLIC_APPWRITE_DATABASE_ID',
    'NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID',
    'NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID',
    'NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID',
    'NEXT_PUBLIC_APPWRITE_OWNERSHIP_COLLECTION_ID',
    'NEXT_PUBLIC_APPWRITE_MULTIPLIERS_COLLECTION_ID',
    'NEXT_PUBLIC_APPWRITE_FUNCTION_ID',
  ];

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      logSuccess(`${varName} is set`);
    } else {
      logError(`${varName} is missing`);
    }
  }
}

async function verifyAppwriteConnection() {
  console.log('\n🔌 Verifying Appwrite Connection...\n');

  try {
    const client = new sdk.Client()
      .setEndpoint(CONFIG.endpoint)
      .setProject(CONFIG.projectId);

    const health = new sdk.Health(client);
    const status = await health.get();

    logSuccess(`Connected to Appwrite (Status: ${status.status})`);
    return client;
  } catch (error) {
    logError(`Failed to connect to Appwrite: ${error.message}`);
    return null;
  }
}

async function verifyDatabase(client) {
  console.log('\n🗄️  Verifying Database...\n');

  try {
    // Note: This requires an API key with proper permissions
    // For now, we'll just verify the database ID is set
    if (CONFIG.databaseId) {
      logSuccess(`Database ID configured: ${CONFIG.databaseId}`);
    } else {
      logError('Database ID not configured');
    }
  } catch (error) {
    logWarning(`Could not verify database: ${error.message}`);
  }
}

async function verifyCollections() {
  console.log('\n📦 Verifying Collections...\n');

  const collectionIds = [
    process.env.NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID,
    process.env.NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID,
    process.env.NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID,
    process.env.NEXT_PUBLIC_APPWRITE_OWNERSHIP_COLLECTION_ID,
    process.env.NEXT_PUBLIC_APPWRITE_MULTIPLIERS_COLLECTION_ID,
    process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID,
  ];

  for (const collectionId of collectionIds) {
    if (collectionId) {
      logSuccess(`Collection ID configured: ${collectionId}`);
    } else {
      logWarning('Collection ID not configured');
    }
  }
}

async function verifyFunctions() {
  console.log('\n⚡ Verifying Functions...\n');

  const functionIds = [
    process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_ID,
    process.env.NEXT_PUBLIC_APPWRITE_STALL_EVALUATOR_FUNCTION_ID,
    process.env.NEXT_PUBLIC_APPWRITE_ADJUST_MULTIPLIER_FUNCTION_ID,
  ];

  for (const functionId of functionIds) {
    if (functionId) {
      logSuccess(`Function ID configured: ${functionId}`);
    } else {
      logWarning('Function ID not configured (optional)');
    }
  }
}

async function printSummary() {
  console.log('\n========================================');
  console.log('📊 Verification Summary');
  console.log('========================================\n');

  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);

  if (results.failed.length === 0) {
    console.log('\n🎉 All critical checks passed!');
    console.log('\nNext Steps:');
    console.log('1. Test user authentication (signup/login)');
    console.log('2. Create a build cycle');
    console.log('3. Test participation opt-in');
    console.log('4. Submit an activity');
    console.log('5. Verify function executions in Appwrite Console');
  } else {
    console.log('\n⚠️  Some checks failed. Please review the errors above.');
    console.log('\nFailed Checks:');
    results.failed.forEach(msg => console.log(`  - ${msg}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings (non-critical):');
    results.warnings.forEach(msg => console.log(`  - ${msg}`));
  }

  console.log('\n');
}

async function runVerification() {
  console.log('========================================');
  console.log('Builder\'s Circle - Setup Verification');
  console.log('========================================');

  await verifyEnvironmentVariables();
  const client = await verifyAppwriteConnection();
  
  if (client) {
    await verifyDatabase(client);
  }
  
  await verifyCollections();
  await verifyFunctions();
  await printSummary();
}

// Run verification
runVerification().catch(error => {
  console.error('\n❌ Verification failed with error:', error);
  process.exit(1);
});
