/**
 * GUEST-ACCESS-01 account policy is reported on the existing Features desk.
 * Canonical Expo `/admin` desks the Next portal may name for oversight.
 * PORTAL Product / Coverage / Health unapplied notices point here; writes stay in Expo.
 * UX-17 keeps existing public roster discovery and pending selection accountable to school/athlete desks.
 * Add a row when a desk ships so agents keep the portal and TEAMS desk list aligned.
 */

export type ExpoDeskGroup =
  | 'operations'
  | 'content'
  | 'commerce'
  | 'audience'
  | 'growth'
  | 'system'
  | 'tools'
  | 'reports';

export type ExpoDesk = {
  /** Expo Router path, always `/admin/...`. */
  path: string;
  title: string;
  /** One-line purpose for the read-only portal. */
  detail: string;
  group: ExpoDeskGroup;
};

export const EXPO_DESK_GROUPS: { id: ExpoDeskGroup; label: string }[] = [
  { id: 'operations', label: 'Operations' },
  { id: 'content', label: 'Content' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'audience', label: 'Audience' },
  { id: 'growth', label: 'Growth' },
  { id: 'system', label: 'System' },
  { id: 'tools', label: 'Tools' },
  { id: 'reports', label: 'Reports' },
];

/**
 * @purpose Every Expo editing desk the portal may surface as a deep-link path (never a write control).
 */
export const EXPO_DESKS: readonly ExpoDesk[] = [
  { path: '/admin/games', title: 'Games', detail: 'Create and correct live and scheduled games.', group: 'operations' },
  { path: '/admin/sports', title: 'Sports', detail: 'Sport configs, periods, and callouts.', group: 'operations' },
  { path: '/admin/polls', title: 'Polls', detail: 'Cheer polls and Local engagement.', group: 'operations' },
  { path: '/admin/boosters', title: 'Boosters', detail: 'Booster tiers and Top Boosters.', group: 'operations' },
  { path: '/admin/publish', title: 'Publish', detail: 'Publish draft runtime switches to the app.', group: 'operations' },
  { path: '/admin/highlights', title: 'Highlights', detail: 'Beyond contributions and edited captions in the existing review queue; challenges, coach-level labels and interest-feed controls.', group: 'content' },
  { path: '/admin/moderation', title: 'Moderation', detail: 'Review reports and hide Highlights, including posts with uploader-edited descriptions.', group: 'content' },
  { path: '/admin/fan-zone', title: 'Fan Zone', detail: 'Campaigns, private entries, and free ballots.', group: 'content' },
  { path: '/admin/sport-quiz', title: 'Sport Quiz', detail: 'Trivia rounds, Life Playbook, and fresh questions. Private noncash badges; IQ Aura only when that migration is applied.', group: 'content' },
  { path: '/admin/money', title: 'Money', detail: "Gifts, Vault Exclusive, optional Tip Tapua'i, and Connect.", group: 'commerce' },
  { path: '/admin/books', title: 'Books', detail: 'Finance ledger, reconciliation, and month close.', group: 'commerce' },
  { path: '/admin/drip', title: 'Drip', detail: 'Merchandise catalog and orders.', group: 'commerce' },
  { path: '/admin/wishlist', title: 'Wishlist', detail: 'Gear gift goals.', group: 'commerce' },
  { path: '/admin/people', title: 'People', detail: 'Profiles, roles, and access.', group: 'audience' },
  { path: '/admin/athletes', title: 'Athletes', detail: 'Existing public roster, school/team labels, pending claims and verification.', group: 'audience' },
  { path: '/admin/schools', title: 'Schools', detail: 'Existing school catalog and exact roster school-name associations.', group: 'audience' },
  { path: '/admin/feedback', title: 'Feedback', detail: 'In-app feedback intake.', group: 'growth' },
  { path: '/admin/features', title: 'Features', detail: 'Draft and publish runtime flags.', group: 'system' },
  { path: '/admin/look', title: 'Look', detail: 'Daylight theme tokens.', group: 'system' },
  { path: '/admin/catalog', title: 'Catalogs', detail: 'Prices, sports badges, and Exclusive amounts.', group: 'system' },
  { path: '/admin/lab', title: 'Lab', detail: 'Engineering experiments.', group: 'system' },
  { path: '/admin/support', title: 'Engineering Support', detail: 'Syntax, logic, and glitch review. Health counts open ones.', group: 'tools' },
  { path: '/admin/qa', title: 'QA', detail: 'QA tools and Studio share.', group: 'tools' },
  { path: '/admin/product/coverage', title: 'Control map', detail: 'Every fan control with its desk, flag, and telemetry.', group: 'reports' },
  { path: '/admin/analytics', title: 'Analytics', detail: 'Measure catalog and week boards.', group: 'reports' },
  { path: '/admin/health', title: 'Health (Expo)', detail: 'Same Health family as this portal, with desk links.', group: 'reports' },
  { path: '/admin/revenue', title: 'Revenue (Expo)', detail: 'Same ledger family as this portal Revenue page.', group: 'reports' },
];

