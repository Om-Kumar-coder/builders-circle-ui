'use client';

import { CheckCircle, Clock, AlertCircle, PlayCircle } from 'lucide-react';
import { useMyTasks } from '@/hooks/useTasks';
import { useLeaveStatus } from '@/hooks/useLeave';
import type { AssignmentStatus, TaskStatus } from '@/types/task';

interface Props {
  cycleId: string;
}

const assignmentStatusConfig: Record<AssignmentStatus, { label: string; color: string }> = {
  assigned: { label: 'Pending', color: 'bg-gray-700 text-gray-300' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-900 text-yellow-300' },
  completed: { label: 'Completed', color: 'bg-green-900 text-green-300' },
};

const taskStatusBadge: Record<TaskStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-900 text-blue-300' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-900 text-yellow-300' },
  review: { label: 'In Review', color: 'bg-purple-900 text-purple-300' },
  completed: { label: 'Completed', color: 'bg-green-900 text-green-300' },
  overdue: { label: 'Overdue', color: 'bg-red-900 text-red-300' },
};

function formatDue(date?: string) {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  return `Due in ${diff}d`;
}

export default function AssignedTasksWidget({ cycleId }: Props) {
  const { tasks, loading, error, startTask } = useMyTasks();
  const { onLeave } = useLeaveStatus(cycleId);

  // Filter to tasks in this cycle
  const cycleTasks = tasks.filter(a => a.task?.cycleId === cycleId);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">My Tasks</h3>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">My Tasks</h3>
        <div className="flex items-center gap-2">
          {onLeave && (
            <span className="text-xs bg-orange-900 text-orange-300 px-2 py-0.5 rounded-full font-medium">
              On Leave
            </span>
          )}
          <span className="text-xs text-gray-500">{cycleTasks.length} task{cycleTasks.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 mb-3">{error}</p>
      )}

      {cycleTasks.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">No tasks assigned yet.</p>
      ) : (
        <div className="space-y-3">
          {cycleTasks.map(assignment => {
            const task = assignment.task!;
            const taskStatus = task.status as TaskStatus;
            const assignStatus = assignment.status as AssignmentStatus;
            const statusBadge = assignmentStatusConfig[assignStatus];
            const taskBadge = taskStatusBadge[taskStatus];
            const dueLabel = formatDue(task.dueDate);
            const isCompleted = assignStatus === 'completed';
            const isOverdue = taskStatus === 'overdue';

            return (
              <div
                key={assignment.id}
                className={`rounded-lg p-3 border ${isOverdue ? 'border-red-800 bg-red-950/30' : 'border-gray-700 bg-gray-750'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-gray-500' : 'text-gray-100'}`}>
                      {task.title}
                      {(task as { isStarter?: boolean }).isStarter && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-teal-900/40 text-teal-400 font-normal">Starter</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${taskBadge.color}`}>
                        {taskBadge.label}
                      </span>
                      {dueLabel && (
                        <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                          {isOverdue ? <AlertCircle size={11} /> : <Clock size={11} />}
                          {dueLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isCompleted && !onLeave && (
                    <div className="flex gap-1 shrink-0">
                      {assignStatus === 'assigned' && (
                        <button
                          onClick={() => startTask(task.id)}
                          title="Start task"
                          className="p-1.5 rounded-lg bg-yellow-900/50 text-yellow-400 hover:bg-yellow-900 transition-colors"
                        >
                          <PlayCircle size={15} />
                        </button>
                      )}
                      {assignStatus === 'in_progress' && (
                        <button
                          onClick={() => window.location.href = `/activity?taskId=${task.id}`}
                          title="Submit activity to complete"
                          className="p-1.5 rounded-lg bg-green-900/50 text-green-400 hover:bg-green-900 transition-colors"
                        >
                          <CheckCircle size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
