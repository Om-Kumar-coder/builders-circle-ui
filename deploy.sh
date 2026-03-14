#!/bin/bash
set -e

# --------------------------------------------------------------------------
# Builder's Circle — Unified Deployment Script
# https://triagebuilders.com
# --------------------------------------------------------------------------
# Usage:
#   sudo ./deploy.sh install    — Fresh VPS install (first time)
#   sudo ./deploy.sh update     — Pull latest code & rebuild
#   sudo ./deploy.sh restart    — Rebuild & restart backend only
#   sudo ./deploy.sh seed       — Seed database with test users
#   sudo ./deploy.sh nginx      — Fix/reload Nginx config
#   sudo ./deploy.sh check      — Health check all services
# --------------------------------------------------------------------------

DOMAIN="triagebuilders.com"
APP_DIR="/var/www/builders-circle-ui"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }

require_root() {
    if [ "$EUID" -ne 0 ]; then
        error "Please run as root (use sudo)."
        exit 1
    fi
}

require_app_dir() {
    if [ ! -d "$APP_DIR" ]; then
        error "App directory $APP_DIR not found. Run: sudo ./deploy.sh install"
        exit 1
    fi
}

# --------------------------------------------------------------------------
# NGINX CONFIG (shared between install and nginx subcommand)
# --------------------------------------------------------------------------
write_nginx_config() {
    info "Writing Nginx configuration..."
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

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        add_header 'Access-Control-Allow-Origin' 'https://$DOMAIN' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
    }

    # API preflight
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
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static asset caching
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
}

# --------------------------------------------------------------------------
# HEALTH CHECK (shared)
# --------------------------------------------------------------------------
run_health_checks() {
    info "Running health checks..."
    sleep 5

    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health | grep -q "200\|404"; then
        info "✅ Backend responding on :3001"
    else
        warn "⚠️  Backend not responding on :3001"
        pm2 logs builders-circle-backend --lines 15 --nostream || true
    fi

    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
        info "✅ Frontend responding on :3000"
    else
        warn "⚠️  Frontend not responding on :3000"
        pm2 logs builders-circle-frontend --lines 15 --nostream || true
    fi

    if curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN | grep -q "200\|301\|302"; then
        info "✅ https://$DOMAIN is reachable"
    else
        warn "⚠️  https://$DOMAIN not reachable — check DNS/SSL"
    fi
}

# --------------------------------------------------------------------------
# SUBCOMMAND: install
# --------------------------------------------------------------------------
cmd_install() {
    require_root
    info "Starting fresh install for https://$DOMAIN ..."

    read -p "Email for Let's Encrypt SSL: " EMAIL
    [ -z "$EMAIL" ] && { error "Email required."; exit 1; }

    read -sp "PostgreSQL password for 'builders_user' (blank = auto-generate): " DB_PASS; echo
    [ -z "$DB_PASS" ] && DB_PASS=$(openssl rand -base64 24) && info "Generated DB password: $DB_PASS"

    read -sp "JWT secret (blank = auto-generate): " JWT_SECRET; echo
    [ -z "$JWT_SECRET" ] && JWT_SECRET=$(openssl rand -base64 32) && info "Generated JWT secret: $JWT_SECRET"

    # System packages
    info "Updating system & installing packages..."
    apt update && apt upgrade -y
    apt install -y curl wget git build-essential nginx postgresql postgresql-contrib ufw certbot python3-certbot-nginx

    info "Installing Node.js 18 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs

    info "Installing PM2..."
    npm install -g pm2

    # Firewall
    info "Configuring UFW firewall..."
    ufw allow OpenSSH
    ufw allow 'Nginx Full'
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable

    # PostgreSQL
    info "Setting up PostgreSQL..."
    systemctl start postgresql && systemctl enable postgresql
    sudo -u postgres psql <<PSQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'builders_user') THEN
        CREATE USER builders_user WITH PASSWORD '$DB_PASS';
    ELSE
        ALTER USER builders_user WITH PASSWORD '$DB_PASS';
    END IF;
END
\$\$;
SELECT 'CREATE DATABASE builders_circle OWNER builders_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'builders_circle')\gexec
PSQL

    # Clone repo
    if [ -d "$APP_DIR" ]; then
        warn "$APP_DIR exists — pulling latest..."
        cd "$APP_DIR" && git pull
    else
        read -p "Git repository URL: " REPO_URL
        mkdir -p /var/www
        git clone "$REPO_URL" "$APP_DIR"
        cd "$APP_DIR"
    fi

    # Env files
    info "Writing environment files..."
    DB_PASS_ENCODED=$(node -e "console.log(encodeURIComponent('$DB_PASS'))")
    cat > backend/.env <<EOF
DATABASE_URL="postgresql://builders_user:${DB_PASS_ENCODED}@localhost:5432/builders_circle"
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES=7d
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://$DOMAIN
CORS_ORIGIN=https://$DOMAIN
EOF
    cat > .env.local <<EOF
