/**
 * Role helpers: narrow a string to a known `UserRole` and decide who may open /admin (`is_admin` or the admin role).
 * Route groups use these through `RoleGate`.
 */

import type { UserRole } from '@/types/database';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const USER_ROLES: UserRole[] = [
  'guest',
  'fan',
  'athlete',
  'parent',
  'operator',
  'booster',
  'sponsor',
  'admin',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  guest: 'Guest',
  fan: 'Fan',
  athlete: 'Athlete',
  parent: 'Parent',
  operator: 'Operator',
  booster: 'Booster',
  sponsor: 'Sponsor',
  admin: 'Admin',
};

/** Roles Studio can preview. Admin stays a portal, not a fan-app chip. */
export const STUDIO_PREVIEW_ROLES = [
  'guest',
  'fan',
  'athlete',
  'parent',
  'operator',
  'booster',
  'sponsor',
] as const satisfies readonly UserRole[];

export const ROLE_HOME = {
  guest: '/',
  fan: '/',
  athlete: '/',
  parent: '/parent',
  operator: '/operator',
  booster: '/booster',
  sponsor: '/sponsor',
  admin: '/admin',
} as const satisfies Record<UserRole, string>;

const ROLE_ORDER: UserRole[] = [
  'fan',
  'athlete',
  'parent',
  'operator',
  'booster',
  'sponsor',
  'admin',
  'guest',
];

/**
 * @purpose Narrow a string to a known Tapua'i `UserRole`.
 */
export function isUserRole(value: string | null | undefined): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

/**
 * @purpose True when this session may open `/admin` (`profiles.is_admin` or admin role). Studio unlock is layered in `AuthContext`.
 * @param input Active preview role, dual `roles`, and loaded `profiles` row.
 */
export function isAdminAccess(input: {
  role?: UserRole | string | null;
  roles?: readonly string[] | null;
  profile?: { is_admin?: boolean | null; role?: string | null; roles?: unknown } | null;
}): boolean {
  if (input.profile?.is_admin === true) return true;
  if (input.role === 'admin') return true;
  if (input.roles?.some((item) => item.toLowerCase() === 'admin')) return true;
  if (input.profile?.role === 'admin') return true;
  return parseRoles(input.profile?.roles).includes('admin');
}

/**
 * @purpose Parse `profiles.roles` (text[], JSON array, or comma list) into unique `UserRole`s.
 */
export function parseRoles(raw: unknown): UserRole[] {
  const values: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') values.push(item);
    }
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string') values.push(item);
          }
        }
      } catch {
        values.push(...trimmed.split(','));
      }
    } else {
      values.push(...trimmed.split(','));
    }
  }
  const unique = new Set<UserRole>();
  for (const item of values) {
    const role = item.trim().toLowerCase();
    if (isUserRole(role)) unique.add(role);
  }
  return ROLE_ORDER.filter((role) => unique.has(role));
}

/**
 * @purpose Build the dual-capability role list: athletes always keep `fan`.
 * @param active Dev-switcher / navigation role.
 * @param profile Loaded `profiles` row (`role` + optional `roles`).
 */
export function deriveRoles(active: UserRole, profile?: { role?: string | null; roles?: unknown } | null): UserRole[] {
  if (active === 'guest' && !profile?.role && parseRoles(profile?.roles).length === 0) {
    return ['guest'];
  }
  const next = new Set<UserRole>(parseRoles(profile?.roles));
  if (isUserRole(profile?.role)) next.add(profile.role);
  next.add(active);
  if (next.has('athlete')) next.add('fan');
  if (active === 'guest' && next.size === 1) return ['guest'];
  next.delete('guest');
  const ordered = ROLE_ORDER.filter((role) => next.has(role));
  return ordered.length > 0 ? ordered : [active];
}

/**
 * @purpose Fan ⚡ / Athlete 🏆 chips for Account Capability copy.
 * @param roles Dual `roles` from auth (`guest` counts as Fan on the hub).
 */
export function capabilityBadges(roles: readonly string[] | null | undefined): { label: string; emoji: string }[] {
  const set = new Set((roles ?? []).map((item) => item.toLowerCase()));
  const hasAthlete = set.has('athlete');
  const hasFan = set.has('fan') || set.has('guest') || !hasAthlete;
  const badges: { label: string; emoji: string }[] = [];
  if (hasFan) badges.push({ label: 'Fan', emoji: '⚡' });
  if (hasAthlete) badges.push({ label: 'Athlete', emoji: '🏆' });
  return badges;
}

/**
 * @purpose Settings row label, e.g. `[ Fan ⚡ ]` or `[ Fan ⚡ | Athlete 🏆 ]`.
 */
export function formatCapabilityLine(roles: readonly string[] | null | undefined): string {
  const badges = capabilityBadges(roles);
  if (badges.length === 0) return '[ Fan ⚡ ]';
  return `[ ${badges.map((item) => `${item.label} ${item.emoji}`).join(' | ')} ]`;
}

/**
 * @purpose Append a capability onto `profiles.roles` via `add_user_role`.
 * @param newRole Role to union onto the signed-in profile (`athlete` also keeps `fan`).
 * @returns Updated `roles` text[] from Postgres, or `null` when unauthenticated / RPC missing.
 * @sideEffects Supabase RPC `add_user_role(new_role)`.
 */
export async function addUserRoleRemote(newRole: UserRole): Promise<UserRole[] | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('add_user_role', { new_role: newRole });
  if (error || !data) return null;
  return parseRoles(data);
}

/**
 * @purpose Route gate: admin always; otherwise the active role or any dual `roles` entry.
 */
export function canAccessRole(
  current: UserRole,
  allowed: UserRole[],
  roles: readonly string[] = [],
): boolean {
  if (current === 'admin' || roles.includes('admin')) return true;
  if (allowed.includes(current)) return true;
  return roles.some((item) => isUserRole(item) && allowed.includes(item));
}
