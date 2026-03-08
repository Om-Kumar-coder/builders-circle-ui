# Builder's Circle - Infrastructure Reconstruction Checklist

Use this checklist to track your progress through the infrastructure reconstruction process.

## Pre-Reconstruction

- [ ] VPS/Server access confirmed
- [ ] Domain name configured (optional)
- [ ] GitHub repository access confirmed
- [ ] Backup of any existing data (if applicable)
- [ ] Server meets minimum requirements:
  - [ ] 2GB RAM minimum
  - [ ] 20GB disk space
  - [ ] Ubuntu 20.04+ or Debian 10+

## Phase 1: Infrastructure Setup

- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Appwrite downloaded
- [ ] Appwrite started successfully
- [ ] Appwrite accessible via browser
- [ ] SSL certificate configured (production only)
- [ ] Nginx configured (if using reverse proxy)

**Verification:**
```bash
docker --version
docker-compose --version
docker ps | grep appwrite
```

## Phase 2: Project Setup

- [ ] Appwrite Console accessible
- [ ] Admin account created
- [ ] Project "Builder's Circle" created
- [ ] Project ID saved
- [ ] API Key created with all scopes
- [ ] API Key saved securely
- [ ] Authentication methods enabled:
  - [ ] Email/Password
  - [ ] JWT
- [ ] Session settings configured

**Save These Values:**
```
Endpoint: _______________________
Project ID: _____________________
API Key: ________________________
```

## Phase 3: Database Structure

- [ ] Database "builder_circle" created
- [ ] Collection: ownership_ledger
  - [ ] Attributes created
  - [ ] Indexes created
  - [ ] Permissions set
- [ ] Collection: multipliers
  - [ ] Attributes created
  - [ ] Indexes created
  - [ ] Permissions set
- [ ] Collection: build_cycles
  - [ ] Attributes created
  - [ ] Indexes created
  - [ ] Permissions set
- [ ] Collection: cycle_participation
  - [ ] Attributes created
  - [ ] Indexes created
  - [ ] Permissions set
- [ ] Collection: activity_events
  - [ ] Attributes created
  - [ ] Indexes created
  - [ ] Permissions set
- [ ] Collection: notifications
  - [ ] Attributes created
  - [ ] Indexes created
  - [ ] Permissions set
- [ ] Collection: user_profiles (optional)
  - [ ] Attributes created
  - [ ] Indexes created
  - [ ] Permissions set
- [ ] Collection: audit_logs (optional)
  - [ ] Attributes created
  - [ ] Indexes created
  - [ ] Permissions set

**Quick Setup:**
```bash
node scripts/create-collections.js
```

## Phase 4: Appwrite Functions

### Function: computeOwnership
- [ ] Function created in Console
- [ ] Runtime set to Node.js 22
- [ ] Entrypoint set to src/main.js
- [ ] Execute access set to "Any"
- [ ] Timeout set to 15 seconds
- [ ] Environment variables configured:
  - [ ] APPWRITE_FUNCTION_API_ENDPOINT
  - [ ] APPWRITE_FUNCTION_PROJECT_ID
  - [ ] APPWRITE_API_KEY
  - [ ] DATABASE_ID
  - [ ] LEDGER_COLLECTION_ID
  - [ ] MULTIPLIER_COLLECTION_ID
- [ ] Code deployed
- [ ] Deployment activated
- [ ] Test execution successful

### Function: stallEvaluator
- [ ] Function created in Console
- [ ] Runtime set to Node.js 22
- [ ] Entrypoint set to src/main.js
- [ ] Execute access set to "Server"
- [ ] Timeout set to 300 seconds
- [ ] Schedule set to `0 2 * * *`
- [ ] Environment variables configured:
  - [ ] APPWRITE_ENDPOINT
  - [ ] APPWRITE_PROJECT_ID
  - [ ] APPWRITE_API_KEY
  - [ ] APPWRITE_DATABASE_ID
  - [ ] PARTICIPATION_COLLECTION_ID
  - [ ] CYCLES_COLLECTION_ID
- [ ] Code deployed
- [ ] Deployment activated
- [ ] Test execution successful

### Function: adjustMultiplier
- [ ] Function created in Console
- [ ] Runtime set to Node.js 22
- [ ] Entrypoint set to src/main.js
- [ ] Execute access set to "Server"
- [ ] Timeout set to 300 seconds
- [ ] Schedule set to `0 3 * * *`
- [ ] Environment variables configured:
  - [ ] APPWRITE_ENDPOINT
  - [ ] APPWRITE_PROJECT_ID
  - [ ] APPWRITE_API_KEY
  - [ ] APPWRITE_DATABASE_ID
  - [ ] PARTICIPATION_COLLECTION_ID
  - [ ] MULTIPLIERS_COLLECTION_ID
  - [ ] LEDGER_COLLECTION_ID
  - [ ] CYCLES_COLLECTION_ID
- [ ] Code deployed
- [ ] Deployment activated
- [ ] Test execution successful

**Quick Package:**
```bash
./scripts/deploy-functions.sh
```

## Phase 5: Cron Jobs

- [ ] stallEvaluator schedule verified: `0 2 * * *`
- [ ] adjustMultiplier schedule verified: `0 3 * * *`
- [ ] Cron jobs enabled in function settings
- [ ] First scheduled execution confirmed

## Phase 6: Permissions

- [ ] ownership_ledger permissions verified
- [ ] multipliers permissions verified
- [ ] build_cycles permissions verified
- [ ] cycle_participation permissions verified
- [ ] activity_events permissions verified
- [ ] notifications permissions verified
- [ ] Admin team created (if needed)
- [ ] Admin users added to team