NEXT_PUBLIC_API_URL=https://$DOMAIN/api
NEXT_PUBLIC_APP_URL=https://$DOMAIN
EOF
    cp .env.local .env.production

    # Dependencies
    info "Installing dependencies..."
    npm install
    cd backend && npm install && cd ..

    # Prisma
    info "Running database migrations..."
    cd backend
    npx prisma generate
    if [ ! -d "prisma/migrations" ]; then
        npx prisma migrate dev --name init --create-only
    fi
    npx prisma migrate deploy
    npx prisma generate
    npm run build
    cd ..

    # Frontend build
    info "Building frontend..."
    npm run build

    # PM2 ecosystem
    info "Writing PM2 ecosystem config..."
    mkdir -p logs
    cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [
    {
      name: 'builders-circle-backend',
      script: './backend/dist/server.js',
      env: { NODE_ENV: 'production', PORT: 3001 },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      time: true
    },
    {
      name: 'builders-circle-frontend',
      script: 'npm',
      args: 'start',
      env: { NODE_ENV: 'production', PORT: 3000, HOSTNAME: '0.0.0.0' },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      time: true
    }
  ]
};
EOF

    # Nginx (HTTP only first, for certbot)
    info "Configuring Nginx (HTTP) for certbot..."
    cat > /etc/nginx/sites-available/builders-circle <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF
    ln -sf /etc/nginx/sites-available/builders-circle /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl restart nginx

    # Start apps
    info "Starting apps with PM2..."
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup systemd -u root --hp /root

    # SSL
    info "Obtaining SSL certificate..."
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect

    # Final nginx with HTTPS
    write_nginx_config
    nginx -t && systemctl reload nginx

    run_health_checks

    info "------------------------------------------------"
    info "🎉 Install complete! https://$DOMAIN"
    info "DB password: $DB_PASS"
    info "JWT secret:  $JWT_SECRET"
    info "Run 'sudo ./deploy.sh seed' to seed test users."
    info "------------------------------------------------"
}

# --------------------------------------------------------------------------
# SUBCOMMAND: update
# --------------------------------------------------------------------------
cmd_update() {
    require_root
    require_app_dir
    info "Updating application..."

    BACKUP="/tmp/builders-circle-backup-$(date +%Y%m%d-%H%M%S)"
    cp -r "$APP_DIR" "$BACKUP"
    info "Backup saved to $BACKUP"

    cd "$APP_DIR"
    git pull

    npm install
    cd backend && npm install && cd ..

    info "Running migrations..."
    cd backend
    npx prisma generate
    npx prisma db push
    npm run build
    cd ..

    info "Building frontend..."
    npm run build

    info "Reloading PM2..."
    pm2 reload all

    run_health_checks

    info "------------------------------------------------"
    info "🎉 Update complete! https://$DOMAIN"
    info "Rollback: rm -rf $APP_DIR && mv $BACKUP $APP_DIR && pm2 reload all"
    info "------------------------------------------------"
}

# --------------------------------------------------------------------------
# SUBCOMMAND: restart
# --------------------------------------------------------------------------
cmd_restart() {
    require_root
    require_app_dir
    info "Rebuilding and restarting backend..."

    cd "$APP_DIR/backend"
    npm run build
    cd ..

    pm2 restart builders-circle-backend
    sleep 3
    pm2 status

    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health | grep -q "200\|404"; then
        info "✅ Backend is up"
    else
        warn "⚠️  Backend not responding — check: pm2 logs builders-circle-backend"
    fi
}

# --------------------------------------------------------------------------
# SUBCOMMAND: seed
# --------------------------------------------------------------------------
cmd_seed() {
    require_app_dir
    info "Seeding database..."

    cd "$APP_DIR/backend"
    npm run db:seed

    info "------------------------------------------------"
    info "✅ Database seeded!"
    info "  founder@test.com  / founder123"
    info "  admin@test.com    / admin123"
    info "  user@test.com     / user123"
    info "  employee@test.com / employee123"
    info "------------------------------------------------"
}

# --------------------------------------------------------------------------
# SUBCOMMAND: nginx
# --------------------------------------------------------------------------
cmd_nginx() {
    require_root
    write_nginx_config
    nginx -t && systemctl reload nginx
    info "✅ Nginx reloaded. Testing https://$DOMAIN/api/health ..."
    sleep 2
    curl -s https://$DOMAIN/api/health || warn "API health check failed — services may still be starting"
}

# --------------------------------------------------------------------------
# SUBCOMMAND: check
# --------------------------------------------------------------------------
cmd_check() {
    info "Checking backend on :3001..."
    if curl -s http://localhost:3001/api/health > /dev/null; then
        info "✅ Backend responding"
        curl -s http://localhost:3001/api/health
    else
        warn "❌ Backend not responding"
        pm2 status || true
        pm2 logs builders-circle-backend --lines 20 --nostream || true

        info "Attempting restart..."
        pm2 restart builders-circle-backend || true
        sleep 5

        if curl -s http://localhost:3001/api/health > /dev/null; then
            info "✅ Backend recovered"
        else
            warn "Still down. Check port usage:"
            netstat -tlnp | grep :3001 || ss -tlnp | grep :3001 || true
        fi
    fi

    echo ""
    info "Testing login endpoint..."
    curl -s -X POST http://localhost:3001/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"founder@test.com","password":"founder123"}' | head -c 300
    echo ""
}

# --------------------------------------------------------------------------
# ENTRYPOINT
# --------------------------------------------------------------------------
case "${1:-}" in
    install) cmd_install ;;
    update)  cmd_update  ;;
    restart) cmd_restart ;;
    seed)    cmd_seed    ;;
    nginx)   cmd_nginx   ;;
    check)   cmd_check   ;;
    *)
        echo ""
        echo "Usage: sudo ./deploy.sh <command>"
        echo ""
        echo "  install   Fresh VPS setup (installs everything)"
        echo "  update    Pull latest code, rebuild, reload PM2"
        echo "  restart   Rebuild & restart backend only"
        echo "  seed      Seed database with test users"
        echo "  nginx     Fix/reload Nginx config"
        echo "  check     Health check all services"
        echo ""
        exit 1
        ;;
esac
