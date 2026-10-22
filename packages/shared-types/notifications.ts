/**
 * Shared optional notification contract for Profile, Activity and the staff delivery desk.
 * Owner choice 2026-10-21: all optional email starts off; Auth recovery is a separate flow.
 * Source availability and current recipient rights are enforced by the server, never this UI model.
 */
export const NOTIFICATION_CATEGORY_IDS = [
  'account', 'donation_receipts', 'donations_received', 'payment_updates',
  'social', 'crew', 'workouts', 'games',
] as const;

export type NotificationCategoryId = typeof NOTIFICATION_CATEGORY_IDS[number];
export type NotificationChannel = 'email' | 'inApp';
export type NotificationCategoryChoices = Record<NotificationCategoryId, { email: boolean; inApp: boolean }>;

export const NOTIFICATION_CATEGORIES: ReadonlyArray<{
  id: NotificationCategoryId; label: string; description: string;
}> = [
  { id: 'account', label: 'Account welcome and updates', description: 'Welcome and meaningful account updates.' },
  { id: 'donation_receipts', label: 'Gifts you make', description: 'Gift confirmations in your account.' },
  { id: 'donations_received', label: 'Gifts you receive', description: 'Updates for gifts you are permitted to review.' },
  { id: 'payment_updates', label: 'Payment updates', description: 'Recorded changes affecting your gifts.' },
  { id: 'social', label: 'Thanks and social activity', description: 'Allowed thanks, tags and friend requests.' },
  { id: 'crew', label: 'Crew and followed athletes', description: 'Allowed Crew and published Highlight updates.' },
  { id: 'workouts', label: 'Workout invitations', description: 'Invitations and responses under your existing contact choices.' },
  { id: 'games', label: 'Followed games and school updates', description: 'Updates from games you follow and permitted school relationships.' },
];

export interface NotificationPreferences {
  revision: number;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  categories: NotificationCategoryChoices;
}

export interface NotificationConfig {
  revision: number;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  categories: Record<NotificationCategoryId, boolean>;
  sourceAvailability: Record<NotificationCategoryId, boolean>;
}

export type NotificationAvailability = Pick<NotificationConfig,
  'emailEnabled' | 'inAppEnabled' | 'categories' | 'sourceAvailability'>;

export interface NotificationInboxItem {
  id: string;
  category: NotificationCategoryId;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
  /** Server-authorized account path; unavailable sources return null and generic copy. */
  href: string | null;
}

export interface NotificationInboxPage {
  items: NotificationInboxItem[];
  unreadCount: number;
  cutoff: string | null;
  nextCursor: string | null;
}

export type NotificationDeliveryState = 'queued' | 'attempting' | 'accepted' | 'delivered'
  | 'suppressed' | 'failed' | 'unknown' | 'bounced';

export interface NotificationHealthSnapshot {
  asOf: string;
  windowStart: string;
  pending: number;
  oldestPendingSeconds: number | null;
  attempted: number;
  accepted: number;
  delivered: number;
  suppressed: number;
  failed: number;
  bounced: number;
  unknown: number;
  providerEvidence: boolean;
}

export interface NotificationAdminJob {
  id: string;
  category: NotificationCategoryId;
  status: NotificationDeliveryState;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastErrorCode: string | null;
}

export interface NotificationAdminJobsPage { items: NotificationAdminJob[]; nextCursor: string | null }

/** References contain no gift amounts, private message content or recipient addresses. */
export type NotificationPayload = {
  version: 1;
  kind: 'account_welcome' | 'donation_confirmed' | 'donation_received' | 'payment_updated'
    | 'social_update' | 'crew_update' | 'workout_update' | 'game_update';
  referenceId: string;
};

/** @purpose Create independent preferences for an account with all optional email choices off. */
export function makeDefaultNotificationPreferences(): NotificationPreferences {
  return {
    revision: 0, emailEnabled: true, inAppEnabled: true,
    categories: Object.fromEntries(NOTIFICATION_CATEGORY_IDS.map(id => [id, {
      email: false, inApp: id !== 'games',
    }])) as NotificationCategoryChoices,
  };
}

/** @purpose Expose paused production; only the reviewed account source is available initially. */
export function makeDefaultNotificationConfig(): NotificationConfig {
  return {
    revision: 0, emailEnabled: false, inAppEnabled: false,
    categories: Object.fromEntries(NOTIFICATION_CATEGORY_IDS.map(id => [id, false])) as NotificationConfig['categories'],
    sourceAvailability: Object.fromEntries(NOTIFICATION_CATEGORY_IDS.map(id => [id, id === 'account'])) as NotificationConfig['sourceAvailability'],
  };
}

export function isNotificationCategoryId(value: unknown): value is NotificationCategoryId {
  return typeof value === 'string' && (NOTIFICATION_CATEGORY_IDS as readonly string[]).includes(value);
}

/** @purpose Resolve a stored choice; a master switch never enrolls a new category. */
export function resolveNotificationChoice(
  preferences: NotificationPreferences, category: unknown, channel: NotificationChannel,
): boolean {
  if (!isNotificationCategoryId(category)) return false;
  const master = channel === 'email' ? preferences.emailEnabled : preferences.inAppEnabled;
  return master === true && preferences.categories[category]?.[channel] === true;
}
