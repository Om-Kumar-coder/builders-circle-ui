import { useAuth } from '@/context/AuthContext';
import { can, canAny, canAll, isPrivileged, isFounder, isParticipant, type Permission } from '@/lib/permissions';

/**
 * Hook that exposes permission helpers bound to the current user.
 * Use this instead of checking user.role directly in components.
 *
 * @example
 * const { can, isAdmin } = usePermissions();
 * if (can('activity:verify')) { ... }
 */
export function usePermissions() {
  const { user } = useAuth();

  return {
    /** Check a single permission */
    can: (permission: Permission) => can(user, permission),
    /** Check if user has any of the given permissions */
    canAny: (...permissions: Permission[]) => canAny(user, ...permissions),
    /** Check if user has all of the given permissions */
    canAll: (...permissions: Permission[]) => canAll(user, ...permissions),
    /** True for admin and founder */
    isAdmin: isPrivileged(user),
    /** True only for founder */
    isFounder: isFounder(user),
    /** True for roles that can submit activities (not observer) */
    isParticipant: isParticipant(user),
    /** The raw role string, if needed */
    role: user?.role,
  };
}
