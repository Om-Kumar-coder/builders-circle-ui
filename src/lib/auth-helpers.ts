import type { User } from '@/types/auth';

type Role = NonNullable<User['role']>;

/**
 * Resolves the role from a user object, handling both `user.role`
 * and legacy `user.profile.role` shapes.
 */
export function getUserRole(user: User | null | undefined): Role | undefined {
  if (!user) return undefined;
  // Handle legacy shape where role may be nested under profile
  const legacyRole = (user as { profile?: { role?: Role } })?.profile?.role as Role | undefined;
  return user.role ?? legacyRole;
}

export function hasRole(user: User | null | undefined, ...roles: Role[]): boolean {
  const role = getUserRole(user);
  return role !== undefined && roles.includes(role);
}

export function isAdmin(user: User | null | undefined): boolean {
  return hasRole(user, 'admin', 'founder');
}

export function isContributor(user: User | null | undefined): boolean {
  return hasRole(user, 'contributor', 'employee', 'admin', 'founder');
}
