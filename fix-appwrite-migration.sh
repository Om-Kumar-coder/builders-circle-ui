#!/bin/bash

echo "🔧 Fixing all remaining Appwrite references..."

# Fix activity page
sed -i 's/activity\.\$id/activity.id/g' app/activity/page.tsx
sed -i 's/user\?\.\$id/user?.id/g' app/activity/page.tsx

# Fix all TypeScript files for $id references
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/\$id/id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/\$createdAt/createdAt/g'

# Fix specific patterns that might remain
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/user\?\.\$id/user?.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/user\.\$id/user.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/cycle\.\$id/cycle.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/activity\.\$id/activity.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/notification\.\$id/notification.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/member\.\$id/member.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/event\.\$id/event.id/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/participation\.\$id/participation.id/g'

# Fix createdAt references
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/activity\.\$createdAt/activity.createdAt/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/notification\.\$createdAt/notification.createdAt/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/event\.\$createdAt/event.createdAt/g'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/user\.\$createdAt/user.createdAt/g'

echo "✅ Fixed all Appwrite references"
echo "🔍 Checking for any remaining issues..."

# Check for remaining $id references
if grep -r '\$id' --include="*.tsx" --include="*.ts" --exclude-dir=node_modules .; then
    echo "⚠️  Found remaining \$id references above"
else
    echo "✅ No \$id references found"
fi

# Check for remaining $createdAt references
if grep -r '\$createdAt' --include="*.tsx" --include="*.ts" --exclude-dir=node_modules .; then
    echo "⚠️  Found remaining \$createdAt references above"
else
    echo "✅ No \$createdAt references found"
fi

echo "🏗️  Ready to build!"