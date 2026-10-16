/**
 * Process-wide usage and performance logger. Batches events (video stalls, first frame, tab dwell, scroll depth,
 * feature taps, checkout latency, UI issues) and inserts them into `telemetry_logs`, which feeds the admin Reports
 * and Coverage desks. See docs/engineering/DATA_PRIVACY_MAP.md for what is collected.
 * @sideEffects Inserts into `telemetry_logs`.
 */

import { AppState, type NativeEventSubscription } from 'react-native';

import { isMissingRelation } from '@/lib/dbErrors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { TelemetryLog } from '@/types/database';
import { redactPayload, redactSsnText } from '@/lib/redact';

const FLUSH_MS = 10_000;
const MAX_BATCH = 15;
const MAX_BUFFERED = 120;
const DELIVERY_TIMEOUT_MS = 10_000;
const GLOBAL_KEY = '__tapuaiTelemetryManager';

export type TelemetryDeliveryPhase =
  | 'unknown' | 'sending' | 'delivered' | 'not_configured' | 'migration_missing'
  | 'permission_denied' | 'delivery_failed' | 'delivery_uncertain' | 'disposed';
export type TelemetryFailure =
  | 'not_configured' | 'migration_missing' | 'permission_denied' | 'delivery_failed'
  | 'transport_error' | 'timeout' | 'queue_full' | 'disposed';

/** Process-local, sampled delivery evidence; never a fleet-health or durability claim. */
export type TelemetryHealthSnapshot = Readonly<{
  phase: TelemetryDeliveryPhase;
  queued: number;
  /** Includes an unresolved HTTP reservation after timeout/dispose, even when already counted lost. */
  inFlight: number;
  capacity: number;
  batchSize: number;
  timeoutMs: number;
  /** Rows admitted to the queue; refused events do not increment accepted. */
  accepted: number;
  delivered: number;
  /** All discarded/refused rows, including uncertain rows; may exceed accepted after refusals. */
  dropped: number;
  /** Subset of dropped: attempted INSERT rows whose commit outcome was not confirmed. */
  uncertain: number;
  /** Historical fixed failure reason/time are retained after a later successful delivery. */
  lastFailure: TelemetryFailure | null;
  lastDeliveredAt: string | null;
  lastFailureAt: string | null;
}>;

type TelemetryEventType =
  | 'video_stall'
  | 'video_first_frame'
  | 'socket_reconnect'
  | 'checkout_latency'
  | 'tab_dwell'
  | 'surface_scroll'
  | 'feature_tap'
  | 'ui_issue';

export type TelemetryEvent = {
  event_type: TelemetryEventType | string;
  video_id?: string | null;
  channel?: string | null;
  step?: string | null;
  duration_ms?: number | null;
  attempts?: number | null;
  payload?: Record<string, unknown>;
};

type QueueRow = Omit<TelemetryLog, 'id' | 'created_at'> & { created_at: string };
type DeliveryResponse = { error: unknown; status: number };
type DeliveryOutcome = { kind: 'response'; result: DeliveryResponse } | { kind: 'transport' | 'timeout' | 'disposed' };
type DeliveryAttempt = {
  rows: number;
  controller: AbortController;
  cancel: () => void;
  timeout: ReturnType<typeof setTimeout> | null;
  accounted: boolean;
  settled: boolean;
};

const addCount = (count: number, rows: number) => Math.min(Number.MAX_SAFE_INTEGER, count + rows);

/** Only explicit missing-table codes qualify; column/relationship failures remain failures. */
function rejectedDelivery(result: DeliveryResponse): TelemetryFailure {
  if (result.status === 0 || result.status === 408 || result.status >= 500) return 'transport_error';
  const error = result.error && typeof result.error === 'object' ? result.error as { code?: unknown } : {};
  if (result.status === 401 || result.status === 403 || error.code === '42501' || error.code === 'PGRST301') return 'permission_denied';
  // dbErrors also accepts message fragments and missing relationships. The INSERT contract
  // knows its target, so pass only the two exact table codes and no backend message.
  if ((error.code === '42P01' || error.code === 'PGRST205') && isMissingRelation({ code: error.code })) return 'migration_missing';
  return 'delivery_failed';
}

function nowIso(): string {
  return new Date().toISOString();
}

