# Builder's Circle — Project Status

> Based on: Builder's Circle Full Scope of Work (Primetrix Solutions) + UI Requirements

---

## TIER 1 — CORE (GO-LIVE GATE)

### Step 1 — Infrastructure & Security

| Item | Status |
|------|--------|
| Linux VPS / Docker / NGINX / HTTPS setup | ✅ Done (deploy scripts present) |
| Secure JWT-based auth with HttpOnly cookies | ✅ Done |
| Role-based access control (RBAC) | ✅ Done |
| Immutable audit log (append-only) | ✅ Done |
| Background worker service (cron jobs) | ✅ Done |
| Strong password rules | ✅ Done (bcrypt, min length enforced) |
| Mandatory 2FA | ❌ Pending |
| Session expiry & re-authentication modal | ❌ Pending |
| Step-up auth for admin actions | ❌ Pending |

---

### Step 2 — User & Role System

| Item | Status |
|------|--------|
| Roles: Founder, Admin, Contributor, Employee, Observer | ✅ Done |
| Role-based middleware enforcing access | ✅ Done |
| Only Admin/Founder can change system state | ✅ Done |
| Contributors/Employees cannot self-approve | ✅ Done |
| Every role change is logged | ✅ Done |

---

### Step 3 — Core Data Models

| Model | Status |
|-------|--------|
| Users + UserProfile | ✅ Done |
| Roles & Permissions | ✅ Done |
| Build Cycles | ✅ Done |
| Participation | ✅ Done |
| Activity Records | ✅ Done |
| Ownership Ledger (Earnings) | ✅ Done |
| Audit Logs | ✅ Done |
| Disputes | ✅ Done |
| Agreements (versioned) | ❌ Pending |
| Tasks / Milestones | ❌ Pending (no dedicated model) |

---

### Step 4 — Build Cycle Engine

| Item | Status |
|------|--------|
| States: Planned → Active → Paused → Closed | ✅ Done |
| Only ACTIVE cycles trigger accountability | ✅ Done |
| Paused cycles freeze all timers | ✅ Done |
| Closed cycles finalize earnings | ✅ Done |
| One contributor in multiple cycles | ✅ Done |
| Admin-only cycle state control | ✅ Done |

---

### Step 5 — Participation Logic

| Item | Status |
|------|--------|
| Contributor opt-in to a build | ✅ Done |
| No opt-in = no accountability = no earnings impact | ✅ Done |
| Employee hours & activity tracking | ✅ Done |
| Participation status tracking | ✅ Done |

---

### Step 6 — Activity Tracking

| Item | Status |
|------|--------|
| Task/milestone completion | ✅ Done |
| PR / commit link submission (proofLink) | ✅ Done |
| Docs & reviews | ✅ Done |
| Employee daily/weekly hours logging | ✅ Done |
| Activity verification workflow (pending → verified/rejected) | ✅ Done |
| Admin feedback on activities | ✅ Done |
| Valid activity resets stall countdown | ✅ Done |
| Messages/intent/drafts do NOT count | ✅ Done |

---

### Step 7 — Earnings & Accountability Engine

| Item | Status |
|------|--------|
| Vested % (immutable) | ✅ Done |
| Provisional % (adjustable) | ✅ Done |
| 3-day grace period on join | ✅ Done |
| Stall stages: Active → At Risk → Diminishing → Paused | ✅ Done |
| Multiplier penalties per stage (1.0 → 0.75 → 0.5 → 0.0) | ✅ Done |
| Countdown resets only on valid activity | ✅ Done |
| Ownership decay job (weekly) | ✅ Done |
| Multiplier adjustment job (daily) | ✅ Done |
| All multiplier changes deterministic & logged | ✅ Done |

---

### Step 8 — Dashboards

| Item | Status |
|------|--------|
| Contributor: Vested %, Provisional %, Multiplier, Effective % | ✅ Done |
| Contributor: Build status, Participation status | ✅ Done |
| Contributor: Last activity date, Next stall threshold | ✅ Done |
| Contributor: Rules explanation banner | ✅ Done (StallWarningAlert) |
| Contributor: Contribution heatmap | ✅ Done |
| Contributor: Engagement score | ✅ Done |
| Admin: Full system visibility | ✅ Done |
| Admin: Participation states overview | ✅ Done |
| Admin: Override controls | ✅ Done |
| Admin: Audit history | ✅ Done |

---

### Step 9 — Agreement System

| Item | Status |
|------|--------|
| Versioned agreement (v1.1) | ❌ Pending |
| Digital acknowledgment required | ❌ Pending |
| Agreement visible at all times | ❌ Pending |
| No agreement = no provisional earnings | ❌ Pending |

---

### Step 10 — Admin & Founder Controls

