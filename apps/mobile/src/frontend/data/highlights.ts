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

/** Highlights ⚡ feed switch — Train Like Me + Serve Like Me clips (owner 2026-10-16: Beyond moves to the Home bar). */
export const HIGHLIGHT_FEED_BEYOND = 'Beyond';

export type HighlightFeedFilter = 'home' | 'beyond' | 'all' | 'seki';

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

/**
 * @purpose True when a clip belongs on the Beyond Highlights ⚡ switch: an athlete's workout or service clip.
 * Fan posts without an athlete live on the Beyond the Game page, not in this feed.
 */
export function isBeyondHighlight(clip: Pick<HighlightClip, 'category'>): boolean {
  return clip.category === REEL_CATEGORY_TRAIN || clip.category === REEL_CATEGORY_SERVE;
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
  /** Recorded `reels.sport`; null/undefined history stays only in All and is never inferred. */
  sport?: string | null;
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
  /** `reels.safety_label`. Undefined until the column is on this database. True shows the Coach-level badge. */
  coachLevel?: boolean;
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
  /** Phase 1 explicit picks. When omitted or personalization off, pick bonuses are skipped. */
  prefs?: UserFeedPrefs | null;
  /** Phase 2 implicit signals — only applied when `feedImplicitSignalsEnabled()`. */
  implicit?: ImplicitFeedSignals | null;
  /** Clock for decay math / Phase 0 (tests inject a fixed now). */
  nowMs?: number;
};

/** Category lean on the pick screen. `all` adds no category bonus. */
export type FeedCategoryLean = 'all' | ReelCategory;

/**
 * Explicit Highlights picks (Phase 1). Stored in `user_feed_prefs` for signed-in owners only.
 * Guests never load this shape.
 */
export type UserFeedPrefs = {
  sports: string[];
  schools: string[];
  categoryPref: FeedCategoryLean;
  personalizationOn: boolean;
};

/** On-device / session signals for Phase 2 (no new tracking table). */
export type ImplicitFeedSignals = {
  /** Completed views this device recorded (athlete/school/sport + time). */
  views: FeedSignalTouch[];
  /** Saved clips (same shape). */
  saves: FeedSignalTouch[];
  /** Athlete ids demoted after 2+ hides (until epoch ms). */
  demotedAthletes: ReadonlyMap<string, number>;
  /** Clip ids the viewer already watched to completion. */
  completedClipIds: ReadonlySet<string>;
};

export type FeedSignalTouch = {
  athleteId?: string | null;
  school?: string | null;
  sport?: string | null;
  atMs: number;
};

export type FeedReasonCode = 'crew' | 'sport' | 'school' | 'category' | 'fresh' | 'serve';

export type RankedFeedItem<T> = {
  item: T;
  score: number;
  reasons: FeedReasonCode[];
};

export type HomeFeedMeasureReport = {
  sampleSize: number;
  top20: number;
  top3AthleteShare: number | null;
  top2SchoolShare: number | null;
  olderThan48hShare: number | null;
  zeroHypeShare: number | null;
  crewInFirst5: number | null;
  note: string;
};

const SCHOOL_SCORE_CAP = 60;
const VIEW_DECAY_MS = 14 * 24 * 3_600_000;
const SEEN_PENALTY_MS = 7 * 24 * 3_600_000;
const IMPLICIT_VIEW_BONUS = 8;
const IMPLICIT_SAVE_BONUS = 15;
const SEEN_PENALTY = 20;
const HIDE_DEMOTE = 50;

/**
 * @purpose Phase 2 / 3 gate. Defaults OFF until counsel clears §7 of the interest-feed prompt.
 * Never enable in production builds without that written clearance.
 */
export function feedImplicitSignalsEnabled(
  env: string | undefined = process.env.EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS,
): boolean {
  return env === '1' || env === 'true';
}

function schoolMatches(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}

