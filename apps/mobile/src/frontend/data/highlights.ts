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

export type ReelCategory = 'game_play' | 'train_like_me' | 'serve_like_me';

export const REEL_CATEGORY_GAME = 'game_play' as const;
export const REEL_CATEGORY_TRAIN = 'train_like_me' as const;
export const REEL_CATEGORY_SERVE = 'serve_like_me' as const;

/** Base Aura granted on a Highlights ⚡ double-tap. Serve Like Me multiplies this. */
export const DOUBLE_TAP_AURA_POINTS = 1;
export const SERVE_LIKE_ME_AURA_MULTIPLIER = 2;

export const REEL_CATEGORY_PILLS: { id: ReelCategory; label: string }[] = [
  { id: REEL_CATEGORY_GAME, label: '⚡ Game Play' },
  { id: REEL_CATEGORY_TRAIN, label: '💪 Train Like Me' },
  { id: REEL_CATEGORY_SERVE, label: '🤝 Serve Like Me (2x Aura Boost)' },
];

/**
 * @purpose Overlay Catalogs-desk labels onto the three shipping category ids. Unknown ids stay Game Play / Train / Serve.
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
 * @purpose Normalize `reels.category`. Missing / unknown values are Game Play.
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
 * @purpose Feed badge copy. Game Play has no extra chip (Seki plays live in the All / Seki switch).
 */
export function reelCategoryBadge(category?: ReelCategory | null): string | null {
  if (category === REEL_CATEGORY_SERVE) return SERVE_LIKE_ME_FEED_BADGE;
  if (category === REEL_CATEGORY_TRAIN) return TRAIN_LIKE_ME_FEED_BADGE;
  return null;
}

/**
 * @purpose True when a clip belongs on the Seki Highlights ⚡ switch (`sekiPlay` or 3+ Seki 🤙).
 */
export function isSekiHighlight(clip: Pick<HighlightClip, 'sekiPlay' | 'sekiCount'>): boolean {
  return Boolean(clip.sekiPlay) || (clip.sekiCount ?? 0) >= 3;
}

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
  /** `reels.category` — Game Play / Train Like Me / Serve Like Me. */
  category?: ReelCategory;
  /** `reels.flash_unlock_until` — Vault clip is playable until this instant. */
  flashUnlockUntil?: string | null;
  /** `reels.tag_status` — pending tags do not elect Player of the Week. */
  tagStatus?: 'pending' | 'confirmed' | 'rejected';
};

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

const SAMPLE = {
  blazes: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  escapes: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  fun: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  joyrides: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  meltdowns: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  bunny: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  elephants: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  subaru: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  bullrun: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
};

export const HIGHLIGHT_CLIPS: HighlightClip[] = [
  {
    id: 'hl-1',
    athleteName: 'Marcus Rivera',
    school: 'ALA Hawks',
    tag: 'Touchdown',
    sekiPlay: true,
    videoUrl: SAMPLE.blazes,
  },
  {
    id: 'hl-2',
    athleteName: 'Jordan Blake',
    school: 'ALA Hawks',
    tag: 'Breakaway',
    isVaultOnly: true,
    flashUnlockUntil: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    videoUrl: SAMPLE.escapes,
  },
  {
    id: 'hl-3',
    athleteName: 'Tyler Nguyen',
    school: 'Westlake',
    tag: 'One-handed grab',
    sekiPlay: true,
    category: 'train_like_me',
    videoUrl: SAMPLE.fun,
  },
  {
    id: 'hl-4',
    athleteName: 'Derek Sullivan',
    school: 'Lone Peak',
    tag: 'Sack',
    videoUrl: SAMPLE.joyrides,
  },
  {
    id: 'hl-5',
    athleteName: 'Andre Coleman',
    school: 'Skyridge',
    tag: 'Chase-down',
    category: 'serve_like_me',
    videoUrl: SAMPLE.meltdowns,
  },
];

const PROFILE_TAGGED_CLIPS: HighlightClip[] = [
  {
    id: 'hl-1b',
    athleteName: 'Marcus Rivera',
    school: 'ALA Hawks',
    tag: 'Scramble',
    videoUrl: SAMPLE.escapes,
  },
  {
    id: 'hl-1c',
    athleteName: 'Marcus Rivera',
    school: 'ALA Hawks',
    tag: 'Deep ball',
    sekiPlay: true,
    videoUrl: SAMPLE.fun,
  },
  {
    id: 'hl-1d',
    athleteName: 'Marcus Rivera',
    school: 'ALA Hawks',
    tag: 'Red-zone',
    videoUrl: SAMPLE.joyrides,
  },
  {
    id: 'hl-1e',
    athleteName: 'Marcus Rivera',
    school: 'ALA Hawks',
    tag: 'Two-point',
    videoUrl: SAMPLE.meltdowns,
  },
  {
    id: 'hl-1f',
    athleteName: 'Marcus Rivera',
    school: 'ALA Hawks',
    tag: 'Sideline',
    videoUrl: SAMPLE.bunny,
  },
  {
    id: 'hl-1g',
    athleteName: 'Marcus Rivera',
    school: 'ALA Hawks',
    tag: 'Q4 drive',
    sekiPlay: true,
    videoUrl: SAMPLE.elephants,
  },
  {
    id: 'hl-1h',
    athleteName: 'Marcus Rivera',
    school: 'ALA Hawks',
    tag: 'Walk-off',
    videoUrl: SAMPLE.subaru,
  },
  {
    id: 'hl-1i',
    athleteName: 'Marcus Rivera',
    school: 'ALA Hawks',
    tag: 'Rollout',
    videoUrl: SAMPLE.bullrun,
  },
];

export function taggedReelsForAthlete(athleteName: string, school?: string): HighlightClip[] {
  const name = athleteName.trim().toLowerCase();
  const catalog = [...HIGHLIGHT_CLIPS, ...PROFILE_TAGGED_CLIPS];
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
