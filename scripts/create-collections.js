/**
 * Builder's Circle - Automated Collection Creation Script
 * 
 * This script creates all required Appwrite collections with proper attributes and indexes.
 * Run this after creating your Appwrite project and database.
 * 
 * Usage:
 * 1. Update the configuration variables below
 * 2. Run: node scripts/create-collections.js
 */

const sdk = require('node-appwrite');

// ========================================
// CONFIGURATION - UPDATE THESE VALUES
// ========================================
const CONFIG = {
  endpoint: 'https://your-domain.com/v1', // or http://YOUR_SERVER_IP/v1
  projectId: 'YOUR_PROJECT_ID',
  apiKey: 'YOUR_API_KEY',
  databaseId: '69b008400000b872c17a',
};

// ========================================
// COLLECTION SCHEMAS
// ========================================
const COLLECTIONS = [
  {
    id: 'ownership_ledger',
    name: 'ownership_ledger',
    permissions: ['read("users")'],
    documentSecurity: true,
    attributes: [
      { key: 'userId', type: 'string', size: 999, required: true },
      { key: 'cycleId', type: 'string', size: 999, required: true },
      { key: 'eventType', type: 'string', size: 999, required: true },
      { key: 'ownershipAmount', type: 'double', required: true },
      { key: 'multiplierSnapshot', type: 'double', required: true },
      { key: 'scourceReference', type: 'string', size: 999, required: false },
      { key: 'createdBy', type: 'string', size: 999, required: true },
    ],
    indexes: [
      { key: 'userId_cycleId', type: 'key', attributes: ['userId', 'cycleId'] },
      { key: 'cycleId', type: 'key', attributes: ['cycleId'] },
      { key: 'userId', type: 'key', attributes: ['userId'] },
    ],
  },
  {
    id: 'multipliers',
    name: 'multipliers',
    permissions: ['read("users")'],
    documentSecurity: true,
    attributes: [
      { key: 'userId', type: 'string', size: 999, required: false },
      { key: 'cycleId', type: 'string', size: 999, required: false },
      { key: 'multiplier', type: 'double', required: false },
      { key: 'reason', type: 'string', size: 9999, required: false },
    ],
    indexes: [
      { key: 'userId_cycleId', type: 'key', attributes: ['userId', 'cycleId'], orders: ['DESC'] },
    ],
  },
  {
    id: 'build_cycles',
    name: 'build_cycles',
    permissions: ['read("users")'],
    documentSecurity: false,
    attributes: [
      { key: 'name', type: 'string', size: 255, required: true },
      { key: 'state', type: 'string', size: 50, required: true },
      { key: 'startDate', type: 'datetime', required: true },
      { key: 'endDate', type: 'datetime', required: true },
      { key: 'participantCount', type: 'integer', required: false, default: 0 },
    ],
    indexes: [
      { key: 'state', type: 'key', attributes: ['state'] },
      { key: 'startDate', type: 'key', attributes: ['startDate'], orders: ['DESC'] },
    ],
  },
  {
    id: 'cycle_participation',
    name: 'cycle_participation',
    permissions: ['read("users")'],
    documentSecurity: false,
    attributes: [
      { key: 'userId', type: 'string', size: 999, required: true },
      { key: 'cycleId', type: 'string', size: 999, required: true },
      { key: 'optedIn', type: 'boolean', required: true, default: true },
      { key: 'participationStatus', type: 'string', size: 50, required: true },
      { key: 'stallStage', type: 'string', size: 50, required: true },
      { key: 'lastActivityDate', type: 'datetime', required: false },
    ],
    indexes: [
      { key: 'userId_cycleId', type: 'unique', attributes: ['userId', 'cycleId'] },
      { key: 'cycleId', type: 'key', attributes: ['cycleId'] },
      { key: 'userId', type: 'key', attributes: ['userId'] },
      { key: 'stallStage', type: 'key', attributes: ['stallStage'] },
    ],
  },
  {
    id: 'activity_events',
    name: 'activity_events',
    permissions: ['read("users")', 'create("users")'],
    documentSecurity: false,
    attributes: [
      { key: 'userId', type: 'string', size: 999, required: true },
      { key: 'cycleId', type: 'string', size: 999, required: true },
      { key: 'activityType', type: 'string', size: 999, required: true },
      { key: 'proofLink', type: 'string', size: 9999, required: true },
      { key: 'description', type: 'string', size: 9999, required: false },
      { key: 'verified', type: 'string', size: 50, required: true, default: 'pending' },
    ],
    indexes: [
      { key: 'userId_cycleId', type: 'key', attributes: ['userId', 'cycleId'], orders: ['DESC'] },
      { key: 'cycleId', type: 'key', attributes: ['cycleId'], orders: ['DESC'] },
      { key: 'userId', type: 'key', attributes: ['userId'], orders: ['DESC'] },
    ],
  },
  {
    id: 'notifications',
    name: 'notifications',
    permissions: ['read("users")', 'create("users")'],
    documentSecurity: true,
    attributes: [
      { key: 'userId', type: 'string', size: 999, required: true },
      { key: 'type', type: 'string', size: 100, required: true },
      { key: 'message', type: 'string', size: 9999, required: true },
      { key: 'read', type: 'boolean', required: true, default: false },
      { key: 'metadata', type: 'string', size: 9999, required: false },
    ],
    indexes: [
      { key: 'userId_read', type: 'key', attributes: ['userId', 'read'], orders: ['DESC'] },
      { key: 'userId', type: 'key', attributes: ['userId'], orders: ['DESC'] },
    ],
  },
  {
    id: 'user_profiles',
    name: 'user_profiles',
    permissions: ['read("users")'],
    documentSecurity: true,
    attributes: [
      { key: 'userId', type: 'string', size: 999, required: true },
      { key: 'role', type: 'string', size: 50, required: true, default: 'member' },
      { key: 'status', type: 'string', size: 50, required: true, default: 'active' },
      { key: 'bio', type: 'string', size: 1000, required: false },
      { key: 'avatar', type: 'string', size: 500, required: false },
    ],
    indexes: [
      { key: 'userId', type: 'unique', attributes: ['userId'] },
    ],
  },
  {
    id: 'audit_logs',
    name: 'audit_logs',
    permissions: [],
    documentSecurity: false,
    attributes: [
      { key: 'actorId', type: 'string', size: 999, required: true },
      { key: 'action', type: 'string', size: 255, required: true },
      { key: 'targetType', type: 'string', size: 100, required: true },
      { key: 'targetId', type: 'string', size: 999, required: false },
      { key: 'reason', type: 'string', size: 9999, required: false },
      { key: 'metadata', type: 'string', size: 9999, required: false },
    ],
    indexes: [
      { key: 'actorId', type: 'key', attributes: ['actorId'], orders: ['DESC'] },
      { key: 'action', type: 'key', attributes: ['action'], orders: ['DESC'] },
    ],
  },
];

