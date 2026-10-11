/**
 * Highlights ⚡ shared vocabulary: nav/tab labels, the three categories (Game Day / Train Like Me /
 * Serve Like Me), the `HighlightClip` shape every feed and grid renders (videos and photo stories —
 * PHOTO_STORIES_DESIGN.md), and pure ranking helpers for the Home feed. No network or React here.
 */

/** Fan-bar label (space is tight; ⚡ lives on profile pills and publish). */
export const HIGHLIGHT_NAV_LABEL = 'Home';

/** Fan-bar label for Player of the Week / Month / Year board. */
export const SPOTLIGHT_NAV_LABEL = 'Spotlight';

/** Profile hub pill — Highlights ⚡ */
export const HIGHLIGHT_TAB_LABEL = 'Highlights ⚡';

export const STATS_TAB_LABEL = 'Stats 📊';

export const VAULT_TAB_LABEL = 'Vault 🔒';

export const HIGHLIGHT_PUBLISH_LABEL = 'Publish Highlight ⚡';

/** Highlights ⚡ feed switch — personalized For You mix. */
export const HIGHLIGHT_FEED_HOME = 'Home';

/** Highlights ⚡ feed switch — every clip. */
export const HIGHLIGHT_FEED_ALL = 'All';

/** Highlights ⚡ feed switch — Seki-tagged plays only. */
export const HIGHLIGHT_FEED_SEKI = 'Seki';

export type HighlightFeedFilter = 'home' | 'all' | 'seki';

/** Stored `reels.category`. The Game Day label (owner rename 2026-10-07) keeps id `game_play`. */
export type ReelCategory = 'game_play' | 'train_like_me' | 'serve_like_me';

export const REEL_CATEGORY_GAME = 'game_play' as const;
export const REEL_CATEGORY_TRAIN = 'train_like_me' as const;
export const REEL_CATEGORY_SERVE = 'serve_like_me' as const;

/** Base Aura granted on a Highlights ⚡ double-tap. Serve Like Me multiplies this. */
export const DOUBLE_TAP_AURA_POINTS = 1;
export const SERVE_LIKE_ME_AURA_MULTIPLIER = 2;

export const REEL_CATEGORY_PILLS: { id: ReelCategory; label: string }[] = [
  { id: REEL_CATEGORY_GAME, label: '⚡ Game Day' },
  { id: REEL_CATEGORY_TRAIN, label: '💪 Train Like Me' },
  { id: REEL_CATEGORY_SERVE, label: '🤝 Serve Like Me (2x Aura Boost)' },
];

/**
 * @purpose Overlay Catalogs-desk labels onto the three shipping category ids. Unknown ids stay Game Day / Train / Serve.
 */
export function labeledReelCategories(
  rows?: { id: string; label: string }[] | null,
): { id: ReelCategory; label: string }[] {
  return REEL_CATEGORY_PILLS.map((pill) => ({
    ...pill,
    label: rows?.find((row) => row.id === pill.id)?.label?.trim() || pill.label,
  }));
}

export const SERVE_LIKE_ME_BOOST_LABEL = 'Community Impact Boost ⚡';
export const SERVE_LIKE_ME_FEED_BADGE = '🤝 SERVE LIKE ME • 2x AURA';
export const TRAIN_LIKE_ME_FEED_BADGE = '💪 TRAIN LIKE ME';

/**
 * @purpose Normalize `reels.category`. Missing / unknown values are Game Day (`game_play`).
 */
export function parseReelCategory(value: unknown): ReelCategory {
  if (value === REEL_CATEGORY_TRAIN || value === REEL_CATEGORY_SERVE) return value;
  return REEL_CATEGORY_GAME;
}

/**
 * @purpose Double-tap Aura for a clip. Serve Like Me grants 2× the base point.
 */
export function doubleTapAuraForCategory(category?: ReelCategory | null): number {
  const base = DOUBLE_TAP_AURA_POINTS;
  return category === REEL_CATEGORY_SERVE ? base * SERVE_LIKE_ME_AURA_MULTIPLIER : base;
}

/**
 * @purpose Feed badge copy. Game Day has no extra chip (Seki plays live in the All / Seki switch).
 */
