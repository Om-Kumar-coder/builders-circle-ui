#!/bin/bash

echo "🚀 Fixing Builder's Circle deployment issues..."

# Step 1: Update backend environment
echo "1️⃣ Updating backend environment..."
cd backend
cat > .env <<EOF
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="7s3ZEzohLpfedY+qtl9IE2REGTmcTgxQyaC+2vquCyE="
JWT_EXPIRES=7d
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://triagebuilders.com
CORS_ORIGIN=https://triagebuilders.com
EOF

# Step 2: Rebuild backend
echo "2️⃣ Rebuilding backend..."
npm run build
cd ..

# Step 3: Rebuild frontend
echo "3️⃣ Rebuilding frontend..."
npm run build

# Step 4: Restart PM2 processes
echo "4️⃣ Restarting PM2 processes..."
pm2 restart all

# Step 5: Wait for services to start
echo "5️⃣ Waiting for services to start..."
sleep 10

# Step 6: Test backend locally
echo "6️⃣ Testing backend locally..."
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend is responding locally"
else
    echo "❌ Backend not responding locally"
    pm2 logs builders-circle-backend --lines 10
fi

# Step 7: Test frontend locally
echo "7️⃣ Testing frontend locally..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is responding locally"
else
    echo "❌ Frontend not responding locally"
    pm2 logs builders-circle-frontend --lines 10
fi

# Step 8: Update Nginx configuration
echo "8️⃣ Updating Nginx configuration..."
cat > /etc/nginx/sites-available/builders-circle <<'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name triagebuilders.com www.triagebuilders.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Configuration
server {
    listen 443 ssl http2;
    server_name triagebuilders.com www.triagebuilders.com;

    # SSL Configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/triagebuilders.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/triagebuilders.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Step 9: Test and reload Nginx
echo "9️⃣ Testing and reloading Nginx..."
nginx -t
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Nginx configuration error"
    exit 1
fi

# Step 10: Final tests
echo "🔟 Running final tests..."
sleep 5

echo "Testing HTTPS API endpoint..."
curl -v https://triagebuilders.com/api/health

echo ""
echo "Testing login endpoint..."
curl -X POST https://triagebuilders.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@test.com","password":"founder123"}' \
  -v

echo ""
echo "🎉 Deployment fix complete!"
echo "🌐 Your application should now be available at: https://triagebuilders.com"