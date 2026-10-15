// ARCHIVED 2026-10-15 · QUIZ-04 owner simplification · owner approved · excerpt from packages/shared-types/lifePlaybook.ts (LifeDomain, LIFE_ILLUSTRATIVE_MARKER, LifeSignoff, LifeSignoffInput, LifeReviewer, LifeReviewerGrantInput, LifeReviewerReceipt, LifeRereviewItem).
// Not built, tested or imported. Restore: move these types back into packages/shared-types/lifePlaybook.ts with the archived SQL tables quiz_life_signoffs / quiz_content_reviewers and their RPCs.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

export type LifeDomain = 'finance' | 'tax';
/** The only accepted figure marker (supabase/content/life_copy_rules.json). */
export const LIFE_ILLUSTRATIVE_MARKER = 'Illustrative example with made-up numbers' as const;
/** A sign-off counts only once a second admin confirms it, until expires_on; it covers the approved versions listed at recording. */
export type LifeSignoff = { id: string; chapter: LifeChapterId; signed_by_name: string; signed_on: string; note: string | null; recorded_by: string | null; recorded_at: string;
  confirmed_by: string | null; confirmed_at: string | null; expires_on: string; covers_count: number; current: boolean };
export type LifeSignoffInput = { chapter: LifeChapterId; signed_by_name: string; signed_on: string; note: string | null };
export type LifeReviewer = {
  id: string; profile_id: string; display_name: string; domain: LifeDomain; qualification: string; grant_reason: string; granted_by: string | null;
  granted_at: string; expires_at: string | null; revoked_at: string | null; revoked_by: string | null; revoke_reason: string | null;
  confirmed_by: string | null; confirmed_at: string | null; active: boolean;
};
export type LifeReviewerGrantInput = { profile_id: string; domain: LifeDomain; qualification: string; expires_at: string | null };
export type LifeReviewerReceipt = {
  contract_version: 4; id: string; profile_id: string; domain: LifeDomain; qualification: string; granted_by: string | null; granted_at: string;
  expires_at: string | null; revoked_at: string | null; revoked_by: string | null; confirmed_by: string | null; confirmed_at: string | null; active: boolean;
};
export type LifeRereviewItem = {
  id: string; question_key: string; version: number; chapter: LifeChapterId; domain: LifeDomain; prompt: string;
  review_due_on: string | null; as_of_tax_year: number | null; overdue: boolean | null; withdrawn: boolean;
};
