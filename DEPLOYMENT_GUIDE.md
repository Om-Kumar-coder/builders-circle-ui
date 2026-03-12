# 🚀 Deployment Guide: Migrating to triagebuilders.com

This guide will help you migrate your Builder's Circle application from `http://148.230.90.1/` to `https://triagebuilders.com/`.

## 📋 Prerequisites

Before running the deployment script, ensure you have:

1. **Domain DNS Setup**: Point your domain to your server IP
2. **Server Access**: SSH access to your Ubuntu server
3. **Email Address**: For SSL certificate registration

## 🔧 DNS Configuration (Do This First!)

### Step 1: Configure DNS Records

In your domain registrar's DNS settings (where you bought triagebuilders.com), add these records:

```
Type: A
Name: @ (or triagebuilders.com)
Value: 148.230.90.1
TTL: 300 (or default)

Type: A  
Name: www
Value: 148.230.90.1
TTL: 300 (or default)
```

### Step 2: Verify DNS Propagation

Wait 5-15 minutes, then test:

```bash
# Test if domain points to your server
nslookup triagebuilders.com
ping triagebuilders.com

# Should return 148.230.90.1
```

## 🚀 Simple Deployment Process

### Step 1: Connect to Your Server

```bash
ssh root@148.230.90.1
# or
ssh your-username@148.230.90.1
```

### Step 2: Stop Current Services (if running)

```bash
# Stop PM2 processes (if any exist)
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Stop nginx (if running)
systemctl stop nginx 2>/dev/null || true
```

### Step 3: Backup Current Data (Recommended)

```bash
# Backup database (if exists)
sudo -u postgres pg_dump builders_circle > /tmp/builders_circle_backup.sql 2>/dev/null || true

# Backup current app (if exists)
cp -r /var/www/builders-circle-ui /tmp/builders-circle-ui-backup 2>/dev/null || true
```

### Step 4: Run the Deployment Script

**This is the ONLY script you need to run:**

```bash
# Make script executable
chmod +x deploy.sh

# Run deployment (as root)
sudo ./deploy.sh
```

**The script will:**
- ✅ Install all system dependencies
- ✅ Set up PostgreSQL database
- ✅ Configure SSL certificates
- ✅ Deploy your application with activity verification system
- ✅ Set up monitoring and logging

**During deployment, you'll be prompted for:**
- Email address for SSL certificate (required)
- PostgreSQL password (leave empty to auto-generate)
- JWT secret (leave empty to auto-generate)
- Git repository URL (your repo URL)

### Step 5: Verify Deployment

After deployment completes, test these URLs:

```bash
# Test HTTPS (should work)
curl -I https://triagebuilders.com

# Test API (should return JSON)
curl https://triagebuilders.com/api/health

# Test redirect (HTTP should redirect to HTTPS)
curl -I http://triagebuilders.com
```

## 🔄 Future Updates (After Initial Deployment)

For future code updates, you can use the quick update script:

```bash
# Navigate to app directory
cd /var/www/builders-circle-ui

# Run quick update
sudo ./update-app.sh
```

This is much faster than re-running the full deployment.

## 🔍 Troubleshooting

### Common Issues and Solutions

#### 1. DNS Not Propagating
**Problem**: Domain doesn't point to your server
**Solution**: 
- Wait longer (up to 24 hours)
- Check DNS settings with your registrar
- Use `dig triagebuilders.com` to verify

#### 2. SSL Certificate Fails
**Problem**: Let's Encrypt can't verify domain
**Solution**:
```bash
# Manually obtain certificate
certbot --nginx -d triagebuilders.com -d www.triagebuilders.com
```

#### 3. Services Not Starting
**Problem**: PM2 processes fail to start
**Solution**:
```bash
# Check logs
pm2 logs

# Restart services
pm2 restart all

# Check status
pm2 status
```

## 📊 Post-Deployment Checklist

After successful deployment, verify:

- [ ] **HTTPS Access**: `https://triagebuilders.com` loads correctly
- [ ] **HTTP Redirect**: `http://triagebuilders.com` redirects to HTTPS
- [ ] **API Endpoints**: `https://triagebuilders.com/api/` responds
- [ ] **User Login**: Existing users can log in
- [ ] **Activity Submission**: New activity verification system works
- [ ] **Admin Panel**: Admin activity review page accessible
- [ ] **SSL Certificate**: Valid and auto-renewing

## 🔧 Management Commands

### PM2 Process Management
```bash
# View status
pm2 status

# View logs
pm2 logs builders-circle-backend
pm2 logs builders-circle-frontend

# Restart services
pm2 restart all

# Reload (zero downtime)
pm2 reload all
```

### SSL Certificate Management
```bash
# Check certificate status
certbot certificates

# Test renewal
certbot renew --dry-run

# Force renewal
certbot renew --force-renewal
```

### Database Management
```bash
# Connect to database
sudo -u postgres psql -d builders_circle

# Backup database
sudo -u postgres pg_dump builders_circle > backup.sql

# Restore database
sudo -u postgres psql -d builders_circle < backup.sql
```

## 🎉 Success!

Once deployed successfully, your Builder's Circle application will be available at:

- **Main Site**: https://triagebuilders.com
- **API**: https://triagebuilders.com/api
- **Admin Panel**: https://triagebuilders.com/admin
- **Activity Review**: https://triagebuilders.com/admin/activity-review

The application includes the complete Activity Verification & Work Logging system with HTTPS security!