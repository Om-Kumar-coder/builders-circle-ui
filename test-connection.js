const { Client, Databases } = require('appwrite');

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'http://148.230.90.1/v1')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '69adee6a00043e4e9c46');

const databases = new Databases(client);

async function testConnection() {
  try {
    console.log('Testing connection to:', process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'http://148.230.90.1:9501/v1');
    
    const response = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '69b008400000b872c17a',
      'build_cycles'
    );
    
    console.log('✅ Connection successful!');
    console.log('Build cycles found:', response.documents.length);
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
  }
}

testConnection();