export function reelCategoryBadge(category?: ReelCategory | null): string | null {
  if (category === REEL_CATEGORY_SERVE) return SERVE_LIKE_ME_FEED_BADGE;
  if (category === REEL_CATEGORY_TRAIN) return TRAIN_LIKE_ME_FEED_BADGE;
  return null;
}

/** Seki taps that move a clip onto the Seki pill. The story line uses the same bar. */
export const SEKI_PILL_COUNT = 3;

/**
 * @purpose True when a clip belongs on the Seki Highlights ⚡ switch (`sekiPlay` or 3+ Seki 🤙).
 */
export function isSekiHighlight(clip: Pick<HighlightClip, 'sekiPlay' | 'sekiCount'>): boolean {
  return Boolean(clip.sekiPlay) || (clip.sekiCount ?? 0) >= SEKI_PILL_COUNT;
}

/** `reels.media_type` — pre-migration rows and missing columns are `video`. */
export type HighlightMediaType = 'video' | 'photo_story';

/** Most photos one story can hold (the `set_reel_photos` RPC enforces the same cap). */
export const PHOTO_STORY_MAX_PHOTOS = 10;

/** Longest optional per-photo description, in characters (`reel_photos.description` CHECK). */
export const PHOTO_DESCRIPTION_MAX = 200;

/** One photo in a story, from `reel_photos_feed`, ordered by `position` (0-based). */
export type StoryPhoto = {
  id: string;
  position: number;
  imageUrl: string;
  description: string | null;
  width?: number | null;
  height?: number | null;
};

export type HighlightClip = {
  id: string;
  athleteName: string;
  school: string;
  tag: string;
  videoUrl: string;
  sekiPlay?: boolean;
  exclusive?: boolean;
  /** `reels.is_vault_only` — default false (free public feed). */
  isVaultOnly?: boolean;
  playerId?: string | null;
  gameId?: string | null;
  sekiCount?: number;
  auraCount?: number;
  flexCount?: number;
  totalTipsCents?: number;
  /** `reels.created_at` — newest first in profile / athlete grids. */
  createdAt?: string;
  /** `reels.category` — Game Day / Train Like Me / Serve Like Me. */
  category?: ReelCategory;
  /** `reels.flash_unlock_until` — Vault clip is playable until this instant. */
  flashUnlockUntil?: string | null;
  /** `reels.tag_status` — pending tags do not elect Player of the Week. */
  tagStatus?: 'pending' | 'confirmed' | 'rejected';
  /** `reels.uploaded_by` — fan who posted the clip (may differ from the tagged athlete). */
  uploadedBy?: string | null;
  /** `reels.view_count` via `reels_feed` — counted views (see `VIEW_PLAY_MS`). Undefined until the SQL is applied. */
  viewCount?: number;
  /** Fan who filmed and posted the clip, when that is not the athlete (`reels_feed.uploader_name`). */
  filmedBy?: string | null;
  /** `reels_feed.media_type` — undefined means video (column missing before the photo-story SQL). */
  mediaType?: HighlightMediaType;
  /** `reels_feed.photo_count` — photos in a story; 0 means the story never finished publishing. */
  photoCount?: number;
  /** `reels_feed.cover_path` — position-0 photo, used for grid posters and as the feed fallback. */
  coverUrl?: string | null;
};

/**
 * @purpose True when the clip is a photo story rather than a video (render photos, never a player).
 */
export function isPhotoStory(clip: Pick<HighlightClip, 'mediaType'>): boolean {
  return clip.mediaType === 'photo_story';
}

export type HomeFeedContext = {
  crewIds: Set<string>;
  school?: string;
};

/**
 * @purpose Rank Home / For You: Crew you follow, your school, Serve Like Me, energy, freshness.
 * @param clips Current Highlights rows.
 * @param context Viewer Crew ids + school name from `profiles.team`.
 * @returns A new array, highest score first. Ties keep a stable id order.
 */
