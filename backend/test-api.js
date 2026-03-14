const { default: fetch } = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

async function testAPI() {
  try {
    console.log('🔄 Testing API endpoints...');
    
    // Test 1: Login to get token
    console.log('\n1️⃣ Testing login...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'admin123' // Correct password
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (!loginData.token) {
      console.log('❌ Login failed, cannot continue with authenticated tests');
      console.log('Response:', loginData);
      return;
    }
    
    const token = loginData.token;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    console.log('✅ Login successful, got token');
    
    // Test 2: Get contribution weights
    console.log('\n2️⃣ Testing contribution weights...');
    const weightsResponse = await fetch(`${API_BASE}/weights`, { headers });
    const weightsData = await weightsResponse.json();
    console.log('Weights response:', weightsData);
    
    // Test 3: Get activities
    console.log('\n3️⃣ Testing activities...');
    const activitiesResponse = await fetch(`${API_BASE}/activities`, { headers });
    const activitiesData = await activitiesResponse.json();
    console.log('Activities response:', activitiesData);
    
    // Test 4: Start session
    console.log('\n4️⃣ Testing session tracking...');
    const sessionResponse = await fetch(`${API_BASE}/sessions/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ pageVisited: '/test' })
    });
    const sessionData = await sessionResponse.json();
    console.log('Session response:', sessionData);
    
    // Test 5: Get session analytics
    console.log('\n5️⃣ Testing session analytics...');
    const analyticsResponse = await fetch(`${API_BASE}/sessions/analytics`, { headers });
    const analyticsData = await analyticsResponse.json();
    console.log('Analytics response:', analyticsData);
    
    // Test 6: Get pending activities (admin)
    console.log('\n6️⃣ Testing pending activities...');
    const pendingResponse = await fetch(`${API_BASE}/activities/pending`, { headers });
    const pendingData = await pendingResponse.json();
    console.log('Pending activities response:', pendingData);
    
    console.log('\n✅ All API tests completed!');
    
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
}

testAPI();