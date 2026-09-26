/**
 * In-app Terms / NIL / minor-safety copy. Not legal advice — counsel replaces this before live money.
 * Bump `LEGAL_TERMS_VERSION` when the acknowledgement text materially changes.
 */

export const LEGAL_TERMS_VERSION = '2026-09-16';

export const LEGAL_MENU_LABEL = 'Terms of Service & NIL Compliance 📜';

/** Shown wherever the product is still short of the legal briefing. Not a claim of compliance. */
export const COMPLIANCE_ACCOUNT =
  'Payments are in test mode. These terms are a prototype summary, not a finished Terms of Service or Privacy Policy.';
export const COMPLIANCE_PAYMENT =
  'Test payment only. This does not send live money. Mālo is a gift, not a wager or pay for a play. A school or association may restrict it.';
export const COMPLIANCE_PAYOUT =
  'This starts a US individual Express account in test mode. It is not a parent or guardian custodial payout, and it is not a live transfer.';
export const COMPLIANCE_PARENT =
  'This consent switch is a prototype. It is not a finished parental authorization, identity check, or custodial payout.';
export const COMPLIANCE_POLL = 'Cheers only. No entry fee and no prize.';
export const COMPLIANCE_UPLOAD =
  'Only upload a clip you have rights to share. School logos and official game film are not a license. Do not upload a child under 13.';

export const LEGAL_ACK_LABEL =
  'I have read and agree to the Terms of Service & Privacy summary, the High School NIL Disclaimer, and the Minor Safety & Parental Authorization policy.';

export type LegalSection = {
  id: string;
  title: string;
  body: string;
};

export const LEGAL_SECTIONS: LegalSection[] = [
  {
    id: 'tos',
    title: 'Terms of Service & Privacy',
    body: `Tapua'i is a game-day highlights and community app. By using it you agree that Mālo, Crew, Chip In, Drip, and Exclusive are optional; that video, names, and school identity you upload may be shown to other fans; and that we may hide or flag clips you report.

We store the account you create (email or sign-in provider), a fan profile, and product activity needed to run tips, Crew, and receipts. Demo RLS is still open — do not put production student data in this prototype.

This summary is not a full Terms of Service or Privacy Policy. It is not legal advice. Counsel must replace it before live money or a public app-store listing.`,
  },
  {
    id: 'nil',
    title: 'High School NIL Disclaimer',
    body: `Mālo is a voluntary gift of support. It is independent of school, team, or individual performance. It is not pay-for-play, not a wager, and not compensation for a statistic, win, ranking, or highlight.

Tapua'i does not claim to be “approved NIL.” High-school amateur rules are usually stricter than college NIL and are set by the state association and school district — not by this app.

Fans and athletes must not use school trademarks, logos, or official marks as if Tapua'i or a Mālo were school-sponsored. School names may appear as community identity; they are not a license to sell those marks.

Aura points cannot be withdrawn as cash. Cheer polls have no entry fee and no prize.`,
  },
  {
    id: 'minors',
    title: 'Minor Safety & Parental Authorization',
    body: `Target users include high-school athletes, many of whom are minors. Stripe Express onboarding is built as a US individual account and typically requires the payee to be 18+. Payouts to minors must use a parent- or guardian-controlled custodial design — the Parent HQ consent toggle is a prototype, not a finished authorization.

Do not create accounts for children under 13. Parents and guardians should expect real consent, identity, and custodial payouts before any live transfer.

Connecting a bank (Stripe Connect) is blocked until you acknowledge these terms. Schools and associations may restrict participation; we will honor a written direction to freeze Mālo for a named athlete, team, or school when that process exists.`,
  },
];