| Item | Status |
|------|--------|
| Assign / remove participants | ✅ Done |
| Pause / resume builds | ✅ Done |
| Grant temporary leave | ❌ Pending |
| Clear stalls (with reason, logged) | ✅ Done |
| Apply overrides (logged, irreversible) | ✅ Done |
| Step-up authentication for admin actions | ❌ Pending |

---

### Step 11 — Background Services

| Job | Status |
|-----|--------|
| Stall evaluator (daily 2 AM) | ✅ Done |
| Earnings recalculation / multiplier adjustment (daily 3 AM) | ✅ Done |
| Activity archiver (weekly Sunday 5 AM) | ✅ Done |
| Cycle finalizer (daily 4 AM) | ✅ Done |
| Ownership decay (weekly Sunday 1 AM) | ✅ Done |
| Notifications job | ✅ Done (in-app) |
| All results logged | ✅ Done |

---

## TIER 2 — ENHANCEMENTS (POST-LAUNCH)

| Item | Status |
|------|--------|
| In-app notifications | ✅ Done |
| Email notifications | ❌ Pending (schema ready, no email service) |
| Admin bulk actions | ❌ Pending |
| Filters & exports | ❌ Pending |
| Activity timelines | ✅ Done (ActivityTimeline component) |
| Earnings projection UI | ❌ Pending |
| Cycle messaging / discussion | ✅ Done (bonus) |
| Contributor reputation scoring | ✅ Done (bonus) |
| Analytics dashboard | ✅ Done (bonus) |

---

## UI REQUIREMENTS STATUS

### Authentication & Session UI

| Item | Status |
|------|--------|
| Login screen (email, password, error messages) | ✅ Done |
| 2FA prompt (step 2 of login) | ❌ Pending |
| Session expiry warning modal ("expires in 2 min") | ❌ Pending |
| Forced re-auth modal for restricted actions | ❌ Pending |

---

### Dashboard UI

| Item | Status |
|------|--------|
| User name + access tier badge | ✅ Done |
| 2FA security status indicator | ❌ Pending (no 2FA) |
| Assigned tasks widget | ❌ Pending (no task model) |
| Access expiry widget | ❌ Pending |
| Recent activity widget | ✅ Done |
| Security notices / stall warnings | ✅ Done |

---

### Onboarding UI

| Item | Status |
|------|--------|
| Onboarding stepper (5 steps) | ⚠️ Partial (OnboardingTour.tsx exists, minimal) |
| Accept Builder's Circle rules step | ❌ Pending |
| Enable 2FA step | ❌ Pending |
| Confirm password manager step | ❌ Pending |
| Access tier assigned step | ❌ Pending |
| Cannot skip steps / cannot access app until complete | ❌ Pending |

---

### Docs Vault UI

| Item | Status |
|------|--------|
| Folder-based navigation | ❌ Pending |
| Security labels & access expiry notices | ❌ Pending |
| Watermark (username + timestamp) | ❌ Pending |
| View-only mode, download disabled by default | ❌ Pending |
| "Request Access" button | ❌ Pending |

---

### Access & Security UI

| Item | Status |
|------|--------|
| Access overview (tier, systems, expiry dates) | ❌ Pending |
| Access request form | ❌ Pending |
| 2FA management UI | ❌ Pending |
| Password change UI | ❌ Pending |

---

### Activity Log UI

| Item | Status |
|------|--------|
| Read-only audit log table | ✅ Done |
| Columns: timestamp, user, action, resource, result | ✅ Done |
| No delete/edit buttons | ✅ Done |
| Filters by date, user, action | ❌ Pending |

---

### Admin UI

| Item | Status |
|------|--------|
| User management | ✅ Done |
| Access approvals | ✅ Done |
| Session management | ❌ Pending |
| Security alerts | ❌ Pending |
| Grant/revoke access with expiry | ❌ Pending |
| Force session logout | ❌ Pending |
| Disable accounts | ✅ Done |

---

## Summary

| Category | Done | Pending |
|----------|------|---------|
| Tier 1 Core Logic | ~85% | 2FA, agreements, temp leave, step-up auth |
| Background Jobs | 100% | — |
| Dashboards | ~90% | Minor widgets |
| UI Requirements | ~55% | 2FA, onboarding stepper, docs vault, access/security UI |
| Tier 2 Enhancements | ~50% | Email, bulk actions, exports, earnings projection |

### Critical Blockers Before Go-Live
1. **2FA** — mandatory per spec, not implemented
2. **Agreement system** — versioned agreement + digital acknowledgment required
3. **Onboarding stepper** — must complete before accessing app
4. **Step-up re-authentication** — required for admin/sensitive actions
5. **Temporary leave grants** — admin control missing

### Not In Scope (Tier 3 — Do Not Build)
- Advanced AI/automation suggestions
- Slack / GitHub deep sync integrations
- Payments
- Public dashboards
- Gamification
