// ARCHIVED 2026-10-15 · QUIZ-04 owner simplification · owner approved · excerpt from apps/mobile/src/frontend/lib/lifePlaybook.ts (signoffReceipt, recordLifeSignoff, confirmLifeSignoff, reviewerReceipt, grantLifeReviewer, confirmLifeReviewer, revokeLifeReviewer).
// Not built, tested or imported. Restore: move the wrappers back into apps/mobile/src/frontend/lib/lifePlaybook.ts after the archived SQL RPCs quiz_admin_life_signoff / quiz_admin_life_signoff_confirm / quiz_admin_reviewer return; restore the archived shared types too.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

function signoffReceipt(v: unknown, chapter?: LifeChapterId): LifeSignoff {
  if (!object(v) || v.contract_version !== 4 || !chapterId(v.chapter) || (chapter && v.chapter !== chapter) || !text(v.id) || !text(v.signed_by_name) || !date(v.signed_on)
    || !timestamp(v.recorded_at) || !date(v.expires_on) || !integer(v.covers_count) || typeof v.current !== 'boolean' || (v.current && v.confirmed_at === null)) throw unavailable();
  const { contract_version: _version, ...rest } = v;
  return rest as unknown as LifeSignoff;
}
/** @purpose Record a CPA sign-off for a chapter (append-only); it counts only after a second admin confirms it. */
export async function recordLifeSignoff(input: LifeSignoffInput, reason: string, expectedActorId: string): Promise<LifeSignoff> {
  return signoffReceipt(await callRpc<unknown>('quiz_admin_life_signoff', { p_payload: input, p_reason: reason, p_expected_actor_id: expectedActorId }), input.chapter);
}
/** @purpose Second admin (not the recorder, no author in the chapter) confirms a CPA sign-off. */
export async function confirmLifeSignoff(signoffId: string, reason: string, expectedActorId: string): Promise<LifeSignoff> {
  const r = signoffReceipt(await callRpc<unknown>('quiz_admin_life_signoff_confirm', { p_signoff_id: Number(signoffId), p_reason: reason, p_expected_actor_id: expectedActorId }));
  if (r.id !== signoffId || r.confirmed_at === null) throw unavailable();
  return r;
}
function reviewerReceipt(v: unknown): LifeReviewerReceipt {
  if (!object(v) || v.contract_version !== 4 || !text(v.id) || !text(v.profile_id) || !['finance', 'tax'].includes(String(v.domain)) || typeof v.active !== 'boolean'
    || !timestamp(v.granted_at)) throw unavailable();
  return v as unknown as LifeReviewerReceipt;
}
/** @purpose Grant a named finance / tax reviewer (another adult admin) with an audited reason. */
export async function grantLifeReviewer(input: LifeReviewerGrantInput, reason: string, expectedActorId: string): Promise<LifeReviewerReceipt> {
  return reviewerReceipt(await callRpc<unknown>('quiz_admin_reviewer', { p_action: 'grant', p_payload: input, p_reason: reason, p_expected_actor_id: expectedActorId }));
}
/** @purpose A second admin (not the granter, not the grantee) confirms a grant; only then can it approve. */
export async function confirmLifeReviewer(grantId: string, reason: string, expectedActorId: string): Promise<LifeReviewerReceipt> {
  const r = reviewerReceipt(await callRpc<unknown>('quiz_admin_reviewer', { p_action: 'confirm', p_payload: { grant_id: grantId }, p_reason: reason, p_expected_actor_id: expectedActorId }));
  if (r.id !== grantId || r.confirmed_at === null) throw unavailable();
  return r;
}
/** @purpose Revoke a reviewer grant with an audited reason; revocation is final. */
export async function revokeLifeReviewer(grantId: string, reason: string, expectedActorId: string): Promise<LifeReviewerReceipt> {
  const r = reviewerReceipt(await callRpc<unknown>('quiz_admin_reviewer', { p_action: 'revoke', p_payload: { grant_id: grantId }, p_reason: reason, p_expected_actor_id: expectedActorId }));
  if (r.active || r.id !== grantId) throw unavailable();
  return r;
}
