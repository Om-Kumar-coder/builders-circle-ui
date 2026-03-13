#!/bin/bash

echo "🔄 Restarting Builder's Circle Backend..."

# Navigate to backend directory
cd backend

# Rebuild the backend
echo "📦 Building backend..."
npm run build

# Go back to root
cd ..

# Restart PM2 process
echo "🚀 Restarting PM2 process..."
pm2 restart builders-circle-backend

echo "✅ Backend restarted successfully!"

# Show status
pm2 status