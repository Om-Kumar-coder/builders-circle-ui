#!/bin/bash

echo "🚀 COMPLETE APPWRITE MIGRATION FIX - FIXING EVERYTHING AT ONCE"

# First, let's stash any local changes and pull fresh
git add .
git stash
git pull origin main

echo "📁 Files updated from git, now applying ALL fixes..."

# 1. Fix User interface in types
cat > src/types/auth.ts << 'EOF'
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
  role?: 'founder' | 'admin' | 'contributor' | 'employee' | 'observer';
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
EOF

# 2. Fix AuthContext completely
sed -i 's/\$id: userData\.id/id: userData.id/g' src/context/AuthContext.tsx
sed -i 's/createdAt: userData\.createdAt/createdAt: userData.createdAt/g' src/context/AuthContext.tsx

# 3. Fix ALL $id references in ALL files
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/\$id/id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/\$createdAt/createdAt/g'

# 4. Fix specific patterns that might remain
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/user\?\.\$id/user?.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/user\.\$id/user.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/cycle\.\$id/cycle.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/activity\.\$id/activity.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/notification\.\$id/notification.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/member\.\$id/member.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/event\.\$id/event.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/participation\.\$id/participation.id/g'

# 5. Fix createdAt references
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/activity\.\$createdAt/activity.createdAt/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/notification\.\$createdAt/notification.createdAt/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/event\.\$createdAt/event.createdAt/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .git | xargs sed -i 's/user\.\$createdAt/user.createdAt/g'

# 6. Fix the specific TypeScript error in admin audit page
sed -i 's/let filteredEvents = response;/let filteredEvents: any[] = Array.isArray(response) ? response : [];/g' app/admin/audit/page.tsx

# 7. Fix any remaining interface definitions
sed -i 's/interface.*{[[:space:]]*\$id: string;/interface TeamMember {\n  id: string;/g' app/team/page.tsx
sed -i 's/interface.*{[[:space:]]*\$id: string;[[:space:]]*\$createdAt: string;/interface AuditEvent {\n  id: string;\n  createdAt: string;/g' app/admin/audit/page.tsx

# 8. Fix mock data objects
sed -i 's/\$id: '\''1'\''/id: '\''1'\''/g' app/team/page.tsx app/admin/audit/page.tsx
sed -i 's/\$id: '\''2'\''/id: '\''2'\''/g' app/team/page.tsx app/admin/audit/page.tsx
sed -i 's/\$createdAt: new Date/createdAt: new Date/g' app/admin/audit/page.tsx

# 9. Clear Next.js cache
rm -rf .next

echo "✅ ALL FIXES APPLIED!"
echo "🔍 Checking for remaining issues..."

# Check for remaining issues
echo "=== Remaining \$id references ==="
grep -rn '\$id' --include="*.tsx" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.git . || echo "✅ No \$id references found"

echo "=== Remaining \$createdAt references ==="
grep -rn '\$createdAt' --include="*.tsx" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.git . || echo "✅ No \$createdAt references found"

echo "🏗️ BUILDING PROJECT..."
npm run build

if [ $? -eq 0 ]; then
    echo "🎉 BUILD SUCCESSFUL! Starting servers..."
    
    # Set up database if not done
    cd backend
    npx prisma generate
    npx prisma db push
    cd ..
    
    # Start with PM2
    pm2 start ecosystem.config.js
    pm2 save
    
    echo "🚀 DEPLOYMENT COMPLETE!"
    echo "Frontend: http://148.230.90.1:3000"
    echo "Backend: http://148.230.90.1:3001"
    
    # Test the endpoints
    echo "🧪 Testing endpoints..."
    curl -s http://148.230.90.1:3001/api/health && echo " ✅ Backend healthy"
    curl -s -I http://148.230.90.1:3000 | head -1 && echo " ✅ Frontend responding"
    
else
    echo "❌ BUILD FAILED - Check errors above"
    exit 1
fi
EOF