/**
 * Soft-Wall + browse-first auth helpers shared by the Next admin portal.
 * Product gates live in `@tapuai/shared-types` (`SOFT_WALL_GATES`).
 */

import {
  SOFT_WALL_AUTH_PROVIDERS,
  SOFT_WALL_GATES,
  type SoftWallOversight,
} from '@tapuai/shared-types';

import { getSupabaseServerClient } from '@/lib/supabase';

type RuntimeLayouts = {
  operatorConsole?: boolean;
  wishlist?: boolean;
};

type RuntimeButtons = {
  malo?: boolean;
  crew?: boolean;
  subscribe?: boolean;
};

type RuntimeBag = {
  layouts?: RuntimeLayouts;
  buttons?: RuntimeButtons;
};

function asBool(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/**
 * @purpose Load Soft-Wall oversight from `app_runtime_config` + `profiles` for the web control plane.
 * @sideEffects Supabase SELECT on runtime config and profiles (count + recent fans).
 */
export async function fetchSoftWallOversight(): Promise<SoftWallOversight> {
  const empty: SoftWallOversight = {
    configured: false,
    fanProfiles: 0,
    fansLast7d: 0,
    operatorConsoleLive: false,
    operatorConsoleDraft: null,
    maloLive: true,
    crewLive: true,
    wishlistLive: true,
    exclusiveLive: true,
    publishedAt: null,
    softWallGates: SOFT_WALL_GATES,
    authProviders: SOFT_WALL_AUTH_PROVIDERS,
  };

  const supabase = getSupabaseServerClient();
  if (!supabase) return empty;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [runtimeRes, fanCountRes, recentFansRes] = await Promise.all([
    supabase.from('app_runtime_config').select('published, draft, published_at').eq('id', 'default').maybeSingle(),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .or('role.eq.fan,roles.cs.{fan}'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .or('role.eq.fan,roles.cs.{fan}')
      .gte('created_at', weekAgo),
  ]);

  const published = (runtimeRes.data?.published ?? {}) as RuntimeBag;
  const draft = (runtimeRes.data?.draft ?? {}) as RuntimeBag;

  return {
    configured: true,
    fanProfiles: asInt(fanCountRes.count),
    fansLast7d: asInt(recentFansRes.count),
    operatorConsoleLive: asBool(published.layouts?.operatorConsole, false),
    operatorConsoleDraft:
      typeof draft.layouts?.operatorConsole === 'boolean' ? draft.layouts.operatorConsole : null,
    maloLive: asBool(published.buttons?.malo, true),
    crewLive: asBool(published.buttons?.crew, true),
    wishlistLive: asBool(published.layouts?.wishlist, true),
    exclusiveLive: asBool(published.buttons?.subscribe, true),
    publishedAt: typeof runtimeRes.data?.published_at === 'string' ? runtimeRes.data.published_at : null,
    softWallGates: SOFT_WALL_GATES,
    authProviders: SOFT_WALL_AUTH_PROVIDERS,
  };
}

export type PortalPerson = {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string | null;
};

/**
 * @purpose Recent Soft-Wall fan profiles for the web People desk.
 * @sideEffects `profiles` SELECT.
 */
export async function fetchPortalPeople(limit = 40): Promise<PortalPerson[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, role, is_verified, is_admin, roles, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => {
    const roles = Array.isArray(row.roles) ? row.roles.map(String) : [];
    return {
      id: String(row.id),
      full_name: String(row.full_name || 'Unnamed'),
      username: row.username ? String(row.username) : null,
      role: String(row.role || 'fan'),
      is_verified: Boolean(row.is_verified),
      is_admin: Boolean(row.is_admin) || roles.includes('admin') || row.role === 'admin',
      created_at: typeof row.created_at === 'string' ? row.created_at : null,
    };
  });
}

export type PortalRuntimeSnapshot = {
  configured: boolean;
  draft: Record<string, unknown>;
  published: Record<string, unknown>;
  publishedAt: string | null;
  dirty: boolean;
};

/**
 * @purpose Read Features draft + published chrome for the web Features desk.
 * @sideEffects `app_runtime_config` SELECT.
 */
export async function fetchPortalRuntime(): Promise<PortalRuntimeSnapshot> {
  const empty: PortalRuntimeSnapshot = {
    configured: false,
    draft: {},
    published: {},
    publishedAt: null,
    dirty: false,
  };
  const supabase = getSupabaseServerClient();
  if (!supabase) return empty;
  const { data, error } = await supabase
    .from('app_runtime_config')
    .select('draft, published, published_at')
    .eq('id', 'default')
    .maybeSingle();
  if (error || !data) return empty;
  const draft = (data.draft && typeof data.draft === 'object' ? data.draft : {}) as Record<string, unknown>;
  const published =
    data.published && typeof data.published === 'object' ? (data.published as Record<string, unknown>) : {};
  return {
    configured: true,
    draft,
    published,
    publishedAt: typeof data.published_at === 'string' ? data.published_at : null,
    dirty: JSON.stringify(draft) !== JSON.stringify(published),
  };
}
