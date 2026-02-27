// Test the Appwrite function via API
const https = require('http');

const data = JSON.stringify({
  userId: 'user123',
  cycleId: 'cycle456'
});

const options = {
  hostname: '148.230.90.1',
  port: 80,
  path: '/v1/functions/69933d31002f287121c6/executions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'X-Appwrite-Project': '69948407003ab1a59d8d'
  }
};

console.log('Testing function execution...\n');

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('\nResponse:');
    try {
      const parsed = JSON.parse(responseData);
      console.log(JSON.stringify(parsed, null, 2));
      
      // Wait a bit then check the execution result
      if (parsed.$id) {
        console.log('\n\nWaiting 3 seconds for execution to complete...');
        setTimeout(() => {
          checkExecution(parsed.$id);
        }, 3000);
      }
    } catch (e) {
      console.log(responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();

function checkExecution(executionId) {
  const checkOptions = {
    hostname: '148.230.90.1',
    port: 80,
    path: `/v1/functions/69933d31002f287121c6/executions/${executionId}`,
    method: 'GET',
    headers: {
      'X-Appwrite-Project': '69948407003ab1a59d8d'
    }
  };

  console.log('\nChecking execution result...\n');

  const checkReq = https.request(checkOptions, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      try {
        const parsed = JSON.parse(responseData);
        console.log('Execution Status:', parsed.status);
        console.log('Response Status Code:', parsed.responseStatusCode);
        console.log('\nFunction Response Body:');
        console.log(parsed.responseBody);
        
        if (parsed.responseBody) {
          try {
            const functionResult = JSON.parse(parsed.responseBody);
            console.log('\nParsed Function Result:');
            console.log(JSON.stringify(functionResult, null, 2));
          } catch (e) {
            console.log('(Could not parse as JSON)');
          }
        }
        
        if (parsed.logs) {
          console.log('\nFunction Logs:');
          console.log(parsed.logs);
        }
        
        if (parsed.errors) {
          console.log('\nFunction Errors:');
          console.log(parsed.errors);
        }
      } catch (e) {
        console.log(responseData);
      }
    });
  });

  checkReq.on('error', (error) => {
    console.error('Error:', error);
  });

  checkReq.end();
}
