/**
 * Profile, Activity and staff notification RPC boundary. Actor identity is always server-derived.
 * Missing/malformed data is unavailable, never an empty inbox or a successful preference save.
 * @sideEffects Owner/admin notification RPCs through the bound Supabase client; no email sends.
 */
import {
  NOTIFICATION_CATEGORY_IDS, isNotificationCategoryId,
  type NotificationPreferences, type NotificationConfig, type NotificationAvailability,
  type NotificationInboxPage, type NotificationInboxItem, type NotificationHealthSnapshot,
  type NotificationAdminJob, type NotificationAdminJobsPage,
} from '@tapuai/shared-types/notifications';
import { isMissingFunction, isMissingRelation } from '@/lib/dbErrors';
import { untypedRpc } from '@/lib/rpc';
import { isSupabaseConfigured } from '@/lib/supabase';

export type NotificationErrorCode = 'unavailable' | 'denied' | 'conflict' | 'failed' | 'invalid';
const MESSAGES: Record<NotificationErrorCode, string> = {
  unavailable: 'Notifications are not available yet.',
  denied: 'You do not have access to these notifications.',
  conflict: 'Your settings changed elsewhere. Reload them and try again.',
  failed: 'Could not update or load notifications. Try again.',
  invalid: 'The notification response could not be verified.',
};

/** @purpose Expose only a fixed safe code/message, never provider or SQL diagnostics. */
export class NotificationError extends Error {
  constructor(public readonly code: NotificationErrorCode) { super(MESSAGES[code]); this.name = 'NotificationError'; }
}
/** @purpose Keep UI notices within the same fixed safe message vocabulary. */
export function notificationErrorText(error: unknown): string {
  return error instanceof Error && Object.values(MESSAGES).includes(error.message) ? error.message : MESSAGES.failed;
}
const invalid = (): never => { throw new NotificationError('invalid'); };
const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
};
const bool = (value: unknown): boolean => typeof value === 'boolean' ? value : invalid();
const count = (value: unknown): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid();
const stamp = (value: unknown): string => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : invalid();
const nullableStamp = (value: unknown) => value === null ? null : stamp(value);
const uuid = (value: unknown): string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : invalid();
const nullableUuid = (value: unknown) => value === null ? null : uuid(value);
const text = (value: unknown, limit: number): string => typeof value === 'string' && value.length <= limit ? value : invalid();

async function rpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  if (!isSupabaseConfigured) throw new NotificationError('unavailable');
  try {
    const { data, error } = await untypedRpc(name, args);
    if (error) {
      if (isMissingFunction(error) || isMissingRelation(error)) throw new NotificationError('unavailable');
      if (error.code === '42501' || error.code === 'PGRST301') throw new NotificationError('denied');
      if (error.code === '40001') throw new NotificationError('conflict');
      throw new NotificationError('failed');
    }
    return data;
  } catch (error) {
    if (error instanceof NotificationError) throw error;
    throw new NotificationError('failed');
  }
}

function parsePreferences(value: unknown): NotificationPreferences {
  const row = record(value); const choices = record(row.categories);
  const categories = Object.fromEntries(NOTIFICATION_CATEGORY_IDS.map(id => {
    const choice = record(choices[id]); return [id, { email: bool(choice.email), inApp: bool(choice.inApp) }];
  })) as NotificationPreferences['categories'];
  return { revision: count(row.revision), emailEnabled: bool(row.emailEnabled), inAppEnabled: bool(row.inAppEnabled), categories };
}
function parseAvailability(value: unknown): NotificationAvailability {
  const row = record(value); const choices = record(row.categories); const sources = record(row.sourceAvailability);
  const categories = Object.fromEntries(NOTIFICATION_CATEGORY_IDS.map(id => [id, bool(choices[id])])) as NotificationConfig['categories'];
  const sourceAvailability = Object.fromEntries(NOTIFICATION_CATEGORY_IDS.map(id => [id, bool(sources[id])])) as NotificationConfig['sourceAvailability'];
  return { emailEnabled: bool(row.emailEnabled), inAppEnabled: bool(row.inAppEnabled), categories, sourceAvailability };
}
function parseConfig(value: unknown): NotificationConfig {
  return { ...parseAvailability(value), revision: count(record(value).revision) };
}

/** @purpose Load current server-confirmed choices; defaults are not substituted for missing service. */
export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  return parsePreferences(await rpc('get_notification_preferences'));
}

/** @purpose Save allowlisted choices using the last confirmed revision; stale saves conflict. */
export async function saveNotificationPreferences(value: NotificationPreferences, expectedActor: string): Promise<NotificationPreferences> {
  const { revision, ...preferences } = parsePreferences(value);
  const saved = parsePreferences(await rpc('save_notification_preferences', { expected_revision: revision, preferences, expected_actor: uuid(expectedActor) }));
  if (saved.revision !== revision + 1) return invalid();
  return saved;
}

/** @purpose Read public channel/source availability without accessing the admin configuration. */
export async function fetchNotificationAvailability(): Promise<NotificationAvailability> {
  return parseAvailability(await rpc('get_notification_availability'));
}

