/**
 * Upload confirmations and report reasons for footage, photos, sound, and marks.
 * Wording is a product control. Counsel still decides what school marks may appear.
 * Bump the matching version when confirmation text changes: `RIGHTS_VERSION` for videos,
 * `PHOTO_RIGHTS_VERSION` for photo stories (both are stored in `reels.rights_version`).
 */
import type { HighlightMediaType, ReelCategory } from '@/data/highlights';
import { REEL_CATEGORY_GAME } from '@/data/highlights';

export const RIGHTS_VERSION = '2026-10-01';

/** Photo-story confirmations, added 2026-10-07 (PHOTO_STORIES_DESIGN.md). Video wording is unchanged. */
export const PHOTO_RIGHTS_VERSION = '2026-10-07';

/** How many separate accounts must report a clip before it leaves the public feed. */
export const REPORTS_BEFORE_HIDE = 3;

export type RightsAckId = 'permission' | 'sound' | 'marks' | 'game' | 'photo_permission' | 'photo_real';

export type ReportReasonId =
  | 'fake_footage'
  | 'wrong_athlete'
  | 'impersonation'
  | 'rights'
  | 'inappropriate'
  | 'other'
  | 'unspecified';

export const UPLOAD_RIGHTS_CHECKS: { id: RightsAckId; label: string; gameOnly?: boolean }[] = [
  { id: 'permission', label: 'I filmed this, or I have permission to share it.' },
  { id: 'sound', label: 'The sound is the original recording, or music I have the right to use.' },
  {
    id: 'marks',
    label: 'I am not using a school logo, a team mark, or a TV broadcast as if I own it.',
  },
  {
    id: 'game',
    label: 'This is real footage from a real game. It is not AI-made or a face swap.',
    gameOnly: true,
  },
];

/**
 * Photo stories (owner-approved wording, PHOTO_STORIES_DESIGN.md). Photos often show other people's
 * children, so the permission line names "the people in them" (minor-safety rules in LEGAL_BRIEFING).
 * There is no sound line because a story has no audio; marks and the Game Day real-media line stay.
 */
export const PHOTO_RIGHTS_CHECKS: { id: RightsAckId; label: string; gameOnly?: boolean }[] = [
  { id: 'photo_permission', label: 'I took these photos or have permission from the people in them.' },
  {
    id: 'marks',
    label: 'I am not using a school logo, a team mark, or a TV broadcast as if I own it.',
  },
  {
    id: 'photo_real',
    label: 'These are real photos from a real game. They are not AI-made or edited to change who is in them.',
    gameOnly: true,
  },
];

export const REPORT_REASONS: { id: Exclude<ReportReasonId, 'unspecified'>; label: string }[] = [
  { id: 'fake_footage', label: 'Fake or AI-made game footage' },
  { id: 'wrong_athlete', label: "That's not this athlete" },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'rights', label: 'Music, logo, or broadcast without permission' },
  { id: 'inappropriate', label: 'Inappropriate' },
  { id: 'other', label: 'Other' },
];

/** Reasons that leave the public feed on the first report, pending review. */
export const IMMEDIATE_HIDE_REASONS: readonly ReportReasonId[] = ['fake_footage', 'impersonation', 'rights'];

/**
 * @purpose Which confirmations the upload sheet requires for this category and media.
 * @param category Highlight category. Game Day (`game_play`) adds the real-footage / real-photos line.
 * @param mediaType `video` (default) or `photo_story`; photo stories use the photo wording.
 */
export function rightsChecksFor(category: ReelCategory, mediaType: HighlightMediaType = 'video'): typeof UPLOAD_RIGHTS_CHECKS {
  const rows = mediaType === 'photo_story' ? PHOTO_RIGHTS_CHECKS : UPLOAD_RIGHTS_CHECKS;
  return rows.filter((row) => !row.gameOnly || category === REEL_CATEGORY_GAME);
}

/**
 * @purpose True when every confirmation for this category and media is checked.
 * @param acked Map of confirmation id → checked.
 * @param category Highlight category.
 * @param mediaType `video` (default) or `photo_story`.
 */
export function rightsReady(
  acked: Readonly<Partial<Record<RightsAckId, boolean>>>,
  category: ReelCategory,
  mediaType: HighlightMediaType = 'video',
): boolean {
  return rightsChecksFor(category, mediaType).every((row) => acked[row.id] === true);
}

/**
 * @purpose True when this reason, or an athlete/guardian report, should hide the clip now.
 * @param reason Report reason id.
 * @param fromAthleteOrGuardian Reporter is the tagged athlete or their guardian.
 */
export function reportHidesNow(reason: ReportReasonId, fromAthleteOrGuardian: boolean): boolean {
  return fromAthleteOrGuardian || IMMEDIATE_HIDE_REASONS.includes(reason);
}

/**
 * @purpose Keep a queued report reason inside the allowed set.
 * @param value Raw reason from the sheet or an older offline queue row.
 */
export function parseReportReason(value: string | null | undefined): ReportReasonId {
  if (value === 'unspecified') return 'unspecified';
  const match = REPORT_REASONS.find((row) => row.id === value);
  return match?.id ?? 'unspecified';
}
