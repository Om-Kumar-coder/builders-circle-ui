/**
 * Appwrite Collection Setup Script
 * Run this script to create all required collections for production enhancements
 * 
 * Usage: node scripts/setup-collections.js
 */

const { Client, Databases, ID, Permission, Role } = require('node-appwrite');

// Configuration
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;

if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || !DATABASE_ID) {
  console.error('❌ Missing required environment variables:');
  console.error('   APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

async function createCollection(collectionId, collectionName, attributes, indexes) {
  try {
    console.log(`\n📦 Creating collection: ${collectionName} (${collectionId})`);
    
    // Create collection
    await databases.createCollection(
      DATABASE_ID,
      collectionId,
      collectionName,
      [
        Permission.read(Role.any()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users())
      ]
    );
    
    console.log(`   ✅ Collection created`);
    
    // Create attributes
    for (const attr of attributes) {
      console.log(`   📝 Adding attribute: ${attr.key}`);
      
      if (attr.type === 'string') {
        await databases.createStringAttribute(
          DATABASE_ID,
          collectionId,
          attr.key,
          attr.size,
          attr.required,
          attr.default,
          attr.array || false
        );
      } else if (attr.type === 'integer') {
        await databases.createIntegerAttribute(
          DATABASE_ID,
          collectionId,
          attr.key,
          attr.required,
          attr.min,
          attr.max,
          attr.default,
          attr.array || false
        );
      } else if (attr.type === 'float') {
        await databases.createFloatAttribute(
          DATABASE_ID,
          collectionId,
          attr.key,
          attr.required,
          attr.min,
          attr.max,
          attr.default,
          attr.array || false
        );
      } else if (attr.type === 'boolean') {
        await databases.createBooleanAttribute(
          DATABASE_ID,
          collectionId,
          attr.key,
          attr.required,
          attr.default,
          attr.array || false
        );
      } else if (attr.type === 'datetime') {
        await databases.createDatetimeAttribute(
          DATABASE_ID,
          collectionId,
          attr.key,
          attr.required,
          attr.default,
          attr.array || false
        );
      } else if (attr.type === 'enum') {
        await databases.createEnumAttribute(
          DATABASE_ID,
          collectionId,
          attr.key,
          attr.elements,
          attr.required,
          attr.default,
          attr.array || false
        );
      }
      
      // Wait for attribute to be available
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Create indexes
    for (const index of indexes) {
      console.log(`   🔍 Creating index: ${index.key}`);
      await databases.createIndex(
        DATABASE_ID,
        collectionId,
        index.key,
        index.type,
        index.attributes,
        index.orders || []
      );
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`   ✅ Collection ${collectionName} setup complete`);
    
  } catch (error) {
    if (error.code === 409) {
      console.log(`   ⚠️  Collection ${collectionName} already exists`);
    } else {
      console.error(`   ❌ Error creating ${collectionName}:`, error.message);
      throw error;
    }
  }
}

async function setupCollections() {
  console.log('🚀 Starting Appwrite collection setup...');
  console.log(`   Endpoint: ${APPWRITE_ENDPOINT}`);
  console.log(`   Project: ${APPWRITE_PROJECT_ID}`);
  console.log(`   Database: ${DATABASE_ID}`);
  
  // 1. system_logs collection
  await createCollection(
    'system_logs',
    'System Logs',
    [
      { key: 'event', type: 'string', size: 255, required: true },
      { key: 'severity', type: 'enum', elements: ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'], required: true },
      { key: 'message', type: 'string', size: 5000, required: true },
      { key: 'timestamp', type: 'datetime', required: true },
      { key: 'userId', type: 'string', size: 255, required: false },
      { key: 'metadata', type: 'string', size: 10000, required: false } // JSON serialized
    ],
    [
      { key: 'timestamp_desc', type: 'key', attributes: ['timestamp'], orders: ['DESC'] },
      { key: 'severity_timestamp', type: 'key', attributes: ['severity', 'timestamp'] },
      { key: 'userId_timestamp', type: 'key', attributes: ['userId', 'timestamp'] }
    ]
  );
  
  // 2. audit_trail collection
  await createCollection(
    'audit_trail',
    'Audit Trail',
    [
      { key: 'adminId', type: 'string', size: 255, required: true },
      { key: 'action', type: 'enum', elements: ['ownership_override', 'stall_clear', 'multiplier_restore', 'dispute_resolution'], required: true },
      { key: 'targetUserId', type: 'string', size: 255, required: true },
      { key: 'previousValue', type: 'string', size: 5000, required: false }, // JSON serialized
      { key: 'newValue', type: 'string', size: 5000, required: false }, // JSON serialized
      { key: 'reason', type: 'string', size: 2000, required: true },
      { key: 'timestamp', type: 'datetime', required: true }
    ],
    [
      { key: 'timestamp_desc', type: 'key', attributes: ['timestamp'], orders: ['DESC'] },
      { key: 'adminId_timestamp', type: 'key', attributes: ['adminId', 'timestamp'] },
      { key: 'targetUserId_timestamp', type: 'key', attributes: ['targetUserId', 'timestamp'] },
      { key: 'action_timestamp', type: 'key', attributes: ['action', 'timestamp'] }
    ]
  );
  
  // 3. disputes collection
  await createCollection(
    'disputes',
    'Disputes',
    [
      { key: 'userId', type: 'string', size: 255, required: true },
      { key: 'activityId', type: 'string', size: 255, required: true },
      { key: 'reason', type: 'string', size: 2000, required: true },
      { key: 'status', type: 'enum', elements: ['pending', 'approved', 'denied'], required: true, default: 'pending' },
      { key: 'resolution', type: 'string', size: 2000, required: false },
      { key: 'createdAt', type: 'datetime', required: true },
      { key: 'resolvedAt', type: 'datetime', required: false },
      { key: 'resolvedBy', type: 'string', size: 255, required: false }
    ],
    [
      { key: 'status_createdAt', type: 'key', attributes: ['status', 'createdAt'] },
      { key: 'userId_status', type: 'key', attributes: ['userId', 'status'] }
    ]
  );
  
  // 4. notifications collection
  await createCollection(
    'notifications',
    'Notifications',
    [
      { key: 'userId', type: 'string', size: 255, required: true },
      { key: 'type', type: 'enum', elements: ['stall_change', 'activity_status', 'dispute_resolved'], required: true },
      { key: 'message', type: 'string', size: 2000, required: true },
      { key: 'metadata', type: 'string', size: 5000, required: false }, // JSON serialized
      { key: 'sent', type: 'boolean', required: true, default: false },
      { key: 'createdAt', type: 'datetime', required: true },
      { key: 'sentAt', type: 'datetime', required: false }
    ],
    [
      { key: 'sent_createdAt', type: 'key', attributes: ['sent', 'createdAt'] },
      { key: 'userId_sent', type: 'key', attributes: ['userId', 'sent'] }
    ]
  );
  
  // 5. archived_activities collection
  await createCollection(
    'archived_activities',
    'Archived Activities',
    [
      { key: 'userId', type: 'string', size: 255, required: true },
      { key: 'cycleId', type: 'string', size: 255, required: true },
      { key: 'activityType', type: 'string', size: 255, required: true },
      { key: 'proofLink', type: 'string', size: 2000, required: true },
      { key: 'description', type: 'string', size: 2000, required: false },
      { key: 'verified', type: 'string', size: 50, required: true },
      { key: 'contributionType', type: 'enum', elements: ['code', 'documentation', 'review', 'hours_logged'], required: false },
      { key: 'contributionWeight', type: 'float', required: false },
      { key: 'calculatedOwnership', type: 'float', required: false },
      { key: 'archivedAt', type: 'datetime', required: true },
      { key: 'originalId', type: 'string', size: 255, required: true }
    ],
    [
      { key: 'archivedAt_desc', type: 'key', attributes: ['archivedAt'], orders: ['DESC'] },
      { key: 'userId_archivedAt', type: 'key', attributes: ['userId', 'archivedAt'] }
    ]
  );
  
  console.log('\n✅ All collections created successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Update activity collection with new fields (run update-activity-collection.js)');
  console.log('   2. Verify collections in Appwrite console');
  console.log('   3. Continue with implementation tasks');
}

setupCollections().catch(error => {
  console.error('\n❌ Setup failed:', error);
  process.exit(1);
});
