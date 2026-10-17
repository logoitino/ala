/** SAFETY-01 Coach-level label. Uploaders mark a new workout; admins add or remove it with a reason.
 * A missing migration reads as unknown, never as "nothing is labelled."
 * The layouts.coachLevel switch hides the uploader control and the report reason. Labels already set still show.
 * @sideEffects set_own_coach_label, set_coach_label, coach_label_desk.
 */
import { callRpc } from '@/lib/rpc';

export const COACH_LEVEL_BADGE = 'Coach-level move';
export const COACH_LEVEL_SHEET = 'Try this only with a coach or spotter. Workout ideas, not medical advice. Warm up and know your limits.';
export const COACH_LEVEL_SWITCH = 'Advanced move: needs a coach or spotter';
export const WORKOUT_IDEAS_LINE = 'Workout ideas, not medical advice. Warm up and know your limits.';
export const COACH_LEVEL_REPORT = 'Risky without a coach';

export type CoachLabel = 'none' | 'coach_level';
export type CoachTargetKind = 'reel' | 'beyond_post';

export type CoachLabelSuggestion = { kind: 'reel'; id: string; title: string; reports: number };
export type CoachLabelEvent = {
  id: string;
  targetKind: CoachTargetKind;
  targetId: string;
  oldLabel: CoachLabel;
  newLabel: CoachLabel;
  actorId: string | null;
  reason: string;
  createdAt: string;
};
export type CoachLabelDesk = {
  labelledReels: number;
  labelledPosts: number;
  openSuggestions: number;
  medianReviewHours: number | null;
  suggestions: CoachLabelSuggestion[];
  events: CoachLabelEvent[];
};

const label = (value: unknown): CoachLabel => (value === 'coach_level' ? 'coach_level' : 'none');

/** @purpose Read the Highlights desk. Throws when the source fails, including a migration that is not applied. */
export async function fetchCoachLabelDesk(): Promise<CoachLabelDesk> {
  const data = await callRpc<Record<string, unknown>>('coach_label_desk');
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
  const events = Array.isArray(data.events) ? data.events : [];
  const median = data.median_review_hours;
  return {
    labelledReels: Number(data.labelled_reels) || 0,
    labelledPosts: Number(data.labelled_posts) || 0,
    openSuggestions: Number(data.open_suggestions) || 0,
    medianReviewHours: typeof median === 'number' && Number.isFinite(median) ? median : null,
    suggestions: suggestions.slice(0, 50).map((row) => {
      const item = row as Record<string, unknown>;
      return { kind: 'reel' as const, id: String(item.id), title: String(item.title ?? 'Highlight'), reports: Number(item.reports) || 0 };
    }),
    events: events.slice(0, 50).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id),
        targetKind: item.target_kind === 'beyond_post' ? 'beyond_post' : 'reel',
        targetId: String(item.target_id),
        oldLabel: label(item.old_label),
        newLabel: label(item.new_label),
        actorId: item.actor_id == null ? null : String(item.actor_id),
        reason: String(item.reason ?? ''),
        createdAt: String(item.created_at ?? ''),
      };
    }),
  };
}

/**
 * @purpose Admin add or remove. The reason is stored with the actor and time.
 * @param kind Highlight or Beyond workout.
 * @param targetId Row id.
 * @param next none removes the label.
 * @param reason At least 8 characters, matching the database.
 */
export function setCoachLabel(kind: CoachTargetKind, targetId: string, next: CoachLabel, reason: string): Promise<unknown> {
  return callRpc('set_coach_label', { target_kind: kind, target_id: targetId, label: next, reason });
}

/** @purpose Uploader marks their own new workout. Later changes go through review. */
export function setOwnCoachLabel(kind: CoachTargetKind, targetId: string): Promise<unknown> {
  return callRpc('set_own_coach_label', { target_kind: kind, target_id: targetId, label: 'coach_level' });
}
