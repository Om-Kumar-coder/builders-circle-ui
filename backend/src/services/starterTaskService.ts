import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

/**
 * Assigns up to 5 starter tasks from the user's group to the user.
 * Called on: triage approval, cycle join.
 * Safe to call multiple times — skips already-assigned tasks.
 */
export async function assignStarterTasks(
  userId: string,
  groupId: string,
  cycleId?: string
): Promise<number> {
  const where: Prisma.TaskWhereInput = {
    isStarter: true,
    groupId,
    status: 'open',
    ...(cycleId ? { cycleId } : {}),
  };

  const starterTasks = await prisma.task.findMany({
    where,
    take: 5,
    orderBy: { createdAt: 'asc' },
  });

  if (starterTasks.length === 0) return 0;

  const existingAssignments = await prisma.taskAssignment.findMany({
    where: { userId, taskId: { in: starterTasks.map(t => t.id) } },
    select: { taskId: true },
  });
  const alreadyAssigned = new Set(existingAssignments.map(a => a.taskId));

  const toAssign = starterTasks.filter(t => !alreadyAssigned.has(t.id));
  if (toAssign.length === 0) return 0;

  await prisma.taskAssignment.createMany({
    data: toAssign.map(task => ({
      taskId: task.id,
      userId,
      status: 'assigned',
    })),
  });

  await prisma.notification.create({
    data: {
      userId,
      type: 'admin_message',
      message: `You've been assigned ${toAssign.length} starter task${toAssign.length > 1 ? 's' : ''} to get you started.`,
      metadata: JSON.stringify({ taskIds: toAssign.map(t => t.id) }),
    },
  });

  return toAssign.length;
}
