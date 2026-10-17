/**
 * Local Explore search data: `search_local_entities`, with plain table reads when that function is missing or fails.
 * Moved out of `hooks/useLocalSearch` (PORT-01) so a host change rewrites lib/, not the hook.
 * @sideEffects `search_local_entities` RPC; fallback SELECTs on `players`, `games` and `sponsorships`.
 */

import { likeNeedle, orIlike } from '@/lib/postgrestFilter';
import { untypedRpc } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';
import type { LocalSearchHit, LocalSearchKind } from '@/types/database';

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parseHit(row: Record<string, unknown>): LocalSearchHit | null {
  const entity_type = asText(row.entity_type);
  const entity_id = asText(row.entity_id);
  const title = asText(row.title);
  if (!entity_id || !title) return null;
  if (entity_type !== 'athlete' && entity_type !== 'school' && entity_type !== 'booster') return null;
  return {
    entity_type,
    entity_id,
    title,
    subtitle: asText(row.subtitle),
  };
}

function parseHits(rows: unknown): LocalSearchHit[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => (row && typeof row === 'object' ? parseHit(row as Record<string, unknown>) : null))
    .filter((row): row is LocalSearchHit => Boolean(row));
}

async function fallbackSearch(needle: string, kind: LocalSearchKind): Promise<LocalSearchHit[]> {
  const pattern = orIlike(needle);
  const hits: LocalSearchHit[] = [];

  if (kind === 'all' || kind === 'athlete') {
    const { data } = await supabase
      .from('players')
      .select('id, name, school_name, team')
      .or(`name.ilike.${pattern},school_name.ilike.${pattern}`)
      .limit(20);
    for (const row of data ?? []) {
      const id = asText(row.id);
      const title = asText(row.name);
      if (!id || !title) continue;
      hits.push({
        entity_type: 'athlete',
        entity_id: id,
        title,
        subtitle: asText(row.school_name) || asText(row.team),
      });
    }
  }

  if (kind === 'all' || kind === 'school') {
    const { data } = await supabase.from('games').select('home_school, away_school, home_team, away_team').limit(80);
    const seen = new Set<string>();
    for (const row of data ?? []) {
      for (const raw of [row.home_school, row.away_school, row.home_team, row.away_team]) {
        const title = asText(raw);
        const key = title.toLowerCase();
        if (!title || seen.has(key) || !key.includes(likeNeedle(needle).toLowerCase())) continue;
        seen.add(key);
        hits.push({ entity_type: 'school', entity_id: title, title, subtitle: 'High school' });
      }
    }
  }

  if (kind === 'all' || kind === 'booster') {
    const { data } = await supabase
      .from('sponsorships')
      .select('id, business_name, school_team')
      .or(`business_name.ilike.${pattern},school_team.ilike.${pattern}`)
      .limit(20);
    for (const row of data ?? []) {
      const id = asText(row.id);
      const title = asText(row.business_name);
      if (!id || !title) continue;
      hits.push({
        entity_type: 'booster',
        entity_id: id,
        title,
        subtitle: asText(row.school_team),
      });
    }
  }

  return hits;
}

/**
 * @purpose Search athletes, schools and boosters for the Local results drawer.
 * @param needle Trimmed search text (callers skip one-character queries).
 * @param kind Segment chip: `all` / `athlete` / `school` / `booster`.
 * @returns Hits from the database function, or from the table fallback when the function errors; an empty list when
 *   the fallback throws too.
 */
export async function searchLocalEntities(needle: string, kind: LocalSearchKind): Promise<LocalSearchHit[]> {
  const safe = likeNeedle(needle);
  if (safe.length < 2) return [];
  const rpc = await untypedRpc('search_local_entities', { search_query: safe, entity_kind: kind });
  if (!rpc.error) return parseHits(rpc.data);
  try {
    return await fallbackSearch(safe, kind);
  } catch {
    return [];
  }
}