function sportMatches(clipSport: string | null | undefined, picks: readonly string[]): boolean {
  const sport = (clipSport ?? '').trim().toLowerCase();
  if (!sport) return false;
  return picks.some((pick) => pick.trim().toLowerCase() === sport);
}

function decayWeight(atMs: number, nowMs: number, windowMs: number): number {
  const age = nowMs - atMs;
  if (age < 0 || age >= windowMs) return 0;
  return 1 - age / windowMs;
}

function newestFirst<T extends { clip: HighlightClip }>(clips: readonly T[]): T[] {
  return [...clips].sort((left, right) => {
    const leftAt = Date.parse(left.clip.createdAt ?? '') || 0;
    const rightAt = Date.parse(right.clip.createdAt ?? '') || 0;
    if (rightAt !== leftAt) return rightAt - leftAt;
    return left.clip.id.localeCompare(right.clip.id);
  });
}

/**
 * @purpose One-line "Why this clip" copy. Never includes a score number. Guests get null upstream.
 * Joins up to two reasons with " • " (e.g. "Your school • Fresh").
 */
export function whyThisClipLine(
  reasons: readonly FeedReasonCode[],
  detail?: { athleteName?: string; sport?: string | null; school?: string | null },
): string | null {
  if (!reasons.length) return null;
  const parts: string[] = [];
  for (const code of reasons) {
    if (parts.length >= 2) break;
    if (code === 'crew') {
      const who = detail?.athleteName?.trim();
      parts.push(who ? `Because you follow ${who}` : 'Because you follow this athlete');
    } else if (code === 'sport') {
      const sport = detail?.sport?.trim();
      parts.push(sport ? `You picked ${sport}` : 'You picked this sport');
    } else if (code === 'school') {
      parts.push('Your school');
    } else if (code === 'category') {
      parts.push('Matches your Highlights lean');
    } else if (code === 'fresh') {
      parts.push('Fresh');
    } else if (code === 'serve') {
      parts.push('Serve Like Me');
    }
  }
  return parts.length ? parts.join(' • ') : null;
}

/**
 * Score one Home row.
 *
 * HARD RULE — money never ranks: `totalTipsCents`, gift/tip amounts, and backer counts are
 * never read here. Ads / paid promotion / sponsored placement are out of scope; no feed signal
 * is used for ad targeting. Keep it that way in any future edit.
 */
export function scoreHomeFeedItem<
  T extends { clip: HighlightClip; player?: { id?: string; school_name?: string; name?: string } | null },
