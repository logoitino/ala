/**
 * Highlights data layer: fetch the feed (tiered ranking) and one athlete's clips, hype votes (`bumpReelHype` /
 * `clearReelHype`), donation totals on a clip, hiding a clip locally, reporting and Vault toggling, playback URL
 * resolution (including Vault signing), deep links, and the "Filmed by" credit. Also pure helpers for the owner-peek drag.
 * Photo stories (PHOTO_STORIES_DESIGN.md) come through the same feed rows with `media_type = 'photo_story'`; their
 * photos are fetched separately (`lib/photoStories.ts`, `hooks/useStoryPhotos.ts`).
 * Screens call this, not Supabase. Uploading a clip is `services/MediaUploadService` plus `UploadVideoModal`.
 * @sideEffects `reels`, `reel_hype_votes` and related RPCs; AsyncStorage for local hides and the peek hint.
 */

import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ReportReasonId } from '@/data/contentRights';
import { parseReelCategory, type HighlightClip, type HighlightMediaType, type ReelCategory } from '@/data/highlights';
import type { PlayReactionId } from '@/data/players';
import { storyPhotoPublicUrl } from '@/lib/photoStories';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { REEL_VAULT_BUCKET, REEL_VAULT_PREFIX, uploadHighlight } from '@/services/MediaUploadService';
import type { Player, Reel, ReelWithPlayer } from '@/types/database';

export const HIGHLIGHTS_BUCKET = 'game_highlights';

export type UploadSekiPlayInput = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  title: string;
  playerId: string;
  /** Optional — a Highlight does not need to be linked to a specific live matchup. */
  gameId?: string | null;
  /** Persist `reels.is_vault_only` / `is_exclusive`. Default false = free public feed. */
  isExclusive?: boolean;
  /** Persist `reels.category`. Default Game Day (`game_play`). */
  category?: ReelCategory;
  /** True when `HighlightPickerModal` already ran `Video.compress`. */
  compressed?: boolean;
  onProgress?: (value: number) => void;
  onStatus?: (message: string) => void;
};

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

/**
 * @purpose "Filmed by" name for a fan-posted clip. Null when the athlete posted it themself, when the
 *   uploader is unknown, or before the credit migration is applied.
 */
export function filmerCredit(reel: Reel, player: Player | null): string | null {
  const name = reel.uploader_name?.trim();
  if (!name || !reel.uploaded_by) return null;
  const athlete = player?.name?.trim().toLowerCase();
  if (athlete && (athlete === name.toLowerCase() || athlete.split(/\s+/)[0] === name.toLowerCase())) return null;
  return name;
}

/**
 * Photo-story columns on `reels_feed` (migration 20261007230000). Declared here as optional so this file
 * reads them safely whether or not `types/database.ts` has caught up; absent on every older tier.
 * The database stores a Storage path (`cover_path`), never a URL; the client builds the URL.
 */
type ReelMediaColumns = {
  media_type?: string | null;
  photo_count?: number | null;
  cover_path?: string | null;
};

/**
 * @purpose Normalize the media columns of a feed row. Missing / unknown `media_type` is video, so
 *   rows from before the photo-story SQL (and every fallback tier) behave exactly as they did.
 */
export function reelMedia(reel: Reel): { mediaType: HighlightMediaType; photoCount: number; coverUrl: string | null } {
  const row = reel as Reel & ReelMediaColumns;
  const mediaType: HighlightMediaType = row.media_type === 'photo_story' ? 'photo_story' : 'video';
  const count = Number(row.photo_count);
  return {
    mediaType,
    photoCount: Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0,
    coverUrl: storyPhotoPublicUrl(row.cover_path),
  };
}

/**
 * @purpose True when a feed row belongs in Highlights lists and profile grids. Videos need a playable
 *   URL; photo stories need at least one published photo (`photo_count` 0 = upload failed or the photo
 *   list was never saved, so there is nothing to show). Removed clips never list.
 */
