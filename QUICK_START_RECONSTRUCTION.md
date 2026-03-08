# Builder's Circle - Quick Start Reconstruction

This is a condensed version of the infrastructure reconstruction guide for rapid deployment.

## Prerequisites

- Ubuntu/Debian VPS with root access
- Domain name (optional but recommended)
- GitHub repository access

## Step 1: Install Infrastructure (5 minutes)

```bash
# Make script executable
chmod +x scripts/setup-appwrite-infrastructure.sh

# Run installation script
./scripts/setup-appwrite-infrastructure.sh

# Logout and login again for Docker group changes
exit
# SSH back in
```

## Step 2: Configure Appwrite (10 minutes)

1. Open browser: `http://YOUR_SERVER_IP`
2. Create admin account
3. Create project: "Builder's Circle"
4. Save Project ID
5. Go to Settings → API Keys → Create API Key
6. Name: "Backend Functions"
7. Select ALL scopes
8. Save API Key

## Step 3: Create Database & Collections (5 minutes)

```bash
# Install node-appwrite
npm install node-appwrite

# Edit configuration in script
nano scripts/create-collections.js

# Update these values:
# - endpoint: 'http://YOUR_SERVER_IP/v1'
# - projectId: 'YOUR_PROJECT_ID'
# - apiKey: 'YOUR_API_KEY'

# Run collection creation script
node scripts/create-collections.js
```

## Step 4: Deploy Functions (15 minutes)

```bash
# Package functions
chmod +x scripts/deploy-functions.sh
./scripts/deploy-functions.sh

# This creates deployments/ folder with:
# - computeOwnership.zip
# - stallEvaluator.zip
# - adjustMultiplier.zip
```

### Upload Functions via Console

**For each function:**

1. Go to Appwrite Console → Functions → Create Function
2. Upload the corresponding .zip file
3. Configure as shown in script output
4. Add environment variables
5. Activate deployment

**computeOwnership:**
- Runtime: Node.js 22
- Entrypoint: src/main.js
- Execute: Any
- Timeout: 15s
- Env vars: See script output

**stallEvaluator:**
- Runtime: Node.js 22
- Entrypoint: src/main.js
- Execute: Server
- Timeout: 300s
- Schedule: `0 2 * * *`
- Env vars: See script output

**adjustMultiplier:**
- Runtime: Node.js 22
- Entrypoint: src/main.js
- Execute: Server
- Timeout: 300s
- Schedule: `0 3 * * *`
- Env vars: See script output

## Step 5: Configure Frontend (5 minutes)

```bash
# Create .env.local
cp .env.example .env.local

# Edit with your values
nano .env.local
```

Update:
```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=http://YOUR_SERVER_IP/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=YOUR_PROJECT_ID
NEXT_PUBLIC_APPWRITE_DATABASE_ID=builder_circle
NEXT_PUBLIC_APPWRITE_FUNCTION_ID=computeOwnership
```

## Step 6: Deploy Frontend (10 minutes)

```bash
# Install dependencies
npm install

# Build production
npm run build

# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "builders-circle" -- start

# Save PM2 config
pm2 save
pm2 startup

# Check status
pm2 status
```

## Step 7: Test System (10 minutes)

1. **Test Authentication:**
   - Open `http://YOUR_SERVER_IP:3000`
   - Sign up new account
   - Login

2. **Test Build Cycle:**
   - Create new cycle (if admin)
   - View cycles list

3. **Test Participation:**
   - Join a cycle
   - Check participation status

4. **Test Activity:**
   - Submit activity with proof link
   - View activity timeline

5. **Test Functions:**
   - Go to Appwrite Console → Functions
   - Execute `computeOwnership` manually
   - Check execution logs

## Quick Reference

### Essential Commands

```bash
# Restart Appwrite
cd ~/appwrite && docker-compose restart

# Restart Frontend
pm2 restart builders-circle

# View Logs
docker logs appwrite
pm2 logs builders-circle

# Check Status
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
- user_profiles
- audit_logs
```

### Function IDs

```
- computeOwnership (on-demand)
- stallEvaluator (cron: daily 2 AM)
- adjustMultiplier (cron: daily 3 AM)
```

## Troubleshooting

**Appwrite not accessible:**
```bash
docker ps
cd ~/appwrite && docker-compose restart
```

**Function fails:**
- Check environment variables
- Verify API key permissions
- Check function logs in Console

**Frontend can't connect:**
- Verify .env.local values
- Check Appwrite is running
- Verify project ID matches

**Database errors:**
- Verify collections exist
- Check permissions
- Review collection IDs

## Production Checklist

- [ ] Setup domain name
- [ ] Configure SSL (Certbot)
- [ ] Setup firewall (UFW)
- [ ] Configure backups
- [ ] Setup monitoring
- [ ] Test all functions
- [ ] Create admin user
- [ ] Create first build cycle
- [ ] Test complete user flow
- [ ] Document admin procedures

## Next Steps

1. **Security:**
   - Setup SSL certificate
   - Configure firewall
   - Review permissions

2. **Monitoring:**
   - Setup uptime monitoring
   - Configure alerts
   - Monitor function executions

3. **Backup:**
   - Configure database backups
   - Test restore procedures

4. **Documentation:**
   - Document admin procedures
   - Create user guides
   - Document API endpoints

5. **Testing:**
   - End-to-end testing
   - Load testing
   - Security audit

## Support

- Full Guide: `INFRASTRUCTURE_RECONSTRUCTION_GUIDE.md`
- Appwrite Docs: https://appwrite.io/docs
- GitHub Issues: Create issue in repository

---

**Total Setup Time: ~60 minutes**

Your Builder's Circle platform should now be fully operational! 🎉
