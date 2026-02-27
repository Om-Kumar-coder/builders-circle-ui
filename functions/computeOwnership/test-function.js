// Quick test script to verify function locally
// Run with: node test-function.js

const main = require('./src/main.js');

// Mock context object (Appwrite Functions v4+ signature)
const mockContext = {
  req: {
    bodyJson: {
      userId: 'test-user',
      cycleId: 'test-cycle'
    },
    body: JSON.stringify({
      userId: 'test-user',
      cycleId: 'test-cycle'
    })
  },
  res: {
    json: (data) => {
      console.log('\n=== FUNCTION RESPONSE ===');
      console.log(JSON.stringify(data, null, 2));
      console.log('=========================\n');
      return data;
    }
  },
  log: (...args) => {
    console.log('[LOG]', ...args);
  },
  error: (...args) => {
    console.error('[ERROR]', ...args);
  }
};

console.log('Testing function locally...\n');
console.log('Request payload:', mockContext.req.body);
console.log('\nEnvironment variables:');
console.log('- APPWRITE_FUNCTION_API_ENDPOINT:', process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'NOT SET');
console.log('- APPWRITE_FUNCTION_PROJECT_ID:', process.env.APPWRITE_FUNCTION_PROJECT_ID || 'NOT SET');
console.log('- APPWRITE_API_KEY:', process.env.APPWRITE_API_KEY ? 'SET' : 'NOT SET');
console.log('- DATABASE_ID:', process.env.DATABASE_ID || 'NOT SET');
console.log('- LEDGER_COLLECTION_ID:', process.env.LEDGER_COLLECTION_ID || 'NOT SET');
console.log('- MULTIPLIER_COLLECTION_ID:', process.env.MULTIPLIER_COLLECTION_ID || 'NOT SET');
console.log('\n');

main(mockContext).catch(err => {
  console.error('Function threw error:', err);
  process.exit(1);
});
