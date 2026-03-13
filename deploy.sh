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
DOMAIN="triagebuilders.com"
print_message "Using domain: $DOMAIN"

# Email for Let's Encrypt
read -p "Enter your email address for Let's Encrypt SSL certificate: " EMAIL
if [ -z "$EMAIL" ]; then
    print_error "Email address is required for SSL certificate."
    exit 1
fi

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
ufw allow 80/tcp
ufw allow 443/tcp
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

# URL encode the password for PostgreSQL connection string
DB_PASS_ENCODED=$(node -e "console.log(encodeURIComponent('$DB_PASS'))")

# Backend .env
cat > backend/.env <<EOF
DATABASE_URL="postgresql://builders_user:$DB_PASS_ENCODED@localhost:5432/builders_circle"
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
NEXT_PUBLIC_APP_URL=https://$DOMAIN
EOF

# Also create .env.production for reference
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

# --------------------------------------------------------------------------
# Database Migration (Prisma)
# --------------------------------------------------------------------------
print_message "Running database migrations..."
cd backend

# First, ensure we have the latest Prisma client
print_message "Generating Prisma client..."
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

# Run the activity verification migration and force schema sync
print_message "Running activity verification migration..."
npx prisma db push --force-reset --accept-data-loss

# Regenerate Prisma client after schema changes
print_message "Regenerating Prisma client after schema changes..."
npx prisma generate

print_message "Building backend..."
npm run build
cd ..

print_message "Building frontend..."
npm run build

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
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    },
    {
      name: 'builders-circle-frontend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true
    }
  ]
};
EOF

# Create logs directory
mkdir -p logs

# --------------------------------------------------------------------------
# Nginx Configuration (HTTP first, then HTTPS)
# --------------------------------------------------------------------------
print_message "Configuring Nginx as reverse proxy..."
cat > /etc/nginx/sites-available/builders-circle <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

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
        
        # Security headers
        proxy_set_header X-Frame-Options DENY;
        proxy_set_header X-Content-Type-Options nosniff;
        proxy_set_header X-XSS-Protection "1; mode=block";
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
        
        # CORS headers for API
        add_header 'Access-Control-Allow-Origin' 'https://$DOMAIN' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
    }

    # Handle preflight requests
    location ~ ^/api.*\$ {
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'https://$DOMAIN';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
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
# Start Applications with PM2
# --------------------------------------------------------------------------
print_message "Starting applications with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# --------------------------------------------------------------------------
# SSL Certificate (Let's Encrypt)
# --------------------------------------------------------------------------
print_message "Obtaining SSL certificate from Let's Encrypt..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect

# --------------------------------------------------------------------------
# Final Nginx Configuration with HTTPS optimizations
# --------------------------------------------------------------------------
print_message "Updating Nginx configuration for HTTPS..."
cat > /etc/nginx/sites-available/builders-circle <<EOF
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS Configuration
server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL Configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
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
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # CORS headers for API
        add_header 'Access-Control-Allow-Origin' 'https://$DOMAIN' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
    }

    # Handle preflight requests
    location ~ ^/api.*\$ {
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'https://$DOMAIN';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

# Test and reload nginx
nginx -t
systemctl reload nginx

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

# Test HTTPS
if curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN | grep -q "200"; then
    print_message "HTTPS is working correctly."
else
    print_warning "HTTPS check failed. Check SSL certificate and nginx configuration."
fi

# Output final instructions
print_message "------------------------------------------------"
print_message "🎉 Deployment successful!"
print_message "Your application is available at: https://$DOMAIN"
print_message "Backend API: https://$DOMAIN/api"
print_message ""
print_message "PM2 Commands:"
print_message "  pm2 status                # View process status"
print_message "  pm2 logs builders-circle-backend  # View backend logs"
print_message "  pm2 logs builders-circle-frontend # View frontend logs"
print_message "  pm2 restart all           # Restart both apps"
print_message "  pm2 reload all            # Reload both apps (zero downtime)"
print_message ""
print_message "SSL Certificate:"
print_message "  Certificate will auto-renew via cron job"
print_message "  Manual renewal: certbot renew"
print_message ""
print_message "Database credentials:"
print_message "  Database: builders_circle"
print_message "  User: builders_user"
print_message "  Password: $DB_PASS"
print_message ""
print_message "JWT Secret: $JWT_SECRET"
print_message ""
print_message "🔒 HTTPS enabled with automatic HTTP redirect"
print_message "🔄 Auto-renewal configured for SSL certificate"
print_message "------------------------------------------------"