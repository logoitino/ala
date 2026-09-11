import type { UserRole } from '@/types/database';

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

export const ROLE_HOME = {
  guest: '/',
  fan: '/',
  athlete: '/athlete',
  parent: '/parent',
  operator: '/operator',
  booster: '/booster',
  sponsor: '/sponsor',
  admin: '/admin',
} as const satisfies Record<UserRole, string>;

export function canAccessRole(current: UserRole, allowed: UserRole[]): boolean {
  if (current === 'admin') return true;
  return allowed.includes(current);
}
