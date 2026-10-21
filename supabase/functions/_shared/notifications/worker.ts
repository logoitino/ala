/**
 * Bounded optional email worker behind a service-only repository and replaceable mail transport.
 * SQL owns current opt-in, source state, verified recipients and leases; durable begin rechecks them.
 * An unknown external outcome is never automatically retried or reported as delivery.
 * @sideEffects Injected repository RPCs and a future configured mail transport only.
 */
import {
  isNotificationCategoryId, type NotificationCategoryId, type NotificationPayload,
} from '../../../../packages/shared-types/notifications.ts';
import {
  isNotificationPayload, isNotificationReferenceId, renderNotificationTemplate,
  type NotificationTemplate,
} from './templates.ts';
import type { NotificationTransport, NotificationTransportResult } from './transport.ts';

export interface NotificationJob {
  id: string; eventId: string; recipientId: string; category: NotificationCategoryId;
  payload: NotificationPayload; leaseToken: string; attemptNumber: number; idempotencyKey: string;
}
export type NotificationSuppressionReason = 'email_opt_out' | 'category_opt_out' | 'channel_paused'
  | 'category_paused' | 'source_unavailable' | 'recipient_ineligible' | 'email_unverified'
  | 'provider_suppression' | 'business_state_changed' | 'event_expired' | 'lease_lost'
  | 'unsubscribe_unavailable' | 'invalid_authorization' | 'invalid_payload';
export type NotificationAuthorization =
  | { allowed: false; reason: NotificationSuppressionReason }
  | { allowed: true; recipient: {userId: string; email: string; verified: true};
      category: NotificationCategoryId; payload: NotificationPayload; idempotencyKey: string; unsubscribeUrl: string };
export interface NotificationAttemptOutcome {
  outcome: 'accepted' | 'suppressed' | 'failed' | 'unknown';
  errorCode?: string;
  providerMessageId?: string;
  safeRetry: boolean;
}
export interface NotificationRepository {
  claim(input: { workerId: string; batchSize: number; leaseSeconds: number }): Promise<NotificationJob[]>;
  authorize(job: NotificationJob): Promise<NotificationAuthorization>;
  /** Atomically begins the durable attempt and returns freshly checked destination/source authority. */
  begin(job: NotificationJob): Promise<NotificationAuthorization>;
  complete(job: NotificationJob, result: NotificationAttemptOutcome): Promise<boolean>;
  /** Release is permitted only before a durable attempt starts; SQL still applies queued opt-outs. */
  release(job: NotificationJob): Promise<boolean>;
}
export interface NotificationWorkerOptions {
  workerId: string; appOrigin: string; batchSize?: number; leaseSeconds?: number; sendTimeoutMs?: number;
}
export interface NotificationWorkerReport {
  claimed: number; accepted: number; suppressed: number; failed: number; unknown: number;
  unconfigured: number; repositoryErrors: number;
}

const SUPPRESSION_REASONS = new Set<NotificationSuppressionReason>([
  'email_opt_out', 'category_opt_out', 'channel_paused', 'category_paused', 'source_unavailable',
  'recipient_ineligible', 'email_unverified', 'provider_suppression', 'business_state_changed',
  'event_expired', 'lease_lost', 'unsubscribe_unavailable', 'invalid_authorization', 'invalid_payload',
]);
const TRANSPORT_ERROR_CODES = new Set(['provider_unavailable', 'provider_rejected', 'provider_rate_limited']);

function bound(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback;
}
function validJob(job: NotificationJob): boolean {
  return !!job && isNotificationReferenceId(job.id) && isNotificationReferenceId(job.eventId)
    && isNotificationReferenceId(job.recipientId) && isNotificationReferenceId(job.leaseToken)
    && isNotificationCategoryId(job.category) && isNotificationPayload(job.category, job.payload)
    && Number.isInteger(job.attemptNumber) && job.attemptNumber > 0
    && typeof job.idempotencyKey === 'string' && /^[A-Za-z0-9:_-]{1,200}$/.test(job.idempotencyKey);
}
function documentForAuthorization(
  job: NotificationJob, authorization: NotificationAuthorization, appOrigin: string,
): NotificationTemplate | null {
  if (!authorization || authorization.allowed !== true) return null;
  const recipient = authorization.recipient;
  if (!recipient || recipient.userId !== job.recipientId || recipient.verified !== true
    || typeof recipient.email !== 'string' || recipient.email.length > 254
    || !/^[^\s@<>\x00-\x1f\x7f]+@[^\s@<>\x00-\x1f\x7f]+\.[^\s@<>\x00-\x1f\x7f]+$/.test(recipient.email)
    || authorization.category !== job.category || authorization.idempotencyKey !== job.idempotencyKey
    || !isNotificationPayload(authorization.category, authorization.payload)
    || authorization.payload.referenceId !== job.payload.referenceId) return null;
  try { return renderNotificationTemplate(authorization.category, authorization.payload, {
    appOrigin, unsubscribeUrl: authorization.unsubscribeUrl,
  }); } catch { return null; }
}
function suppressionReason(authorization: NotificationAuthorization): NotificationSuppressionReason {
  return authorization?.allowed === false && SUPPRESSION_REASONS.has(authorization.reason)
    ? authorization.reason : 'invalid_authorization';
}
function transportOutcome(result: NotificationTransportResult): NotificationAttemptOutcome {
  if (result?.status === 'accepted' && typeof result.providerMessageId === 'string'
    && /^[A-Za-z0-9_-]{1,120}$/.test(result.providerMessageId)) {
    return { outcome: 'accepted', providerMessageId: result.providerMessageId, safeRetry: false };
  }
  if (result?.status === 'failed' && TRANSPORT_ERROR_CODES.has(result.errorCode)) {
    return {
      outcome: 'failed', errorCode: result.errorCode,
      safeRetry: result.retryable === true && result.errorCode !== 'provider_rejected',
    };
  }
  // A provider becoming unconfigured after begin is not proof that nothing was submitted.
  return { outcome: 'unknown', errorCode: 'transport_unknown', safeRetry: false };
}