export function isListableReel(reel: Reel): boolean {
  if (reel.is_removed === true) return false;
  const media = reelMedia(reel);
  if (media.mediaType === 'photo_story') return media.photoCount > 0;
  return Boolean(reel.video_url);
}

export function reelToClip(reel: Reel, player: Player | null): HighlightClip {
  const hype = hypeFromReel(reel);
  const media = reelMedia(reel);
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
    uploadedBy: reel.uploaded_by ?? null,
    viewCount: typeof reel.view_count === 'number' ? Math.max(0, reel.view_count) : undefined,
    filmedBy: filmerCredit(reel, player),
    mediaType: media.mediaType,
    photoCount: media.mediaType === 'photo_story' ? media.photoCount : undefined,
    coverUrl: media.mediaType === 'photo_story' ? media.coverUrl : undefined,
  };
}

/** -1 = panel slid in from the right (fan swiped left), 1 = from the left, 0 = closed. */
export type PeekSide = -1 | 0 | 1;

/** Fraction of the page width a drag must cover to open the owner peek. */
export const PEEK_OPEN_RATIO = 0.24;
/** Fraction of the page width a drag must cover to close an open peek. */
export const PEEK_CLOSE_RATIO = 0.16;
/** px/s fling that opens or closes regardless of distance. */
export const PEEK_FLING_VELOCITY = 650;

/**
 * @purpose Decide where the Reel owner peek settles after a horizontal drag (pure, worklet-safe).
 * @param translationX Finger travel since the drag began (negative = left).
 * @param velocityX Release velocity in px/s.
 * @param width Page width.
 * @param open Side that was open when the drag began.
 * @returns The side to snap to. A closed reel opens toward the drag; an open panel closes on the opposite drag and never flips straight to the other side.
 */
export function resolvePeekSnap(translationX: number, velocityX: number, width: number, open: PeekSide): PeekSide {
  'worklet';
  const span = Math.max(1, width);
  if (open === 0) {
    if (translationX <= -span * PEEK_OPEN_RATIO || velocityX <= -PEEK_FLING_VELOCITY) return -1;
    if (translationX >= span * PEEK_OPEN_RATIO || velocityX >= PEEK_FLING_VELOCITY) return 1;
    return 0;
  }
  // Open from the right (video pushed left): dragging right closes.
  if (open === -1) {
    return translationX >= span * PEEK_CLOSE_RATIO || velocityX >= PEEK_FLING_VELOCITY ? 0 : -1;
  }
  return translationX <= -span * PEEK_CLOSE_RATIO || velocityX <= -PEEK_FLING_VELOCITY ? 0 : 1;
}

/**
 * @purpose Clamp the live peek offset while dragging: full travel up to the panel width, then rubber-band.
 * @param base Offset when the drag started (`side * panelWidth`).
 * @param translationX Finger travel.
 * @param panelWidth Panel width in px.
 * @returns Offset in px for the panel / video shift.
 */
/**
 * @purpose Width of the Reel owner panel. Leaves an equal close-strip on a phone and caps the card on a wide browser.
 * @param pageWidth Pager page width in px.
 * @returns Panel width in px. `0` when the page has not been measured.
 */
export function peekPanelWidth(pageWidth: number): number {
  'worklet';
  if (pageWidth <= 0) return 0;
  const capped = Math.min(pageWidth * 0.84, 420);
  const reveal = Math.max(40, Math.round(pageWidth * 0.12));
  return Math.max(0, Math.round(Math.min(capped, pageWidth - reveal)));
}

export function clampPeekOffset(base: number, translationX: number, panelWidth: number): number {
  'worklet';
  const raw = base + translationX;
  const limit = Math.max(1, panelWidth);
  if (raw > limit) return limit + (raw - limit) * 0.18;
  if (raw < -limit) return -limit + (raw + limit) * 0.18;
  return raw;
}

const PEEK_HINT_KEY = 'tapuai.reelPeekHint';

/**
 * @purpose True once the fan has opened the owner peek at least once (hides the swipe hint).
 * @sideEffects AsyncStorage `tapuai.reelPeekHint`.
 */
