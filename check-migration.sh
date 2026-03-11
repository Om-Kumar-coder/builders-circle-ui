#!/bin/bash

echo "🔍 Checking for Appwrite migration issues..."

echo "=== Checking for \$id references ==="
grep -rn '\$id' --include="*.tsx" --include="*.ts" --exclude-dir=node_modules . || echo "✅ No \$id references found"

echo ""
echo "=== Checking for \$createdAt references ==="
grep -rn '\$createdAt' --include="*.tsx" --include="*.ts" --exclude-dir=node_modules . || echo "✅ No \$createdAt references found"

echo ""
echo "=== Checking specific problematic patterns ==="
echo "Checking activity.\$id:"
grep -rn 'activity\.\$id' --include="*.tsx" --include="*.ts" --exclude-dir=node_modules . || echo "✅ No activity.\$id found"

echo "Checking user.\$id:"
grep -rn 'user\.\$id' --include="*.tsx" --include="*.ts" --exclude-dir=node_modules . || echo "✅ No user.\$id found"

echo "Checking cycle.\$id:"
grep -rn 'cycle\.\$id' --include="*.tsx" --include="*.ts" --exclude-dir=node_modules . || echo "✅ No cycle.\$id found"

echo ""
echo "=== TypeScript compilation test ==="
npx tsc --noEmit --skipLibCheck