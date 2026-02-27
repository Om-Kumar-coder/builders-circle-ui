/**
 * Script to add missing 'description' attribute to activity_events collection
 * Run with: node add-description-attribute.js
 */

const fs = require('fs');
const { Client, Databases } = require('node-appwrite');

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

async function addDescriptionAttribute() {
  console.log('🔧 Adding description attribute to activity_events...\n');

  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  console.log('Environment:');
  console.log(`  Endpoint: ${endpoint}`);
  console.log(`  Project: ${projectId}`);
  console.log(`  Database: ${databaseId}`);
  console.log(`  API Key: ***${apiKey.slice(-4)}\n`);

  try {
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);

    const databases = new Databases(client);

    console.log('Adding description attribute...');
    await databases.createStringAttribute(
      databaseId,
      'activity_events',
      'description',
      9999,
      false // optional
    );

    console.log('✅ Description attribute added successfully!');
    console.log('\n⏳ Wait 1-2 minutes for the attribute to be indexed.');
    console.log('Then restart your dev server and try submitting an activity.');

  } catch (error) {
    if (error.code === 409) {
      console.log('✅ Description attribute already exists!');
      console.log('You can proceed with submitting activities.');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

addDescriptionAttribute();
