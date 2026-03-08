# Builder's Circle - Complete Infrastructure Reconstruction Guide

## System Overview

Builder's Circle is a behavior-based ownership and accountability platform built on:
- **Frontend**: Next.js 16 with React 19, TypeScript, Tailwind CSS
- **Backend**: Appwrite (self-hosted)
- **Database**: Appwrite Database with 6 collections
- **Functions**: 3 Appwrite serverless functions (Node.js 22)
- **Cron Jobs**: Automated stall evaluation and multiplier adjustment

---

## PHASE 1: INFRASTRUCTURE SETUP

### 1.1 Install Docker & Docker Compose

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version

# Logout and login again for group changes to take effect
```

### 1.2 Install Appwrite

```bash
# Create Appwrite directory
mkdir -p ~/appwrite
cd ~/appwrite

# Download Appwrite installation script
curl -o docker-compose.yml https://appwrite.io/install/compose

# Start Appwrite
docker-compose up -d

# Check status
docker ps
```

### 1.3 Configure Domain & SSL

**Option A: Using Domain Name**
```bash
# Install Nginx
sudo apt install nginx -y

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/appwrite

# Add this configuration:
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/appwrite /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

**Option B: Using Server IP (Development)**
```bash
# Access Appwrite directly via:
# http://YOUR_SERVER_IP

# For production, SSL is recommended
```

### 1.4 Access Appwrite Console

```bash
# Open browser and navigate to:
# https://your-domain.com (with domain)
# or
# http://YOUR_SERVER_IP (without domain)

# Create admin account on first access
```

---

## PHASE 2: PROJECT SETUP

### 2.1 Create Appwrite Project

1. Login to Appwrite Console
2. Click "Create Project"
3. Name: `Builder's Circle`
4. Project ID will be auto-generated (save this)

### 2.2 Configure Project Settings

**Authentication Settings:**
- Enable: Email/Password
- Enable: JWT
- Session Duration: 31536000 seconds (1 year)
- Sessions Limit: 10
- Disable password dictionary check
- Disable personal data check

**API Settings:**
- Enable all services: Account, Databases, Functions, Storage, Teams, Users

### 2.3 Generate API Key

1. Go to Project Settings → API Keys
2. Create new API key with name: `Backend Functions`
3. Scopes: Select ALL scopes (or minimum):
   - `databases.read`
   - `databases.write`
   - `collections.read`
   - `collections.write`
   - `documents.read`
   - `documents.write`
   - `users.read`
   - `functions.read`
   - `functions.write`
   - `execution.read`
   - `execution.write`
4. Save the API key securely

### 2.4 Save Configuration Values

```bash
# Save these values for later use:
APPWRITE_ENDPOINT=https://your-domain.com/v1  # or http://YOUR_SERVER_IP/v1
APPWRITE_PROJECT_ID=<your-project-id>
APPWRITE_API_KEY=<your-api-key>
```

---

## PHASE 3: DATABASE STRUCTURE

### 3.1 Create Database

1. Go to Databases → Create Database
2. Database ID: `builder_circle`
3. Name: `builder_circle`

### 3.2 Create Collections

#### Collection 1: ownership_ledger
```
Collection ID: ownership_ledger
Name: ownership_ledger
Permissions: read("users")
Document Security: Enabled

Attributes:
- userId (string, 999, required)
- cycleId (string, 999, required)
- eventType (string, 999, required)
- ownershipAmount (double, required)
- multiplierSnapshot (double, required)
- scourceReference (string, 999, optional) [Note: typo in original]
- createdBy (string, 999, required)

Indexes:
- userId_cycleId (key: userId, cycleId, type: key, order: ASC)
- cycleId (key: cycleId, type: key, order: ASC)
- userId (key: userId, type: key, order: ASC)
```

#### Collection 2: multipliers
```
Collection ID: multipliers
Name: multipliers
Permissions: read("users")
Document Security: Enabled

Attributes:
- userId (string, 999, optional)
- cycleId (string, 999, optional)
- multiplier (double, optional)
- reason (string, 9999, optional)

Indexes:
- userId_cycleId (key: userId, cycleId, type: key, order: DESC)
```