function parseInboxItem(value: unknown): NotificationInboxItem {
  const row = record(value);
  if (!isNotificationCategoryId(row.category)) return invalid();
  // Only fixed, authenticated app destinations are allowed; no arbitrary server/user URL is opened.
  if (row.href !== null && !['/profile', '/receipts', '/activity'].includes(row.href as string)) return invalid();
  return { id: uuid(row.id), category: row.category, title: text(row.title, 160), body: text(row.body, 500),
    createdAt: stamp(row.createdAt), readAt: nullableStamp(row.readAt), archivedAt: nullableStamp(row.archivedAt), href: row.href as string | null };
}

/** @purpose Load one recipient-only page and server-issued account-bound mark-all snapshot. */
export async function fetchNotificationInbox(options: { archived?: boolean; cursor?: string | null } = {}): Promise<NotificationInboxPage> {
  const cursor = nullableUuid(options.cursor ?? null);
  const row = record(await rpc('get_notification_inbox', { archived: options.archived ?? false, cursor, page_size: 20 }));
  if (!Array.isArray(row.items) || row.items.length > 20) return invalid();
  return { items: row.items.map(parseInboxItem), unreadCount: count(row.unreadCount), cutoff: nullableUuid(row.cutoff), nextCursor: nullableUuid(row.nextCursor) };
}

async function mutate(name: string, args: Record<string, unknown>): Promise<void> {
  if (await rpc(name, args) !== true) throw new NotificationError('failed');
}
/** @purpose Change one own item's read state; reading never deletes delivery evidence. */
export async function setNotificationRead(id: string, read: boolean): Promise<void> {
  return mutate('set_notification_read', { notification_id: uuid(id), is_read: bool(read) });
}
/** @purpose Mark only the account-bound server snapshot read; concurrent later arrivals remain unread. */
export async function markAllNotificationsRead(cutoff: string): Promise<number> {
  return count(await rpc('mark_all_notifications_read', { cutoff: uuid(cutoff) }));
}
/** @purpose Archive/restore an own item while preserving its separate read state. */
export async function setNotificationArchived(id: string, archived: boolean): Promise<void> {
  return mutate('set_notification_archived', { notification_id: uuid(id), is_archived: bool(archived) });
}

/** @purpose Staff-only source/config read, with server authorization on every call. */
export async function fetchAdminNotificationConfig(): Promise<NotificationConfig> {
  return parseConfig(await rpc('get_admin_notification_config'));
}
/** @purpose Save category/channel controls; staff cannot declare an unimplemented source authoritative. */
export async function saveAdminNotificationConfig(value: NotificationConfig, expectedActor: string): Promise<NotificationConfig> {
  const { revision, sourceAvailability: _sources, ...config } = parseConfig(value);
  const saved = parseConfig(await rpc('set_admin_notification_config', { expected_revision: revision, config, expected_actor: uuid(expectedActor), reason: 'reviewed_change' }));
  if (saved.revision !== revision + 1) return invalid();
  return saved;
}

/** @purpose Return defined queue snapshot and 24-hour delivery windows, preserving missing evidence. */
export async function fetchAdminNotificationHealth(): Promise<NotificationHealthSnapshot> {
  const row = record(await rpc('get_admin_notification_health'));
  const fields = ['pending', 'attempted', 'accepted', 'delivered', 'suppressed', 'failed', 'bounced', 'unknown'] as const;
  const counts = Object.fromEntries(fields.map(key => [key, count(row[key])])) as Pick<NotificationHealthSnapshot, typeof fields[number]>;
  const age = row.oldestPendingSeconds;
  if (age !== null && (typeof age !== 'number' || !Number.isFinite(age) || age < 0)) return invalid();
  return { ...counts, asOf: stamp(row.asOf), windowStart: stamp(row.windowStart), oldestPendingSeconds: age as number | null, providerEvidence: bool(row.providerEvidence) };
}
const STATES = ['queued', 'attempting', 'accepted', 'delivered', 'suppressed', 'failed', 'unknown', 'bounced'];
function parseJob(value: unknown): NotificationAdminJob {
  const row = record(value);
  if (!isNotificationCategoryId(row.category) || !STATES.includes(row.status as string)) return invalid();
  const rawCode = row.lastErrorCode;
  const lastErrorCode = rawCode === null ? null : typeof rawCode === 'string' && /^NOTIF_[A-Z0-9_]{1,60}$/.test(rawCode) ? rawCode : 'NOTIF_JOB_FAILED';
  return { id: uuid(row.id), category: row.category, status: row.status as NotificationAdminJob['status'], attempts: count(row.attempts),
    lastErrorCode, createdAt: stamp(row.createdAt), updatedAt: stamp(row.updatedAt) };
}
/** @purpose Staff-only bounded sanitized jobs; addresses and event details are not returned. */
export async function fetchAdminNotificationJobs(cursor: string | null = null): Promise<NotificationAdminJobsPage> {
  const row = record(await rpc('get_admin_notification_jobs', { cursor: nullableUuid(cursor), page_size: 20 }));
  if (!Array.isArray(row.items) || row.items.length > 20) return invalid();
  return { items: row.items.map(parseJob), nextCursor: nullableUuid(row.nextCursor) };
}
/** @purpose Request only the fixed known-failure repair; unknown outcomes are denied by the server. */
export async function retryNotificationJob(id: string, expectedActor: string): Promise<void> {
  return mutate('retry_notification_job', { job_id: uuid(id), expected_actor: uuid(expectedActor), reason: 'retry_known_failure' });
}
