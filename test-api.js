// Simple test to verify API connectivity
const https = require('https');

function testAPI() {
  console.log('🧪 Testing API connectivity...');
  
  // Test health endpoint
  const options = {
    hostname: 'triagebuilders.com',
    port: 443,
    path: '/api/health',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Response:', data);
      
      // Test login endpoint
      testLogin();
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.end();
}

function testLogin() {
  console.log('\n🔐 Testing login endpoint...');
  
  const postData = JSON.stringify({
    email: 'founder@test.com',
    password: 'founder123'
  });

  const options = {
    hostname: 'triagebuilders.com',
    port: 443,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Login Status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Login Response:', data);
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with login request: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

testAPI();