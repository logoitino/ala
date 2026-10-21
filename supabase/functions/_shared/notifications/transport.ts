/**
 * Replaceable server mail boundary; implementation has no provider or credential configuration.
 * Acceptance means only provider acceptance. A timeout or unknown send result requires reconciliation.
 * Synthetic document previews live in the template module and never invoke this boundary.
 */
import type { NotificationTemplate } from './templates.ts';

export type NotificationTransportErrorCode = 'provider_unavailable' | 'provider_rejected' | 'provider_rate_limited';
export type NotificationTransportResult =
  | { status: 'accepted'; providerMessageId: string }
  | { status: 'failed'; errorCode: NotificationTransportErrorCode; retryable: boolean }
  | { status: 'unknown' }
  | { status: 'unconfigured' };

export interface NotificationTransportMessage extends NotificationTemplate {
  /** Only a current server authorization may supply this verified Auth destination. */
  to: string;
  idempotencyKey: string;
}

export interface NotificationTransport {
  readonly configured: boolean;
  /** @sideEffects A future configured adapter may contact its reviewed mail provider. */
  send(message: NotificationTransportMessage, signal: AbortSignal): Promise<NotificationTransportResult>;
}

/** @purpose Leave production jobs pending until a reviewed provider adapter is configured. */
export function createUnconfiguredNotificationTransport(): NotificationTransport {
  return { configured: false, async send() { return { status: 'unconfigured' }; } };
}