export function rankHomeFeed<T extends { clip: HighlightClip; player?: { id?: string; school_name?: string } | null }>(
  clips: T[],
  context: HomeFeedContext,
): T[] {
  const school = (context.school ?? '').trim().toLowerCase();
  const scored = clips.map((item, index) => {
    const clip = item.clip;
    const playerId = item.player?.id ?? clip.playerId ?? '';
    let score = 0;
    if (playerId && context.crewIds.has(playerId)) score += 90;
    const clipSchool = (item.player?.school_name || clip.school || '').trim().toLowerCase();
    if (school && clipSchool && (clipSchool.includes(school) || school.includes(clipSchool))) score += 45;
    if (clip.category === REEL_CATEGORY_SERVE) score += 28;
    if (clip.sekiPlay || (clip.sekiCount ?? 0) >= 3) score += 16;
    if (clip.flashUnlockUntil) score += 22;
    score += Math.min(32, ((clip.sekiCount ?? 0) + (clip.auraCount ?? 0) + (clip.flexCount ?? 0)) * 2);
    if (clip.createdAt) {
      const ageH = Math.max(0, (Date.now() - Date.parse(clip.createdAt)) / 3_600_000);
      if (Number.isFinite(ageH)) score += Math.max(0, 18 - ageH);
    }
    return { item, score, index };
  });
  scored.sort((left, right) => right.score - left.score || left.index - right.index);
  return scored.map((row) => row.item);
}

/**
 * @purpose Re-apply a feed order that was ranked earlier to fresh clip objects. Home ranking and the
 *   Seki filter both read hype counts, so re-ranking on every Seki / Aura / Flex tap moved the clip the
 *   fan was watching and slid a different video under their finger (the flicker, and the un-tap
 *   landing on the wrong clip). Rank once per list change; hype taps only refresh the objects.
 * @param orderedIds Clip ids in the order last ranked.
 * @param clips Current rows (new counts). Ids missing here (hidden, deleted) are dropped.
 * @returns Rows in `orderedIds` order.
 */
export function pinFeedOrder<T extends { clip: { id: string } }>(orderedIds: readonly string[], clips: readonly T[]): T[] {
  const byId = new Map(clips.map((item) => [item.clip.id, item]));
  const out: T[] = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item) out.push(item);
  }
  return out;
}

// 2026-09 fix: these used to point at Google's public `commondatastorage.googleapis.com` sample
// video bucket, which now rejects every request with a permission error. Combined with a Home feed
// bug (see ReelCard.tsx) that loaded every mounted card's video eagerly, several dead URLs failing
// at once contributed to real-device freezes. `videoUrl: ''` is a real "no video" value `ReelCard`
// already handles (`clip.videoUrl || null` — see its `videoSource`), so these entries keep serving
// their non-video purpose (Home feed filler metadata, `demoSpotlightAward`'s Westlake fallback in
// lib/spotlight.ts) without ever touching the video decoder.
export const HIGHLIGHT_CLIPS: HighlightClip[] = [
  {
    id: 'hl-1',
    athleteName: 'Marcus Rivera',
    school: 'ALA Hawks',
    tag: 'Touchdown',
    sekiPlay: true,
    videoUrl: '',
  },
  {
    id: 'hl-2',
    athleteName: 'Jordan Blake',
    school: 'ALA Hawks',
    tag: 'Breakaway',
    isVaultOnly: true,
    flashUnlockUntil: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    videoUrl: '',
  },
  {
    id: 'hl-3',
    athleteName: 'Tyler Nguyen',
    school: 'Westlake',
    tag: 'One-handed grab',
    sekiPlay: true,
    category: 'train_like_me',
    videoUrl: '',
  },
  {
    id: 'hl-4',
    athleteName: 'Derek Sullivan',
    school: 'Lone Peak',
    tag: 'Sack',
    videoUrl: '',
  },
  {
    id: 'hl-5',
    athleteName: 'Andre Coleman',
    school: 'Skyridge',
    tag: 'Chase-down',
    category: 'serve_like_me',
    videoUrl: '',
  },
];

export function taggedReelsForAthlete(athleteName: string, school?: string): HighlightClip[] {
  const name = athleteName.trim().toLowerCase();
  const catalog = HIGHLIGHT_CLIPS;
  const tagged = catalog.filter((clip) => clip.athleteName.toLowerCase() === name);
  if (tagged.length >= 6) return tagged;

  const schoolNeedle = (school ?? '').trim().toLowerCase();
  const schoolmates = catalog.filter(
    (clip) =>
      clip.athleteName.toLowerCase() !== name &&
      Boolean(schoolNeedle) &&
      clip.school.toLowerCase().includes(schoolNeedle),
  );

  return [...tagged, ...schoolmates];
}
