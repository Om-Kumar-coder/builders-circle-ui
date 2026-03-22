const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// All columns expected per table based on schema.prisma
const expected = {
  tasks: ['id','title','description','acceptanceCriteria','proofLink','securityNote','restricted','isStarter','starterWeight','cycleId','groupId','createdBy','dueDate','status','maxAssignments','createdAt','updatedAt'],
  task_assignments: ['id','taskId','userId','status','claimedAt','submittedAt','completedAt','createdAt','updatedAt'],
  activity_events: ['id','userId','cycleId','activityType','proofLink','description','hoursLogged','workSummary','taskReference','linkedTaskId','status','verifiedBy','verifiedAt','rejectionReason','feedbackComment','feedbackAuthor','feedbackTimestamp','contributionType','contributionWeight','calculatedOwnership','scoreContribution','createdAt','updatedAt'],
  users: ['id','email','password','name','createdAt','updatedAt','emailVerified','emailVerifyToken','emailVerifyExpiry','twoFactorEnabled','twoFactorSecret','onboardingStep','onboardingCompleted','onboardingTourCompleted','tokenRevokedAt','passwordResetToken','passwordResetExpiry','groupId'],
  build_cycles: ['id','name','description','state','startDate','endDate','participantCount','metricsInitialized','createdAt','updatedAt'],
  cycle_participation: ['id','userId','cycleId','optedIn','participationStatus','stallStage','lastActivityDate','isLead','createdAt'],
  user_profiles: ['id','userId','role','status','bio','avatar','notificationPrefs'],
  cycle_messages: ['id','cycleId','authorId','message','mentions','editedAt','createdAt','updatedAt'],
  admin_action_logs: ['id','adminId','action','targetUserIds','entityType','entityId','metadata','createdAt'],
  triage_submissions: ['id','name','email','roleType','submissionType','description','proofLinks','availability','status','reviewedBy','reviewedAt','rejectionNote','createdAt'],
  ideas: ['id','submittedBy','title','description','attachments','status','reviewedBy','reviewedAt','rejectionNote','cycleId','createdAt'],
  contribution_scores: ['id','userId','cycleId','score','lastUpdatedAt'],
  system_pool: ['id','totalValue','contributorPoolPct','founderPoolPct','investorPoolPct','decayRate','isActive','updatedAt','createdAt'],
  groups: ['id','name','description','isDefault','createdAt','updatedAt'],
};

// Column definitions for ALTER TABLE ADD COLUMN
const colDefs = {
  acceptanceCriteria: 'TEXT',
  proofLink: 'TEXT',
  securityNote: 'TEXT',
  restricted: 'BOOLEAN NOT NULL DEFAULT false',
  isStarter: 'BOOLEAN NOT NULL DEFAULT false',
  starterWeight: 'DOUBLE PRECISION NOT NULL DEFAULT 1.0',
  groupId: 'TEXT',
  dueDate: 'TIMESTAMP(3)',
  maxAssignments: 'INTEGER NOT NULL DEFAULT 1',
  claimedAt: 'TIMESTAMPTZ',
  submittedAt: 'TIMESTAMPTZ',
  completedAt: 'TIMESTAMP(3)',
  taskReference: 'TEXT',
  linkedTaskId: 'TEXT',
  feedbackComment: 'TEXT',
  feedbackAuthor: 'TEXT',
  feedbackTimestamp: 'TIMESTAMP(3)',
  scoreContribution: 'DOUBLE PRECISION',
  onboardingTourCompleted: 'BOOLEAN NOT NULL DEFAULT false',
  metricsInitialized: 'BOOLEAN NOT NULL DEFAULT false',
  isLead: 'BOOLEAN NOT NULL DEFAULT false',
  notificationPrefs: "TEXT NOT NULL DEFAULT '{\"stallWarnings\":true,\"activityReminders\":true,\"cycleUpdates\":true}'",
  editedAt: 'TIMESTAMP(3)',
  entityType: 'TEXT',
  entityId: 'TEXT',
  lastUpdatedAt: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
};

async function run() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  const map = {};
  for (const r of rows) {
    if (!map[r.table_name]) map[r.table_name] = [];
    map[r.table_name].push(r.column_name);
  }

  const missing = {};
  for (const [table, cols] of Object.entries(expected)) {
    const actual = map[table] || [];
    const diff = cols.filter(c => !actual.includes(c));
    if (diff.length) missing[table] = diff;
  }

  if (!Object.keys(missing).length) {
    console.log('✅ All columns present — nothing to fix!');
    process.exit(0);
  }

  console.log('Missing columns found:');
  for (const [t, cols] of Object.entries(missing)) {
    console.log('  ' + t + ': ' + cols.join(', '));
  }

  console.log('\nApplying fixes...');
  let fixed = 0;
  let skipped = 0;

  for (const [table, cols] of Object.entries(missing)) {
    for (const col of cols) {
      const def = colDefs[col];
      if (!def) {
        console.log('  SKIP (no def): ' + table + '.' + col);
        skipped++;
        continue;
      }
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" ${def}`);
        console.log('  ADDED: ' + table + '.' + col);
        fixed++;
      } catch (e) {
        console.log('  ERROR: ' + table + '.' + col + ' — ' + e.message);
      }
    }
  }

  console.log('\nDone. Fixed: ' + fixed + ', Skipped: ' + skipped);
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