#### Collection 3: build_cycles
```
Collection ID: build_cycles
Name: build_cycles
Permissions: read("users")
Document Security: Disabled

Attributes:
- name (string, 255, required)
- state (string, 50, required) [enum: planned, active, paused, closed]
- startDate (datetime, required)
- endDate (datetime, required)
- participantCount (integer, optional, default: 0)

Indexes:
- state (key: state, type: key, order: ASC)
- startDate (key: startDate, type: key, order: DESC)
```

#### Collection 4: cycle_participation
```
Collection ID: cycle_participation
Name: cycle_participation
Permissions: read("users")
Document Security: Disabled

Attributes:
- userId (string, 999, required)
- cycleId (string, 999, required)
- optedIn (boolean, required, default: true)
- participationStatus (string, 50, required) [enum: active, at-risk, paused, grace]
- stallStage (string, 50, required) [enum: none, grace, active, at_risk, diminishing, paused]
- lastActivityDate (datetime, optional)

Indexes:
- userId_cycleId (key: userId, cycleId, type: key, order: ASC, unique: true)
- cycleId (key: cycleId, type: key, order: ASC)
- userId (key: userId, type: key, order: ASC)
- stallStage (key: stallStage, type: key, order: ASC)
```

#### Collection 5: activity_events
```
Collection ID: activity_events
Name: activity_events
Permissions: read("users"), create("users")
Document Security: Disabled

Attributes:
- userId (string, 999, required)
- cycleId (string, 999, required)
- activityType (string, 999, required)
- proofLink (string, 9999, required)
- description (string, 9999, optional)
- verified (string, 50, required, default: "pending") [enum: pending, verified, rejected]

Indexes:
- userId_cycleId (key: userId, cycleId, type: key, order: DESC)
- cycleId (key: cycleId, type: key, order: DESC)
- userId (key: userId, type: key, order: DESC)
```

#### Collection 6: notifications
```
Collection ID: notifications
Name: notifications
Permissions: read("users"), create("users")
Document Security: Enabled (users can only see their own)

Attributes:
- userId (string, 999, required)
- type (string, 100, required) [enum: stall_warning, participation_paused, activity_verified, multiplier_changed, cycle_started, admin_message]
- message (string, 9999, required)
- read (boolean, required, default: false)
- metadata (string, 9999, optional) [JSON string]

Indexes:
- userId_read (key: userId, read, type: key, order: DESC)
- userId (key: userId, type: key, order: DESC)
```

#### Collection 7: user_profiles (Optional - for extended user data)
```
Collection ID: user_profiles
Name: user_profiles
Permissions: read("users")
Document Security: Enabled

Attributes:
- userId (string, 999, required, unique)
- role (string, 50, required, default: "member") [enum: member, admin]
- status (string, 50, required, default: "active") [enum: active, suspended]
- bio (string, 1000, optional)
- avatar (string, 500, optional)

Indexes:
- userId (key: userId, type: key, order: ASC, unique: true)
```

#### Collection 8: audit_logs (Optional - for admin tracking)
```
Collection ID: audit_logs
Name: audit_logs
Permissions: read("role:admin")
Document Security: Disabled

Attributes:
- actorId (string, 999, required)
- action (string, 255, required)
- targetType (string, 100, required)
- targetId (string, 999, optional)
- reason (string, 9999, optional)
- metadata (string, 9999, optional) [JSON string]

Indexes:
- actorId (key: actorId, type: key, order: DESC)
- action (key: action, type: key, order: DESC)
```

---

## PHASE 4: APPWRITE FUNCTIONS

### 4.1 Function: computeOwnership

**Create Function:**
```bash
# In Appwrite Console:
# Functions → Create Function

Name: computeOwnership
Function ID: computeOwnership (or auto-generated)
Runtime: Node.js 22
Entrypoint: src/main.js
Execute Access: Any
Timeout: 15 seconds
```