export async function readPeekHintSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PEEK_HINT_KEY)) === '1';
  } catch {
    return false;
  }
}

/**
 * @purpose Remember that the swipe hint has done its job.
 * @sideEffects AsyncStorage `tapuai.reelPeekHint`.
 */
export async function markPeekHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(PEEK_HINT_KEY, '1');
  } catch {
    // Storage unavailable (web private mode) — the hint just shows again next launch.
  }
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
/** Views + filmer credit (migration 20260929160000). Falls back to the tag tier until applied. */
const REEL_COLUMNS_CREDIT = `${REEL_COLUMNS_TAG}, view_count, uploader_name, uploader_avatar_url`;
/** Photo stories (migration 20261007230000). Falls back to the credit tier until applied; those rows are all video. */
const REEL_COLUMNS_MEDIA = `${REEL_COLUMNS_CREDIT}, media_type, photo_count, cover_path`;
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

/**
 * @purpose Turn a Vault storage token into a one-hour signed URL. Public https URLs pass through.
 * @param videoUrl `reels.video_url` from `reels_feed` (`reelvault:{path}` or a public URL).
 * @returns Playable URL, or '' when the caller is not allowed to read the private object.
 * @sideEffects Storage `createSignedUrl` on `reel_vault` when the value is a vault token.
 */
export async function resolvePlaybackUrl(videoUrl: string | null | undefined): Promise<string> {
  const raw = videoUrl?.trim() ?? '';
  if (!raw.startsWith(REEL_VAULT_PREFIX)) return raw;
  if (!isSupabaseConfigured) return '';
  const path = raw.slice(REEL_VAULT_PREFIX.length);
  const { data, error } = await supabase.storage.from(REEL_VAULT_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return '';
  return data.signedUrl;
}

async function withPlaybackUrls(rows: ReelWithPlayer[]): Promise<ReelWithPlayer[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      video_url: await resolvePlaybackUrl(row.video_url),
    })),
  );
}

async function selectReels(columns: string, playerId?: string) {
  // 2026-09 audit (paywall bypass): reads go through `reels_feed`, not the base `reels` table —
  // the view nulls `video_url` for Vault/Exclusive/Flash-Unlock clips the caller isn't entitled to
  // instead of trusting the `is_vault_only`/`is_exclusive` filters below to double as access control.
  const ordered = supabase.from('reels_feed').select(columns).order('created_at', { ascending: false });
  return playerId ? ordered.eq('player_id', playerId) : ordered;
}

function rowsFromQuery<T>(data: unknown): T[] {
  if (!Array.isArray(data)) return [];
  return data as unknown as T[];
}

async function playable(rows: ReelWithPlayer[]): Promise<ReelWithPlayer[]> {
  // Photo stories carry `video_url = ''` by design, so they skip the playback-URL check; a Vault
  // signing failure still drops a video the caller cannot play.
  return (await withPlaybackUrls(rows)).filter(isListableReel);
}

