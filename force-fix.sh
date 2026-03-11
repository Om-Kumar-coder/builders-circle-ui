#!/bin/bash

echo "🚀 FORCE FIXING BUILD ISSUE"

echo "🔄 Resetting local changes and pulling latest..."
git reset --hard HEAD
git pull origin main

echo ""
echo "🔧 Ensuring User interface has emailVerification property..."

# Backup current file
cp src/types/auth.ts src/types/auth.ts.backup

# Overwrite with correct content
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

echo "✅ Updated auth.ts with emailVerification property"

echo ""
echo "🏗️ Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ BUILD SUCCESSFUL!"
    echo ""
    echo "🚀 Starting production server..."
    npm start
else
    echo "❌ Build failed. Checking for other issues..."
    echo ""
    echo "📄 Showing any TypeScript errors:"
    npx tsc --noEmit
fi