**Environment Variables:**
```
APPWRITE_FUNCTION_API_ENDPOINT=https://your-domain.com/v1
APPWRITE_FUNCTION_PROJECT_ID=<your-project-id>
APPWRITE_API_KEY=<your-api-key>
DATABASE_ID=builder_circle
LEDGER_COLLECTION_ID=ownership_ledger
MULTIPLIER_COLLECTION_ID=multipliers
```

**Deploy Code:**
```bash
# Option 1: Using Appwrite CLI
cd functions/computeOwnership
appwrite deploy function --functionId computeOwnership

# Option 2: Manual deployment via Console
# 1. Zip the function directory
cd functions/computeOwnership
zip -r computeOwnership.zip .

# 2. Upload via Appwrite Console → Functions → computeOwnership → Deployments
# 3. Upload computeOwnership.zip
# 4. Build command: npm install
# 5. Activate deployment
```

### 4.2 Function: stallEvaluator

**Create Function:**
```bash
Name: stallEvaluator
Function ID: stallEvaluator
Runtime: Node.js 22
Entrypoint: src/main.js
Execute Access: Server (API Key only)
Timeout: 300 seconds (5 minutes)
Schedule: 0 2 * * * (Daily at 2 AM UTC)
```

**Environment Variables:**
```
APPWRITE_ENDPOINT=https://your-domain.com/v1
APPWRITE_PROJECT_ID=<your-project-id>
APPWRITE_API_KEY=<your-api-key>
APPWRITE_DATABASE_ID=builder_circle
PARTICIPATION_COLLECTION_ID=cycle_participation
CYCLES_COLLECTION_ID=build_cycles
```

**Deploy Code:**
```bash
cd functions/stallEvaluator
zip -r stallEvaluator.zip .
# Upload via Console
```

### 4.3 Function: adjustMultiplier

**Create Function:**
```bash
Name: adjustMultiplier
Function ID: adjustMultiplier
Runtime: Node.js 22
Entrypoint: src/main.js
Execute Access: Server (API Key only)
Timeout: 300 seconds (5 minutes)
Schedule: 0 3 * * * (Daily at 3 AM UTC, after stallEvaluator)
```

**Environment Variables:**
```
APPWRITE_ENDPOINT=https://your-domain.com/v1
APPWRITE_PROJECT_ID=<your-project-id>
APPWRITE_API_KEY=<your-api-key>
APPWRITE_DATABASE_ID=builder_circle
PARTICIPATION_COLLECTION_ID=cycle_participation
MULTIPLIERS_COLLECTION_ID=multipliers
LEDGER_COLLECTION_ID=ownership_ledger
CYCLES_COLLECTION_ID=build_cycles
```

**Deploy Code:**
```bash
cd functions/adjustMultiplier
zip -r adjustMultiplier.zip .
# Upload via Console
```

---

## PHASE 5: CRON JOBS CONFIGURATION

Cron jobs are configured in the function settings:

### Schedule Format (Cron Expression)
```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Recommended Schedules

**stallEvaluator:**
```
Schedule: 0 2 * * *
Description: Daily at 2:00 AM UTC
Purpose: Evaluate participant activity and update stall stages
```

**adjustMultiplier:**
```
Schedule: 0 3 * * *
Description: Daily at 3:00 AM UTC (1 hour after stallEvaluator)
Purpose: Adjust multipliers based on updated stall stages
```

**Optional: notificationDispatcher (future)**
```
Schedule: 0 */6 * * *
Description: Every 6 hours
Purpose: Send pending notifications via email
```

---

## PHASE 6: PERMISSIONS CONFIGURATION

### Collection Permissions Summary

**ownership_ledger:**
```
Create: Server only (via functions)
Read: Any authenticated user
Update: None
Delete: None
```

**multipliers:**
```
Create: Server only (via functions)
Read: Any authenticated user
Update: None
Delete: None
```

**build_cycles:**
```
Create: role:admin
Read: Any authenticated user
Update: role:admin
Delete: role:admin
```

**cycle_participation:**
```
Create: Server only (via functions)
Read: Any authenticated user
Update: Server only (via functions)
Delete: None
```

**activity_events:**
```
Create: Any authenticated user
Read: Any authenticated user
Update: None (immutable)
Delete: None
```

**notifications:**
```
Create: Server only (via functions)
Read: User's own notifications only
Update: User's own notifications only (mark as read)
Delete: User's own notifications only
```

### Admin Role Setup

```bash
# Create admin team in Appwrite Console
# Teams → Create Team
Team ID: admin
Team Name: Administrators

