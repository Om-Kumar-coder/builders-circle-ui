// Test script to verify Appwrite connection for build cycles
// Run with: node test-cycles-connection.js

const fs = require('fs');
const { Client, Databases, Query } = require('node-appwrite');

// Load .env.local manually
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

async function testConnection() {
  console.log('🔍 Testing Appwrite Build Cycles Connection...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('  Endpoint:', process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT);
  console.log('  Project ID:', process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);
  console.log('  Database ID:', process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID);
  console.log('  Cycles Collection ID:', process.env.NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID);
  console.log('');

  if (!process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || !process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID) {
    console.error('❌ Missing required environment variables!');
    console.log('Make sure .env.local exists with all required values.');
    return;
  }

  // Initialize client
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

  const databases = new Databases(client);

  try {
    console.log('🔌 Attempting to connect to Appwrite...');
    
    const response = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      process.env.NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID,
      [Query.orderDesc('createdAt')]
    );

    console.log('✅ Connection successful!\n');
    console.log(`📊 Found ${response.total} build cycle(s):\n`);
    
    if (response.documents.length === 0) {
      console.log('  No cycles found in the database.');
      console.log('  This is normal if you haven\'t created any cycles yet.');
    } else {
      response.documents.forEach((cycle, index) => {
        console.log(`  ${index + 1}. ${cycle.name}`);
        console.log(`     State: ${cycle.state}`);
        console.log(`     Start: ${cycle.startDate}`);
        console.log(`     End: ${cycle.endDate}`);
        console.log(`     Participants: ${cycle.participantCount || 0}`);
        console.log('');
      });
    }

    console.log('✨ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Connection failed!\n');
    console.error('Error:', error.message);
    console.log('\n💡 Common issues:');
    console.log('  1. Check if Project ID is correct');
    console.log('  2. Check if Database ID exists in your Appwrite project');
    console.log('  3. Check if Collection ID matches your Appwrite collection');
    console.log('  4. Verify API permissions allow reading the collection');
    console.log('  5. Check if Appwrite endpoint is accessible');
  }
}

testConnection();