## Phase 7: Frontend Connection

- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] .env.local created from template
- [ ] Environment variables configured:
  - [ ] NEXT_PUBLIC_APPWRITE_ENDPOINT
  - [ ] NEXT_PUBLIC_APPWRITE_PROJECT_ID
  - [ ] NEXT_PUBLIC_APPWRITE_DATABASE_ID
  - [ ] All collection IDs
  - [ ] Function IDs
- [ ] Development server tested (`npm run dev`)
- [ ] Connection to Appwrite verified

**Verify Setup:**
```bash
node scripts/verify-setup.js
```

## Phase 8: Frontend Deployment

- [ ] Production build successful (`npm run build`)
- [ ] PM2 installed (or alternative)
- [ ] Application started with PM2
- [ ] PM2 configuration saved
- [ ] PM2 startup configured
- [ ] Application accessible via browser
- [ ] Nginx reverse proxy configured (if applicable)
- [ ] SSL certificate configured (production)

## Phase 9: System Verification

### User Authentication
- [ ] Signup page accessible
- [ ] New user registration successful
- [ ] Email verification working (if enabled)
- [ ] Login successful
- [ ] Session persistence working
- [ ] Logout working

### Build Cycles
- [ ] Dashboard accessible
- [ ] Create cycle form working (admin)
- [ ] Cycle appears in database
- [ ] Cycle list displays correctly
- [ ] Cycle details page working
- [ ] Cycle state changes working

### Participation
- [ ] Active cycles visible
- [ ] "Join Build" button working
- [ ] Participation record created
- [ ] Participation status shows "grace"
- [ ] Participation badge displays
- [ ] User can view their participations

### Activity Submission
- [ ] Activity form accessible
- [ ] Activity submission successful
- [ ] Activity appears in timeline
- [ ] Participation status updates to "active"
- [ ] lastActivityDate updated
- [ ] Activity count increments

### Ownership Computation
- [ ] Ownership cards display
- [ ] computeOwnership function executes
- [ ] Ownership data loads correctly
- [ ] Multiplier displays correctly
- [ ] Effective ownership calculated
- [ ] Data refreshes properly

### Stall Evaluation
- [ ] stallEvaluator function executes manually
- [ ] Participation records updated
- [ ] Stall stages calculated correctly
- [ ] Participation status updated
- [ ] Function logs show success
- [ ] Scheduled execution working

### Multiplier Adjustment
- [ ] adjustMultiplier function executes manually
- [ ] Multiplier records created
- [ ] Ledger events logged
- [ ] Ownership reflects new multipliers
- [ ] Function logs show success
- [ ] Scheduled execution working

### Notifications
- [ ] Notification bell displays
- [ ] Unread count accurate
- [ ] Notification panel opens
- [ ] Notifications display correctly
- [ ] Mark as read working
- [ ] Notification types styled correctly

## Phase 10: Production Readiness

### Security
- [ ] SSL certificate installed and valid
- [ ] Firewall configured (UFW or iptables)
- [ ] SSH key authentication enabled
- [ ] Password authentication disabled
- [ ] Fail2ban installed (optional)
- [ ] API keys secured
- [ ] Environment variables not exposed
- [ ] CORS settings reviewed

### Monitoring
- [ ] Uptime monitoring configured
- [ ] Error tracking setup
- [ ] Log aggregation configured
- [ ] Disk space monitoring
- [ ] Memory monitoring
- [ ] CPU monitoring
- [ ] Function execution monitoring

### Backup
- [ ] Database backup strategy defined
- [ ] Automated backups configured
- [ ] Backup restoration tested
- [ ] Backup retention policy set
- [ ] Off-site backup configured

### Documentation
- [ ] Admin procedures documented
- [ ] User guides created
- [ ] API documentation updated
- [ ] Deployment process documented
- [ ] Troubleshooting guide created
- [ ] Emergency contacts listed

### Performance
- [ ] Page load times acceptable
- [ ] Function execution times acceptable
- [ ] Database queries optimized
- [ ] Indexes verified
- [ ] Caching configured (if needed)
- [ ] CDN configured (if needed)

### Testing
- [ ] End-to-end user flow tested
- [ ] All features tested
- [ ] Error handling tested
- [ ] Edge cases tested
- [ ] Load testing performed (optional)
- [ ] Security audit performed (optional)

## Post-Deployment

- [ ] Initial build cycle created
- [ ] Test users created
- [ ] Admin users configured
- [ ] User onboarding flow tested
- [ ] Support channels established
- [ ] Monitoring alerts configured
- [ ] Team trained on admin procedures
- [ ] Launch announcement prepared

## Maintenance Schedule

- [ ] Daily: Check function executions
- [ ] Daily: Review error logs
- [ ] Weekly: Review system metrics
- [ ] Weekly: Check disk space
- [ ] Monthly: Review and rotate logs
- [ ] Monthly: Update dependencies
- [ ] Quarterly: Security audit
- [ ] Quarterly: Performance review

## Emergency Contacts

```
System Administrator: _______________
Appwrite Support: ___________________
Domain Registrar: ___________________
Hosting Provider: ___________________
```

## Important URLs

```
Appwrite Console: ___________________
Frontend Application: _______________
GitHub Repository: __________________
Documentation: ______________________
```

## Notes

```
_____________________________________
_____________________________________
_____________________________________
_____________________________________
_____________________________________
```

---

**Reconstruction Status:**

- Started: _______________
- Completed: _____________
- Verified By: ___________
- Production Launch: _____

---

**Congratulations on completing the reconstruction!** 🎉

Keep this checklist for future reference and maintenance procedures.
