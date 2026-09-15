import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseReelCategory, type HighlightClip, type ReelCategory } from '@/data/highlights';
import type { PlayReactionId } from '@/data/players';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Player, Reel, ReelWithPlayer } from '@/types/database';

export const HIGHLIGHTS_BUCKET = 'game_highlights';

export type UploadSekiPlayInput = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  title: string;
  playerId: string;
  gameId: string;
  /** Persist `reels.is_vault_only` / `is_exclusive`. Default false = free public feed. */
  isExclusive?: boolean;
  /** Persist `reels.category`. Default Game Play. */
  category?: ReelCategory;
  onProgress?: (value: number) => void;
  onStatus?: (message: string) => void;
};

function fileExtFromUri(selectedVideoUri: string, fileName?: string | null): string {
  const source = fileName || selectedVideoUri;
  const raw = (source.split('.').pop() || 'mp4').split(/[?#]/)[0].toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(raw) ? raw : 'mp4';
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message.trim() ? caught.message : fallback;
}

async function blobFromVideoUri(selectedVideoUri: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(selectedVideoUri);
  } catch (caught) {
    throw new Error(
      `Could not read this clip from disk. Pick or record it again. (${errorMessage(caught, 'fetch failed')})`,
    );
  }

  // Local file:// / content:// / ph:// fetches often return status 0, so skip response.ok.
  try {
    const blob = await response.blob();
    if (blob && blob.size > 0) return blob;
  } catch {
    // Fall through to ArrayBuffer → Blob for React Native file URIs.
  }

  try {
    const retry = await fetch(selectedVideoUri);
    const buffer = await retry.arrayBuffer();
    if (!buffer.byteLength) {
      throw new Error('The selected clip is empty.');
    }
    return new Blob([buffer], { type: 'video/mp4' });
  } catch (caught) {
    throw new Error(
      `Could not convert this clip to binary data. (${errorMessage(caught, 'blob conversion failed')})`,
    );
  }
}

export function playerFromReel(reel: ReelWithPlayer, roster: Player[] = []): Player | null {
  const joined = reel.players;
  const tagged = Array.isArray(joined) ? joined[0] : joined;
  if (tagged) return tagged;
  if (!reel.player_id) return null;
  return roster.find((player) => player.id === reel.player_id) ?? null;
}

export type ReelHype = {
  seki_count: number;
  aura_count: number;
  flex_count: number;
  total_tips_cents: number;
};

export const EMPTY_REEL_HYPE: ReelHype = {
  seki_count: 0,
  aura_count: 0,
  flex_count: 0,
  total_tips_cents: 0,
};

export function hypeFromReel(reel: Pick<Reel, 'seki_count' | 'aura_count' | 'flex_count' | 'total_tips_cents'> | null | undefined): ReelHype {
  return {
    seki_count: reel?.seki_count ?? 0,
    aura_count: reel?.aura_count ?? 0,
    flex_count: reel?.flex_count ?? 0,
    total_tips_cents: reel?.total_tips_cents ?? 0,
  };
}

export function formatTipDollars(cents: number): string {
  const dollars = Math.max(0, cents) / 100;
  return Number.isInteger(dollars) ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

export function reelToClip(reel: Reel, player: Player | null): HighlightClip {
  const hype = hypeFromReel(reel);
  const vaultOnly = Boolean(reel.is_vault_only ?? reel.is_exclusive);
  return {
    id: reel.id,
    athleteName: player?.name ?? 'Untagged athlete',
    school: player?.school_name ?? player?.team_name ?? player?.team ?? '',
    tag: reel.title.trim() || 'Seki Play',
    videoUrl: reel.video_url,
    sekiPlay: true,
    exclusive: vaultOnly,
    isVaultOnly: vaultOnly,
    playerId: reel.player_id ?? player?.id ?? null,
    gameId: reel.game_id ?? null,
    sekiCount: hype.seki_count,
    auraCount: hype.aura_count,
    flexCount: hype.flex_count,
    totalTipsCents: hype.total_tips_cents,
    createdAt: reel.created_at,
    category: parseReelCategory(reel.category),
    flashUnlockUntil: reel.flash_unlock_until ?? null,
    tagStatus: reel.tag_status === 'pending' || reel.tag_status === 'rejected' ? reel.tag_status : 'confirmed',
  };
}

function stampMs(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * @purpose Keep profile / athlete tagged clips newest → oldest (`reels.created_at` desc).
 * @param clips Grid or pager items.
 * @returns A new array; items without `createdAt` keep relative order at the end of their stamp group.
 */
export function sortClipsNewestFirst(clips: HighlightClip[]): HighlightClip[] {
  return [...clips].sort((left, right) => stampMs(right.createdAt) - stampMs(left.createdAt));
}

const REEL_COLUMNS =
  'id, video_url, title, player_id, game_id, created_at, seki_count, aura_count, flex_count, total_tips_cents';
const REEL_COLUMNS_EXCLUSIVE = `${REEL_COLUMNS}, is_exclusive`;
const REEL_COLUMNS_MODERATION = `${REEL_COLUMNS_EXCLUSIVE}, is_flagged, reported_by`;
const REEL_COLUMNS_VAULT = `${REEL_COLUMNS_MODERATION}, is_vault_only`;
const REEL_COLUMNS_CATEGORY = `${REEL_COLUMNS_VAULT}, category`;
const REEL_COLUMNS_FLASH = `${REEL_COLUMNS_CATEGORY}, flash_unlock_until`;
const REEL_COLUMNS_REMOVED = `${REEL_COLUMNS_FLASH}, is_removed`;
const REEL_COLUMNS_TAG = `${REEL_COLUMNS_REMOVED}, tag_status, uploaded_by`;
const REEL_COLUMNS_BASIC = 'id, video_url, title, player_id, game_id, created_at';
const HIDDEN_REELS_KEY = 'tapuai.hiddenReels';

const PLAYER_SELECT = `
  id,
  name,
  jersey_number,
  position,
  height,
  school_name,
  backer_count,
  team
`;

export function isReelUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * @purpose Format a shareable Tapua'i deep link for a Highlight (`alasports://user/{id}?reel=`).
 * @param reelId Clip `reels.id` (or seeded highlight id).
 * @param playerId Tagged athlete when known so Share opens `/user/[id]`.
 * @returns `expo-linking` URL using the app scheme.
 */
export function formatReelDeepLink(reelId: string, playerId?: string | null): string {
  if (playerId) {
    return Linking.createURL(`user/${playerId}`, { queryParams: { reel: reelId } });
  }
  return Linking.createURL('/', { queryParams: { reel: reelId } });
}

async function selectReels(columns: string, playerId?: string) {
  const ordered = supabase.from('reels').select(columns).order('created_at', { ascending: false });
  return playerId ? ordered.eq('player_id', playerId) : ordered;
}

function rowsFromQuery<T>(data: unknown): T[] {
  if (!Array.isArray(data)) return [];
  return data as unknown as T[];
}

async function queryReels(playerId?: string): Promise<ReelWithPlayer[]> {
  const tagged = await selectReels(`${REEL_COLUMNS_TAG}, players (${PLAYER_SELECT})`, playerId);
  if (!tagged.error) {
    return rowsFromQuery<ReelWithPlayer>(tagged.data).filter(
      (row) => Boolean(row.video_url) && row.is_removed !== true,
    );
  }

  const live = await selectReels(`${REEL_COLUMNS_REMOVED}, players (${PLAYER_SELECT})`, playerId);
  if (!live.error) {
    return rowsFromQuery<ReelWithPlayer>(live.data).filter(
      (row) => Boolean(row.video_url) && row.is_removed !== true,
    );
  }

  const flashed = await selectReels(`${REEL_COLUMNS_FLASH}, players (${PLAYER_SELECT})`, playerId);
  if (!flashed.error) {
    return rowsFromQuery<ReelWithPlayer>(flashed.data).filter((row) => Boolean(row.video_url));
  }

  const categorized = await selectReels(`${REEL_COLUMNS_CATEGORY}, players (${PLAYER_SELECT})`, playerId);
  if (!categorized.error) {
    return rowsFromQuery<ReelWithPlayer>(categorized.data).filter((row) => Boolean(row.video_url));
  }

  const vaulted = await selectReels(`${REEL_COLUMNS_VAULT}, players (${PLAYER_SELECT})`, playerId);
  if (!vaulted.error) {
    return rowsFromQuery<ReelWithPlayer>(vaulted.data).filter((row) => Boolean(row.video_url));
  }

  const moderated = await selectReels(`${REEL_COLUMNS_MODERATION}, players (${PLAYER_SELECT})`, playerId);
  if (!moderated.error) {
    return rowsFromQuery<ReelWithPlayer>(moderated.data).filter((row) => Boolean(row.video_url));
  }

  const exclusiveWithPlayers = await selectReels(`${REEL_COLUMNS_EXCLUSIVE}, players (${PLAYER_SELECT})`, playerId);
  if (!exclusiveWithPlayers.error) {
    return rowsFromQuery<ReelWithPlayer>(exclusiveWithPlayers.data).filter((row) => Boolean(row.video_url));
  }

  const selectWithPlayers = `${REEL_COLUMNS}, players (${PLAYER_SELECT})`;
  const withPlayers = await selectReels(selectWithPlayers, playerId);
  if (!withPlayers.error) {
    return rowsFromQuery<ReelWithPlayer>(withPlayers.data).filter((row) => Boolean(row.video_url));
  }

  const exclusiveOnly = await selectReels(REEL_COLUMNS_EXCLUSIVE, playerId);
  if (!exclusiveOnly.error) {
    return rowsFromQuery<Reel>(exclusiveOnly.data)
      .filter((row) => Boolean(row.video_url))
      .map((row) => ({ ...row, players: null }));
  }

  const fallback = await selectReels(REEL_COLUMNS, playerId);
  if (!fallback.error) {
    return rowsFromQuery<Reel>(fallback.data)
      .filter((row) => Boolean(row.video_url))
      .map((row) => ({ ...row, players: null }));
  }

  const basicResult = await selectReels(REEL_COLUMNS_BASIC, playerId);
  if (basicResult.error) throw new Error(basicResult.error.message);
  return rowsFromQuery<Reel>(basicResult.data)
    .filter((row) => Boolean(row.video_url))
    .map((row) => ({ ...row, players: null }));
}

export async function fetchReels(): Promise<ReelWithPlayer[]> {
  if (!isSupabaseConfigured) return [];
  return queryReels();
}

export async function fetchReelsForPlayer(playerId: string): Promise<ReelWithPlayer[]> {
  if (!isSupabaseConfigured || !playerId) return [];
  return queryReels(playerId);
}

function asCount(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseReelHype(data: unknown, fallback: ReelHype): ReelHype {
  if (!data || typeof data !== 'object') return fallback;
  const row = data as Record<string, unknown>;
  return {
    seki_count: asCount(row.seki_count, fallback.seki_count),
    aura_count: asCount(row.aura_count, fallback.aura_count),
    flex_count: asCount(row.flex_count, fallback.flex_count),
    total_tips_cents: asCount(row.total_tips_cents, fallback.total_tips_cents),
  };
}

/**
 * @purpose Increment a Reel's Seki / Aura / Flex counter once per signed-in fan (`reel_hype_votes` + `increment_reel_hype`).
 * @param reelId Target `reels.id`.
 * @param kind Chip or double-tap hype kind.
 * @param current Local counts used as the optimistic fallback.
 * @returns Server row when the RPC lands; duplicate votes return the unchanged counts.
 * @sideEffects `increment_reel_hype` RPC (inserts `reel_hype_votes` for `auth.uid()`); `reels` UPDATE if the RPC is missing.
 */
export async function bumpReelHype(reelId: string, kind: PlayReactionId, current: ReelHype): Promise<ReelHype> {
  const optimistic: ReelHype = {
    ...current,
    seki_count: kind === 'seki' ? current.seki_count + 1 : current.seki_count,
    aura_count: kind === 'aura' ? current.aura_count + 1 : current.aura_count,
    flex_count: kind === 'flex' ? current.flex_count + 1 : current.flex_count,
  };

  if (!isSupabaseConfigured || !isReelUuid(reelId)) return optimistic;

  const { data, error } = await supabase.rpc('increment_reel_hype', {
    target_reel_id: reelId,
    hype_kind: kind,
  });

  if (!error) {
    const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    const applied = row?.applied !== false;
    return parseReelHype(data, applied ? optimistic : current);
  }

  const patch =
    kind === 'aura'
      ? { aura_count: optimistic.aura_count }
      : kind === 'flex'
        ? { flex_count: optimistic.flex_count }
        : { seki_count: optimistic.seki_count };

  await supabase.from('reels').update(patch).eq('id', reelId);
  return optimistic;
}

export async function addReelTips(reelId: string, addCents: number, current: ReelHype): Promise<ReelHype> {
  const add = Math.max(0, addCents);
  const optimistic: ReelHype = {
    ...current,
    total_tips_cents: current.total_tips_cents + add,
  };
  if (!isSupabaseConfigured || !isReelUuid(reelId) || add === 0) return optimistic;

  const { data, error } = await supabase.rpc('increment_reel_tips', {
    target_reel_id: reelId,
    add_cents: add,
  });

  if (!error && typeof data === 'number') {
    return { ...optimistic, total_tips_cents: data };
  }

  const { data: row } = await supabase.from('reels').select('total_tips_cents').eq('id', reelId).maybeSingle();
  const nextTotal = asCount(row?.total_tips_cents, current.total_tips_cents) + add;
  await supabase.from('reels').update({ total_tips_cents: nextTotal }).eq('id', reelId);
  return { ...optimistic, total_tips_cents: nextTotal };
}

/**
 * @purpose Upload a Seki clip to Storage `game_highlights` and insert a `reels` row.
 * @param input Local video URI, caption, tagged player/game, optional `isExclusive` (writes `is_vault_only`), optional `category` (Game Play / Train / Serve).
 * @returns The inserted reel, including vault flags and category. Default is public Game Play.
 * @sideEffects Storage upload; `reels` insert (`is_vault_only` / `is_exclusive` / `category`).
 */
export async function uploadSekiPlay({
  uri: selectedVideoUri,
  fileName,
  title,
  playerId,
  gameId,
  isExclusive = false,
  category = 'game_play',
  onProgress,
  onStatus,
}: UploadSekiPlayInput): Promise<Reel> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add EXPO_PUBLIC keys to .env.local.');
  }

  const caption = title.trim();
  if (!caption) throw new Error('Add a title / hype caption.');
  if (!playerId) throw new Error('Tag a player before uploading.');
  if (!gameId) throw new Error('Pick an active game before uploading.');
  if (!selectedVideoUri) throw new Error('Pick or record a clip before uploading.');

  onStatus?.('Reading clip…');
  onProgress?.(0.08);

  const fileExt = fileExtFromUri(selectedVideoUri, fileName);
  const uploadName = `${Date.now()}.${fileExt}`;
  const filePath = `reels/${uploadName}`;

  const blob = await blobFromVideoUri(selectedVideoUri);
  onProgress?.(0.32);
  onStatus?.('Uploading to Tapua\'i…');

  const { error: uploadError } = await supabase.storage.from(HIGHLIGHTS_BUCKET).upload(filePath, blob, {
    contentType: 'video/mp4',
    upsert: true,
  });

  if (uploadError) {
    throw new Error(
      uploadError.message.includes('Bucket not found')
        ? 'Storage bucket game_highlights is missing. Run supabase/reels.sql in the SQL editor.'
        : uploadError.message,
    );
  }

  onProgress?.(0.82);
  onStatus?.('Saving reel…');

  const {
    data: { publicUrl },
  } = supabase.storage.from(HIGHLIGHTS_BUCKET).getPublicUrl(filePath);
  if (!publicUrl) throw new Error('Upload succeeded but no public video URL was returned.');

  const nextCategory = parseReelCategory(category);
  const baseRow = {
    video_url: publicUrl,
    title: caption,
    player_id: playerId,
    game_id: gameId,
    is_exclusive: isExclusive,
    is_vault_only: isExclusive,
    category: nextCategory,
  };

  const withCategory = await supabase
    .from('reels')
    .insert(baseRow)
    .select('id, video_url, title, player_id, game_id, created_at, is_exclusive, is_vault_only, category')
    .single();

  if (!withCategory.error && withCategory.data) {
    onProgress?.(1);
    onStatus?.('Seki play uploaded.');
    return {
      ...(withCategory.data as Reel),
      is_exclusive: isExclusive,
      is_vault_only: isExclusive,
      category: nextCategory,
    };
  }

  const insertError = withCategory.error;
  if (insertError?.message.includes('category') || insertError?.message.includes('is_vault_only')) {
    const { category: _dropped, ...withoutCategory } = baseRow;
    const retry = await supabase
      .from('reels')
      .insert(withoutCategory)
      .select('id, video_url, title, player_id, game_id, created_at, is_exclusive, is_vault_only')
      .single();
    if (!retry.error && retry.data) {
      onProgress?.(1);
      onStatus?.('Seki play uploaded.');
      return { ...(retry.data as Reel), is_exclusive: isExclusive, is_vault_only: isExclusive, category: nextCategory };
    }
    if (retry.error?.message.includes('is_vault_only') || insertError.message.includes('is_vault_only')) {
      const vaultless = await supabase
        .from('reels')
        .insert({
          video_url: publicUrl,
          title: caption,
          player_id: playerId,
          game_id: gameId,
          is_exclusive: isExclusive,
        })
        .select('id, video_url, title, player_id, game_id, created_at, is_exclusive')
        .single();
      if (!vaultless.error && vaultless.data) {
        onProgress?.(1);
        onStatus?.('Seki play uploaded.');
        return {
          ...(vaultless.data as Reel),
          is_exclusive: isExclusive,
          is_vault_only: isExclusive,
          category: nextCategory,
        };
      }
    }
  }

  throw new Error(
    insertError?.message.includes('Could not find the table')
      ? 'The reels table is missing. Run supabase/reels.sql in the SQL editor.'
      : insertError?.message.includes('is_exclusive')
        ? 'The reels.is_exclusive column is missing. Run supabase/subscriptions.sql in the SQL editor.'
        : insertError?.message.includes('category')
          ? 'The reels.category column is missing. Run supabase/reel_category.sql in the SQL editor.'
          : insertError?.message ?? 'Could not save that Highlight.',
  );
}

export function gameMatchupLabel(homeTeam: string, awayTeam: string): string {
  return `${homeTeam} vs ${awayTeam}`;
}

export function playerTagLabel(player: Player): string {
  const jersey = player.jersey_number != null ? `#${player.jersey_number}` : '';
  return `${player.name}${jersey ? ` ${jersey}` : ''}`.trim();
}

function parseIdList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * @purpose Local hide list for Report / Hide Highlight (survives relaunch).
 * @returns Clip ids this device has hidden.
 * @sideEffects AsyncStorage `tapuai.hiddenReels`.
 */
export async function readHiddenReelIds(): Promise<string[]> {
  return parseIdList(await AsyncStorage.getItem(HIDDEN_REELS_KEY));
}

/**
 * @purpose Persist a hidden clip id after a report.
 * @param reelId Uploaded uuid or seeded highlight id.
 * @sideEffects AsyncStorage `tapuai.hiddenReels`.
 */
export async function hideReelLocally(reelId: string): Promise<string[]> {
  const id = reelId.trim();
  if (!id) return readHiddenReelIds();
  const current = await readHiddenReelIds();
  if (current.includes(id)) return current;
  const next = [id, ...current].slice(0, 200);
  await AsyncStorage.setItem(HIDDEN_REELS_KEY, JSON.stringify(next));
  return next;
}

/**
 * @purpose True when this fan already reported the clip (`reported_by`) or hid it locally.
 */
export function reelHiddenForUser(
  reel: Pick<Reel, 'id' | 'reported_by'> | { id: string; reported_by?: string[] | null },
  userId: string | null | undefined,
  hiddenIds: readonly string[],
): boolean {
  if (hiddenIds.includes(reel.id)) return true;
  if (!userId || !Array.isArray(reel.reported_by)) return false;
  return reel.reported_by.includes(userId);
}

/**
 * @purpose Append `auth.uid()` onto `reels.reported_by` and set `is_flagged` via RPC.
 * @param reelId `reels.id` uuid.
 * @sideEffects `report_reel(target_reel_id)` (security definer). Seeded `hl-*` ids are no-ops.
 */
export async function reportReelRemote(reelId: string): Promise<void> {
  if (!isSupabaseConfigured || !isReelUuid(reelId)) return;
  const { error } = await supabase.rpc('report_reel', { target_reel_id: reelId });
  if (error) throw error;
}

/**
 * @purpose Flip a clip between the free public feed and Subscriber Vault (`reels.is_vault_only`).
 * @param reelId Uploaded `reels.id` uuid.
 * @param currentlyVault Current local vault flag used for the optimistic fallback.
 * @returns Next `is_vault_only` value.
 * @sideEffects `toggle_reel_vault_status` RPC; falls back to `reels` UPDATE when the RPC is missing (demo).
 */
export async function toggleReelVaultStatus(reelId: string, currentlyVault: boolean): Promise<boolean> {
  const nextVault = !currentlyVault;
  if (!isSupabaseConfigured || !isReelUuid(reelId)) return nextVault;

  const { data, error } = await supabase.rpc('toggle_reel_vault_status', { target_reel_id: reelId });
  if (!error && typeof data === 'boolean') return data;

  const { error: updateError } = await supabase
    .from('reels')
    .update({ is_vault_only: nextVault, is_exclusive: nextVault })
    .eq('id', reelId);

  if (updateError?.message.includes('is_vault_only')) {
    await supabase.from('reels').update({ is_exclusive: nextVault }).eq('id', reelId);
  }

  return nextVault;
}
