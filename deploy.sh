#!/bin/bash
set -e  # exit on error

# --------------------------------------------------------------------------
# Builder's Circle Production Deployment Script
# --------------------------------------------------------------------------
# This script deploys the Builder's Circle application on a fresh Ubuntu VPS.
# It installs dependencies, sets up PostgreSQL, builds the app, configures
# PM2 and Nginx, and obtains SSL certificates via Let's Encrypt.
# --------------------------------------------------------------------------

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)."
    exit 1
fi

# --------------------------------------------------------------------------
# User Input Prompts
# --------------------------------------------------------------------------
print_message "Starting Builder's Circle deployment..."

# Domain name (required for nginx and SSL)
read -p "Enter your domain name (e.g., example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    print_error "Domain name is required."
    exit 1
fi

# Email for Let's Encrypt (optional but recommended)
read -p "Enter your email address for Let's Encrypt (optional, press Enter to skip): " EMAIL

# Database password (generate if not provided)
read -sp "Enter PostgreSQL password for 'builders_user' (leave empty to auto-generate): " DB_PASS
echo
if [ -z "$DB_PASS" ]; then
    DB_PASS=$(openssl rand -base64 24)
    print_message "Generated database password: $DB_PASS"
fi

# JWT secret (generate if not provided)
read -sp "Enter JWT secret for production (leave empty to auto-generate): " JWT_SECRET
echo
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    print_message "Generated JWT secret: $JWT_SECRET"
fi

# Application directory
APP_DIR="/var/www/builders-circle-ui"

# --------------------------------------------------------------------------
# System Update & Dependencies
# --------------------------------------------------------------------------
print_message "Updating system packages..."
apt update && apt upgrade -y

print_message "Installing required packages..."
apt install -y curl wget git build-essential nginx postgresql postgresql-contrib ufw certbot python3-certbot-nginx

# Install Node.js 18.x (LTS)
print_message "Installing Node.js 18 LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2 globally
print_message "Installing PM2..."
npm install -g pm2

# --------------------------------------------------------------------------
# Configure Firewall (UFW)
# --------------------------------------------------------------------------
print_message "Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status

# --------------------------------------------------------------------------
# PostgreSQL Setup
# --------------------------------------------------------------------------
print_message "Setting up PostgreSQL database..."
# Start PostgreSQL if not running
systemctl start postgresql
systemctl enable postgresql

# Create database and user (if not exist)
sudo -u postgres psql <<EOF
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'builders_user') THEN
        CREATE USER builders_user WITH PASSWORD '$DB_PASS';
    ELSE
        ALTER USER builders_user WITH PASSWORD '$DB_PASS';
    END IF;
END
\$\$;
EOF

sudo -u postgres psql <<EOF
SELECT 'CREATE DATABASE builders_circle OWNER builders_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'builders_circle')\gexec
EOF

# --------------------------------------------------------------------------
# Clone/Update Repository
# --------------------------------------------------------------------------
if [ -d "$APP_DIR" ]; then
    print_warning "Directory $APP_DIR already exists. Pulling latest changes..."
    cd "$APP_DIR"
    git pull
else
    print_message "Cloning repository..."
    mkdir -p /var/www
    cd /var/www
    # Replace with your actual repository URL
    read -p "Enter your Git repository URL: " REPO_URL
    git clone "$REPO_URL" builders-circle-ui
    cd builders-circle-ui
fi

# --------------------------------------------------------------------------
# Environment Configuration
# --------------------------------------------------------------------------
print_message "Configuring environment variables..."

# Backend .env
cat > backend/.env <<EOF
DATABASE_URL="postgresql://builders_user:$DB_PASS@localhost:5432/builders_circle"
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES=7d
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://$DOMAIN
CORS_ORIGIN=https://$DOMAIN
EOF

# Frontend .env.local (for build)
cat > .env.local <<EOF
NEXT_PUBLIC_API_URL=https://$DOMAIN/api
EOF

# Also create .env.production for reference (optional)
cp .env.local .env.production

# --------------------------------------------------------------------------
# Install Dependencies & Build
# --------------------------------------------------------------------------
print_message "Installing frontend dependencies..."
npm install

print_message "Installing backend dependencies..."
cd backend
npm install
cd ..

print_message "Building frontend..."
npm run build

print_message "Building backend..."
cd backend
npm run build
cd ..

# --------------------------------------------------------------------------
# Database Migration (Prisma)
# --------------------------------------------------------------------------
print_message "Running database migrations..."
cd backend

# Generate Prisma client for PostgreSQL
npx prisma generate

# Create initial migration if none exist, or deploy existing ones
if [ ! -d "prisma/migrations" ]; then
    print_message "Creating initial database migration..."
    npx prisma migrate dev --name init --create-only
    npx prisma migrate deploy
else
    print_message "Deploying existing migrations..."
    npx prisma migrate deploy
fi

cd ..

# --------------------------------------------------------------------------
# PM2 Ecosystem File
# --------------------------------------------------------------------------
print_message "Creating PM2 ecosystem file..."
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [
    {
      name: 'builders-circle-backend',
      script: './backend/dist/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'builders-circle-frontend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      }
    }
  ]
};
EOF

# --------------------------------------------------------------------------
# Start Applications with PM2
# --------------------------------------------------------------------------
print_message "Starting applications with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# --------------------------------------------------------------------------
# Nginx Configuration
# --------------------------------------------------------------------------
print_message "Configuring Nginx as reverse proxy..."
cat > /etc/nginx/sites-available/builders-circle <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/builders-circle /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

# Restart nginx
systemctl restart nginx

# --------------------------------------------------------------------------
# SSL Certificate (Let's Encrypt)
# --------------------------------------------------------------------------
if [ -n "$EMAIL" ]; then
    print_message "Obtaining SSL certificate from Let's Encrypt..."
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"
else
    print_warning "No email provided, skipping SSL certificate. You can obtain one later with: certbot --nginx -d $DOMAIN"
fi

# --------------------------------------------------------------------------
# Final Checks
# --------------------------------------------------------------------------
print_message "Deployment complete! Verifying services..."

# Check PM2 status
pm2 status

# Test backend API
sleep 5
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health | grep -q "200\|404"; then
    print_message "Backend API is reachable (health endpoint responded)."
else
    print_warning "Backend health check failed. Check logs with: pm2 logs builders-circle-backend"
fi

# Test frontend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    print_message "Frontend is reachable."
else
    print_warning "Frontend check failed. Check logs with: pm2 logs builders-circle-frontend"
fi

# Output final instructions
print_message "------------------------------------------------"
print_message "Deployment successful!"
print_message "Your application is available at: https://$DOMAIN"
print_message "Backend API: https://$DOMAIN/api"
print_message ""
print_message "PM2 Commands:"
print_message "  pm2 status                # View process status"
print_message "  pm2 logs builders-circle-backend  # View backend logs"
print_message "  pm2 logs builders-circle-frontend # View frontend logs"
print_message "  pm2 restart all           # Restart both apps"
print_message ""
print_message "Database credentials:"
print_message "  Database: builders_circle"
print_message "  User: builders_user"
print_message "  Password: $DB_PASS"
print_message ""
print_message "JWT Secret: $JWT_SECRET"
print_message ""
print_message "Make sure to:"
print_message "  - Update DNS A record for $DOMAIN to point to this server's IP"
print_message "  - If you skipped SSL, run: certbot --nginx -d $DOMAIN"
print_message "------------------------------------------------"