async function queryReels(playerId?: string): Promise<ReelWithPlayer[]> {
  const media = await selectReels(`${REEL_COLUMNS_MEDIA}, players (${PLAYER_SELECT})`, playerId);
  if (!media.error) {
    return playable(rowsFromQuery<ReelWithPlayer>(media.data).filter(isListableReel));
  }

  const credited = await selectReels(`${REEL_COLUMNS_CREDIT}, players (${PLAYER_SELECT})`, playerId);
  if (!credited.error) {
    return playable(
      rowsFromQuery<ReelWithPlayer>(credited.data).filter(
        (row) => Boolean(row.video_url) && row.is_removed !== true,
      ),
    );
  }

  const tagged = await selectReels(`${REEL_COLUMNS_TAG}, players (${PLAYER_SELECT})`, playerId);
  if (!tagged.error) {
    return playable(
      rowsFromQuery<ReelWithPlayer>(tagged.data).filter(
        (row) => Boolean(row.video_url) && row.is_removed !== true,
      ),
    );
  }

  const live = await selectReels(`${REEL_COLUMNS_REMOVED}, players (${PLAYER_SELECT})`, playerId);
  if (!live.error) {
    return playable(
      rowsFromQuery<ReelWithPlayer>(live.data).filter(
        (row) => Boolean(row.video_url) && row.is_removed !== true,
      ),
    );
  }

  const flashed = await selectReels(`${REEL_COLUMNS_FLASH}, players (${PLAYER_SELECT})`, playerId);
  if (!flashed.error) {
    return playable(rowsFromQuery<ReelWithPlayer>(flashed.data).filter((row) => Boolean(row.video_url)));
  }

  const categorized = await selectReels(`${REEL_COLUMNS_CATEGORY}, players (${PLAYER_SELECT})`, playerId);
  if (!categorized.error) {
    return playable(rowsFromQuery<ReelWithPlayer>(categorized.data).filter((row) => Boolean(row.video_url)));
  }

  const vaulted = await selectReels(`${REEL_COLUMNS_VAULT}, players (${PLAYER_SELECT})`, playerId);
  if (!vaulted.error) {
    return playable(rowsFromQuery<ReelWithPlayer>(vaulted.data).filter((row) => Boolean(row.video_url)));
  }

  const moderated = await selectReels(`${REEL_COLUMNS_MODERATION}, players (${PLAYER_SELECT})`, playerId);
  if (!moderated.error) {
    return playable(rowsFromQuery<ReelWithPlayer>(moderated.data).filter((row) => Boolean(row.video_url)));
  }

  const exclusiveWithPlayers = await selectReels(`${REEL_COLUMNS_EXCLUSIVE}, players (${PLAYER_SELECT})`, playerId);
  if (!exclusiveWithPlayers.error) {
    return playable(
      rowsFromQuery<ReelWithPlayer>(exclusiveWithPlayers.data).filter((row) => Boolean(row.video_url)),
    );
  }

  const selectWithPlayers = `${REEL_COLUMNS}, players (${PLAYER_SELECT})`;
  const withPlayers = await selectReels(selectWithPlayers, playerId);
  if (!withPlayers.error) {
    return playable(rowsFromQuery<ReelWithPlayer>(withPlayers.data).filter((row) => Boolean(row.video_url)));
  }

  const exclusiveOnly = await selectReels(REEL_COLUMNS_EXCLUSIVE, playerId);
  if (!exclusiveOnly.error) {
    return playable(
      rowsFromQuery<Reel>(exclusiveOnly.data)
        .filter((row) => Boolean(row.video_url))
        .map((row) => ({ ...row, players: null })),
    );
  }

  const fallback = await selectReels(REEL_COLUMNS, playerId);
  if (!fallback.error) {
    return playable(
      rowsFromQuery<Reel>(fallback.data)
        .filter((row) => Boolean(row.video_url))
        .map((row) => ({ ...row, players: null })),
    );
  }

  const basicResult = await selectReels(REEL_COLUMNS_BASIC, playerId);
  if (basicResult.error) throw new Error(basicResult.error.message);
  return playable(
    rowsFromQuery<Reel>(basicResult.data)
      .filter((row) => Boolean(row.video_url))
      .map((row) => ({ ...row, players: null })),
  );
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
 * @returns Server row when the RPC lands; duplicate votes (or an RPC error) return the unchanged counts.
 * @sideEffects `increment_reel_hype` RPC (inserts `reel_hype_votes` for `auth.uid()`).
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

  if (error) {
    // 2026-09 audit (reels RLS tightening): `increment_reel_hype` is the source of truth for hype
    // counters — it also dedupes one tap per signed-in fan via `reel_hype_votes`. A raw client
    // `reels` UPDATE fallback would let anyone spam these counts with no dedupe at all, so hype
    // counters no longer have a raw-UPDATE grant and there is nothing safe to fall back to here.
    return current;
  }

  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const applied = row?.applied !== false;
  return parseReelHype(data, applied ? optimistic : current);
}

