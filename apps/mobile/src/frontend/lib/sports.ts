/**
 * Per-sport configuration (positions, scoring actions, stat fields, callouts, measurables) stored in Supabase.
 * Rows live in `sport_configs`, read with the `get_sport_configs` RPC and written with `upsert_sport_config`. Starters
 * come from `data/sports.ts`; the Expo /admin Sports desk edits them; scorer and profile screens read them through
 * `hooks/useSportConfigs`. `parseSportConfig` validates untrusted rows so a bad row cannot crash a screen.
 * @sideEffects Reads and writes sport configs; `fetchSportUsage` also reads `athlete_career_stats` and `games`.
 */

import {
  GENERIC_SPORT_CONFIG,
  SPORT_CONFIG_SEEDS,
  SPORT_MEASURABLE_KEYS,
  SPORT_STAT_SOURCES,
  type SportCallout,
  type SportConfig,
  type SportMeasurable,
  type SportMeasurableKey,
  type SportPosition,
  type SportScoreAction,
  type SportStatField,
  type SportStatSource,
} from '@/data/sports';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { SportConfigRow } from '@/types/database';

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asInt(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? Math.round(next) : fallback;
}

function slug(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `item-${index + 1}`;
}

function parseScoring(raw: unknown): SportScoreAction[] {
  return asArray(raw)
    .map((entry, index) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const label = asText(row.label, '');
      if (!label) return null;
      return {
        id: asText(row.id, slug(label, index)),
        label,
        points: asInt(row.points, 0),
        eventType: asText(row.eventType ?? row.event_type, label),
      };
    })
    .filter((row): row is SportScoreAction => Boolean(row));
}

function parseCallouts(raw: unknown): SportCallout[] {
  return asArray(raw)
    .map((entry, index) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const label = asText(row.label, '');
      if (!label) return null;
      return {
        id: asText(row.id, slug(label, index)),
        label,
        emoji: asText(row.emoji, '⚡'),
        eventType: asText(row.eventType ?? row.event_type, label),
      };
    })
    .filter((row): row is SportCallout => Boolean(row));
}

function parsePositions(raw: unknown): SportPosition[] {
  return asArray(raw)
    .map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const full = asText(row.full ?? row.label, '');
      const short = asText(row.short, full.slice(0, 3).toUpperCase());
      if (!full && !short) return null;
      return { short: short || full, full: full || short };
    })
    .filter((row): row is SportPosition => Boolean(row));
}

function parseStatFields(raw: unknown): SportStatField[] {
  const known = new Set(SPORT_STAT_SOURCES.map((row) => row.id));
  const rows = asArray(raw)
    .map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const source = asText(row.source, '') as SportStatSource;
      if (!known.has(source)) return null;
      return {
        source,
        label: asText(row.label, source),
        show: row.show !== false,
      };
    })
    .filter((row): row is SportStatField => Boolean(row));
  return rows.length > 0 ? rows : GENERIC_SPORT_CONFIG.statFields;
}

function parseMeasurables(raw: unknown): SportMeasurable[] {
  const byKey = new Map(
    asArray(raw).map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      return [asText(row.key, ''), row] as const;
    }),
  );
  return SPORT_MEASURABLE_KEYS.map((item) => {
    const row = byKey.get(item.id);
    // A playbook saved with no measurables shows all four; one that lists some hides the rest.
    if (!row) return { key: item.id as SportMeasurableKey, label: item.label, show: byKey.size === 0 };
    return {
      key: item.id as SportMeasurableKey,
      label: asText(row.label, item.label),
      show: row.show !== false,
    };
  });
}

/**
 * @purpose Turn a `sport_configs` row into the client playbook, filling anything the admin left blank.
 */
export function parseSportConfig(raw: unknown): SportConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const sport = asText(row.sport, '');
  if (!sport) return null;
  const periods = asArray(row.periods)
    .map((entry) => asText(entry, ''))
    .filter(Boolean);
  return {
    id: asText(row.id, sport.toLowerCase()),
    sport,
    emoji: asText(row.emoji, '🏅'),
    periodLabel: asText(row.period_label ?? row.periodLabel, 'Period'),
    periods: periods.length > 0 ? periods : GENERIC_SPORT_CONFIG.periods,
    usesClock: (row.uses_clock ?? row.usesClock) !== false,
    clockSeconds: Math.max(0, asInt(row.clock_seconds ?? row.clockSeconds, 0)),
    scoring: parseScoring(row.scoring),
    callouts: parseCallouts(row.callouts),
    statFields: parseStatFields(row.stat_fields ?? row.statFields),
    measurables: parseMeasurables(row.measurables),
    positions: parsePositions(row.positions),
    isActive: (row.is_active ?? row.isActive) !== false,
    sortOrder: asInt(row.sort_order ?? row.sortOrder, 0),
  };
}