# Add admin users to this team
# Users → Select User → Teams → Add to Team → admin
```

---

## PHASE 7: FRONTEND CONNECTION

### 7.1 Clone Repository

```bash
# On your VPS or local machine
git clone https://github.com/YOUR_USERNAME/builders-circle.git
cd builders-circle
```

### 7.2 Configure Environment Variables

Create `.env.local` file:

```bash
# Appwrite Configuration
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://your-domain.com/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<your-project-id>

# Database Configuration
NEXT_PUBLIC_APPWRITE_DATABASE_ID=builder_circle

# Collection IDs
NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID=build_cycles
NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID=cycle_participation
NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID=activity_events
NEXT_PUBLIC_APPWRITE_OWNERSHIP_COLLECTION_ID=ownership_ledger
NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID=user_profiles
NEXT_PUBLIC_APPWRITE_MULTIPLIERS_COLLECTION_ID=multipliers
NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID=notifications

# Function IDs
NEXT_PUBLIC_APPWRITE_FUNCTION_ID=computeOwnership
```

### 7.3 Install Dependencies

```bash
npm install
```

### 7.4 Test Connection

```bash
# Run development server
npm run dev

# Access at http://localhost:3000
# Test login/signup functionality
```

---

## PHASE 8: DEPLOY FRONTEND

### 8.1 Build Production Bundle

```bash
npm run build
```

### 8.2 Option A: Deploy with PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "builders-circle" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Check status
pm2 status
pm2 logs builders-circle
```

### 8.3 Option B: Deploy with Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/builders-circle