>(item: T, context: HomeFeedContext, _index = 0): RankedFeedItem<T> {
  const nowMs = context.nowMs ?? Date.now();
  const clip = item.clip;
  const playerId = item.player?.id ?? clip.playerId ?? '';
  const clipSchool = (item.player?.school_name || clip.school || '').trim();
  const prefs = context.prefs;
  const personalize = prefs?.personalizationOn !== false;
  const reasons: FeedReasonCode[] = [];
  let score = 0;

  if (playerId && context.crewIds.has(playerId)) {
    score += 90;
    reasons.push('crew');
  }

  const viewerSchool = (context.school ?? '').trim();
  let schoolScore = 0;
  if (viewerSchool && schoolMatches(clipSchool, viewerSchool)) schoolScore += 45;
  if (personalize && prefs) {
    const pickedSchools = prefs.schools.slice(0, 3);
    if (pickedSchools.some((school) => schoolMatches(clipSchool, school))) schoolScore += 35;
  }
  if (schoolScore > 0) {
    score += Math.min(SCHOOL_SCORE_CAP, schoolScore);
    reasons.push('school');
  }

  if (clip.category === REEL_CATEGORY_SERVE) {
    score += 28;
    reasons.push('serve');
  }
  if (clip.sekiPlay || (clip.sekiCount ?? 0) >= 3) score += 16;
  if (clip.flashUnlockUntil) score += 22;
  // Public hype energy only — never a per-user preference weight.
  score += Math.min(32, ((clip.sekiCount ?? 0) + (clip.auraCount ?? 0) + (clip.flexCount ?? 0)) * 2);

  if (clip.createdAt) {
    const ageH = Math.max(0, (nowMs - Date.parse(clip.createdAt)) / 3_600_000);
    if (Number.isFinite(ageH)) {
      const fresh = Math.max(0, 18 - ageH);
      score += fresh;
      if (fresh >= 9) reasons.push('fresh');
    }
  }

  if (personalize && prefs) {
    if (sportMatches(clip.sport, prefs.sports.slice(0, 3))) {
      score += 40;
      reasons.push('sport');
    }
    if (prefs.categoryPref !== 'all' && clip.category === prefs.categoryPref) {
      score += 20;
      reasons.push('category');
    }
  }

  if (feedImplicitSignalsEnabled() && context.implicit) {
    const { views, saves, demotedAthletes, completedClipIds } = context.implicit;
    for (const touch of views) {
      const w = decayWeight(touch.atMs, nowMs, VIEW_DECAY_MS);
      if (w <= 0) continue;
      if (playerId && touch.athleteId && touch.athleteId === playerId) score += IMPLICIT_VIEW_BONUS * w;
      else if (touch.school && schoolMatches(clipSchool, touch.school)) score += IMPLICIT_VIEW_BONUS * w;
      else if (touch.sport && sportMatches(clip.sport, [touch.sport])) score += IMPLICIT_VIEW_BONUS * w;
    }
    for (const touch of saves) {
      const w = decayWeight(touch.atMs, nowMs, VIEW_DECAY_MS);
      if (w <= 0) continue;
      if (playerId && touch.athleteId && touch.athleteId === playerId) score += IMPLICIT_SAVE_BONUS * w;
      else if (touch.school && schoolMatches(clipSchool, touch.school)) score += IMPLICIT_SAVE_BONUS * w;
      else if (touch.sport && sportMatches(clip.sport, [touch.sport])) score += IMPLICIT_SAVE_BONUS * w;
    }
    const demoteUntil = playerId ? demotedAthletes.get(playerId) : undefined;
    if (demoteUntil && demoteUntil > nowMs) score -= HIDE_DEMOTE;
    if (completedClipIds.has(clip.id) && !(playerId && context.crewIds.has(playerId))) {
      const viewedAt = views.find((touch) => touch.athleteId === playerId)?.atMs;
      // Apply seen penalty when the clip id is marked completed within the window.
      if (!viewedAt || nowMs - viewedAt < SEEN_PENALTY_MS) score -= SEEN_PENALTY;
    }
  }

  return { item, score, reasons: reasons.slice(0, 3) };
}

/**
 * Phase 3 diversity (gated with Phase 2): max 2 consecutive same athlete, max 3 same school,
 * every 5th slot prefers a fresh discovery clip when one qualifies.
 */
