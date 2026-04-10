/**
 * Central permission matrix.
 * Every UI-level capability is defined here — no role strings scattered across components.
 *
 * Roles (least → most privileged):
 *   observer < contributor = employee < admin < founder
 */

import type { User } from '@/types/auth';

// ── Permission keys ───────────────────────────────────────────────────────────

export type Permission =
  // Activities
  | 'activity:submit'
  | 'activity:verify'
  | 'activity:delete'
  // Cycles
  | 'cycle:create'
  | 'cycle:edit'
  | 'cycle:delete'
  | 'cycle:join'
  // Ownership / earnings
  | 'ownership:view_own'
  | 'ownership:view_all'
  | 'ownership:override'
  // Docs
  | 'docs:view'
  | 'docs:upload'
  | 'docs:grant_access'
  // Users / roles
  | 'users:view'
  | 'users:change_role'
  | 'users:force_logout'
  | 'users:grant_access'
  | 'users:revoke_access'
  // Admin panels
  | 'admin:audit'
  | 'admin:disputes'
  | 'admin:overrides'
  | 'admin:weights'
  | 'admin:analytics'
  | 'admin:jobs'
  // Founder-only
  | 'founder:manage_founders'
  | 'founder:system_config'
  // Groups
  | 'groups:view'
  | 'groups:manage'
  // Ideas
  | 'ideas:submit'
  | 'ideas:manage'
  // Gatekeeper (Veronica)
  | 'gatekeeper:intake'
  | 'gatekeeper:submissions'
  | 'gatekeeper:queue'
  | 'gatekeeper:reports';

// ── Matrix ────────────────────────────────────────────────────────────────────

type Role = NonNullable<User['role']>;

const MATRIX: Record<Role, Set<Permission>> = {
  observer: new Set([
    'ownership:view_own',
    'docs:view',
    'groups:view',
  ]),

  contributor: new Set([
    'activity:submit',
    'cycle:join',
    'ownership:view_own',
    'docs:view',
    'groups:view',
    'ideas:submit',
  ]),

  employee: new Set([
    'activity:submit',
    'cycle:join',
    'ownership:view_own',
    'docs:view',
    'groups:view',
    'ideas:submit',
  ]),

  gatekeeper: new Set([
    'users:view',
    'docs:view',
    'groups:view',
    'gatekeeper:intake',
    'gatekeeper:submissions',
    'gatekeeper:queue',
    'gatekeeper:reports',
  ]),

  admin: new Set([
    // inherits contributor
    'activity:submit',
    'activity:verify',
    'activity:delete',
    'cycle:create',
    'cycle:edit',
    'cycle:join',
    'ownership:view_own',
    'ownership:view_all',
    'ownership:override',
    'docs:view',
    'docs:upload',
    'docs:grant_access',
    'users:view',
    'users:change_role',
    'users:force_logout',
    'users:grant_access',
    'users:revoke_access',
    'admin:audit',
    'admin:disputes',
    'admin:overrides',
    'admin:weights',
    'admin:analytics',
    'admin:jobs',
    // groups + ideas
    'groups:view',
    'groups:manage',
    'ideas:submit',
    'ideas:manage',
    // gatekeeper visibility
    'gatekeeper:intake',
    'gatekeeper:submissions',
    'gatekeeper:queue',
    'gatekeeper:reports',
  ]),

  founder: new Set([
    // inherits all admin permissions
    'activity:submit',
    'activity:verify',
    'activity:delete',
    'cycle:create',
    'cycle:edit',
    'cycle:delete',
    'cycle:join',
    'ownership:view_own',
    'ownership:view_all',
    'ownership:override',
    'docs:view',
    'docs:upload',
    'docs:grant_access',
    'users:view',
    'users:change_role',
    'users:force_logout',
    'users:grant_access',
    'users:revoke_access',
    'admin:audit',
    'admin:disputes',
    'admin:overrides',
    'admin:weights',
    'admin:analytics',
    'admin:jobs',
    // founder-only
    'founder:manage_founders',
    'founder:system_config',
    // groups + ideas
    'groups:view',
    'groups:manage',
    'ideas:submit',
    'ideas:manage',
    // gatekeeper visibility
    'gatekeeper:intake',
    'gatekeeper:submissions',
    'gatekeeper:queue',
    'gatekeeper:reports',
  ]),
};

// ── Public API ────────────────────────────────────────────────────────────────

export function can(user: User | null | undefined, permission: Permission): boolean {
  if (!user?.role) return false;
  return MATRIX[user.role]?.has(permission) ?? false;
}

export function canAny(user: User | null | undefined, ...permissions: Permission[]): boolean {
  return permissions.some(p => can(user, p));
}

export function canAll(user: User | null | undefined, ...permissions: Permission[]): boolean {
  return permissions.every(p => can(user, p));
}

/** Convenience: is the user any kind of admin (admin or founder)? */
export function isPrivileged(user: User | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'founder';
}

/** Convenience: is the user a founder specifically? */
export function isFounder(user: User | null | undefined): boolean {
  return user?.role === 'founder';
}

/** Convenience: can the user submit or participate (not observer)? */
export function isParticipant(user: User | null | undefined): boolean {
  return can(user, 'activity:submit');
}

/** Convenience: is the user a gatekeeper (or admin/founder)? */
export function isGatekeeper(user: User | null | undefined): boolean {
  return user?.role === 'gatekeeper' || isPrivileged(user);
}
