/**
 * Versioned generic notification documents shared by the server worker and synthetic staff previews.
 * References are validated but never copied into mail; reading details requires signing into the app.
 * This renderer does not authorize recipients, issue unsubscribe tokens or send messages.
 */
import {
  isNotificationCategoryId,
  type NotificationCategoryId,
  type NotificationPayload,
} from './notifications.ts';

const KINDS: Record<NotificationCategoryId, NotificationPayload['kind']> = {
  account: 'account_welcome', donation_receipts: 'donation_confirmed',
  donations_received: 'donation_received', payment_updates: 'payment_updated',
  social: 'social_update', crew: 'crew_update', workouts: 'workout_update', games: 'game_update',
};
const COPY: Record<NotificationCategoryId, { subject: string; body: string }> = {
  account: { subject: "Welcome to Tapua'i Sports", body: 'Your account is ready. Sign in to explore your account.' },
  donation_receipts: { subject: 'Your donation update', body: 'There is an update for a donation you made. Sign in to review your donation history.' },
  donations_received: { subject: 'A donation update is ready', body: 'There is a donation update you may be permitted to review. Sign in to see the current details.' },
  payment_updates: { subject: 'An update for your donation', body: 'A recorded donation status has changed. Sign in to review the current details.' },
  social: { subject: "Your Tapua'i Sports activity", body: 'There is an activity update in your account. Sign in to review it.' },
  crew: { subject: 'Your Crew activity', body: 'There is a Crew or followed-athlete update in your account. Sign in to review it.' },
  workouts: { subject: 'Your workout activity', body: 'There is a workout invitation or response in your account. Sign in to review it.' },
  games: { subject: 'Your followed updates', body: 'There is a followed-game or permitted school update in your account. Sign in to review it.' },
};

export interface NotificationTemplateContext { appOrigin: string; unsubscribeUrl: string }
export interface NotificationTemplate {
  templateVersion: 1;
  subject: string;
  text: string;
  html: string;
  href: string;
  unsubscribeUrl: string;
}

export function isNotificationReferenceId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** @purpose Reject unregistered sources and payload snapshots that could disclose private details. */
export function isNotificationPayload(category: unknown, value: unknown): value is NotificationPayload {
  if (!isNotificationCategoryId(category) || !value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return Object.keys(payload).sort().join(',') === 'kind,referenceId,version'
    && payload.version === 1 && payload.kind === KINDS[category]
    && isNotificationReferenceId(payload.referenceId);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}

function safeContext(context: NotificationTemplateContext): { origin: string; unsubscribeUrl: string } {
  try {
    const app = new URL(context.appOrigin);
    const unsubscribe = new URL(context.unsubscribeUrl);
    if (app.protocol !== 'https:' || app.username || app.password || app.pathname !== '/' || app.search || app.hash
      || unsubscribe.origin !== app.origin || unsubscribe.username || unsubscribe.password || unsubscribe.hash
      || unsubscribe.pathname !== '/notifications/unsubscribe'
      || [...unsubscribe.searchParams.keys()].join(',') !== 't'
      || !/^[A-Za-z0-9_-]{43,128}$/.test(unsubscribe.searchParams.get('t') ?? '')) throw new Error();
    return { origin: app.origin, unsubscribeUrl: unsubscribe.href };
  } catch { throw new Error('invalid_template_context'); }
}

/** @purpose Render reviewed generic copy and same-origin destinations from an allowlisted source. */
export function renderNotificationTemplate(
  category: NotificationCategoryId, payload: NotificationPayload, context: NotificationTemplateContext,
): NotificationTemplate {
  if (!isNotificationPayload(category, payload)) throw new Error('invalid_notification_payload');
  const { origin, unsubscribeUrl } = safeContext(context);
  const href = `${origin}/activity`;
  const { subject, body } = COPY[category];
  return {
    templateVersion: 1, subject, href, unsubscribeUrl,
    text: `${body}\n\nOpen your account: ${href}\n\nManage optional email: ${unsubscribeUrl}\nOpening the email settings link does not change your choices. Confirm any change on that page.`,
    html: `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(href)}">Open your account</a></p><p><a href="${escapeHtml(unsubscribeUrl)}">Manage optional email</a></p><p>Opening the email settings link does not change your choices. Confirm any change on that page.</p>`,
  };
}

/** @purpose Produce a synthetic staff document without recipient selection or delivery evidence. */
export function previewNotificationTemplate(category: NotificationCategoryId): NotificationTemplate & { mode: 'preview' } {
  if (!isNotificationCategoryId(category)) throw new Error('invalid_notification_category');
  return {
    ...renderNotificationTemplate(category, {
      version: 1, kind: KINDS[category], referenceId: '00000000-0000-4000-8000-000000000001',
    }, {
      appOrigin: 'https://example.invalid',
      unsubscribeUrl: `https://example.invalid/notifications/unsubscribe?t=${'synthetic_preview_'.repeat(3)}`,
    }),
    mode: 'preview',
  };
}
