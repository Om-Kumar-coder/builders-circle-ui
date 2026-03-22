const { google } = require('googleapis');
const http = require('http');
const url = require('url');

// Set these in your environment or replace temporarily (do NOT commit real values)
const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || 'YOUR_GOOGLE_CLIENT_ID';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET';
const REDIRECT_URI  = 'http://localhost:3333/callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive.file'],
  prompt: 'consent',
});

console.log('\n👉 Open this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for Google to redirect back...\n');

const server = http.createServer(async (req, res) => {
  const code = url.parse(req.url, true).query.code;
  if (!code) {
    res.end('No code found.');
    return;
  }

  res.end('<h2>✅ Done! You can close this tab and check your terminal.</h2>');
  server.close();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n✅ Refresh token:\n');
    console.log(tokens.refresh_token);
    console.log('\n--- Copy these into backend/.env ---');
    console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('------------------------------------\n');
  } catch (e) {
    console.error('Failed to get token:', e.message);
  }
});

server.listen(3333, () => {
  console.log('Listening on http://localhost:3333 ...');
});