export function applyFeedDiversity<T extends { clip: HighlightClip; player?: { id?: string; school_name?: string } | null }>(
  ranked: readonly T[],
  context: HomeFeedContext,
): T[] {
  if (!feedImplicitSignalsEnabled() || ranked.length <= 1) return [...ranked];
  const nowMs = context.nowMs ?? Date.now();
  const remaining = [...ranked];
  const out: T[] = [];
  const athleteOf = (row: T) => row.player?.id ?? row.clip.playerId ?? '';
  const schoolOf = (row: T) => (row.player?.school_name || row.clip.school || '').trim().toLowerCase();

  const pickDiscovery = (): T | null => {
    const shownAthletes = new Map<string, number>();
    for (const row of out) {
      const id = athleteOf(row);
      if (!id) continue;
      shownAthletes.set(id, (shownAthletes.get(id) ?? 0) + 1);
    }
    const prefs = context.prefs;
    for (let i = 0; i < remaining.length; i += 1) {
      const row = remaining[i];
      const ageH = row.clip.createdAt ? (nowMs - Date.parse(row.clip.createdAt)) / 3_600_000 : Infinity;
      if (!(ageH < 48)) continue;
      const athlete = athleteOf(row);
      if (athlete && (shownAthletes.get(athlete) ?? 0) >= 3) continue;
      const sportOk = !prefs?.sports.length || sportMatches(row.clip.sport, prefs.sports);
      const schoolOk =
        !prefs?.schools.length || prefs.schools.some((school) => schoolMatches(schoolOf(row), school));
      if (prefs?.sports.length || prefs?.schools.length) {
        if (!sportOk && !schoolOk) continue;
      }
      remaining.splice(i, 1);
      return row;
    }
    return null;
  };

  const athleteOk = (row: T) => {
    const athlete = athleteOf(row);
    if (!athlete || out.length < 2) return true;
    return !(athleteOf(out[out.length - 1]) === athlete && athleteOf(out[out.length - 2]) === athlete);
  };
  const schoolOk = (row: T) => {
    const school = schoolOf(row);
    if (!school || out.length < 3) return true;
    return !(
      schoolOf(out[out.length - 1]) === school &&
      schoolOf(out[out.length - 2]) === school &&
      schoolOf(out[out.length - 3]) === school
    );
  };

  while (remaining.length) {
    const slot = out.length + 1;
    if (slot % 5 === 0) {
      const discovery = pickDiscovery();
      // Discovery still respects hard caps when any other candidate can.
      if (discovery && athleteOk(discovery) && schoolOk(discovery)) {
        out.push(discovery);
        continue;
      }
      if (discovery) remaining.unshift(discovery);
    }
    let chosen = remaining.findIndex((row) => athleteOk(row) && schoolOk(row));
    if (chosen < 0) chosen = remaining.findIndex((row) => athleteOk(row));
    if (chosen < 0) chosen = remaining.findIndex((row) => schoolOk(row));
    if (chosen < 0) chosen = 0;
    out.push(remaining.splice(chosen, 1)[0]);
  }
  return out;
}

/**
 * @purpose Rank Home / For You: Crew, school, Serve Like Me, energy, freshness, then Phase 1 picks.
 * Phase 2/3 apply only when `feedImplicitSignalsEnabled()`. Money amounts never affect order.
 * @param clips Current Highlights rows.
 * @param context Viewer Crew ids, school, optional prefs / implicit signals.
 * @returns A new array, highest score first (or newest-first when personalization is off). Ties keep stable id order.
 */
export function rankHomeFeed<T extends { clip: HighlightClip; player?: { id?: string; school_name?: string } | null }>(
  clips: T[],
  context: HomeFeedContext,
): T[] {
  if (context.prefs && context.prefs.personalizationOn === false) {
    return newestFirst(clips);
  }
  const scored = clips.map((item, index) => ({ ...scoreHomeFeedItem(item, context, index), index }));
  scored.sort((left, right) => right.score - left.score || left.index - right.index);
  const ordered = scored.map((row) => row.item);
  return applyFeedDiversity(ordered, context);
}

/**
 * @purpose Map ranked rows to reason codes for the "Why this clip" line (signed-in Home only).
 */
export function rankHomeFeedWithReasons<
  T extends { clip: HighlightClip; player?: { id?: string; school_name?: string; name?: string } | null },
>(clips: T[], context: HomeFeedContext): { item: T; reasons: FeedReasonCode[] }[] {
  if (context.prefs && context.prefs.personalizationOn === false) {
    return newestFirst(clips).map((item) => ({ item, reasons: [] as FeedReasonCode[] }));
  }
  const scored = clips.map((item, index) => ({ ...scoreHomeFeedItem(item, context, index), index }));
  scored.sort((left, right) => right.score - left.score || left.index - right.index);
  const ordered = applyFeedDiversity(
    scored.map((row) => row.item),
    context,
  );
  const byId = new Map(scored.map((row) => [row.item.clip.id, row.reasons]));
  return ordered.map((item) => ({ item, reasons: byId.get(item.clip.id) ?? [] }));
}

