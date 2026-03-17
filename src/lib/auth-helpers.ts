import type { User } from '@/types/auth';
import { can, isPrivileged, isParticipant } from '@/lib/permissions';

type Role = NonNullable<User['role']>;

/**
 * Resolves the role from a user object, handling both `user.role`
 * and legacy `user.profile.role` shapes.
 */
export function getUserRole(user: User | null | undefined): Role | undefined {
  if (!user) return undefined;
  const legacyRole = (user as { profile?: { role?: Role } })?.profile?.role as Role | undefined;
  return user.role ?? legacyRole;
}

export function hasRole(user: User | null | undefined, ...roles: Role[]): boolean {
  const role = getUserRole(user);
  return role !== undefined && roles.includes(role);
}

/** @deprecated Use `can(user, 'admin:audit')` or `usePermissions().isAdmin` instead */
export function isAdmin(user: User | null | undefined): boolean {
  return isPrivileged(user);
}

/** @deprecated Use `can(user, 'activity:submit')` or `usePermissions().isParticipant` instead */
export function isContributor(user: User | null | undefined): boolean {
  return isParticipant(user);
}

// Re-export for convenience
export { can, isPrivileged, isParticipant };
