# Builder's Circle — Production Deployment Checklist

> **Last updated:** May 28, 2026
> **Based on:** [report.md](./report.md) — Phase 1 + Phase 2 Complete, all 261 tests passing

---

## Table of Contents

- [1. Pre-Deployment Verification](#1-pre-deployment-verification)
- [2. Environment Variables](#2-environment-variables)
- [3. Infrastructure Setup](#3-infrastructure-setup)
- [4. Security Hardening](#4-security-hardening)
- [5. Deployment Steps](#5-deployment-steps)
- [6. Post-Deployment Validation](#6-post-deployment-validation)
- [7. Monitoring & Operations](#7-monitoring--operations)
- [8. Rollback Plan](#8-rollback-plan)
- [9. Quick Reference (One-Page Summary)](#9-quick-reference-one-page-summary)

---

## 1. Pre-Deployment Verification

Check off each item before deploying to production.

### 1.1 Code Quality

- [ ] **Tests pass** — Run full test suite:
  ```bash
  # Backend (201 tests)
  cd backend && npx jest --no-coverage --runInBand
  
  # Frontend components (60 tests)
  cd .. && npx jest --config jest.component.config.js --no-coverage
  
  # Expected: 261 total, all passing
  ```
- [ ] **TypeScript compiles** — Both frontend and backend:
  ```bash
  cd backend && npx tsc --noEmit
  cd .. && npx tsc --noEmit
  ```
- [ ] **Lint passes**:
  ```bash
  npm run lint
  ```
- [ ] **Build succeeds**:
  ```bash
  npm run build
  cd backend && npm run build && cd ..
  ```

### 1.2 Environment Configuration

- [ ] **All env vars defined** (see [§2 Environment Variables](#2-environment-variables))
- [ ] **Secrets generated** — `JWT_SECRET` must be a cryptographically random string ≥ 32 chars
- [ ] **CAPTCHA configured** — Both `NEXT_PUBLIC_CAPTCHA_SITE_KEY` and `CAPTCHA_SECRET_KEY` set (required in production)
- [ ] **Akismet configured** — `AKISMET_API_KEY` set for spam protection
- [ ] **Resend API key set** — `RESEND_API_KEY` for transactional emails
- [ ] **`NODE_ENV=production`** — Confirmed in backend `.env`
- [ ] **`NEXT_PUBLIC_API_URL`** points to the production API URL (e.g., `https://triagebuilders.com/api`)

### 1.3 Database

- [ ] **PostgreSQL accessible** — Test connection with the production `DATABASE_URL`
- [ ] **Migrations applied** — Run `npx prisma migrate deploy` in `backend/`
- [ ] **No pending migrations** — Verify with `npx prisma migrate status`
- [ ] **Database indexes verified** — The following indexes should exist:
  - `entry_intake`: `email`, `status`, `createdAt`
  - `event_logs`: `event`, `sessionId`, `createdAt`
  - `gatekeeper_review`: `entityType`, `queue`, `status`, `createdAt`
  - `triage_submissions`: `email`, `status`, `createdAt`

### 1.4 Infrastructure

- [ ] **Server provisioned** — Minimum: 2 vCPU, 4 GB RAM, 50 GB SSD
- [ ] **Nginx installed and configured** (see `deploy.sh` for template)
- [ ] **SSL certificate obtained** — Via Let's Encrypt / Certbot
- [ ] **PM2 configured** — Using `ecosystem.config.js`
- [ ] **Ollama installed** — For Veronica AI (rule-based fallback works without it)
- [ ] **Phi-3 Mini model pulled** — `ollama pull phi3:mini`
- [ ] **Firewall configured** — Ports: 22 (SSH), 80 (HTTP), 443 (HTTPS) only
- [ ] **Upload directory exists** — Set `UPLOAD_DIR` and ensure writeable by the app user

---

## 2. Environment Variables

### 2.1 Backend (`backend/.env`)

| Variable | Required | Description | Source |
|----------|----------|-------------|--------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string | Infrastructure |
| `JWT_SECRET` | **Yes** | Cryptographic secret for JWT signing (≥ 32 chars) | Generate w/ `openssl rand -base64 32` |
| `JWT_EXPIRES` | No (default: `2h`) | JWT token expiry duration | Config |
| `PORT` | No (default: `3001`) | Backend server port | Config |
| `NODE_ENV` | **Yes** | Must be `production` | Config |
| `FRONTEND_URL` | **Yes** | Frontend URL for CORS (e.g., `https://triagebuilders.com`) | DNS |
| `RESEND_API_KEY` | **Recommended** | Transactional email (verification, resets, alerts) | Resend |
| `CAPTCHA_SECRET_KEY` | **Yes** (fail-closed) | reCAPTCHA v3 secret key; **production will block submissions without it** | Google reCAPTCHA Admin |
| `AKISMET_API_KEY` | **Recommended** | Spam protection; logged warning if missing | Akismet |
| `UPLOAD_DIR` | No (default: `./uploads`) | Absolute path for file uploads | Infrastructure |
| `OLLAMA_URL` | No (default: `http://localhost:11434`) | Ollama server URL for Veronica AI | Infrastructure |
| `BACKUP_DIR` | No | Database backup directory | Infrastructure |
| `GOOGLE_CLIENT_ID` | Conditionally | Google Drive backup integration | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Conditionally | Google Drive backup integration | Google Cloud Console |
| `GOOGLE_REFRESH_TOKEN` | Conditionally | Google Drive backup integration | OAuth flow |
| `GOOGLE_DRIVE_FOLDER_ID` | Conditionally | Google Drive backup destination | Google Drive |
| `GOOGLE_SHEET_ID` | No | Interest form spreadsheet ID | Google Sheets |
| `FOUNDATION_PHASE_ENABLED` | No (`true`/`false`) | Feature flag for foundation phase features | Config |

### 2.2 Frontend (`.env.local` / `.env.production`)

| Variable | Required | Description | Source |
|----------|----------|-------------|--------|
| `NEXT_PUBLIC_API_URL` | **Yes** | Backend API URL (e.g., `https://triagebuilders.com/api`) | DNS |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Frontend URL (e.g., `https://triagebuilders.com`) | DNS |
| `NEXT_PUBLIC_CAPTCHA_SITE_KEY` | **Yes** (fail-closed) | reCAPTCHA v3 site key; matches `CAPTCHA_SECRET_KEY` | Google reCAPTCHA Admin |
| `NEXT_PUBLIC_ERROR_REPORTING_URL` | No | Optional error reporting endpoint | Config |

### 2.3 Verification Steps

After setting all env vars, run the backend — it will log startup warnings for any critical missing values.

---

## 3. Infrastructure Setup

### 3.1 Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 50 GB SSD | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Node.js | 18.x LTS | 20.x LTS |

### 3.2 Nginx Configuration

Use the template from `deploy.sh` (`write_nginx_config` function). Key points:

- **HTTPS redirect**: HTTP → 301 → HTTPS
- **SSL**: Let's Encrypt with auto-renewal
- **Security headers**: HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- **API proxy**: `client_max_body_size 25M` (20 MB file uploads + headroom)
- **Static assets**: 1-year immutable cache for `.js`, `.css`, `.png`, etc.
- **No duplicate CORS headers**: CORS is handled entirely by Express

> **Important**: Do NOT add `Access-Control-*` headers in Nginx when proxying to the backend. Express already sets them. Duplicate headers cause browser CORS failures.

### 3.3 PM2 Process Management

Using `ecosystem.config.js` (two apps):

| App | Port | Restart Policy |
|-----|------|----------------|
| `builders-circle-backend` | 3001 | 4s delay, max 10 restarts, 10s min uptime |
| `builders-circle-frontend` | 3000 | Same |

Commands:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root
```

### 3.4 Database (PostgreSQL)

- [ ] User `builders_user` created
- [ ] Database `builders_circle` created (owner: `builders_user`)
- [ ] Connection string tested: `psql "$DATABASE_URL" -c "SELECT 1"`
- [ ] Regular backups configured (see §7.3)

### 3.5 Veronica AI (Ollama)

- [ ] Ollama installed: `curl -fsSL https://ollama.com/install.sh | sh`
- [ ] Service running: `systemctl start ollama && systemctl enable ollama`
- [ ] Model pulled: `ollama pull phi3:mini`
- [ ] Health check: `curl http://localhost:11434/api/tags | grep phi3:mini`
- [ ] `OLLAMA_URL` set in backend `.env` (default: `http://localhost:11434`)

> **Note**: Veronica is optional. If Ollama is unavailable, the rule-based fallback is used. Fallback scores are capped at 0.65 (never auto-approves).

---

## 4. Security Hardening

### 4.1 Entry Control Layer (Phase 1)

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Client-side | localStorage `prefilter_ack` + JWT token check | ✅ Active |
| Middleware | httpOnly `prefilter_token` cookie validated via JWT expiry check | ✅ Active |
| API | JWT verification + sessionId matching + `prefilterAck: true` literal | ✅ Active |

### 4.2 Network Security

- [ ] **Firewall (UFW)**: Allow only ports 22, 80, 443
- [ ] **Fail2ban**: Install and configure for SSH brute-force protection
- [ ] **DDoS protection**: Consider Cloudflare for production traffic
- [ ] **Database access**: Restrict PostgreSQL to localhost only (`listen_addresses = 'localhost'`)

### 4.3 Application Security

- [ ] **Rate limiting active**: 5/h intake submissions, 100/h event logs per IP
- [ ] **CAPTCHA fail-closed**: Missing `CAPTCHA_SECRET_KEY` blocks all submissions in production
- [ ] **Akismet spam check**: Active if `AKISMET_API_KEY` is set (recommended)
- [ ] **Security headers** set via Nginx (HSTS, X-Frame-Options, etc.)
- [ ] **JWT cookies**: `httpOnly`, `sameSite: 'lax'`, `secure: true` in production
- [ ] **Rate limiting skips disabled in production**: Verify `skip: () => env.NODE_ENV === 'test'` is the only skip condition
- [ ] **Input validation**: Zod schemas on all API endpoints
- [ ] **File upload limits**: 20 MB max, `client_max_body_size 25M` in Nginx

### 4.4 Secrets Management

- [ ] `.env` files not in version control (`.gitignore` excludes them)
- [ ] `JWT_SECRET` is at least 32 characters, cryptographically random
- [ ] Database password is strong and unique
- [ ] API keys (Resend, Akismet, Google) rotated regularly
- [ ] No hardcoded secrets in source code

---

## 5. Deployment Steps

### Option A: Automated (using `deploy.sh`)

```bash
# Fresh install
sudo ./deploy.sh install

# Update existing deployment
sudo ./deploy.sh update

# Rollback (manual)
# rsync -a --exclude='node_modules' --exclude='.next' --exclude='backend/node_modules' --exclude='backend/dist' /tmp/builders-circle-backup-<timestamp>/ /var/www/builders-circle-ui/
# pm2 reload all
```

### Option B: Manual Deployment

```bash
# 1. Pull latest code
cd /var/www/builders-circle-ui
git pull origin main

# 2. Install dependencies
npm install
cd backend && npm install && cd ..

# 3. Run database migrations
cd backend
npx prisma generate
npx prisma migrate deploy
npm run build
cd ..

# 4. Build frontend
npm run build

# 5. Reload processes
pm2 reload all

# 6. Verify health
sleep 5
curl -s http://localhost:3001/api/health
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

---

## 6. Post-Deployment Validation

Run these checks after every deployment.

### 6.1 Health Checks

```bash
# Backend API
curl -s http://localhost:3001/api/health

# Expected: 200 OK with JSON status response

# Frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# Expected: 200

# Public HTTPS
curl -s -o /dev/null -w "%{http_code}" https://triagebuilders.com

# Expected: 200

# Veronica (Ollama)
curl -s http://localhost:11434/api/tags | grep phi3:mini

# Expected: phi3:mini found (or fallback mode if missing)
```

### 6.2 Flow Validation

Test each of these manually or with an automated smoke test:

- [ ] **Entry Control Layer**:
  1. Navigate to `/builders-circle/system-entry` → page loads, button disabled
  2. Scroll past 50% of requirements section → `prefilter_scrolled_50` event logged
  3. Check acknowledgment checkbox → button becomes enabled, JWT token issued
  4. Click CTA → redirected to `/triage/apply`
  5. Direct navigation to `/triage/apply` → blocked without cookie, redirected to system-entry

- [ ] **Intake Form**:
  1. Fill all required fields, submit → success with reference ID
  2. Submit with invalid data → validation errors shown
  3. Submit duplicate email → "already submitted" error
  4. Submit without CAPTCHA → blocked in production

- [ ] **Authentication**:
  1. Login with valid credentials → redirected to dashboard
  2. Login with invalid credentials → error shown
  3. Access protected route without token → redirected to login

- [ ] **Gatekeeper**:
  1. Login as gatekeeper → can see intake queue
  2. Login as admin → can see all queues
  3. Review an intake → APPROVED/REJECTED/SENT_BACK actions work
  4. Generate daily report → report appears in list

### 6.3 Monitoring Validation

- [ ] **PM2 processes running**: `pm2 status` → both apps green
- [ ] **No startup errors**: `pm2 logs --lines 30 --nostream`
- [ ] **No missing env var warnings** in logs
- [ ] **Nginx serving correctly**: `systemctl status nginx`
- [ ] **SSL certificate valid**: `certbot certificates`

---

## 7. Monitoring & Operations

### 7.1 Logging

| Log | Location | Retention |
|-----|----------|-----------|
| Backend app logs | `logs/backend-{error,out,combined}.log` | 30 days (PM2) |
| Frontend app logs | `logs/frontend-{error,out,combined}.log` | 30 days (PM2) |
| Event logs (DB) | `event_logs` table | 90 days (auto-cleanup via cron) |
| System audit logs | `system_logs` table | Permanent (admin tool) |
| Nginx access | `/var/log/nginx/access.log` | 30 days |
| Nginx error | `/var/log/nginx/error.log` | 30 days |

### 7.2 Cron Jobs (Auto-Configured)

| Job | Schedule | Description |
|-----|----------|-------------|
| Daily report generation | 11:55 PM daily | Aggregates daily metrics into `daily_reports` table |
| Event logs cleanup | 2:30 AM daily | Deletes `event_logs` older than 90 days |
| Database backup | Configure manually | Recommended: daily pg_dump to offsite storage |

### 7.3 Database Backup

Recommended backup strategy:

```bash
# Add as a cron job: 0 3 * * * (daily at 3 AM)
pg_dump "$DATABASE_URL" | gzip > /backups/builders-circle-$(date +%Y%m%d).sql.gz

# Retention: keep 30 days
find /backups -name "builders-circle-*.sql.gz" -mtime +30 -delete
```

If Google Drive backup is configured (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`), the application's `backupJob` handles this automatically.

### 7.4 Performance Monitoring

- **PM2 metrics**: `pm2 monit` (real-time CPU/memory)
- **System resources**: `htop`, `df -h`, `free -m`
- **API response times**: Monitor via Nginx logs (`$upstream_response_time`)
- **Database connections**: `SELECT count(*) FROM pg_stat_activity;`

### 7.5 Alerting (Recommended)

- [ ] **PM2 auto-restart**: Configured in `ecosystem.config.js` (4s delay, max 10 restarts)
- [ ] **Server monitoring**: Set up UptimeRobot or similar for HTTPS endpoint
- [ ] **Error tracking**: Configure `NEXT_PUBLIC_ERROR_REPORTING_URL` if available
- [ ] **Disk space alert**: Add cron to check disk usage and email if > 90%

---

## 8. Rollback Plan

### 8.1 Code Rollback

```bash
# If deploy.sh was used (backup exists)
cd /var/www/builders-circle-ui
BACKUP=$(ls -t /tmp/builders-circle-backup-* | head -1)
rm -rf /var/www/builders-circle-ui
mv "$BACKUP" /var/www/builders-circle-ui
pm2 reload all

# Or using git
cd /var/www/builders-circle-ui
git revert HEAD --no-edit
git push origin main
# Then run the update steps (dependencies, build, migrate, reload)
```

### 8.2 Database Rollback

```bash
# Restore from backup
pg_restore --clean --if-exists -d "$DATABASE_URL" /backups/builders-circle-<date>.dump

# Or roll back a specific migration (last resort)
cd backend
npx prisma migrate diff --from-migration <last_good_migration> --to-empty --script > rollback.sql
psql "$DATABASE_URL" -f rollback.sql
npx prisma migrate resolve --rolled-back <bad_migration_name>
```

### 8.3 Emergency Procedures

| Situation | Action |
|-----------|--------|
| Backend down | `pm2 restart builders-circle-backend` |
| Frontend down | `pm2 restart builders-circle-frontend` |
| Database down | `systemctl restart postgresql` |
| Full outage | `sudo ./deploy.sh restart` |
| SSL expired | `certbot renew` followed by `systemctl reload nginx` |
| Disk full | Clean old logs: `find logs/ -name "*.log" -mtime +7 -delete` |
| Ollama unresponsive | Restart: `systemctl restart ollama` (falls back to rule-based automatically) |

---

## 9. Quick Reference (One-Page Summary)

### Essential Commands

```bash
# Deploy
sudo ./deploy.sh update                    # Pull, build, migrate, reload

# Status
pm2 status                                 # Process status
pm2 logs builders-circle-backend --lines 20 # Recent backend logs
sudo ./deploy.sh check                     # Full health check

# Restart
sudo ./deploy.sh restart                   # Rebuild & restart backend
pm2 restart all                            # Restart all processes

# Database
cd backend && npx prisma migrate deploy    # Apply pending migrations
npx prisma studio                          # Open DB admin UI (dev only)

# Tests (pre-deploy)
cd backend && npx jest --no-coverage --runInBand  # Backend tests (201)
cd .. && npx jest --config jest.component.config.js --no-coverage  # Frontend tests (60)
```

### Key URLs

| Route | Purpose | Auth Required |
|-------|---------|---------------|
| `/builders-circle/system-entry` | Entry control prefilter | No |
| `/triage/apply` | Intake form | Prefilter JWT + cookie |
| `/login` | User login | No |
| `/gatekeeper` | Gatekeeper dashboard | Gatekeeper/admin role |
| `/admin` | Admin dashboard | Admin role |
| `/dashboard` | User dashboard | User role |

### Critical Env Vars

| Variable | Required In Production | Failure Mode |
|----------|----------------------|--------------|
| `DATABASE_URL` | **Yes** | App won't start |
| `JWT_SECRET` | **Yes** | Auth broken |
| `NODE_ENV=production` | **Yes** | Dev configs leak |
| `CAPTCHA_SECRET_KEY` | **Yes** | All submissions blocked (fail-closed) |
| `NEXT_PUBLIC_CAPTCHA_SITE_KEY` | **Yes** | CAPTCHA not shown on form |
| `AKISMET_API_KEY` | Recommended | Spam protection disabled (warning in logs) |
| `RESEND_API_KEY` | Recommended | Emails disabled |
| `FRONTEND_URL` | **Yes** | CORS failures |

### Architecture Overview

```
User → Cloudflare/DNS → Nginx (SSL termination)
  ├── /api/* → Express (:3001) → PostgreSQL + Ollama
  └── /*     → Next.js (:3000) → SSR
```

**Process model**: PM2 manages 2 fork-mode processes. No clustering (session affinity / file uploads require single process). Use vertical scaling if needed.

### Deployment Flow

```
git pull → npm install → prisma migrate deploy → npm run build → pm2 reload all → health check
```

Expected downtime: < 5 seconds (PM2 reload is graceful).
