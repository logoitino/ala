/**
 * Upload confirmations and report reasons for footage, photos, sound, and marks.
 * Wording is a product control. Counsel still decides what school marks may appear.
 * Bump the matching version when confirmation text changes: `RIGHTS_VERSION` for videos,
 * `PHOTO_RIGHTS_VERSION` for photo stories (both are stored in `reels.rights_version`).
 */
import type { HighlightMediaType, ReelCategory } from '@/data/highlights';
import { REEL_CATEGORY_GAME } from '@/data/highlights';

export const RIGHTS_VERSION = '2026-10-11';

/** Photo-story confirmations (PHOTO_STORIES_DESIGN.md). The upload sheet shows each set as one confirmation. */
export const PHOTO_RIGHTS_VERSION = '2026-10-11';

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
/**
 * @purpose One confirmation the upload sheet shows. It is the same sentences as the separate boxes, read together.
 * @param category Highlight category. Game Day adds the real-footage or real-photos sentence.
 * @param mediaType `video` (default) or `photo_story`.
 * @returns The full confirmation label.
 */
export function shareConfirmationLabel(category: ReelCategory, mediaType: HighlightMediaType = 'video'): string {
  return rightsChecksFor(category, mediaType).map((row) => row.label).join(' ');
}

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

/**
 * @purpose The reason a reviewer reads for one flagged clip.
 * @param reasons Stored `reel_reports.reason` values for that clip. Null means the report table could not be read.
 * @returns The label of the first hide reason present, otherwise the first known reason. Unknown strings are dropped.
 */
export function queueReasonLabel(reasons: readonly string[] | null): string {
  if (reasons == null) return 'Not on this database';
  const known = reasons.filter(
    (reason) => reason === 'unspecified' || REPORT_REASONS.some((row) => row.id === reason),
  );
  if (known.length === 0) return 'No reason stored';
  const hide = IMMEDIATE_HIDE_REASONS.find((id) => known.includes(id));
  const chosen = hide ?? known[0];
  if (chosen === 'unspecified') return 'Unspecified';
  const match = REPORT_REASONS.find((row) => row.id === chosen);
  return match?.label ?? 'No reason stored';
}

/**
 * @purpose Whether the tagged athlete or their guardian is among the reporters.
 * @param input `readable` is false when the profile or player read failed. Player ids match only when both are non-empty. A reporter profile id matches a guardian profile id on the tagged athlete.
 * @returns `unchecked` when the identity read failed, `yes` on an athlete or guardian match, otherwise `no`.
 */
export function athleteOrGuardianReported(input: {
  readable: boolean;
  reelPlayerId: string | null;
  reporterPlayerIds: readonly (string | null | undefined)[];
  reporterProfileIds: readonly (string | null | undefined)[];
  guardianProfileIds: readonly (string | null | undefined)[];
}): 'yes' | 'no' | 'unchecked' {
  if (!input.readable) return 'unchecked';
  const reelPlayerId = input.reelPlayerId;
  if (reelPlayerId && input.reporterPlayerIds.some((id) => id === reelPlayerId)) return 'yes';
  const guardians = new Set(input.guardianProfileIds.filter((id): id is string => typeof id === 'string' && id.length > 0));
  if (input.reporterProfileIds.some((id) => typeof id === 'string' && id.length > 0 && guardians.has(id))) return 'yes';
  return 'no';
}