function asMillis(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

/**
 * @purpose Batch client performance and product-usage events into `telemetry_logs` for `/admin/reports`.
 * @returns Process-wide singleton. `track*` enqueues; flush runs every 10s or at 15 queued rows.
 * @sideEffects Bounded memory/listeners and best-effort Supabase INSERT, with explicit loss evidence.
 */
export class TelemetryManager {
  private queue: QueueRow[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private appSub: NativeEventSubscription | { remove: () => void } | null = null;
  private active: DeliveryAttempt | null = null;
  private disposed = false;
  private phase: TelemetryDeliveryPhase = isSupabaseConfigured ? 'unknown' : 'not_configured';
  private accepted = 0;
  private delivered = 0;
  private dropped = 0;
  private uncertain = 0;
  private lastFailure: TelemetryFailure | null = null;
  private lastDeliveredAt: string | null = null;
  private lastFailureAt: string | null = null;

  private constructor() {
    this.timer = setInterval(() => {
      void this.flush();
    }, FLUSH_MS);
    // In Node (tests, server rendering) the flush timer must not keep the process alive.
    (this.timer as unknown as { unref?: () => void }).unref?.();
    this.appSub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') void this.flush();
    });
  }

  /**
   * @purpose Stop this instance's listeners and writes. Discard queued rows, abort any pending
   *   request and count its unconfirmed outcome; late responses cannot claim delivery.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.appSub?.remove();
    this.appSub = null;
    this.lose('disposed', this.queue.length);
    this.queue = [];
    if (this.active) {
      if (!this.active.accounted) {
        this.lose('disposed', this.active.rows, true);
        this.active.accounted = true;
      }
      this.active.cancel();
      this.active.controller.abort();
      if (this.active.timeout) clearTimeout(this.active.timeout);
      this.active.timeout = null;
    }
    this.phase = 'disposed';
  }

  static getInstance(): TelemetryManager {
    const bag = globalThis as typeof globalThis & Record<string, TelemetryManager | undefined>;
    const existing = bag[GLOBAL_KEY];
    if (existing) return existing;
    const created = new TelemetryManager();
    bag[GLOBAL_KEY] = created;
    return created;
  }

  /**
   * @purpose Enqueue a raw telemetry row (used for time-to-first-frame and future event types).
   */
  track(event: TelemetryEvent): void {
    if (this.disposed) { this.lose('disposed', 1); return; }
    if (!isSupabaseConfigured) { this.phase = 'not_configured'; this.lose('not_configured', 1); return; }
    if (this.queue.length + (this.active?.rows ?? 0) >= MAX_BUFFERED) { this.lose('queue_full', 1); return; }
    this.queue.push({
      event_type: event.event_type,
      // VERIFY-02: SSN-shaped text never leaves the phone in telemetry.
      video_id: event.video_id ?? null,
      channel: event.channel == null ? null : redactSsnText(event.channel),
      step: event.step == null ? null : redactSsnText(event.step),
      duration_ms: event.duration_ms == null ? null : asMillis(event.duration_ms),
      attempts: event.attempts == null ? null : Math.max(0, Math.round(event.attempts)),
      payload: (redactPayload(event.payload ?? {}) as Record<string, unknown>),
      created_at: nowIso(),
    });
    this.accepted = addCount(this.accepted, 1);
    if (this.queue.length >= MAX_BATCH) void this.flush();
  }

  /** @purpose Read safe delivery evidence without exposing queued rows, payloads or backend errors. */
  getHealth(): TelemetryHealthSnapshot {
    return Object.freeze({
      phase: this.phase, queued: this.queue.length, inFlight: this.active?.rows ?? 0,
      capacity: MAX_BUFFERED, batchSize: MAX_BATCH, timeoutMs: DELIVERY_TIMEOUT_MS,
      accepted: this.accepted, delivered: this.delivered, dropped: this.dropped, uncertain: this.uncertain,
      lastFailure: this.lastFailure, lastDeliveredAt: this.lastDeliveredAt, lastFailureAt: this.lastFailureAt,
    });
  }

  /** Refused rows and discarded batches share a fixed-code loss ledger; uncertainty is a subset. */
  private lose(reason: TelemetryFailure, rows: number, uncertain = false): void {
    if (rows === 0) return;
    this.dropped = addCount(this.dropped, rows);
    if (uncertain) this.uncertain = addCount(this.uncertain, rows);
    this.lastFailure = reason;
    this.lastFailureAt = nowIso();
  }

  /**
   * @purpose Record a mid-reel buffer stall so field Wi-Fi issues show up against a clip id.
   * @param videoId `reels.id` (or clip id).
   * @param durationMs How long playback was stalled.
   */
  trackVideoStall(videoId: string, durationMs: number): void {
    const duration = asMillis(durationMs);
    if (!videoId || duration < 50) return;
    this.track({
      event_type: 'video_stall',
      video_id: videoId,
      duration_ms: duration,
    });
  }

  /**
   * @purpose Record a Realtime channel drop / reconnect for live high-school games.
   * @param channel Channel name (`live_game_{id}_…`).
   * @param attempts Consecutive error/close count before this log.
   */
  trackSocketReconnect(channel: string, attempts: number): void {
    if (!channel) return;
    this.track({
      event_type: 'socket_reconnect',
      channel,
      attempts: Math.max(1, Math.round(attempts)),
    });
  }

  /**
   * @purpose Record Stripe PaymentSheet step timing (intent, init, present, total).
   * @param step Named checkout phase.
   * @param durationMs Elapsed milliseconds for that step.
   */
  trackCheckoutLatency(step: string, durationMs: number): void {
    if (!step) return;
    this.track({
      event_type: 'checkout_latency',
      step,
      duration_ms: asMillis(durationMs),
    });
  }

  /**
   * @purpose How long a fan stayed on Home / Local / Spotlight / Drip / Profile.
   */
  trackTabDwell(tab: string, durationMs: number): void {
    const duration = asMillis(durationMs);
    if (!tab || duration < 500) return;
    this.track({
      event_type: 'tab_dwell',
      channel: tab,
      duration_ms: duration,
    });
  }

  /**
   * @purpose Deepest scroll on a surface (0–100). Flushed on blur so Reports can say where people actually look.
   */
  trackScroll(surface: string, depthPct: number): void {
    const depth = Math.max(0, Math.min(100, Math.round(depthPct)));
    if (!surface || depth < 1) return;
    this.track({
      event_type: 'surface_scroll',
      channel: surface,
      duration_ms: depth,
    });
  }

  /**
   * @purpose A working control the fan chose (Seki, Mālo, search, poll, Drip buy). This is “what they like.”
   */
  trackFeature(feature: string, surface?: string): void {
    if (!feature) return;
    this.track({
      event_type: 'feature_tap',
      channel: surface ?? null,
      step: feature,
    });
  }

  /**
   * @purpose A control that failed or that the fan reported (checkout error, Report / Hide, bug suggestion).
   */
  trackIssue(control: string, surface?: string): void {
    if (!control) return;
    this.track({
      event_type: 'ui_issue',
      channel: surface ?? null,
      step: control,
    });
  }

  /**
   * @purpose Attempt at most fifteen rows once. No failed/uncertain INSERT is replayed because
   *   the server may have committed it. A hung HTTP request keeps its reservation until it settles.
   */
  async flush(): Promise<void> {
    if (this.disposed || this.active || this.queue.length === 0) return;
    if (!isSupabaseConfigured) {
      this.phase = 'not_configured';
      this.lose('not_configured', this.queue.length);
      this.queue = [];
      return;
    }

    const batch = this.queue.splice(0, MAX_BATCH);
    const attempt: DeliveryAttempt = { rows: batch.length, controller: new AbortController(), cancel: () => undefined, timeout: null, accounted: false, settled: false };
    this.active = attempt;
    this.phase = 'sending';
    try {
      const stopped = new Promise<DeliveryOutcome>((resolve) => {
        attempt.cancel = () => resolve({ kind: 'disposed' });
        attempt.timeout = setTimeout(() => {
          // Resolve first so a fetch adapter's synchronous abort response cannot mask the timeout.
          resolve({ kind: 'timeout' });
          attempt.controller.abort();
        }, DELIVERY_TIMEOUT_MS);
        (attempt.timeout as unknown as { unref?: () => void }).unref?.();
      });
      const request = Promise.resolve(supabase.from('telemetry_logs').insert(batch).retry(false).abortSignal(attempt.controller.signal))
        .then<DeliveryOutcome, DeliveryOutcome>((result) => ({ kind: 'response', result }), () => ({ kind: 'transport' }));
      void request.then(() => {
        // A timeout frees the caller, not the unresolved request. Holding this slot prevents
        // an abort-ignoring transport from accumulating more outstanding batches and payloads.
        attempt.settled = true;
        if (attempt.accounted && this.active === attempt) this.active = null;
      });
      const outcome = await Promise.race([request, stopped]);
      if (this.disposed || attempt.accounted) return;
      attempt.accounted = true;
      if (outcome.kind === 'response' && !outcome.result.error && outcome.result.status >= 200 && outcome.result.status < 300) {
        this.delivered = addCount(this.delivered, attempt.rows);
        this.lastDeliveredAt = nowIso();
        this.phase = 'delivered';
      } else {
        const reason = outcome.kind === 'response' ? rejectedDelivery(outcome.result) : outcome.kind === 'timeout' ? 'timeout' : 'transport_error';
        const uncertain = reason === 'timeout' || reason === 'transport_error';
        this.lose(reason, attempt.rows, uncertain);
        this.phase = uncertain ? 'delivery_uncertain' : reason as TelemetryDeliveryPhase;
      }
    } catch {
      if (this.active === attempt) this.active = null;
      if (!this.disposed && !attempt.accounted) {
        attempt.accounted = true;
        this.lose('transport_error', attempt.rows, true);
        this.phase = 'delivery_uncertain';
      }
    } finally {
      if (attempt.timeout) clearTimeout(attempt.timeout);
      attempt.timeout = null;
      // Keep the request reserved until its outcome is accounted, including disposal between
      // HTTP settlement and this continuation. Otherwise that narrow race silently loses rows.
      if (attempt.settled && this.active === attempt) this.active = null;
    }
  }
}

export const telemetry = TelemetryManager.getInstance();