async function sendWithDeadline(
  transport: NotificationTransport, message: Parameters<NotificationTransport['send']>[0], timeoutMs: number,
): Promise<NotificationAttemptOutcome> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<NotificationTransportResult>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve({ status: 'unknown' }); }, timeoutMs);
    });
    return transportOutcome(await Promise.race([transport.send(message, controller.signal), timeout]));
  } catch { return { outcome: 'unknown', errorCode: 'transport_unknown', safeRetry: false }; }
  finally { if (timer !== undefined) clearTimeout(timer); }
}

/**
 * @purpose Process one bounded batch; stale authority and unknown sends cannot become successful mail.
 * @returns Sanitized current-run counts. Accepted counts require persisted evidence; none mean delivered.
 * @sideEffects Service-only claim/authorize/begin/complete/release RPCs and configured transport calls.
 */
export async function runNotificationWorker(
  repository: NotificationRepository, transport: NotificationTransport, options: NotificationWorkerOptions,
): Promise<NotificationWorkerReport> {
  if (!isNotificationReferenceId(options.workerId)) throw new Error('invalid_worker_id');
  const batchSize = bound(options.batchSize, 20, 1, 50);
  const leaseSeconds = bound(options.leaseSeconds, 60, 30, 300);
  const timeoutMs = Math.min(bound(options.sendTimeoutMs, 10_000, 1, 60_000), leaseSeconds * 1000 - 1000);
  const jobs = await repository.claim({ workerId: options.workerId, batchSize, leaseSeconds });
  if (!Array.isArray(jobs) || jobs.length > batchSize) throw new Error('invalid_claim_batch');
  const report: NotificationWorkerReport = {
    claimed: jobs.length, accepted: 0, suppressed: 0, failed: 0, unknown: 0, unconfigured: 0, repositoryErrors: 0,
  };
  async function complete(job: NotificationJob, result: NotificationAttemptOutcome) {
    try {
      if (await repository.complete(job, result) === true) report[result.outcome]++;
      else { report.unknown++; report.repositoryErrors++; }
    } catch { report.unknown++; report.repositoryErrors++; }
  }
  for (const job of jobs) {
    if (!validJob(job)) { report.repositoryErrors++; continue; }
    if (transport.configured !== true) {
      try { if (await repository.release(job) === true) report.unconfigured++; else report.repositoryErrors++; }
      catch { report.repositoryErrors++; }
      continue;
    }
    let authorization: NotificationAuthorization;
    try { authorization = await repository.authorize(job); }
    catch {
      report.repositoryErrors++;
      try { await repository.release(job); } catch { report.repositoryErrors++; }
      continue;
    }
    if (!documentForAuthorization(job, authorization, options.appOrigin)) {
      await complete(job, { outcome: 'suppressed', errorCode: suppressionReason(authorization), safeRetry: false });
      continue;
    }
    try { authorization = await repository.begin(job); }
    catch { report.repositoryErrors++; report.unknown++; continue; }
    const template = documentForAuthorization(job, authorization, options.appOrigin);
    if (!template || authorization.allowed !== true) {
      await complete(job, { outcome: 'suppressed', errorCode: suppressionReason(authorization), safeRetry: false });
      continue;
    }
    await complete(job, await sendWithDeadline(transport, {
      ...template, to: authorization.recipient.email, idempotencyKey: authorization.idempotencyKey,
    }, timeoutMs));
  }
  return report;
}

export interface NotificationRpcClient {
  /** This client must use a server service identity; ordinary Auth callers are denied by SQL grants. */
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{data: unknown; error: unknown}>;
}

/**
 * @purpose Bind the service worker to the reviewed SQL functions, with no caller-chosen destinations.
 * @sideEffects Calls only the notification worker RPC allowlist using an injected server client.
 */
export function createRpcNotificationRepository(client: NotificationRpcClient): NotificationRepository {
  async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await client.rpc(name, args);
    if (result.error) throw new Error('notification_repository_error');
    return result.data as T;
  }
  // A truthy JSON value cannot prove that SQL persisted a lease transition or outcome.
  async function confirm(name: string, args: Record<string, unknown>): Promise<boolean> {
    const result = await call<unknown>(name, args);
    if (typeof result !== 'boolean') throw new Error('notification_repository_error');
    return result;
  }
  const identity = (job: NotificationJob) => ({job_id: job.id, lease_token: job.leaseToken});
  return {
    claim: input => call('claim_notification_jobs', {
      worker_id: input.workerId, batch_size: input.batchSize, lease_seconds: input.leaseSeconds,
    }),
    authorize: job => call('authorize_notification_send', identity(job)),
    begin: job => call('begin_notification_attempt', identity(job)),
    complete: (job, result) => confirm('complete_notification_attempt', {
      ...identity(job), outcome: result.outcome, error_code: result.errorCode ?? null,
      provider_message_id: result.providerMessageId ?? null, safe_retry: result.safeRetry,
    }),
    release: job => confirm('release_notification_job', identity(job)),
  };
}
