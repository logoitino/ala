/**
 * The production map: every fan-visible control is listed with its admin desk, optional runtime flag and
 * telemetry id. Powers the Overview and Coverage desks ("what is live, what is paused, what is not instrumented").
 * Add a row here whenever you add a fan control. Trivia rows (2026-10-15) add the This week strip, level and Life
 * Playbook opt-in / chapters, and the page Skip now reads "Skip my round this week". QUIZ-05 adds Report a problem,
 * the athlete's Share a fun fact, the Privacy fun facts audience and the guardian's fun-fact Approve / Decline.
 */

import type { AdminNavHref } from '@/lib/admin';
import {   type AppRuntimeFlagPath } from '@/lib/runtime';

export type CoverageSurface =
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
  | 'fan-zone';

export type CoverageControl = {
  id: string;
  label: string;
  hint: string;
  surface: CoverageSurface;
  fanHref: string;
  adminHref: AdminNavHref;
  flag?: AppRuntimeFlagPath;
  telemetry?: string;
  /** `code` means the desk can see it but the values still ship in a binary — that is the builder backlog. */
  owner?: 'desk' | 'code';
};

export const COVERAGE_SURFACES: { id: CoverageSurface; label: string }[] = [
  { id: 'home', label: 'Home · Highlights ⚡' },
  { id: 'beyond', label: 'Beyond the Game' },
  { id: 'local', label: 'Local' },
  { id: 'activity', label: 'Activity' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'drip', label: 'Drip' },
  { id: 'profile', label: 'Profile' },
  { id: 'upload', label: 'Upload +' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'auth', label: 'Soft-Wall auth' },
  { id: 'operator', label: 'Operator' },
  { id: 'parent', label: 'Parent HQ' },
  { id: 'booster', label: 'Booster HQ' },
  { id: 'sponsor', label: 'Sponsor HQ' },
  { id: 'sport-quiz', label: 'Sport Quiz' },
  { id: 'fan-zone', label: 'Fan Zone' },
];

/** @purpose Map existing FUN-01 controls to campaign stop, exact permission and tracked case/removal authority. No passive sensor is invented. */
const fanDiscoverySurfaces: { surface: CoverageSurface; href: string }[] = [
  { surface: 'home', href: '/' }, { surface: 'parent', href: '/parent' }, { surface: 'operator', href: '/operator' },
  { surface: 'booster', href: '/booster' }, { surface: 'sponsor', href: '/sponsor' },
];
const fanStop = 'fan_zone_campaigns status/testing-only pilot admission is the stop authority';
const fanDiscoveryActions = [
  ['open', 'Open Fan Zone', 'Read-only root navigation preserves selected canonical campaign; no automatic entry or ballot'],
  ['dismiss', 'Not now for Fan Zone', 'Local participation presentation only; never hides nonempty private guardian queue; identity and returned campaign period; no persisted server action'],
  ['refresh', 'Refresh Fan Zone discovery', 'Read-only independent source recovery; unavailable is not a healthy zero'],
  ['permissions', 'Review fan permissions', 'Private selected campaign queue, not a global inbox; independent of participation; exact fan_zone_consents'],
  ['entry', 'My fan entry', 'Own server-authorized private entry and recovery even when paused or unenrolled'],
  ['recap', 'View fan recap', 'Only authorized finalized results without pending recount; no invented badge or winner'],
] as const;
const fanPageActions = [
  ['back', 'Back', 'Previous route or current account Home fallback'], ['home', 'Account Home', 'Current role Home, always usable'],
  ['refresh', 'Refresh Fan Zone', 'Read-only snapshot and permission review reset'], ['signin', 'Sign in to join Fan Zone', 'Account route; server age/action capability remains authoritative'],
  ['paths', 'Join the fun / Meet an athlete / Serve together', 'Local path choice; no automatic mutation'],
  ['picker', 'Choose / replace MP4 video', 'Explicit system picker; no upload before action'],
  ['draft', 'Fan alias / caption / rights attestation', 'Local draft fields; not public permission'],
  ['upload', 'Upload private entry', 'Server-reserved bounded MP4 and private fan_zone_entries revision'],
  ['retryUpload', 'Retry private upload', 'Same reserved private revision recovery'], ['replaceUpload', 'Replace failed private draft', 'Explicit failed draft replacement'],
  ['video', 'Open / close exact private video', 'Authenticated revocable producer; first-frame readiness tied to identity/revision/digest/scope'],
  ['vote', 'Vote for candidate', 'Free replaceable per-account/window fan_zone_ballots; no spend/view weights'],
  ['retryVote', 'Retry original ballot', 'Same request and candidate; no offline queue'],
  ['scope', 'Confirm reviewed caption and exact permission scope', 'Local confirmation resets on stale review; not a permission grant'],
  ['permission', 'Grant permission / Assent to exact revision', 'Exact active link/revision/digest/alias/audience fan_zone_consents'],
  ['revoke', 'Revoke my exact permission', 'Server permission revocation and actual serving/access enforcement'],
  ['submit', 'Submit private entry for review', 'Published eligibility/rights/safety review; staff does not select vote winner'],
  ['withdraw', 'Withdraw my entry', 'Withdrawal and tracked actual media/index/access removal'],
  ['story', 'Watch / close curated athlete story', 'Only explicitly selected authorized free story; unavailable does not substitute'],
  ['profile', 'Athlete profile & Donate', 'Existing profile/financial flow; optional and never adds votes'],
  ['serve', 'Optional private service reflection choices', 'Preset nonidentifying fan_zone_reflections; no cash, badge or access condition'],
  ['deleteReflection', 'Delete private reflection', 'Own authorized private reflection removal'],
  ['concern', 'Send concern / entry and details fields', 'Blocked-owner-capable private fan_zone_cases intake; restricted details'],
  ['appeal', 'Appeal entry review', 'Tracked case and review correction; protect safety reasons'],
  ['removal', 'Request media removal', 'Tracked all-revision actual media/provider/index/access removal'],
  ['continueRemoval', 'Continue tracked removal', 'Receipt-based incomplete removal recovery; no premature completion claim'],
  ['receipt', 'Check concern status / receipt ID and secret', 'Private case receipt, no fabricated completion'],
  ['safety', 'Read Minor Safety information', 'Policy information; fan_zone_cases and configured support handle intake'],
] as const;
const fanControls: CoverageControl[] = [
  ...fanDiscoverySurfaces.flatMap(({ surface, href }) => fanDiscoveryActions.map(([action, label, hint]) => ({
    id: `fun.${surface}.${action}`, label: `${label} · ${surface}`, hint: `${hint}; ${fanStop}`, surface, fanHref: href, adminHref: '/admin/fan-zone' as const,
  }))),
  { id: 'fun.profile.open', label: 'Fan Zone', hint: `Generic root /fan-zone link; access checked on page, no all-campaign inbox/history claim; ${fanStop}`, surface: 'profile', fanHref: '/profile', adminHref: '/admin/fan-zone' },
  ...fanPageActions.map(([action, label, hint]) => ({ id: `fun.page.${action}`, label, hint: `${hint}; ${fanStop}`, surface: 'fan-zone' as const, fanHref: '/fan-zone', adminHref: '/admin/fan-zone' as const })),
];

