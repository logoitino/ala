/**
 * The guardian consent form (MINOR-01). A parent or legal guardian signs it in Parent HQ to let a 13–17-year-old have a
 * public profile and/or have donations paid out for them. The server accepts only GUARDIAN_CONSENT_VERSION with this
 * exact text: GUARDIAN_CONSENT_SHA256 is the SHA-256 of `guardianConsentTemplate()` and must match
 * `guardian_consent_form_sha256()` in `20261014110000_minor_accounts.sql` (guarded by `guardianConsent.test.ts`).
 * Any wording change needs a new version, a new hash in a new migration, and counsel's review.
 *
 * DRAFT for counsel (LEGAL_BRIEFING row AA): LEGAL routes it; counsel writes the final text. The `-draft` version is shown
 * with a "testing only" banner and must not go to real families. Money words follow docs/product/VOICE.md; "10%" must
 * change with a new version if the platform share changes (data/finance.ts MALO_PLATFORM_CUT_BPS).
 */

export const GUARDIAN_CONSENT_VERSION = '2026-10-14-draft';

export const GUARDIAN_CONSENT_SHA256 = 'f39f7c23538fcf209fb368bd56f16250ba685cd7c3a4bf23d94be19cea0caa0f';

export const GUARDIAN_CONSENT_IS_DRAFT = GUARDIAN_CONSENT_VERSION.endsWith('-draft');

/** Each clause of the form, in order. `{teen}` is replaced with the teen's first name on screen only. */
export const GUARDIAN_CONSENT_CLAUSES: readonly { title: string; body: string }[] = [
  {
    title: 'Who is signing',
    body: "I am {teen}'s parent or legal guardian and I am 18 or older. The full name I type below is my signature. Giving false details ends this link.",
  },
  {
    title: 'What I allow',
    body: 'I choose each permission separately. Public profile: anyone, including adults, can see what {teen} shares with "Everyone". Donations paid out: donations to {teen} can be paid out to the family account on record for {teen}, for {teen} only. Only the guardian on record for that family account can allow this.',
  },
  {
    title: 'Money rules',
    body: "Nothing is paid out without {teen}'s approval, and control passes to {teen} at 18 (or the age in your state). Tapua'i keeps 10% of each donation to run the app, including card processing. Donations are not tax-deductible.",
  },
  {
    title: 'What I see',
    body: "I see {teen}'s privacy settings, safety counts (never who their friends are) and changes made after I linked. {teen} sees exactly what I see. Before {teen} turns 16, I approve or decline making the profile public and accepting friend requests from anyone.",
  },
  {
    title: 'Ending this',
    body: 'Either of us can end this link at any time, and I can withdraw a permission at any time. A public profile then goes private and payouts wait.',
  },
  {
    title: 'Records',
    body: "Tapua'i keeps this signed form, with the time and the version, for the period the law requires. My copy is in Parent HQ.",
  },
];

/** The exact text that is hashed and signed: clauses joined as "title: body", one per line. */
export function guardianConsentTemplate(): string {
  return GUARDIAN_CONSENT_CLAUSES.map((clause) => `${clause.title}: ${clause.body}`).join('\n');
}

/** A clause as shown to the guardian, with the teen's first name filled in. */
export function fillConsentClause(body: string, teenFirstName: string): string {
  return body.split('{teen}').join(teenFirstName.trim() || 'this teen');
}