// ========================================
// MAIN SCRIPT
// ========================================
async function createCollections() {
  console.log('========================================');
  console.log('Builder\'s Circle - Collection Setup');
  console.log('========================================\n');

  // Initialize Appwrite client
  const client = new sdk.Client()
    .setEndpoint(CONFIG.endpoint)
    .setProject(CONFIG.projectId)
    .setKey(CONFIG.apiKey);

  const databases = new sdk.Databases(client);

  console.log('✅ Connected to Appwrite\n');

  // Create each collection
  for (const collectionSchema of COLLECTIONS) {
    try {
      console.log(`📦 Creating collection: ${collectionSchema.name}`);

      // Create collection
      const collection = await databases.createCollection(
        CONFIG.databaseId,
        collectionSchema.id,
        collectionSchema.name,
        collectionSchema.permissions,
        collectionSchema.documentSecurity
      );

      console.log(`   ✅ Collection created: ${collection.$id}`);

      // Create attributes
      for (const attr of collectionSchema.attributes) {
        try {
          let attribute;
          
          switch (attr.type) {
            case 'string':
              attribute = await databases.createStringAttribute(
                CONFIG.databaseId,
                collectionSchema.id,
                attr.key,
                attr.size,
                attr.required,
                attr.default || null
              );
              break;
            
            case 'integer':
              attribute = await databases.createIntegerAttribute(
                CONFIG.databaseId,
                collectionSchema.id,
                attr.key,
                attr.required,
                null,
                null,
                attr.default || null
              );
              break;
            
            case 'double':
              attribute = await databases.createFloatAttribute(
                CONFIG.databaseId,
                collectionSchema.id,
                attr.key,
                attr.required,
                null,
                null,
                attr.default || null
              );
              break;
            
            case 'boolean':
              attribute = await databases.createBooleanAttribute(
                CONFIG.databaseId,
                collectionSchema.id,
                attr.key,
                attr.required,
                attr.default || null
              );
              break;
            
            case 'datetime':
              attribute = await databases.createDatetimeAttribute(
                CONFIG.databaseId,
                collectionSchema.id,
                attr.key,
                attr.required,
                attr.default || null
              );
              break;
          }

          console.log(`   ✅ Attribute created: ${attr.key} (${attr.type})`);
          
          // Wait a bit for attribute to be ready
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.log(`   ⚠️  Attribute ${attr.key} may already exist or error: ${error.message}`);
        }
      }

      // Wait for all attributes to be ready before creating indexes
      console.log(`   ⏳ Waiting for attributes to be ready...`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Create indexes
      for (const index of collectionSchema.indexes) {
        try {
          const indexResult = await databases.createIndex(
            CONFIG.databaseId,
            collectionSchema.id,
            index.key,
            index.type,
            index.attributes,
            index.orders || []
          );

          console.log(`   ✅ Index created: ${index.key}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.log(`   ⚠️  Index ${index.key} may already exist or error: ${error.message}`);
        }
      }

      console.log(`   ✅ Collection ${collectionSchema.name} setup complete\n`);
    } catch (error) {
      console.log(`   ⚠️  Collection ${collectionSchema.name} may already exist or error: ${error.message}\n`);
    }
  }

  console.log('========================================');
  console.log('✅ All collections created successfully!');
  console.log('========================================\n');
  console.log('Next Steps:');
  console.log('1. Verify collections in Appwrite Console');
  console.log('2. Deploy Appwrite Functions');
  console.log('3. Configure frontend .env.local');
  console.log('4. Test the application\n');
}

// Run the script
createCollections().catch(console.error);