/** Surfaces the portal Control map lists (aligned with Expo adminCoverage surfaces). */
export type PortalCoverageSurfaceId =
  | 'home'
  | 'beyond'
  | 'local'
  | 'activity'
  | 'spotlight'
  | 'drip'
  | 'profile'
  | 'upload'
  | 'receipts'
  | 'operator'
  | 'parent'
  | 'booster'
  | 'sponsor'
  | 'auth'
  | 'sport-quiz'
  | 'fan-zone'
  | 'web';

export type PortalCoverageSurface = {
  id: PortalCoverageSurfaceId;
  label: string;
  /** Expo Control map or owning desk for repair. */
  adminPath: string;
  hint: string;
};

/**
 * @purpose Read-only Control map surfaces for the Next portal. Counts stay in Expo `/admin/product/coverage`.
 */
export const PORTAL_COVERAGE_SURFACES: readonly PortalCoverageSurface[] = [
  { id: 'home', label: 'Home · Highlights ⚡', adminPath: '/admin/highlights', hint: 'Reel pager, hype, Vault unlock, interest picks and uploader-only description edits; use Moderation for reports.' },
  { id: 'beyond', label: 'Beyond the Game', adminPath: '/admin/highlights', hint: 'Contributions and edited descriptions use the existing review queue; challenges remain separate.' },
  { id: 'local', label: 'Local', adminPath: '/admin/games', hint: 'Live scores, polls, boosters and existing school/team roster directory; repair via Schools/Athletes desks.' },
  { id: 'activity', label: 'Activity', adminPath: '/admin/features', hint: 'Feed and notification inbox actions.' },
  { id: 'spotlight', label: 'Spotlight', adminPath: '/admin/spotlight', hint: 'Player of the Week board.' },
  { id: 'drip', label: 'Drip', adminPath: '/admin/drip', hint: 'Merchandise browse and checkout.' },
  { id: 'profile', label: 'Profile', adminPath: '/admin/athletes', hint: 'Vault, Crew, notifications, existing roster selection and enlargement of already visible profile photos.' },
  { id: 'upload', label: 'Upload +', adminPath: '/admin/highlights', hint: 'Highlight and Beyond compose.' },
  { id: 'receipts', label: 'Receipts', adminPath: '/admin/money', hint: 'Gift and purchase history.' },
  { id: 'auth', label: 'Soft-Wall auth', adminPath: '/admin/features', hint: 'Three-Highlight preview; registered-account browsing on web and phone. Sign-in resumes after age confirmation; hosted data/API acceptance stays separate.' },
  { id: 'operator', label: 'Operator', adminPath: '/admin/games', hint: 'Sideline console.' },
  { id: 'parent', label: 'Parent HQ', adminPath: '/admin/people', hint: 'Guardian consent and custodial.' },
  { id: 'booster', label: 'Booster HQ', adminPath: '/admin/boosters', hint: 'Booster roster portal.' },
  { id: 'sponsor', label: 'Sponsor HQ', adminPath: '/admin/boosters', hint: 'Sponsor placements.' },
  { id: 'sport-quiz', label: 'Sport Quiz', adminPath: '/admin/sport-quiz', hint: 'Trivia, Life Playbook, fresh questions.' },
  { id: 'fan-zone', label: 'Fan Zone', adminPath: '/admin/fan-zone', hint: 'Private campaigns and ballots.' },
  { id: 'web', label: 'Expo web', adminPath: '/admin/money', hint: 'Browser Stripe Payment Element and phone-column shell. Production native Exclusive uses store billing rails.' },
];