/**
 * @purpose Take back this fan's Seki / Aura / Flex on a Highlight (`clear_reel_hype`).
 * @param reelId Target `reels.id`.
 * @param kind Chip the fan tapped again.
 * @param current Counts before the undo, used when the server has no vote to remove.
 * @returns Server row when a vote was deleted; `current` when nothing changed.
 * @sideEffects `clear_reel_hype` RPC (deletes `reel_hype_votes` for `auth.uid()` and steps the counter down).
 */
export async function clearReelHype(reelId: string, kind: PlayReactionId, current: ReelHype): Promise<ReelHype> {
  const optimistic: ReelHype = {
    ...current,
    seki_count: kind === 'seki' ? Math.max(0, current.seki_count - 1) : current.seki_count,
    aura_count: kind === 'aura' ? Math.max(0, current.aura_count - 1) : current.aura_count,
    flex_count: kind === 'flex' ? Math.max(0, current.flex_count - 1) : current.flex_count,
  };

  if (!isSupabaseConfigured || !isReelUuid(reelId)) return optimistic;

  const { data, error } = await supabase.rpc('clear_reel_hype', {
    target_reel_id: reelId,
    hype_kind: kind,
  });

  if (error) return current;

  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const applied = row?.applied !== false;
  return parseReelHype(data, applied ? optimistic : current);
}

/**
 * @purpose Bump a Reel's displayed running Mālo total after a tip is recorded (`increment_reel_tips`).
 * @param reelId Target `reels.id`.
 * @param addCents Tip amount already recorded in the `tips` ledger.
 * @param current Local counts used as the optimistic fallback.
 * @returns Server total when the RPC lands; the pre-tap total if the RPC errors.
 * @sideEffects `increment_reel_tips` RPC.
 */
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

  // 2026-09 audit (reels RLS tightening): `total_tips_cents` is a displayed aggregate, not the
  // ledger of record (that's `tips`, already inserted by the time this runs) — but it no longer has
  // a raw-UPDATE grant either way, so a failed RPC just leaves the clip's running total unchanged
  // rather than trusting a client-computed amount.
  return current;
}

/**
 * @purpose Upload a Seki clip: compress, Storage `reels/{user_id}/{timestamp}.mp4` (fallback `game_highlights`), insert `public.reels`.
 * @param input Local video URI, caption, tagged player/game, optional `isExclusive` / `category` / `compressed`.
 * @returns The inserted reel, including vault flags and category. Default is public Game Day.
 * @sideEffects `MediaUploadService.uploadHighlight`.
 */
export async function uploadSekiPlay(input: UploadSekiPlayInput): Promise<Reel> {
  return uploadHighlight(input);
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
 * @purpose Record a report reason and hide the clip from the public feed when the reason
 * is fake footage, impersonation, or music/logo/broadcast, when the athlete or guardian reports it,
 * or after three separate accounts report it.
 * @param reelId `reels.id` uuid.
 * @param reason Report reason. Older databases that only have the one-argument RPC store it as unspecified.
 * @sideEffects `report_reel(target_reel_id, report_reason)` (security definer). Seeded `hl-*` ids are no-ops.
 */
export async function reportReelRemote(reelId: string, reason: ReportReasonId = 'unspecified'): Promise<void> {
  if (!isSupabaseConfigured || !isReelUuid(reelId)) return;
  const withReason = await supabase.rpc('report_reel', {
    target_reel_id: reelId,
    report_reason: reason,
  });
  if (!withReason.error) return;
  const message = withReason.error.message ?? '';
  if (!/report_reason|Could not find the function|PGRST202/i.test(message)) throw withReason.error;
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
  } else if (updateError) {
    // e.g. reels_photo_story_public_check: a photo story can never be Vault. Surface it instead of
    // reporting a flip that did not happen.
    throw new Error(
      /photo_story_public/i.test(updateError.message)
        ? 'Photo stories stay on the free public feed.'
        : updateError.message || 'Could not change Vault status.',
    );
  }

  return nextVault;
}
