/**
 * Bounded Engineering Support client capture for DETECT-02. Inert until admin-ready wiring
 * enables it; sends only fixed codes and public build scope, never errors or private payloads.
 * @sideEffects When enabled: timer/AppState listener and record_support_signal RPC. Read recovery
 * invokes a caller's operation at most twice; money, access and writes are never retried.
 */
import { AppState, type NativeEventSubscription } from 'react-native';
import {
  SUPPORT_CODES, canAutomaticallyRecover, safeSupportCode, safeSupportEnvironment, safeSupportFeature, safeSupportRelease,
  type ClientSupportCode, type SupportCategory, type SupportEnvironment, type SupportFeature, type SupportOperation,
} from '@tapuai/shared-types/admin/engineeringSupport';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type ClientSupportCapture = { feature: SupportFeature; code: ClientSupportCode };
export type SupportSignalArgs = { p_feature: SupportFeature; p_code: ClientSupportCode; p_environment: SupportEnvironment; p_release: string };
export type SupportSensorPhase = 'disabled' | 'ready' | 'sending' | 'invalid_configuration' | 'not_configured' | 'migration_missing' | 'permission_denied' | 'delivery_failed';
export type SupportSensorFailure = Exclude<SupportSensorPhase, 'disabled' | 'ready' | 'sending'> | 'invalid_signal' | 'rate_limited' | 'queue_full';
export type SupportSensorStatus = {
  phase: SupportSensorPhase; queued: number; dropped: number; delivered: number;
  lastFailure: SupportSensorFailure | null; lastDeliveredAt: string | null;
};
type Delivery = { error: unknown | null };
type ManagerOptions = {
  send?: (args: SupportSignalArgs, accessToken?: string | null) => Promise<Delivery>; configured?: () => boolean; now?: () => number;
  maxQueue?: number; maxPerMinute?: number; flushIntervalMs?: number; sendTimeoutMs?: number;
};
type RecoveryScope = { feature: SupportFeature; category: SupportCategory; operation: SupportOperation };
const bounded = (value: number | undefined, fallback: number, max: number, min = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
const errorRecord = (error: unknown): Record<string, unknown> => error && typeof error === 'object' ? error as Record<string, unknown> : {};

/** Fixed-code inspection is local only; error text, URL, request body and stack never enter capture. */
function failureCode(error: unknown, scope: RecoveryScope): ClientSupportCode {
  const row = errorRecord(error);
  if (row.name === 'AbortError' || row.code === 'ERR_CANCELED' || row.code === 'ABORT_ERR') return 'user_cancelled';
  if (row.status === 401 || row.code === 'AUTH_EXPIRED') return 'auth_expired';
  if (row.status === 403 || row.code === '42501') return 'access_denied';
  if (scope.category === 'finance' || scope.feature === 'donation' || scope.feature === 'payouts') return 'payment_failed';
  if (row.code === 'ETIMEDOUT' || row.name === 'TimeoutError' || row.status === 408) return 'read_timeout';
  if (isTransient(error)) return 'network_unavailable';
  return scope.operation === 'read' ? 'read_failed' : 'runtime_failure';
}
function isTransient(error: unknown): boolean {
  const row = errorRecord(error);
  if (row.name === 'AbortError' || ['ERR_CANCELED', 'ABORT_ERR', 'AUTH_EXPIRED', '42501'].includes(row.code as string) || row.status === 401 || row.status === 403) return false;
  // Supabase's fetch adapter flattens offline failures to status 0 with an empty code.
  // Preserved cancellation metadata above still wins; ordinary TypeErrors without a status do not qualify.
  return ['ETIMEDOUT', 'NETWORK_ERROR', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(row.code as string) ||
    row.name === 'TimeoutError' || [0, 408, 429, 502, 503, 504].includes(row.status as number);
}
function deliveryFailure(error: unknown): SupportSensorPhase {
  const row = errorRecord(error);
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(row.code as string)) return 'migration_missing';
  if (row.code === '42501' || row.status === 401 || row.status === 403 || row.code === 'PGRST301') return 'permission_denied';
  return 'delivery_failed';
}

/**
 * @purpose Capture safe occurrences separately from usage telemetry. Queue/rate bounds also apply during outages.
 * Failed writes are not replayed: the server may already have committed a timed-out request.
 * @sideEffects configure enables a timer/AppState flush; flush invokes a fixed Supabase RPC.
 */
export class SupportSignalManager {
  private queue: SupportSignalArgs[] = [];
  private scope: { environment: SupportEnvironment; release: string; accessToken: string | null } | null = null;
  private phase: SupportSensorPhase = 'disabled';
  private lastFailure: SupportSensorFailure | null = null;
  private dropped = 0;
  private delivered = 0;
  private lastDeliveredAt: string | null = null;
  private windowStarted = 0;
  private windowAttempts = 0;
  private flushing = false;
  private generation = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private appSub: NativeEventSubscription | null = null;
  private readonly send: NonNullable<ManagerOptions['send']>;
  private readonly configured: () => boolean;
  private readonly now: () => number;
  private readonly maxQueue: number;
  private readonly maxPerMinute: number;
  private readonly flushIntervalMs: number;
  private readonly sendTimeoutMs: number;
  private readonly requiresToken: boolean;

  constructor(options: ManagerOptions = {}) {
    this.requiresToken = !options.send;
    this.send = options.send ?? (async (args, accessToken) => {
      // SDK session lookup can finish after an account switch. Pin authorization to the queued
      // capture context instead; credentials never become an RPC argument or sensor status.
      const { error } = await supabase.rpc('record_support_signal', args).setHeader('Authorization', `Bearer ${accessToken}`);
      return { error };
    });
    this.configured = options.configured ?? (() => isSupabaseConfigured);
    this.now = options.now ?? Date.now;
    this.maxQueue = bounded(options.maxQueue, 32, 64);
    this.maxPerMinute = bounded(options.maxPerMinute, 20, 60);
    this.flushIntervalMs = bounded(options.flushIntervalMs, 15_000, 60_000, 5_000);
    this.sendTimeoutMs = bounded(options.sendTimeoutMs, 8_000, 15_000, 1_000);
  }

  /**
   * @purpose Enable capture with public environment/release metadata after the admin-ready checkpoint.
   * Call disabled on account changes/logout before enabling a new context; prior queued data is discarded.
   */
  configure(input: { enabled: boolean; environment: unknown; release: unknown; accessToken?: unknown }): boolean {
    this.stopListeners();
    this.generation++;
    this.dropped += this.queue.length;
    this.queue = [];
    this.scope = null;
    if (!input.enabled) { this.phase = 'disabled'; return true; }
    const environment = safeSupportEnvironment(input.environment);
    const release = safeSupportRelease(input.release);
    const accessToken = typeof input.accessToken === 'string' && input.accessToken.length > 0 && input.accessToken.length <= 8192 && !/\s/.test(input.accessToken) ? input.accessToken : null;
    if (!environment || !release || this.requiresToken && !accessToken) { this.phase = 'invalid_configuration'; this.lastFailure = 'invalid_configuration'; return false; }
    if (!this.configured()) { this.phase = 'not_configured'; this.lastFailure = 'not_configured'; return false; }
    this.scope = { environment, release, accessToken };
    this.phase = 'ready';
    this.lastFailure = null;
    this.timer = setInterval(() => { void this.flush(); }, this.flushIntervalMs);
    (this.timer as unknown as { unref?: () => void }).unref?.();
    this.appSub = AppState.addEventListener('change', (state) => { if (state === 'background' || state === 'inactive') void this.flush(); });
    return true;
  }

  /** Only four allowlisted fields are selected. Extra caller properties are never serialized. */
  capture(input: ClientSupportCapture): boolean {
    if (!this.scope || ['migration_missing', 'permission_denied', 'not_configured'].includes(this.phase)) { this.dropped++; return false; }
    const feature = safeSupportFeature(input?.feature); const code = safeSupportCode(input?.code);
    if (!feature || !code || !SUPPORT_CODES[code].client) { this.dropped++; this.lastFailure = 'invalid_signal'; return false; }
    const time = this.now();
    if (time - this.windowStarted >= 60_000 || time < this.windowStarted) { this.windowStarted = time; this.windowAttempts = 0; }
    if (++this.windowAttempts > this.maxPerMinute) { this.dropped++; this.lastFailure = 'rate_limited'; return false; }
    if (this.queue.length >= this.maxQueue) { this.dropped++; this.lastFailure = 'queue_full'; return false; }
    this.queue.push({ p_feature: feature, p_code: code as ClientSupportCode, p_environment: this.scope.environment, p_release: this.scope.release });
    return true;
  }

  getStatus(): SupportSensorStatus {
    return { phase: this.phase, queued: this.queue.length, dropped: this.dropped, delivered: this.delivered, lastFailure: this.lastFailure, lastDeliveredAt: this.lastDeliveredAt };
  }

  /** @purpose Deliver the current bounded batch once; capture failure stays visible without retrying an uncertain write. */
  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0 || !this.scope) return;
    if (!this.configured()) { this.failDelivery('not_configured', this.queue.length); this.queue = []; return; }
    const generation = this.generation;
    const accessToken = this.scope.accessToken;
    const batch = this.queue.splice(0);
    this.flushing = true;
    this.phase = 'sending';
    try {
      for (let index = 0; index < batch.length; index++) {
        if (generation !== this.generation) { this.dropped += batch.length - index; break; }
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          const result = await Promise.race([
            this.send(batch[index], accessToken),
            new Promise<Delivery>((resolve) => { timeout = setTimeout(() => resolve({ error: { code: 'DELIVERY_TIMEOUT' } }), this.sendTimeoutMs); }),
          ]);
          if (generation !== this.generation) { this.dropped += batch.length - index; break; }
          if (result.error) { this.failDelivery(deliveryFailure(result.error), batch.length - index); break; }
          this.delivered++;
          this.lastDeliveredAt = new Date(this.now()).toISOString();
          this.phase = 'ready'; this.lastFailure = null;
        } catch {
          if (generation === this.generation) this.failDelivery('delivery_failed', batch.length - index);
          else this.dropped += batch.length - index;
          break;
        } finally { if (timeout !== undefined) clearTimeout(timeout); }
      }
    } finally { this.flushing = false; }
  }

  /**
   * @purpose Run owner work, retrying only a known transient read once outside money/access scopes.
   * Recovery also requires retained failure evidence in the same enabled account/build context.
   * @returns The successful result or the original failure object to the owning caller; it is never logged.
   */
  async runWithRecovery<T>(scope: RecoveryScope, task: () => Promise<T>): Promise<T> {
    const generation = this.generation;
    try { return await task(); }
    catch (error) {
      // A stale task cannot report under, or trigger a read using, a replacement account context.
      if (generation !== this.generation || !this.scope || !this.configured()) throw error;
      const retained = this.capture({ feature: scope.feature, code: failureCode(error, scope) });
      if (!retained || generation !== this.generation || !this.scope || !this.configured() ||
        !canAutomaticallyRecover({ ...scope, transient: isTransient(error), attempts: 0 })) throw error;
      try {
        const result = await task();
        if (generation === this.generation) this.capture({ feature: scope.feature, code: 'recovery_succeeded' });
        return result;
      } catch {
        if (generation === this.generation) this.capture({ feature: scope.feature, code: 'recovery_failed' });
        // The caller retains the first failure; recovery evidence conveys that the single retry also failed.
        throw error;
      }
    }
  }

  /** @purpose Stop device/timer listeners and clear queued context on unmount, logout or hot reload. */
  dispose(): void { this.configure({ enabled: false, environment: null, release: null }); }

  private failDelivery(phase: SupportSensorPhase, count: number): void {
    this.phase = phase; this.lastFailure = phase as SupportSensorFailure; this.dropped += count;
    if (['migration_missing', 'permission_denied', 'not_configured'].includes(phase)) {
      this.dropped += this.queue.length; this.queue = []; this.stopListeners();
    }
  }
  private stopListeners(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.appSub?.remove(); this.appSub = null;
  }
}

// Unlike usage telemetry this singleton does not start listeners or capture during import.
export const supportSignals = new SupportSignalManager();
