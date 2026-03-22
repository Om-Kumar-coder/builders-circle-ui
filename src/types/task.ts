export type TaskStatus = 'open' | 'in_progress' | 'review' | 'completed' | 'overdue';
export type AssignmentStatus = 'assigned' | 'in_progress' | 'completed';
export type LeaveStatus = 'active' | 'paused' | 'left';

export interface Task {
  id: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  proofLink?: string;
  securityNote?: string;
  restricted?: boolean;
  isStarter?: boolean;
  groupId?: string;
  cycleId: string;
  createdBy: string;
  dueDate?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  creator?: { id: string; name?: string; email: string };
  assignments?: TaskAssignment[];
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  userId: string;
  status: AssignmentStatus;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name?: string; email: string };
  task?: Task & { cycle?: { id: string; name: string; state: string } };
}

export interface ParticipationLeave {
  id: string;
  userId: string;
  cycleId: string;
  status: LeaveStatus;
  leaveStart?: string;
  leaveEnd?: string;
  reason?: string;
  grantedBy?: string;
  createdAt: string;
  cycle?: { id: string; name: string };
}

export interface LeaveStatus2 {
  onLeave: boolean;
  leave: ParticipationLeave | null;
}
