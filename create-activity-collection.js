/**
 * Script to create the activity_events collection in Appwrite
 * Run with: node create-activity-collection.js
 */

const fs = require('fs');
const { Client, Databases, ID, Permission, Role } = require('node-appwrite');

// Load environment variables
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
}

async function createActivityCollection() {
  console.log('🚀 Creating activity_events collection...\n');

  // Validate environment variables
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!projectId || !databaseId) {
    console.error('❌ Missing required environment variables!');
    console.log('\nRequired in .env.local:');
    console.log('  NEXT_PUBLIC_APPWRITE_PROJECT_ID');
    console.log('  NEXT_PUBLIC_APPWRITE_DATABASE_ID');
    console.log('  APPWRITE_API_KEY (for creation)');
    return;
  }

  if (!apiKey) {
    console.error('❌ APPWRITE_API_KEY not found!');
    console.log('\nTo create collections, you need an API key with database permissions.');
    console.log('1. Go to Appwrite Console → Settings → API Keys');
    console.log('2. Create a new API key with database permissions');
    console.log('3. Add it to .env.local: APPWRITE_API_KEY=your_key_here');
    return;
  }

  console.log('Environment:');
  console.log(`  Endpoint: ${endpoint}`);
  console.log(`  Project: ${projectId}`);
  console.log(`  Database: ${databaseId}`);
  console.log(`  API Key: ***${apiKey.slice(-4)}\n`);

  try {
    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);

    const databases = new Databases(client);

    // Create collection
    console.log('Creating collection: activity_events...');
    const collection = await databases.createCollection(
      databaseId,
      'activity_events', // Collection ID
      'Activity Events',  // Collection Name
      [
        Permission.read(Role.any()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ]
    );
    console.log('✅ Collection created!\n');

    // Create attributes
    console.log('Creating attributes...');

    // userId (string, required)
    await databases.createStringAttribute(
      databaseId,
      'activity_events',
      'userId',
      999,
      true // required
    );
    console.log('  ✓ userId');

    // Wait a bit between attribute creations
    await new Promise(resolve => setTimeout(resolve, 1000));

    // cycleId (string, required)
    await databases.createStringAttribute(
      databaseId,
      'activity_events',
      'cycleId',
      999,
      true // required
    );
    console.log('  ✓ cycleId');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // activityType (string, required)
    await databases.createStringAttribute(
      databaseId,
      'activity_events',
      'activityType',
      999,
      true // required
    );
    console.log('  ✓ activityType');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // proofLink (string, required)
    await databases.createStringAttribute(
      databaseId,
      'activity_events',
      'proofLink',
      9999,
      true // required
    );
    console.log('  ✓ proofLink');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // description (string, optional)
    await databases.createStringAttribute(
      databaseId,
      'activity_events',
      'description',
      9999,
      false // optional
    );
    console.log('  ✓ description');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // verified (string, required, default: 'pending')
    await databases.createStringAttribute(
      databaseId,
      'activity_events',
      'verified',
      999,
      true, // required
      'pending' // default value
    );
    console.log('  ✓ verified');

    console.log('\n✅ All attributes created!');
    console.log('\n⏳ Waiting for attributes to be available (this may take a minute)...');
    
    // Wait for attributes to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Create indexes for better performance
    console.log('\nCreating indexes...');

    try {
      await databases.createIndex(
        databaseId,
        'activity_events',
        'userId_cycleId_idx',
        'key',
        ['userId', 'cycleId'],
        ['ASC', 'ASC']
      );
      console.log('  ✓ userId_cycleId_idx');
    } catch (err) {
      console.log('  ⚠ Index creation skipped (may already exist or attributes not ready)');
    }

    console.log('\n🎉 Activity Events collection is ready!');
    console.log('\nNext steps:');
    console.log('1. Add to .env.local:');
    console.log('   NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID=activity_events');
    console.log('2. Restart your development server');
    console.log('3. Try submitting an activity again');

  } catch (error) {
    console.error('\n❌ Error creating collection:', error.message);
    
    if (error.code === 409) {
      console.log('\n💡 Collection may already exist. Checking...');
      console.log('Go to Appwrite Console → Databases → Your Database');
      console.log('Look for "activity_events" collection');
      console.log('\nIf it exists, just add to .env.local:');
      console.log('NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID=activity_events');
    } else if (error.code === 401) {
      console.log('\n💡 API key may be invalid or expired.');
      console.log('Create a new API key with database permissions.');
    }
  }
}

createActivityCollection();
