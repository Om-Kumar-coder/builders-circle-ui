#!/bin/bash
set -e

# --------------------------------------------------------------------------
# Builder's Circle Application Update Script
# --------------------------------------------------------------------------
# This script updates the application with latest changes from git
# --------------------------------------------------------------------------

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Application directory
APP_DIR="/var/www/builders-circle-ui"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)."
    exit 1
fi

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    print_error "Application directory $APP_DIR not found. Run deploy.sh first."
    exit 1
fi

print_message "Starting application update..."

# Navigate to app directory
cd "$APP_DIR"

# Backup current version
print_message "Creating backup..."
BACKUP_DIR="/tmp/builders-circle-backup-$(date +%Y%m%d-%H%M%S)"
cp -r "$APP_DIR" "$BACKUP_DIR"
print_message "Backup created at: $BACKUP_DIR"

# Pull latest changes
print_message "Pulling latest changes from git..."
git pull

# Install dependencies (in case new ones were added)
print_message "Installing/updating frontend dependencies..."
npm install

print_message "Installing/updating backend dependencies..."
cd backend
npm install
cd ..

# Run database migrations (if any)
print_message "Running database migrations..."
cd backend
npx prisma generate
npx prisma db push
cd ..

# Build applications
print_message "Building frontend..."
npm run build

print_message "Building backend..."
cd backend
npm run build
cd ..

# Reload PM2 processes (zero downtime)
print_message "Reloading applications..."
pm2 reload all

# Wait a moment for services to start
sleep 5

# Verify services are running
print_message "Verifying services..."
pm2 status

# Test backend API
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health | grep -q "200\|404"; then
    print_message "✅ Backend API is responding"
else
    print_warning "⚠️  Backend API check failed"
fi

# Test frontend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    print_message "✅ Frontend is responding"
else
    print_warning "⚠️  Frontend check failed"
fi

# Test HTTPS
if curl -s -o /dev/null -w "%{http_code}" https://triagebuilders.com | grep -q "200"; then
    print_message "✅ HTTPS is working"
else
    print_warning "⚠️  HTTPS check failed"
fi

print_message "------------------------------------------------"
print_message "🎉 Update completed successfully!"
print_message "Application: https://triagebuilders.com"
print_message "Backup location: $BACKUP_DIR"
print_message ""
print_message "If issues occur, you can rollback with:"
print_message "  sudo rm -rf $APP_DIR"
print_message "  sudo mv $BACKUP_DIR $APP_DIR"
print_message "  sudo pm2 reload all"
print_message "------------------------------------------------"