/** @purpose Client playbook → `upsert_sport_config` payload. */
export function sportConfigPayload(config: SportConfig): Record<string, unknown> {
  return {
    id: /^[0-9a-f]{8}-/i.test(config.id) ? config.id : null,
    sport: config.sport.trim(),
    emoji: config.emoji.trim() || '🏅',
    period_label: config.periodLabel.trim() || 'Period',
    periods: config.periods.map((row) => row.trim()).filter(Boolean),
    uses_clock: config.usesClock,
    clock_seconds: config.usesClock ? Math.max(0, config.clockSeconds) : 0,
    scoring: config.scoring,
    callouts: config.callouts,
    stat_fields: config.statFields,
    measurables: config.measurables,
    positions: config.positions,
    is_active: config.isActive,
    sort_order: config.sortOrder,
  };
}

/**
 * @purpose Read only what `sport_configs` actually stores, so `/admin/sports` can tell saved playbooks from starters.
 * @returns Stored playbooks, or null when Supabase is offline or the table is unreachable.
 * @sideEffects `get_sport_configs` RPC.
 */
export async function fetchStoredSportConfigs(): Promise<SportConfig[] | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('get_sport_configs');
  if (error || !Array.isArray(data)) return null;
  return data.map((row) => parseSportConfig(row)).filter((row): row is SportConfig => Boolean(row));
}

/**
 * @purpose Load every sport playbook, falling back to the seeded catalog when `sport_configs` is missing.
 * @returns Playbooks in builder order; the seeds when Supabase is offline or the table is empty.
 * @sideEffects `get_sport_configs` RPC.
 */
export async function fetchSportConfigs(): Promise<SportConfig[]> {
  const rows = await fetchStoredSportConfigs();
  return rows && rows.length > 0 ? rows : SPORT_CONFIG_SEEDS;
}

/**
 * @purpose Save one playbook from `/admin/sports`.
 * @returns The stored row so the desk can show server-normalized values.
 * @sideEffects `upsert_sport_config` RPC.
 */
export async function saveSportConfig(config: SportConfig): Promise<SportConfig> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('upsert_sport_config', {
    payload: sportConfigPayload(config) as never,
  });
  if (error) throw new Error(error.message);
  return parseSportConfig(data) ?? config;
}

/**
 * @purpose Delete a playbook. Games on that sport fall back to the generic console.
 * @sideEffects `delete_sport_config` RPC.
 */
export async function deleteSportConfig(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('delete_sport_config', { target_id: id });
  if (error) throw new Error(error.message);
}

/**
 * @purpose Seed `sport_configs` from the built-in playbooks so a fresh project has every sport ready.
 * @returns How many playbooks were written.
 * @sideEffects One `upsert_sport_config` per seed.
 */
export async function seedSportConfigs(): Promise<number> {
  let saved = 0;
  for (const seed of SPORT_CONFIG_SEEDS) {
    await saveSportConfig({ ...seed, id: seed.sport.toLowerCase() });
    saved += 1;
  }
  return saved;
}

export type SportUsage = {
  /** Athletes whose `athlete_career_stats.sport` matches. */
  athletes: number;
  /** Games on the board for this sport. */
  games: number;
};

/**
 * @purpose Business context for the builder: how many athletes and games ride on each playbook.
 * @returns Map keyed by lowercase sport name.
 * @sideEffects `athlete_career_stats` + `games` SELECT (sport columns only).
 */
export async function fetchSportUsage(): Promise<Record<string, SportUsage>> {
  const usage: Record<string, SportUsage> = {};
  if (!isSupabaseConfigured) return usage;

  const bump = (sport: unknown, key: keyof SportUsage) => {
    const name = typeof sport === 'string' ? sport.trim().toLowerCase() : '';
    if (!name) return;
    usage[name] = usage[name] ?? { athletes: 0, games: 0 };
    usage[name][key] += 1;
  };

  const [stats, games] = await Promise.all([
    supabase.from('athlete_career_stats').select('sport').limit(2000),
    supabase.from('games').select('sport').limit(2000),
  ]);

  if (Array.isArray(stats.data)) stats.data.forEach((row) => bump((row as { sport?: unknown }).sport, 'athletes'));
  if (Array.isArray(games.data)) games.data.forEach((row) => bump((row as { sport?: unknown }).sport, 'games'));

  return usage;
}

export type { SportConfigRow };
