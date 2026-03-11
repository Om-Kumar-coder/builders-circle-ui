#!/bin/bash

echo "🔧 FIXING SERVER MERGE CONFLICT AND BUILD ISSUE"

# First, let's see what changes are on the server
echo "📋 Checking current changes..."
git status

echo ""
echo "📝 Showing diff of local changes..."
git diff src/types/auth.ts

echo ""
echo "🔄 Stashing local changes..."
git stash

echo ""
echo "⬇️ Pulling latest changes..."
git pull origin main

echo ""
echo "🔄 Applying stashed changes..."
git stash pop

echo ""
echo "🔍 Checking for conflicts..."
git status

echo ""
echo "🏗️ Attempting build..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ BUILD SUCCESSFUL!"
else
    echo "❌ Build still failing. Let's check the auth types file..."
    echo ""
    echo "📄 Current auth.ts content:"
    cat src/types/auth.ts
    echo ""
    echo "🔧 Manually fixing the User interface..."
    
    # Create a backup
    cp src/types/auth.ts src/types/auth.ts.backup
    
    # Fix the User interface to include emailVerification
    cat > src/types/auth.ts << 'EOF'
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
  role?: 'founder' | 'admin' | 'contributor' | 'employee' | 'observer';
  status?: string;
  bio?: string;
  avatar?: string;
  emailVerification?: boolean;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
EOF

    echo "✅ Fixed auth.ts file"
    echo ""
    echo "🏗️ Building again..."
    npm run build
    
    if [ $? -eq 0 ]; then
        echo "✅ BUILD SUCCESSFUL AFTER FIX!"
        echo ""
        echo "💾 Committing the fix..."
        git add src/types/auth.ts
        git commit -m "Fix User interface to include emailVerification property"
    else
        echo "❌ Build still failing. Manual intervention required."
        echo "📄 Current settings page around line 278:"
        sed -n '275,285p' app/settings/page.tsx
    fi
fi

echo ""
echo "🎯 SCRIPT COMPLETE"