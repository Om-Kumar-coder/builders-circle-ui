'use client';

import { useRef, useState } from 'react';
import { Lock, Calendar, User, GripVertical } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { Task, TaskStatus } from '@/types/task';

// ── Column config ─────────────────────────────────────────────────────────────

interface Column {
  id: TaskStatus;
  label: string;
  color: string;
  headerColor: string;
}

const COLUMNS: Column[] = [
  { id: 'open',        label: 'Todo',        color: 'border-blue-700/40',   headerColor: 'text-blue-400' },
  { id: 'in_progress', label: 'In Progress', color: 'border-yellow-700/40', headerColor: 'text-yellow-400' },
  { id: 'review',      label: 'Review',      color: 'border-purple-700/40', headerColor: 'text-purple-400' },
  { id: 'completed',   label: 'Done',        color: 'border-green-700/40',  headerColor: 'text-green-400' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  tasks: Task[];
  isAdmin: boolean;
  onTaskClick: (taskId: string) => void;
  onTasksChange: (tasks: Task[]) => void;
}

// ── Card ──────────────────────────────────────────────────────────────────────

function KanbanCard({
  task,
  isAdmin,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  task: Task;
  isAdmin: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const canDrag = isAdmin && !task.restricted;
  const assignees = task.assignments ?? [];
  const firstAssignee = assignees[0]?.user;
  // Non-admins see restricted tasks as locked cards
  const isLocked = task.restricted && !isAdmin;

  return (
    <div
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onClick={isLocked ? undefined : onClick}
      className={`
        relative bg-gray-800 border rounded-lg p-3 space-y-2 select-none
        transition-all duration-150
        ${isLocked
          ? 'border-yellow-900/50 opacity-60 cursor-not-allowed'
          : canDrag
            ? 'border-gray-700 cursor-grab active:cursor-grabbing hover:border-gray-500'
            : 'border-gray-700 cursor-pointer hover:border-gray-500'
        }
        ${isDragging ? 'opacity-40 scale-95' : ''}
      `}
      role={isLocked ? undefined : 'button'}
      tabIndex={isLocked ? -1 : 0}
      aria-label={isLocked ? `Restricted task: ${task.title}` : `Task: ${task.title}`}
      aria-disabled={isLocked}
      onKeyDown={isLocked ? undefined : e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      {/* Lock overlay for non-admin restricted tasks */}
      {isLocked && (
        <div className="absolute inset-0 rounded-lg flex items-center justify-center z-10 bg-gray-900/30">
          <div className="flex flex-col items-center gap-1 text-yellow-600/80">
            <Lock size={16} />
            <span className="text-xs">Restricted</span>
          </div>
        </div>
      )}

      {/* Title row */}
      <div className="flex items-start gap-2">
        {canDrag && <GripVertical size={14} className="text-gray-600 mt-0.5 shrink-0" />}
        {task.restricted && <Lock size={13} className="text-yellow-400 mt-0.5 shrink-0" aria-label="Restricted" />}
        <p className="text-sm font-medium text-gray-100 leading-snug line-clamp-2 flex-1">{task.title}</p>
      </div>

      {/* Assignee */}
      {firstAssignee && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <User size={11} />
          <span className="truncate">{firstAssignee.name ?? firstAssignee.email}</span>
          {assignees.length > 1 && (
            <span className="text-gray-600">+{assignees.length - 1}</span>
          )}
        </div>
      )}

      {/* Due date */}
      {task.dueDate && (
        <div className={`flex items-center gap-1.5 text-xs ${
          task.status !== 'completed' && new Date(task.dueDate) < new Date()
            ? 'text-red-400'
            : 'text-gray-500'
        }`}>
          <Calendar size={11} />
          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      )}

      {/* Restricted badge (admin view) */}
      {task.restricted && isAdmin && (
        <div className="flex items-center gap-1 text-xs text-yellow-500/80 bg-yellow-900/20 rounded px-1.5 py-0.5 w-fit">
          <Lock size={10} />
          Restricted
        </div>
      )}

      {/* Starter badge (admin view) */}
      {(task as { isStarter?: boolean }).isStarter && isAdmin && (
        <div className="flex items-center gap-1 text-xs text-teal-400/80 bg-teal-900/20 rounded px-1.5 py-0.5 w-fit">
          Starter
        </div>
      )}
    </div>
  );
}

// ── Board ─────────────────────────────────────────────────────────────────────

export default function KanbanBoard({ tasks, isAdmin, onTaskClick, onTasksChange }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const dragTask = useRef<Task | null>(null);

  // Group tasks by status (overdue tasks go into their logical column)
  function getColumnTasks(colId: TaskStatus): Task[] {
    return tasks.filter(t => {
      const effectiveStatus = t.status === 'overdue' ? 'open' : t.status;
      return effectiveStatus === colId;
    });
  }

  function handleDragStart(task: Task) {
    dragTask.current = task;
    setDraggingId(task.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverCol(null);
    dragTask.current = null;
  }

  function handleDragOver(e: React.DragEvent, colId: TaskStatus) {
    e.preventDefault();
    setDragOverCol(colId);
  }

  async function handleDrop(colId: TaskStatus) {
    const task = dragTask.current;
    if (!task || task.status === colId) {
      handleDragEnd();
      return;
    }

    // Optimistic update
    const prev = tasks;
    onTasksChange(tasks.map(t => t.id === task.id ? { ...t, status: colId } : t));

    try {
      await apiClient.updateTaskStatus(task.id, colId);
    } catch {
      // Revert on failure
      onTasksChange(prev);
    }

    handleDragEnd();
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-h-[400px]">
      {COLUMNS.map(col => {
        const colTasks = getColumnTasks(col.id);
        const isOver = dragOverCol === col.id;

        return (
          <div
            key={col.id}
            onDragOver={e => handleDragOver(e, col.id)}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={() => handleDrop(col.id)}
            className={`
              flex flex-col rounded-xl border transition-colors duration-150
              ${col.color}
              ${isOver ? 'bg-gray-700/40 border-indigo-500/60' : 'bg-gray-800/40'}
            `}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-700/50">
              <span className={`text-xs font-semibold uppercase tracking-wider ${col.headerColor}`}>
                {col.label}
              </span>
              <span className="text-xs text-gray-500 bg-gray-700/60 rounded-full px-2 py-0.5">
                {colTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
              {colTasks.length === 0 && (
                <div className={`
                  h-16 rounded-lg border-2 border-dashed flex items-center justify-center
                  text-xs text-gray-600 transition-colors
                  ${isOver ? 'border-indigo-500/50 text-indigo-500/60' : 'border-gray-700/50'}
                `}>
                  {isOver ? 'Drop here' : 'No tasks'}
                </div>
              )}
              {colTasks.map(task => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  isAdmin={isAdmin}
                  isDragging={draggingId === task.id}
                  onDragStart={() => handleDragStart(task)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onTaskClick(task.id)}
                />
              ))}
              {/* Drop zone at bottom when column has cards */}
              {colTasks.length > 0 && isOver && (
                <div className="h-10 rounded-lg border-2 border-dashed border-indigo-500/50 flex items-center justify-center text-xs text-indigo-500/60">
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
