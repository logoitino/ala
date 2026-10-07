/**
 * Process-wide usage and performance logger. Batches events (video stalls, first frame, tab dwell, scroll depth,
 * feature taps, checkout latency, UI issues) and inserts them into `telemetry_logs`, which feeds the admin Reports
 * and Coverage desks. See docs/engineering/DATA_PRIVACY_MAP.md for what is collected.
 * @sideEffects Inserts into `telemetry_logs`.
 */

import { AppState, type NativeEventSubscription } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { TelemetryLog } from '@/types/database';

const FLUSH_MS = 10_000;
const MAX_QUEUE = 15;
const GLOBAL_KEY = '__tapuaiTelemetryManager';

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

function nowIso(): string {
  return new Date().toISOString();
}

function asMillis(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

/**
 * @purpose Batch client performance and product-usage events into `telemetry_logs` for `/admin/reports`.
 * @returns Process-wide singleton. `track*` enqueues; flush runs every 10s or when the queue exceeds 15.
 * @sideEffects In-memory queue, `setInterval`, AppState background flush, Supabase INSERT (swallowed if the table is missing).
 */
export class TelemetryManager {
  private queue: QueueRow[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private appSub: NativeEventSubscription | { remove: () => void } | null = null;
  private flushing = false;

  private constructor() {
    this.timer = setInterval(() => {
      void this.flush();
    }, FLUSH_MS);
    this.appSub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') void this.flush();
    });
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
    this.queue.push({
      event_type: event.event_type,
      video_id: event.video_id ?? null,
      channel: event.channel ?? null,
      step: event.step ?? null,
      duration_ms: event.duration_ms == null ? null : asMillis(event.duration_ms),
      attempts: event.attempts == null ? null : Math.max(0, Math.round(event.attempts)),
      payload: event.payload ?? {},
      created_at: nowIso(),
    });
    if (this.queue.length >= MAX_QUEUE) void this.flush();
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
   * @purpose Push the in-memory batch to `telemetry_logs`. Safe no-op when Supabase or the table is missing.
   */
  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    if (!isSupabaseConfigured) {
      this.queue = [];
      return;
    }

    this.flushing = true;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      const { error } = await supabase.from('telemetry_logs').insert(batch);
      if (error) {
        const missing =
          error.message.includes('telemetry_logs') ||
          error.message.includes('Could not find the table') ||
          error.code === '42P01' ||
          error.code === 'PGRST205';
        if (!missing) this.queue.unshift(...batch);
      }
    } catch {
      this.queue.unshift(...batch);
    } finally {
      this.flushing = false;
    }
  }
}

export const telemetry = TelemetryManager.getInstance();