/**
 * @purpose Phase 0 local measurement of the current ranked Home list (dev / PR report only).
 * Never ships to users and never leaves the device.
 */
export function measureHomeFeedTop<T extends { clip: HighlightClip; player?: { id?: string; school_name?: string } | null }>(
  ranked: readonly T[],
  context: HomeFeedContext,
): HomeFeedMeasureReport {
  const top20 = Math.min(20, ranked.length);
  if (top20 === 0) {
    return {
      sampleSize: 0,
      top20: 0,
      top3AthleteShare: null,
      top2SchoolShare: null,
      olderThan48hShare: null,
      zeroHypeShare: null,
      crewInFirst5: null,
      note: 'Wave 0 feed too small to measure — re-run on the first pilot school once reels_feed has enough rows.',
    };
  }
  const head = ranked.slice(0, top20);
  const athleteCounts = new Map<string, number>();
  const schoolCounts = new Map<string, number>();
  let older = 0;
  let zeroHype = 0;
  const nowMs = context.nowMs ?? Date.now();
  for (const row of head) {
    const athlete = row.player?.id ?? row.clip.playerId ?? row.clip.athleteName;
    athleteCounts.set(athlete, (athleteCounts.get(athlete) ?? 0) + 1);
    const school = (row.player?.school_name || row.clip.school || '').trim() || 'unknown';
    schoolCounts.set(school, (schoolCounts.get(school) ?? 0) + 1);
    const ageH = row.clip.createdAt ? (nowMs - Date.parse(row.clip.createdAt)) / 3_600_000 : Infinity;
    if (ageH > 48) older += 1;
    const hype = (row.clip.sekiCount ?? 0) + (row.clip.auraCount ?? 0) + (row.clip.flexCount ?? 0);
    if (hype === 0) zeroHype += 1;
  }
  const topAthletes = [...athleteCounts.values()].sort((a, b) => b - a).slice(0, 3);
  const topSchools = [...schoolCounts.values()].sort((a, b) => b - a).slice(0, 2);
  const first5 = ranked.slice(0, Math.min(5, ranked.length));
  const crewInFirst5 = first5.filter((row) => {
    const id = row.player?.id ?? row.clip.playerId ?? '';
    return id && context.crewIds.has(id);
  }).length;
  return {
    sampleSize: ranked.length,
    top20,
    top3AthleteShare: topAthletes.reduce((sum, n) => sum + n, 0) / top20,
    top2SchoolShare: topSchools.reduce((sum, n) => sum + n, 0) / top20,
    olderThan48hShare: older / top20,
    zeroHypeShare: zeroHype / top20,
    crewInFirst5,
    note:
      ranked.length < 20
        ? `Only ${ranked.length} clips available (Wave 0). Shares are over the first ${top20}; re-measure on pilot-school data.`
        : 'Measured on the ranked Home list for this session.',
  };
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

// 2026-09 fix: these used to point at a public sample bucket that now rejects every request.
// `videoUrl: ''` never opens a player. They fill Home only while no uploaded clip has a file,
// and they remain the Westlake fallback for `demoSpotlightAward` in lib/spotlight.ts.
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

/**
 * @purpose Home pages real clips. Empty sample cards stay only while nothing uploaded can play.
 * @param uploaded Rows from `reels_feed`.
 * @param samples `HIGHLIGHT_CLIPS` joined to the roster. Used when every upload lacks a file.
 * @returns Playable uploads, or the samples when that list is empty.
 */
export function homePagerClips<T extends { clip: Pick<HighlightClip, 'videoUrl' | 'mediaType' | 'photoCount'> }>(
  uploaded: readonly T[],
  samples: readonly T[],
): T[] {
  const playable = uploaded.filter((item) => {
    if (isPhotoStory(item.clip)) return (item.clip.photoCount ?? 0) > 0;
    return Boolean(item.clip.videoUrl?.trim());
  });
  return playable.length > 0 ? [...playable] : [...samples];
}
