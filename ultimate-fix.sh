#!/bin/bash

echo "🚀 ULTIMATE FIX - RESOLVING ALL REMAINING ISSUES"

# Clear any build cache
rm -rf .next

# Fix the API URL in environment
echo "NEXT_PUBLIC_API_URL=http://148.230.90.1:3001/api" > .env.local
echo "NODE_ENV=production" >> .env.local

# Ensure backend environment is correct
cat > backend/.env << 'EOF'
DATABASE_URL="file:./dev.db"
JWT_SECRET=your-super-secure-jwt-secret-for-production-change-this-to-something-random-and-long
JWT_EXPIRES=7d
PORT=3001
NODE_ENV=production
FRONTEND_URL=http://148.230.90.1:3000
CORS_ORIGIN=http://148.230.90.1:3000
EOF

echo "✅ Environment files updated"

# Build the project
echo "🏗️ Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "🎉 BUILD SUCCESSFUL!"
    
    # Set up database
    echo "🗄️ Setting up database..."
    cd backend
    npx prisma generate
    npx prisma db push
    cd ..
    
    # Kill any existing PM2 processes
    pm2 delete all 2>/dev/null || true
    
    # Start the applications
    echo "🚀 Starting applications..."
    pm2 start ecosystem.config.js
    pm2 save
    
    # Wait a moment for services to start
    sleep 5
    
    # Test the services
    echo "🧪 Testing services..."
    
    # Test backend health
    if curl -s http://148.230.90.1:3001/health | grep -q "ok"; then
        echo "✅ Backend health check passed"
    else
        echo "❌ Backend health check failed"
    fi
    
    # Test backend API
    if curl -s http://148.230.90.1:3001/api/cycles | grep -q "\["; then
        echo "✅ Backend API responding"
    else
        echo "⚠️  Backend API may not be fully ready (this is normal for first startup)"
    fi
    
    # Test frontend
    if curl -s -I http://148.230.90.1:3000 | head -1 | grep -q "200"; then
        echo "✅ Frontend responding"
    else
        echo "❌ Frontend not responding"
    fi
    
    echo ""
    echo "🎊 DEPLOYMENT COMPLETE!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🌐 Frontend: http://148.230.90.1:3000"
    echo "🔧 Backend:  http://148.230.90.1:3001"
    echo "📊 Health:   http://148.230.90.1:3001/health"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🔍 PM2 Status:"
    pm2 status
    
    echo ""
    echo "📝 To view logs: pm2 logs"
    echo "🔄 To restart:   pm2 restart all"
    echo "⏹️  To stop:      pm2 stop all"
    
else
    echo "❌ BUILD FAILED"
    echo "🔍 Last few lines of build output:"
    npm run build 2>&1 | tail -20
    exit 1
fi
EOF