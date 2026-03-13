#!/bin/bash

echo "🔍 Checking backend status..."

# Check if backend is running on port 3001
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend is running and responding"
    curl -s http://localhost:3001/api/health | jq .
else
    echo "❌ Backend is not responding on port 3001"
    
    echo "📊 Checking PM2 status..."
    pm2 status
    
    echo "📋 Backend logs (last 20 lines)..."
    pm2 logs builders-circle-backend --lines 20
    
    echo "🔄 Restarting backend..."
    pm2 restart builders-circle-backend
    
    echo "⏳ Waiting for backend to start..."
    sleep 5
    
    if curl -s http://localhost:3001/api/health > /dev/null; then
        echo "✅ Backend is now running"
    else
        echo "❌ Backend still not responding"
        echo "🔍 Checking if port 3001 is in use..."
        netstat -tlnp | grep :3001
        
        echo "🔍 Checking backend process..."
        ps aux | grep node
    fi
fi

echo ""
echo "🧪 Testing login endpoint locally..."
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@test.com","password":"founder123"}' \
  -v