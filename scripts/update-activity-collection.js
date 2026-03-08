/**
 * Update Activity Collection Script
 * Adds new fields to existing activity collection for contribution weighting
 * 
 * Usage: node scripts/update-activity-collection.js
 */

const { Client, Databases } = require('node-appwrite');

// Configuration
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const ACTIVITY_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID || 'activity';

if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || !DATABASE_ID) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

async function updateActivityCollection() {
  console.log('🚀 Updating activity collection...');
  console.log(`   Collection: ${ACTIVITY_COLLECTION_ID}`);
  
  try {
    // Add contributionType field
    console.log('\n📝 Adding contributionType field...');
    await databases.createEnumAttribute(
      DATABASE_ID,
      ACTIVITY_COLLECTION_ID,
      'contributionType',
      ['code', 'documentation', 'review', 'hours_logged'],
      false, // not required for backward compatibility
      'code' // default value
    );
    console.log('   ✅ contributionType added');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Add contributionWeight field
    console.log('\n📝 Adding contributionWeight field...');
    await databases.createFloatAttribute(
      DATABASE_ID,
      ACTIVITY_COLLECTION_ID,
      'contributionWeight',
      false, // not required for backward compatibility
      0.0,
      10.0,
      1.0 // default value
    );
    console.log('   ✅ contributionWeight added');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Add calculatedOwnership field
    console.log('\n📝 Adding calculatedOwnership field...');
    await databases.createFloatAttribute(
      DATABASE_ID,
      ACTIVITY_COLLECTION_ID,
      'calculatedOwnership',
      false, // not required for backward compatibility
      0.0,
      1000000.0,
      0.0 // default value
    );
    console.log('   ✅ calculatedOwnership added');
    
    console.log('\n✅ Activity collection updated successfully!');
    console.log('\n📋 New fields added:');
    console.log('   - contributionType (enum)');
    console.log('   - contributionWeight (float)');
    console.log('   - calculatedOwnership (float)');
    
  } catch (error) {
    if (error.code === 409) {
      console.log('   ⚠️  Fields may already exist');
    } else {
      console.error('   ❌ Error:', error.message);
      throw error;
    }
  }
}

updateActivityCollection().catch(error => {
  console.error('\n❌ Update failed:', error);
  process.exit(1);
});