/**
 * @purpose Production map: every fan-visible control has an admin desk, an optional runtime flag, and a telemetry id.
 */
export const COVERAGE_CONTROLS: CoverageControl[] = [
  { id: 'notifications.profile.open', label: 'Notifications', hint: 'Profile Account sheet; server notification_config pauses reviewed sources; no passive tap metric', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features' },
  { id: 'notifications.profile.masters', label: 'Notification channel switches', hint: 'Recipient notification_preferences.email_enabled/in_app_enabled; choices/history preserved. Server notification_config controls future production; security Auth messages separate', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features' },
  { id: 'notifications.profile.categories', label: 'Category email / in-app choices', hint: 'Recipient revisioned preferences; unsupported sources unavailable, optional email blocked pending provider/unsubscribe. Applies only connected notification sources; legacy queues use own rules', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features' },
  { id: 'notifications.profile.save', label: 'Save notification preferences', hint: 'Expected revision plus captured actor/Auth equality; single-flight. No tap counter; fixed notifications.settings_save_failed issue only', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features' },
  { id: 'notifications.profile.reload', label: 'Reload notification settings', hint: 'Read-only source recovery; notifications.settings_load_failed issue is not a usage metric', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features' },
  { id: 'notifications.profile.close', label: 'Close notification settings', hint: 'Local sheet dismissal; invalidates its captured view lifetime. No runtime switch or tap metric', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features' },
  { id: 'notifications.activity.read', label: 'Mark notification read / unread', hint: 'Own notification_inbox read_at; production pause does not remove history. No tap counter; fixed notifications.inbox_action_failed issue only', surface: 'activity', fanHref: '/activity', adminHref: '/admin/features' },
  { id: 'notifications.activity.markAll', label: 'Mark reviewed notifications read', hint: 'Server account-bound notification_inbox_snapshots cutoff; later arrivals remain unread; no usage metric', surface: 'activity', fanHref: '/activity', adminHref: '/admin/features' },
  { id: 'notifications.activity.archive', label: 'Archive / restore notification', hint: 'Own notification_inbox.archived_at independent of read state; donation/receipt evidence retained; no tap counter', surface: 'activity', fanHref: '/activity', adminHref: '/admin/features' },
  { id: 'notifications.activity.views', label: 'Inbox / archived notifications', hint: 'One20-row server page with current source authorization; no runtime switch for existing history or tap metric', surface: 'activity', fanHref: '/activity', adminHref: '/admin/features' },
  { id: 'notifications.activity.pages', label: 'Next / refresh notification page', hint: 'Bounded read replaces current page; fixed notifications.inbox_action_failed source/action issue only, not usage', surface: 'activity', fanHref: '/activity', adminHref: '/admin/features' },
  { id: 'notifications.activity.open', label: 'Open notification detail', hint: 'Only current server-authorized fixed Profile/Receipts/Activity destination. No arbitrary URL or per-control telemetry', surface: 'activity', fanHref: '/activity', adminHref: '/admin/features' },
  ...fanControls,
  { id: 'quiz.home.open', label: 'Open / Resume quiz · home', hint: 'Root /sport-quiz; navigation does not assign a question; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'home', fanHref: '/', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.home.dismiss', label: 'Not now (local presentation) · home', hint: 'Local auth + canonical profile + returned week; does not save Skip; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'home', fanHref: '/', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.home.skip', label: 'Skip this week · home', hint: 'Only server-confirmed skipped state is saved; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'home', fanHref: '/', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.home.refresh', label: 'Refresh unavailable quiz · home', hint: 'Failed source or unconfirmed Skip; readonly refresh; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'home', fanHref: '/', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.home.history', label: 'Private quiz history · home', hint: 'Own actual private badges and corrections; no invented counts; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'home', fanHref: '/', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.parent.open', label: 'Open / Resume quiz · parent', hint: 'Root /sport-quiz; navigation does not assign a question; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'parent', fanHref: '/parent', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.parent.dismiss', label: 'Not now (local presentation) · parent', hint: 'Local auth + canonical profile + returned week; does not save Skip; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'parent', fanHref: '/parent', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.parent.skip', label: 'Skip this week · parent', hint: 'Only server-confirmed skipped state is saved; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'parent', fanHref: '/parent', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.parent.refresh', label: 'Refresh unavailable quiz · parent', hint: 'Failed source or unconfirmed Skip; readonly refresh; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'parent', fanHref: '/parent', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.parent.history', label: 'Private quiz history · parent', hint: 'Own actual private badges and corrections; no invented counts; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'parent', fanHref: '/parent', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.operator.open', label: 'Open / Resume quiz · operator', hint: 'Root /sport-quiz; navigation does not assign a question; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'operator', fanHref: '/operator', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.operator.dismiss', label: 'Not now (local presentation) · operator', hint: 'Local auth + canonical profile + returned week; does not save Skip; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'operator', fanHref: '/operator', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.operator.skip', label: 'Skip this week · operator', hint: 'Only server-confirmed skipped state is saved; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'operator', fanHref: '/operator', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.operator.refresh', label: 'Refresh unavailable quiz · operator', hint: 'Failed source or unconfirmed Skip; readonly refresh; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'operator', fanHref: '/operator', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.operator.history', label: 'Private quiz history · operator', hint: 'Own actual private badges and corrections; no invented counts; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'operator', fanHref: '/operator', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.booster.open', label: 'Open / Resume quiz · booster', hint: 'Root /sport-quiz; navigation does not assign a question; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'booster', fanHref: '/booster', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.booster.dismiss', label: 'Not now (local presentation) · booster', hint: 'Local auth + canonical profile + returned week; does not save Skip; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'booster', fanHref: '/booster', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.booster.skip', label: 'Skip this week · booster', hint: 'Only server-confirmed skipped state is saved; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'booster', fanHref: '/booster', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.booster.refresh', label: 'Refresh unavailable quiz · booster', hint: 'Failed source or unconfirmed Skip; readonly refresh; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'booster', fanHref: '/booster', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.booster.history', label: 'Private quiz history · booster', hint: 'Own actual private badges and corrections; no invented counts; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'booster', fanHref: '/booster', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.sponsor.open', label: 'Open / Resume quiz · sponsor', hint: 'Root /sport-quiz; navigation does not assign a question; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sponsor', fanHref: '/sponsor', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.sponsor.dismiss', label: 'Not now (local presentation) · sponsor', hint: 'Local auth + canonical profile + returned week; does not save Skip; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sponsor', fanHref: '/sponsor', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.sponsor.skip', label: 'Skip this week · sponsor', hint: 'Only server-confirmed skipped state is saved; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sponsor', fanHref: '/sponsor', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.sponsor.refresh', label: 'Refresh unavailable quiz · sponsor', hint: 'Failed source or unconfirmed Skip; readonly refresh; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sponsor', fanHref: '/sponsor', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.sponsor.history', label: 'Private quiz history · sponsor', hint: 'Own actual private badges and corrections; no invented counts; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sponsor', fanHref: '/sponsor', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.profile.history', label: 'Sport Quiz & private history', hint: 'Authenticated root /sport-quiz link across roles; sport_quiz_settings enabled/testing-only pilot allowlist is the participation stop authority', surface: 'profile', fanHref: '/profile', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.back', label: 'Back', hint: 'Previous route or account Home fallback remains usable; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.home', label: 'Account Home', hint: 'Current role home remains usable; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.refresh', label: 'Refresh quiz', hint: 'Readonly source refresh; missing data stays unavailable; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.sport', label: 'Choose sport', hint: 'Explicit sport choice starts one server weekly assignment; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.answer', label: 'Answer question', hint: 'One of four choices; same private completion badge even when wrong; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.retry', label: 'Retry this answer', hint: 'Uncertain answer keeps exact request and choice; no offline queue; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.skip', label: 'Skip my round this week', hint: 'QUIZ-04 Skip spends only the personal round (a QUIZ-03 server still shows Skip this week); only confirmed server Skip persists; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.next', label: 'Next question', hint: 'QUIZ-03 round of up to five; exact Next recovery (same request UUID and position); round size on sport_quiz_settings; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.groups', label: 'Play together groups', hint: 'QUIZ-03 preset-name groups, codes, remove/leave/report; trivia.groups switch on sport_quiz_settings pauses new groups and joins; desk shows counts and audited cases only; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.badges', label: 'Badge shelf & season recap', hint: 'QUIZ-03 private badges with opt-in group visibility; noncash; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.week', label: 'This week strip', hint: 'QUIZ-04 personal, group and (when Life is on for the account) Life Playbook rounds, each with its own weekly spot, written in words; read-only; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.level', label: 'Your level', hint: 'QUIZ-04 private level from facts learned in every kind of round; never drops; level thresholds are in the Trivia desk Settings; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.life.optin', label: 'Turn on Life Playbook / Not now / About Life Playbook', hint: 'QUIZ-04 private opt-in card with notice life-playbook-v1-testing, shown only while trivia.life (sport_quiz_settings.life_enabled) is on; 13+ eligible accounts only; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.life.chapters', label: 'Life Playbook chapters', hint: 'QUIZ-04 only server-returned open chapters (Any open chapter / Choose a chapter); a chapter opens at 5 approved questions and the Trivia desk chapter switch; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.life.start', label: 'Start Life Playbook round', hint: 'QUIZ-04 separate weekly Life round (90 or 30 seconds) with its own notice checkbox; trivia.life off ends open Life rounds; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.life.off', label: 'Turn off Life Playbook', hint: 'QUIZ-04 own opt-out; ends an open Life round and keeps private history; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.profile.learn', label: 'Learn your athlete’s sport', hint: 'QUIZ-03 card on another athlete’s profile; preselects the sport for the viewer’s own weekly round; shown only when trivia is ready for the viewer; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'profile', fanHref: '/profile', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.page.report', label: 'Report a problem with this question', hint: 'QUIZ-05 after the reveal only; fixed reasons, no free text; one per question, 10 a day; report intake can be paused from the Trivia control tower; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'sport-quiz', fanHref: '/sport-quiz', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.profile.funfacts', label: 'Share a fun fact', hint: 'QUIZ-05 athlete Edit profile and optional sign-up step; six preset prompts, admin check, guardian approval under 16, Remove any time; trivia.athlete_questions (off) pauses new fun facts; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'profile', fanHref: '/profile', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.profile.funfacts.audience', label: 'Fun facts audience', hint: 'QUIZ-05 Privacy item fun_facts (default friends; 13–15 capped at friends by the server); sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'profile', fanHref: '/profile', adminHref: '/admin/sport-quiz' },
  { id: 'quiz.parent.funfacts', label: 'Approve or decline a fun fact · parent', hint: 'QUIZ-05 guardian of an under-16 approves or declines only (never writes, edits or withdraws); an admin checks after; sport_quiz_settings enabled/testing-only pilot allowlist is the stop authority', surface: 'parent', fanHref: '/parent', adminHref: '/admin/sport-quiz' },
  { id: 'tab.home', label: 'Home tab', hint: 'Fan bar', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'tabs.home', telemetry: 'tab.home' },
  { id: 'home_search', label: 'Clip search', hint: 'Highlights ⚡ search', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'layouts.homeSearch', telemetry: 'home_search' },
  { id: 'feed.home', label: 'Home mix pill', hint: 'For You ranking', surface: 'home', fanHref: '/', adminHref: '/admin/highlights', telemetry: 'feed.home' },
  { id: 'feed.all', label: 'All pill', hint: 'Full clip list', surface: 'home', fanHref: '/', adminHref: '/admin/highlights', telemetry: 'feed.all' },
  { id: 'feed.seki', label: 'Seki mix', hint: 'Not on the Highlight bar. Home, search, and Local are the controls.', surface: 'home', fanHref: '/', adminHref: '/admin/highlights', telemetry: 'feed.seki' },
  { id: 'live_banner', label: 'Live scoreboard', hint: 'Tap through to Local game', surface: 'home', fanHref: '/', adminHref: '/admin/games', flag: 'layouts.liveMatches', telemetry: 'live_banner' },
  { id: 'rivalry_week', label: 'Rivalry week', hint: 'Active rivalry → Local School Polls', surface: 'home', fanHref: '/', adminHref: '/admin/polls', flag: 'layouts.cheerPolls', telemetry: 'rivalry_week' },
  { id: 'slang', label: 'Slang guide', hint: 'Donations / Seki explainer', surface: 'home', fanHref: '/', adminHref: '/admin/look', flag: 'layouts.slangGuide', telemetry: 'slang' },
  { id: 'home_banner', label: 'Campaign banner', hint: 'Look Copy title/body', surface: 'home', fanHref: '/', adminHref: '/admin/look', telemetry: 'home_banner' },
  { id: 'spotlight_modal', label: 'Player of the Week modal', hint: 'Home launch popup', surface: 'home', fanHref: '/', adminHref: '/admin/spotlight', flag: 'layouts.spotlightModal' },
  { id: 'hype.seki', label: 'Seki', hint: '🤙 rail', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.seki', telemetry: 'hype.seki' },
  { id: 'hype.aura', label: 'Aura', hint: '⚡ rail + double-tap', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.aura', telemetry: 'hype.aura' },
  { id: 'hype.flex', label: 'Flex', hint: '💪 rail', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.flex', telemetry: 'hype.flex' },
  { id: 'malo', label: 'Donate', hint: 'Athlete-named donate rail; PaymentSheet only when tag is confirmed', surface: 'home', fanHref: '/', adminHref: '/admin/money', flag: 'buttons.malo', telemetry: 'malo' },
  { id: 'more', label: 'More sheet', hint: 'Share / Save / Report', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.more', telemetry: 'more' },
  { id: 'share', label: 'Share', hint: 'Deep link sheet', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.more', telemetry: 'share' },
  { id: 'save', label: 'Save', hint: 'saved_reels bookmark', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.more', telemetry: 'save' },
  { id: 'report', label: 'Report / Hide', hint: 'Moderation queue', surface: 'home', fanHref: '/', adminHref: '/admin/moderation', flag: 'buttons.more', telemetry: 'report' },
  { id: 'suggest', label: 'Suggest an improvement', hint: 'Feedback inbox', surface: 'home', fanHref: '/', adminHref: '/admin/feedback', flag: 'buttons.suggest', telemetry: 'suggestion' },
  { id: 'vault_unlock', label: 'Open Vault', hint: 'Exclusive PaymentSheet', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.vault', telemetry: 'vault_unlock' },
  { id: 'athlete_profile', label: 'Athlete name', hint: 'Opens /user/[id]', surface: 'home', fanHref: '/', adminHref: '/admin/athletes', telemetry: 'athlete_profile' },
  { id: 'home_search_pills', label: 'Search kind pills', hint: 'Clips / athletes / schools in the overlay', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'layouts.homeSearch' },
  { id: 'live_banner_dismiss', label: 'Dismiss scoreboard', hint: 'Swipe the live banner away', surface: 'home', fanHref: '/', adminHref: '/admin/games', flag: 'layouts.liveMatches' },
  { id: 'slang_dismiss', label: 'Dismiss slang guide', hint: 'Hides the donations / Seki line', surface: 'home', fanHref: '/', adminHref: '/admin/look', flag: 'layouts.slangGuide' },
  { id: 'spotlight_modal_actions', label: 'Spotlight modal Donate / Watch', hint: 'Player of the Week popup buttons', surface: 'home', fanHref: '/', adminHref: '/admin/spotlight', flag: 'layouts.spotlightModal' },
  { id: 'reel_unsave', label: 'Remove bookmark', hint: 'More sheet · saved_reels delete', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.more' },
  { id: 'reel_category', label: 'Clip category badge', hint: 'Game Day / Train / Serve labels — Catalogs', surface: 'home', fanHref: '/', adminHref: '/admin/catalog' },

  // BEYOND/CHAL have no new behavioral telemetry; operational counts are bounded RPC snapshots, not engagement outcomes.
  { id: 'tab.beyond', label: 'Beyond (Highlights switch + page)', hint: 'Home-bar Beyond switch and the Beyond the Game page; server contribution switch is separate', surface: 'beyond', fanHref: '/beyond', adminHref: '/admin/features', flag: 'tabs.beyond' },
  { id: 'beyond.categories', label: 'Workouts / Service / Learning / Stories', hint: 'Category filters; reviewed new posts plus eligible legacy workout/service clips', surface: 'beyond', fanHref: '/beyond', adminHref: '/admin/highlights' },
  { id: 'beyond.contribute', label: 'Share a moment', hint: 'Private reservation/upload/review; default-off server control at Highlights desk', surface: 'beyond', fanHref: '/beyond', adminHref: '/admin/highlights' },
  { id: 'beyond.mine', label: 'My submissions and export', hint: 'Own review status/removal; own export; admin erasure and physical cleanup', surface: 'beyond', fanHref: '/beyond', adminHref: '/admin/highlights' },
  { id: 'beyond.report', label: 'Report a concern', hint: 'Immediately holds distribution; reasoned admin review', surface: 'beyond', fanHref: '/beyond', adminHref: '/admin/highlights' },
  { id: 'challenge.respond', label: 'Workout response / friend invitation', hint: 'Preset-only, server eligibility and current actor; no cash/ranking; challenges.enabled', surface: 'beyond', fanHref: '/beyond', adminHref: '/admin/highlights' },
  { id: 'challenge.inbox', label: 'Workout invitations', hint: 'Activity accepted-friend invites; mute/report controls; no delivery promise', surface: 'activity', fanHref: '/activity', adminHref: '/admin/highlights' },
  { id: 'challenge.settings', label: 'Workout settings / private badge', hint: 'Own athlete switch, mutes, private noncash recognition, own-data export', surface: 'profile', fanHref: '/profile', adminHref: '/admin/highlights' },

  { id: 'tab.local', label: 'Local', hint: 'Home pill → /local', surface: 'local', fanHref: '/local', adminHref: '/admin/features', flag: 'tabs.local', telemetry: 'tab.local' },
  { id: 'local_search', label: 'Local Explore', hint: 'Players, schools, sponsors', surface: 'local', fanHref: '/local', adminHref: '/admin/features', flag: 'layouts.localSearch' },
  { id: 'local_directions', label: 'Get directions', hint: 'Public per-game venue address; Games edits/corrects/clears destination. No new runtime flag: clear address disables directions. Fixed tap/failure codes only; no location collection or destination logs.', surface: 'local', fanHref: '/local', adminHref: '/admin/games', telemetry: 'local_directions' },
  { id: 'hub.matches', label: 'Live Matches', hint: 'Scoreboard list', surface: 'local', fanHref: '/local', adminHref: '/admin/games', flag: 'layouts.liveMatches', telemetry: 'hub.matches' },
  { id: 'live_game', label: 'Open match', hint: '/local/game/[id]', surface: 'local', fanHref: '/local', adminHref: '/admin/games', telemetry: 'live_game' },
  { id: 'hub.polls', label: 'School Polls', hint: 'Cheer matchups', surface: 'local', fanHref: '/local', adminHref: '/admin/polls', flag: 'layouts.cheerPolls', telemetry: 'hub.polls' },
  { id: 'cheer_poll', label: 'Cast a cheer', hint: 'cast_cheer_vote', surface: 'local', fanHref: '/local', adminHref: '/admin/polls', telemetry: 'cheer_poll' },
  { id: 'hub.boosters', label: 'Top Boosters', hint: 'Sponsorship rail', surface: 'local', fanHref: '/local', adminHref: '/admin/boosters', flag: 'layouts.topBoosters', telemetry: 'hub.boosters' },
  { id: 'sponsorship', label: 'Become a sponsor', hint: 'Silver / Gold / Platinum', surface: 'local', fanHref: '/local', adminHref: '/admin/boosters', flag: 'layouts.sponsorshipModal', telemetry: 'sponsorship' },
  { id: 'local_hub_chips', label: 'Board chips', hint: 'Matches / Polls / Boosters labels in Look Copy', surface: 'local', fanHref: '/local', adminHref: '/admin/look' },
  { id: 'local_regions', label: 'Region filters', hint: 'Utah County / Salt Lake / Rivalry — Catalogs', surface: 'local', fanHref: '/local', adminHref: '/admin/catalog' },
  { id: 'local_school_filter', label: 'School poll filter', hint: 'Tap a school, then Clear', surface: 'local', fanHref: '/local', adminHref: '/admin/polls', flag: 'layouts.cheerPolls' },
  { id: 'local_explore_filters', label: 'Explore result filters', hint: 'Players / schools / sponsors + favorites', surface: 'local', fanHref: '/local', adminHref: '/admin/features', flag: 'layouts.localSearch' },
  { id: 'booster_peek', label: 'Top Booster card', hint: 'Peek the booster profile', surface: 'local', fanHref: '/local', adminHref: '/admin/boosters', flag: 'layouts.topBoosters' },
  { id: 'sponsor_tiers', label: 'Sponsor tier prices', hint: 'Silver / Gold / Platinum dollars — Catalogs', surface: 'local', fanHref: '/local', adminHref: '/admin/catalog' },
  { id: 'game_feed_tabs', label: 'Game Feed / Roster tabs', hint: '/local/game/[id]', surface: 'local', fanHref: '/local', adminHref: '/admin/games' },
  { id: 'game_notify', label: 'Game notifications', hint: 'Score / Seki / final alerts on the match sheet', surface: 'local', fanHref: '/local', adminHref: '/admin/games' },
  { id: 'game_roster_profile', label: 'Roster athlete', hint: 'Opens /user/[id] from the match roster', surface: 'local', fanHref: '/local', adminHref: '/admin/athletes' },
  { id: 'game_play_malo', label: 'Play-card Donate', hint: 'Compact donate on a live play', surface: 'local', fanHref: '/local', adminHref: '/admin/money', flag: 'buttons.malo' },

  { id: 'tab.activity', label: 'Activity tab', hint: 'Fan bar', surface: 'activity', fanHref: '/activity', adminHref: '/admin/features', flag: 'tabs.activity', telemetry: 'tab.activity' },
  { id: 'activity.receipts', label: 'Open a donation receipt', hint: 'Sent row → /receipts', surface: 'activity', fanHref: '/activity', adminHref: '/admin/features', flag: 'tabs.activity', telemetry: 'activity.receipts' },
  { id: 'activity.tag', label: 'Review a pending tag', hint: 'Tag row → Profile', surface: 'activity', fanHref: '/activity', adminHref: '/admin/spotlight', flag: 'tabs.activity', telemetry: 'activity.tag' },
  { id: 'activity.thanks', label: 'Say thanks from a donation', hint: 'Received row → Profile donor list', surface: 'activity', fanHref: '/activity', adminHref: '/admin/money', flag: 'tabs.activity', telemetry: 'activity.thanks' },

  { id: 'tab.spotlight', label: 'Spotlight tab', hint: 'Fan bar', surface: 'spotlight', fanHref: '/spotlight', adminHref: '/admin/features', flag: 'tabs.spotlight', telemetry: 'tab.spotlight' },
  { id: 'spotlight_card', label: 'Award card', hint: 'Replay Player of the Week', surface: 'spotlight', fanHref: '/spotlight', adminHref: '/admin/spotlight', telemetry: 'spotlight_card' },
  { id: 'leaderboards', label: 'Boards', hint: 'Players (hype / views), Highlights, Schools, Fans — this week', surface: 'spotlight', fanHref: '/spotlight', adminHref: '/admin/features', flag: 'layouts.leaderboards', telemetry: 'leaderboards' },

  { id: 'tab.drip', label: 'Drip', hint: 'Profile menu; existing route and switch', surface: 'drip', fanHref: '/drip', adminHref: '/admin/features', flag: 'tabs.drip', telemetry: 'tab.drip' },
  { id: 'drip_item', label: 'Gear card', hint: 'Opens ProductSheet', surface: 'drip', fanHref: '/drip', adminHref: '/admin/drip', telemetry: 'drip_item' },
  { id: 'drip_buy', label: 'Buy Now', hint: 'PaymentSheet + shop_orders', surface: 'drip', fanHref: '/drip', adminHref: '/admin/drip', telemetry: 'drip_buy' },
  { id: 'drip_categories', label: 'Category chips', hint: 'Chip labels live in Look Copy', surface: 'drip', fanHref: '/drip', adminHref: '/admin/look' },
  { id: 'drip_size_qty', label: 'Size + quantity', hint: 'ProductSheet picker, clamped to stock', surface: 'drip', fanHref: '/drip', adminHref: '/admin/drip' },

  { id: 'tab.profile', label: 'Profile tab', hint: 'Fan bar', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'tabs.profile', telemetry: 'tab.profile' },
  { id: 'subscribe', label: 'Subscribe', hint: 'One-time Exclusive on the Vault', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.subscribe' },
  { id: 'exclusive_price', label: 'Exclusive pass price', hint: 'Dollars + Aura grant', surface: 'profile', fanHref: '/profile', adminHref: '/admin/catalog' },
  { id: 'crew', label: 'Join Crew', hint: 'The Crew ⚡', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.crew' },
  { id: 'vault', label: 'Vault lock', hint: 'Open / Lock Vault', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.vault' },
  { id: 'flashUnlock', label: 'Flash Unlock', hint: '2-hour Crew window', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.flashUnlock' },
  { id: 'profile_suggest', label: 'Send a suggestion', hint: 'Feedback desk', surface: 'profile', fanHref: '/profile', adminHref: '/admin/feedback', flag: 'buttons.suggest', telemetry: 'suggestion' },
  { id: 'profile_stats', label: 'Stats 📊 rows', hint: 'Combine + career per sport (Look hides the tab)', surface: 'profile', fanHref: '/profile', adminHref: '/admin/sports' },
  { id: 'wishlist', label: 'Locker Room Wishlist', hint: 'Gear cards on Stats 📊', surface: 'profile', fanHref: '/profile', adminHref: '/admin/wishlist', flag: 'layouts.wishlist' },
  { id: 'wishlist_gift', label: 'Buy this item for them', hint: 'Retailer link per gear goal', surface: 'profile', fanHref: '/profile', adminHref: '/admin/wishlist', flag: 'layouts.wishlist', telemetry: 'wishlist_gift' },
  { id: 'wishlist_chip_in', label: 'Donate to a gear goal', hint: 'Donation toward gear + 500 Aura equip (first Catalogs preset)', surface: 'profile', fanHref: '/profile', adminHref: '/admin/catalog', flag: 'layouts.wishlist', telemetry: 'wishlist_chip_in' },
  { id: 'rally_card', label: 'Rally goal card', hint: 'Named cost + story + progress on the athlete profile', surface: 'profile', fanHref: '/profile', adminHref: '/admin/money', telemetry: 'rally_card' },
  { id: 'rally_donate', label: 'Donate to a Rally', hint: 'Rally card → donate sheet (origin rally)', surface: 'profile', fanHref: '/profile', adminHref: '/admin/money', flag: 'buttons.malo', telemetry: 'rally_donate' },
  { id: 'rally_create', label: 'Start / approve a Rally', hint: 'Athlete starts, guardian approves (Parent HQ)', surface: 'profile', fanHref: '/profile', adminHref: '/admin/money', telemetry: 'rally_create' },
  { id: 'say_thanks', label: 'Say thanks to donors', hint: 'Preset thank-yous on Support received', surface: 'profile', fanHref: '/profile', adminHref: '/admin/money', telemetry: 'say_thanks' },
  { id: 'share_qr', label: 'Share & Donate QR', hint: 'ShareQrModal gift flyer /gift/{username or athlete id}; Profile, Rally, Locker, Parent HQ; landing has Donate', surface: 'profile', fanHref: '/profile', adminHref: '/admin/people', telemetry: 'share_qr', owner: 'code' },
  { id: 'coach_level', label: 'Coach-level move', hint: 'Badge on a labelled workout. The uploader switch and Risky without a coach report hide when layouts.coachLevel is off. A label already set stays visible.', surface: 'home', fanHref: '/', adminHref: '/admin/highlights', flag: 'layouts.coachLevel' },
  { id: 'rally_share', label: 'Share a filled Rally', hint: 'Share sheet on the goal-reached moment. No new table.', surface: 'home', fanHref: '/', adminHref: '/admin/money' },
  { id: 'profile_avatar', label: 'Profile photo', hint: 'ProfileAvatarPicker 1:1 crop → avatars bucket', surface: 'profile', fanHref: '/profile', adminHref: '/admin/people', telemetry: 'profile_avatar', owner: 'code' },
  { id: 'profile_tabs', label: 'Highlights / Stats / Vault tabs', hint: 'Look hides a pane; Sports fills Stats', surface: 'profile', fanHref: '/profile', adminHref: '/admin/look' },
  { id: 'profile_malo', label: 'Donate to athlete', hint: 'Profile quick donate naming the athlete — first Catalogs preset', surface: 'profile', fanHref: '/profile', adminHref: '/admin/catalog', flag: 'buttons.malo' },
  { id: 'profile_role', label: 'Account capability', hint: 'Fan / athlete / parent / operator switch', surface: 'profile', fanHref: '/profile', adminHref: '/admin/people' },
  { id: 'profile_onboarding', label: 'Athlete onboarding fields', hint: 'Sport, team, position (class years on Catalogs)', surface: 'profile', fanHref: '/profile', adminHref: '/admin/sports' },
  { id: 'class_years', label: 'Class year pills', hint: 'Onboarding graduation years', surface: 'profile', fanHref: '/profile', adminHref: '/admin/catalog' },
  { id: 'profile_payout', label: 'Stripe Connect payout', hint: 'PayoutSetupCard identity + custodial; legal ack first', surface: 'profile', fanHref: '/profile', adminHref: '/admin/money' },
  { id: 'legal_terms', label: 'Terms of Service & NIL Compliance', hint: 'Profile hamburger LegalModal', surface: 'profile', fanHref: '/profile', adminHref: '/admin/people', telemetry: 'legal_terms', owner: 'code' },
  { id: 'legal_ack', label: 'Legal acknowledgement', hint: 'Required on Claim School Verification and before Connect Bank', surface: 'profile', fanHref: '/profile', adminHref: '/admin/money', telemetry: 'legal_ack', owner: 'code' },
  { id: 'athlete_verify', label: 'Claim School Verification', hint: 'VerifyAthleteModal team code / coach request', surface: 'profile', fanHref: '/profile', adminHref: '/admin/people', telemetry: 'athlete_verify', owner: 'code' },
  { id: 'profile_crew_badge', label: 'Teammates 🤝 badge', hint: 'Mutual crew count', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.crew' },
  { id: 'profile_menu', label: 'Profile hamburger', hint: 'Account Settings sheet', surface: 'profile', fanHref: '/profile', adminHref: '/admin/look', telemetry: 'profile_menu', owner: 'desk' },
  { id: 'team_roster', label: 'Active Team Roster', hint: 'Schoolmates under Highlights; athletes see Claimed', surface: 'profile', fanHref: '/profile', adminHref: '/admin/athletes', telemetry: 'team_roster', owner: 'desk' },
  { id: 'vault_qna', label: 'Vault Q&A request', hint: 'Subscriber ask box', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.subscribe' },
  { id: 'athlete_reel_vault', label: 'Move own clip to Vault', hint: 'Athlete long-press manager', surface: 'profile', fanHref: '/profile', adminHref: '/admin/highlights', flag: 'buttons.vault' },
  { id: 'trading_card_flip', label: 'Trading card flip', hint: 'Aura card from menu (Look showCard)', surface: 'profile', fanHref: '/profile', adminHref: '/admin/look', flag: 'profile.showCard', telemetry: 'trading_card_flip' },
  { id: 'tag_confirm', label: "That's them / Not them", hint: 'Athlete, parent, and operator tag queues', surface: 'profile', fanHref: '/profile', adminHref: '/admin/spotlight' },
  { id: 'receipts', label: 'Donation History & Receipts', hint: '/receipts', surface: 'receipts', fanHref: '/receipts', adminHref: '/admin/money', flag: 'layouts.receipts', telemetry: 'receipts' },
  { id: 'receipt_open_clip', label: 'Receipt → highlight', hint: 'Jump from a receipt to the clip', surface: 'receipts', fanHref: '/receipts', adminHref: '/admin/highlights', flag: 'layouts.receipts' },
  { id: 'malo_amounts', label: 'Donation amount presets', hint: 'Amount chips + cover fee — Catalogs', surface: 'receipts', fanHref: '/receipts', adminHref: '/admin/catalog' },

  { id: 'soft_wall.malo', label: 'Donate Soft Wall', hint: 'Guest donate → SoftWallModal → resume donate sheet', surface: 'auth', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.malo', telemetry: 'soft_wall.malo', owner: 'code' },
  { id: 'soft_wall.crew', label: 'Crew Soft Wall', hint: 'Guest Join Crew → SoftWallModal → resume toggle', surface: 'auth', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.crew', telemetry: 'soft_wall.crew', owner: 'code' },
  { id: 'soft_wall.wishlist', label: 'Gear goal Soft Wall', hint: 'Guest gear-goal donate → SoftWallModal → resume checkout', surface: 'auth', fanHref: '/profile', adminHref: '/admin/wishlist', flag: 'layouts.wishlist', telemetry: 'soft_wall.wishlist', owner: 'code' },
  { id: 'welcome_overlay', label: 'Welcome overlay', hint: 'First-open Watch highlights (no account wall)', surface: 'auth', fanHref: '/', adminHref: '/admin/features', telemetry: 'welcome_overlay', owner: 'code' },
  { id: 'auth.password', label: 'Email + password Sign in', hint: 'SoftWallModal credential form', surface: 'auth', fanHref: '/', adminHref: '/admin/people', telemetry: 'auth.password', owner: 'code' },
  { id: 'auth.apple', label: 'Continue with Apple', hint: 'SoftWallModal · alasports://auth/callback', surface: 'auth', fanHref: '/', adminHref: '/admin/people', telemetry: 'auth.apple', owner: 'code' },
  { id: 'auth.google', label: 'Continue with Google', hint: 'SoftWallModal · OAuth browser', surface: 'auth', fanHref: '/', adminHref: '/admin/people', telemetry: 'auth.google', owner: 'code' },
  { id: 'auth.magic_link', label: 'Send Magic Link', hint: 'SoftWallModal · email OTP', surface: 'auth', fanHref: '/', adminHref: '/admin/people', telemetry: 'auth.magic_link', owner: 'code' },
  { id: 'auth.demo', label: 'Continue as Demo Fan', hint: 'demo@tapuai.app password session · QA', surface: 'auth', fanHref: '/', adminHref: '/admin/people', telemetry: 'auth.demo', owner: 'code' },
  { id: 'browse_guest', label: 'Guest browse hub', hint: 'Highlights / cards / wishlist view without session', surface: 'auth', fanHref: '/', adminHref: '/admin/coverage', owner: 'code' },

  { id: 'tab.upload', label: 'Upload +', hint: 'Center FAB', surface: 'upload', fanHref: '/', adminHref: '/admin/features', flag: 'tabs.upload', telemetry: 'tab.upload' },
  { id: 'upload', label: 'Publish Reel', hint: 'reels Storage (fallback game_highlights)', surface: 'upload', fanHref: '/', adminHref: '/admin/highlights', telemetry: 'upload' },
  { id: 'upload_library', label: 'Camera Roll picker', hint: 'HighlightPickerModal 45s + compress overlay', surface: 'upload', fanHref: '/', adminHref: '/admin/highlights', flag: 'tabs.upload', telemetry: 'upload' },
  { id: 'upload_source', label: 'Library vs Record', hint: 'Clip source picker', surface: 'upload', fanHref: '/', adminHref: '/admin/features', flag: 'tabs.upload' },
  { id: 'upload_category', label: 'Upload category pills', hint: 'Game Day / Train / Serve labels — Catalogs', surface: 'upload', fanHref: '/', adminHref: '/admin/catalog', flag: 'tabs.upload' },
  { id: 'upload_vault', label: 'Vault-only toggle', hint: 'Publish straight to the Vault', surface: 'upload', fanHref: '/', adminHref: '/admin/highlights', flag: 'buttons.vault' },
  { id: 'upload_tag', label: 'Tag the athlete', hint: 'Pending tag until confirmed', surface: 'upload', fanHref: '/', adminHref: '/admin/spotlight', flag: 'tabs.upload' },

  { id: 'operator', label: 'Operator console', hint: 'Sideline scorekeeper', surface: 'operator', fanHref: '/operator', adminHref: '/admin/games', flag: 'layouts.operatorConsole' },
  { id: 'operator_claim', label: 'Claim game (PIN)', hint: 'Operator PIN', surface: 'operator', fanHref: '/operator', adminHref: '/admin/games', flag: 'layouts.operatorConsole', telemetry: 'operator_claim' },
  { id: 'operator_checkin', label: 'GPS check-in', hint: 'operator_checkins', surface: 'operator', fanHref: '/operator', adminHref: '/admin/games', flag: 'layouts.operatorConsole', telemetry: 'operator_checkin' },
  { id: 'operator_scorer', label: 'Player-tagged macros', hint: '/operator/scorer', surface: 'operator', fanHref: '/operator', adminHref: '/admin/games', flag: 'layouts.operatorConsole', telemetry: 'operator_scorer' },
  { id: 'operator_score_buttons', label: 'Score buttons', hint: 'Per-sport points playbook', surface: 'operator', fanHref: '/operator', adminHref: '/admin/sports', flag: 'layouts.operatorConsole' },
  { id: 'operator_periods', label: 'Period chips + clock', hint: 'Quarters / halves / sets / innings', surface: 'operator', fanHref: '/operator', adminHref: '/admin/sports', flag: 'layouts.operatorConsole' },
  { id: 'operator_callouts', label: 'Sideline callouts', hint: 'Broadcast buttons fans see', surface: 'operator', fanHref: '/operator', adminHref: '/admin/sports', flag: 'layouts.operatorConsole' },
  { id: 'operator_clock', label: 'Start / pause clock', hint: 'Only for sports that use a clock', surface: 'operator', fanHref: '/operator', adminHref: '/admin/sports', flag: 'layouts.operatorConsole' },
  { id: 'operator_leave', label: 'Leave console', hint: 'Hands the game back', surface: 'operator', fanHref: '/operator', adminHref: '/admin/games', flag: 'layouts.operatorConsole' },
  { id: 'operator_status', label: 'Match status', hint: 'Scheduled / live / halftime / Final', surface: 'operator', fanHref: '/operator', adminHref: '/admin/games', flag: 'layouts.operatorConsole' },
  { id: 'parent', label: 'Parent HQ', hint: 'Consent and tags', surface: 'parent', fanHref: '/parent', adminHref: '/admin/people', flag: 'layouts.parentHq' },
  { id: 'parent_consent', label: 'Approve / revoke consent', hint: 'players.parental_consent_approved', surface: 'parent', fanHref: '/parent', adminHref: '/admin/people', flag: 'layouts.parentHq', telemetry: 'parent_consent' },
  { id: 'parent_payout', label: 'Custodial payout', hint: 'Stripe Connect', surface: 'parent', fanHref: '/parent', adminHref: '/admin/money', flag: 'layouts.parentHq', telemetry: 'parent_payout' },
  { id: 'booster', label: 'Booster HQ', hint: 'Roster CSV', surface: 'booster', fanHref: '/booster', adminHref: '/admin/boosters', flag: 'layouts.boosterHq' },
  { id: 'booster_csv', label: 'Upload roster CSV', hint: 'players insert', surface: 'booster', fanHref: '/booster', adminHref: '/admin/athletes', flag: 'layouts.boosterHq', telemetry: 'booster_csv' },
  { id: 'booster_verify', label: 'Verify profile', hint: 'verification_requests', surface: 'booster', fanHref: '/booster', adminHref: '/admin/people', flag: 'layouts.boosterHq', telemetry: 'booster_verify' },
  { id: 'sponsor', label: 'Sponsor HQ', hint: 'Sideline ads', surface: 'sponsor', fanHref: '/sponsor', adminHref: '/admin/boosters', flag: 'layouts.sponsorHq' },
  { id: 'sponsor_sideline', label: 'Place sideline board', hint: 'sponsor_ads', surface: 'sponsor', fanHref: '/sponsor', adminHref: '/admin/boosters', flag: 'layouts.sponsorHq', telemetry: 'sponsor_sideline' },
  { id: 'sponsor_rivalry', label: 'Publish rivalry banner', hint: 'sponsor_ads', surface: 'sponsor', fanHref: '/sponsor', adminHref: '/admin/boosters', flag: 'layouts.sponsorHq', telemetry: 'sponsor_rivalry' },
];