# Add configuration:
server {
    listen 80;
    server_name app.your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/builders-circle /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL
sudo certbot --nginx -d app.your-domain.com
```

### 8.4 Option C: Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow prompts and add environment variables
```

---

## PHASE 9: SYSTEM VERIFICATION

### 9.1 Test User Authentication

```bash
# 1. Open frontend in browser
# 2. Click "Sign Up"
# 3. Create test account
# 4. Verify email (if enabled)
# 5. Login successfully
```

### 9.2 Test Build Cycle Creation

```bash
# 1. Login as admin
# 2. Navigate to Dashboard
# 3. Create new build cycle
# 4. Verify cycle appears in database
```

### 9.3 Test Participation Opt-In

```bash
# 1. Login as regular user
# 2. View active cycles
# 3. Click "Join Build"
# 4. Verify participation record created
# 5. Check participation status shows "grace"
```

### 9.4 Test Activity Submission

```bash
# 1. Join a cycle
# 2. Navigate to Activity page
# 3. Submit activity with proof link
# 4. Verify activity appears in timeline
# 5. Check participation status updates to "active"
```

### 9.5 Test Stall Evaluation

```bash
# Manual trigger via Appwrite Console:
# Functions → stallEvaluator → Execute

# Or wait for scheduled execution

# Verify:
# 1. Function executes successfully
# 2. Participation records updated
# 3. Stall stages calculated correctly
```

### 9.6 Test Ownership Computation

```bash
# 1. Navigate to Dashboard
# 2. View ownership cards
# 3. Verify ownership data loads
# 4. Check multiplier displays correctly

# Manual function test:
# Functions → computeOwnership → Execute
# Payload: {"userId": "USER_ID", "cycleId": "CYCLE_ID"}
```

### 9.7 Test Multiplier Adjustment

```bash
# Manual trigger via Appwrite Console:
# Functions → adjustMultiplier → Execute

# Verify:
# 1. Function executes successfully
# 2. Multiplier records created
# 3. Ledger events logged
# 4. Ownership calculations reflect new multipliers
```

### 9.8 Test Notifications

```bash
# 1. Trigger stall warning (wait 7+ days or manually update)
# 2. Check notification bell icon
# 3. View notification panel
# 4. Mark notification as read
# 5. Verify read status persists
```

---

## PHASE 10: MONITORING & MAINTENANCE

### 10.1 Monitor Appwrite

```bash
# Check Docker containers
docker ps

# View Appwrite logs
docker logs appwrite

# Monitor resource usage
docker stats
```

### 10.2 Monitor Functions

```bash
# In Appwrite Console:
# Functions → Select Function → Executions
# View execution history, logs, and errors
```

### 10.3 Monitor Frontend

```bash
# If using PM2:
pm2 logs builders-circle
pm2 monit

# Check application status
pm2 status
```

### 10.4 Backup Database

```bash
# Appwrite provides automatic backups
# Manual backup via CLI:
appwrite databases list
appwrite databases get --databaseId builder_circle

# Export collections (future feature)
```

### 10.5 Update Functions

```bash
# When updating function code:
cd functions/FUNCTION_NAME
zip -r FUNCTION_NAME.zip .

# Upload new deployment via Console
# Activate new deployment
# Monitor execution logs
```

---

## TROUBLESHOOTING

### Issue: Appwrite not accessible
```bash
# Check Docker containers
docker ps

# Restart Appwrite
cd ~/appwrite
docker-compose restart

# Check logs
docker logs appwrite
```

### Issue: Function execution fails
```bash
# Check function logs in Console
# Verify environment variables
# Check API key permissions
# Increase timeout if needed
```

### Issue: Frontend can't connect
```bash
# Verify .env.local configuration
# Check CORS settings in Appwrite
# Verify project ID matches
# Check network connectivity
```

### Issue: Database permissions error
```bash
# Verify collection permissions
# Check user authentication
# Verify API key scopes
# Review document security settings
```

---

## QUICK REFERENCE

### Essential URLs
```
Appwrite Console: https://your-domain.com
Frontend App: https://app.your-domain.com
API Endpoint: https://your-domain.com/v1
```

### Essential Commands
```bash
# Restart Appwrite
docker-compose restart

# Restart Frontend
pm2 restart builders-circle

# View logs
docker logs appwrite
pm2 logs builders-circle

# Check status
docker ps
pm2 status
```

### Collection IDs
```
Database: builder_circle
Collections:
- ownership_ledger
- multipliers
- build_cycles
- cycle_participation
- activity_events
- notifications
- user_profiles (optional)
- audit_logs (optional)
```

### Function IDs
```
- computeOwnership
- stallEvaluator
- adjustMultiplier
```

---

## NEXT STEPS

1. **Seed Initial Data**: Create first build cycle and test users
2. **Configure Email**: Setup email provider for notifications
3. **Setup Monitoring**: Configure uptime monitoring and alerts
4. **Backup Strategy**: Implement regular database backups
5. **Documentation**: Document admin procedures and user guides
6. **Testing**: Perform end-to-end testing with real users
7. **Security Audit**: Review permissions and access controls
8. **Performance Optimization**: Monitor and optimize queries
9. **Feature Enhancements**: Implement additional features as needed
10. **User Onboarding**: Create onboarding flow for new users

---

## SUPPORT & RESOURCES

- **Appwrite Documentation**: https://appwrite.io/docs
- **Next.js Documentation**: https://nextjs.org/docs
- **GitHub Repository**: https://github.com/YOUR_USERNAME/builders-circle
- **Appwrite Discord**: https://appwrite.io/discord

---

**Reconstruction Complete!** 🎉

Your Builder's Circle platform should now be fully operational with all backend infrastructure, database collections, serverless functions, and frontend deployment configured.
