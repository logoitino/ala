import type { AdminNavHref } from '@/lib/admin';
import { getRuntimeFlag, type AppRuntimeConfig, type AppRuntimeFlagPath } from '@/lib/runtime';

export type CoverageSurface =
  | 'home'
  | 'local'
  | 'spotlight'
  | 'drip'
  | 'profile'
  | 'upload'
  | 'receipts'
  | 'operator'
  | 'parent'
  | 'booster'
  | 'sponsor'
  | 'auth';

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
  { id: 'local', label: 'Local' },
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
];

/**
 * @purpose Production map: every fan-visible control has an admin desk, an optional runtime flag, and a telemetry id.
 */
export const COVERAGE_CONTROLS: CoverageControl[] = [
  { id: 'tab.home', label: 'Home tab', hint: 'Fan bar', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'tabs.home', telemetry: 'tab.home' },
  { id: 'home_search', label: 'Clip search', hint: 'Highlights ⚡ search', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'layouts.homeSearch', telemetry: 'home_search' },
  { id: 'feed.home', label: 'Home mix pill', hint: 'For You ranking', surface: 'home', fanHref: '/', adminHref: '/admin/highlights', telemetry: 'feed.home' },
  { id: 'feed.all', label: 'All pill', hint: 'Full clip list', surface: 'home', fanHref: '/', adminHref: '/admin/highlights', telemetry: 'feed.all' },
  { id: 'feed.seki', label: 'Seki pill', hint: 'Seki-only mix', surface: 'home', fanHref: '/', adminHref: '/admin/highlights', telemetry: 'feed.seki' },
  { id: 'live_banner', label: 'Live scoreboard', hint: 'Tap through to Local game', surface: 'home', fanHref: '/', adminHref: '/admin/games', flag: 'layouts.liveMatches', telemetry: 'live_banner' },
  { id: 'slang', label: 'Slang guide', hint: 'Mālo / Seki explainer', surface: 'home', fanHref: '/', adminHref: '/admin/look', flag: 'layouts.slangGuide', telemetry: 'slang' },
  { id: 'home_banner', label: 'Campaign banner', hint: 'Look Copy title/body', surface: 'home', fanHref: '/', adminHref: '/admin/look', telemetry: 'home_banner' },
  { id: 'spotlight_modal', label: 'Player of the Week modal', hint: 'Home launch popup', surface: 'home', fanHref: '/', adminHref: '/admin/spotlight', flag: 'layouts.spotlightModal' },
  { id: 'hype.seki', label: 'Seki', hint: '🤙 rail', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.seki', telemetry: 'hype.seki' },
  { id: 'hype.aura', label: 'Aura', hint: '⚡ rail + double-tap', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.aura', telemetry: 'hype.aura' },
  { id: 'hype.flex', label: 'Flex', hint: '💪 rail', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.flex', telemetry: 'hype.flex' },
  { id: 'malo', label: 'Mālo', hint: 'Athlete-named tip rail; PaymentSheet only when tag is confirmed', surface: 'home', fanHref: '/', adminHref: '/admin/money', flag: 'buttons.malo', telemetry: 'malo' },
  { id: 'more', label: 'More sheet', hint: 'Share / Save / Report', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.more', telemetry: 'more' },
  { id: 'share', label: 'Share', hint: 'Deep link sheet', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.more', telemetry: 'share' },
  { id: 'save', label: 'Save', hint: 'saved_reels bookmark', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.more', telemetry: 'save' },
  { id: 'report', label: 'Report / Hide', hint: 'Moderation queue', surface: 'home', fanHref: '/', adminHref: '/admin/moderation', flag: 'buttons.more', telemetry: 'report' },
  { id: 'suggest', label: 'Suggest an improvement', hint: 'Feedback inbox', surface: 'home', fanHref: '/', adminHref: '/admin/feedback', flag: 'buttons.suggest', telemetry: 'suggestion' },
  { id: 'vault_unlock', label: 'Open Vault', hint: 'Exclusive PaymentSheet', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.vault', telemetry: 'vault_unlock' },
  { id: 'athlete_profile', label: 'Athlete name', hint: 'Opens /user/[id]', surface: 'home', fanHref: '/', adminHref: '/admin/athletes', telemetry: 'athlete_profile' },
  { id: 'home_search_pills', label: 'Search kind pills', hint: 'Clips / athletes / schools in the overlay', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'layouts.homeSearch' },
  { id: 'live_banner_dismiss', label: 'Dismiss scoreboard', hint: 'Swipe the live banner away', surface: 'home', fanHref: '/', adminHref: '/admin/games', flag: 'layouts.liveMatches' },
  { id: 'slang_dismiss', label: 'Dismiss slang guide', hint: 'Hides the Mālo / Seki line', surface: 'home', fanHref: '/', adminHref: '/admin/look', flag: 'layouts.slangGuide' },
  { id: 'spotlight_modal_actions', label: 'Spotlight modal Mālo / Watch', hint: 'Player of the Week popup buttons', surface: 'home', fanHref: '/', adminHref: '/admin/spotlight', flag: 'layouts.spotlightModal' },
  { id: 'reel_unsave', label: 'Remove bookmark', hint: 'More sheet · saved_reels delete', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.more' },
  { id: 'reel_category', label: 'Clip category badge', hint: 'Game Play / Train / Serve labels — Catalogs', surface: 'home', fanHref: '/', adminHref: '/admin/catalog' },

  { id: 'tab.local', label: 'Local tab', hint: 'Fan bar', surface: 'local', fanHref: '/local', adminHref: '/admin/features', flag: 'tabs.local', telemetry: 'tab.local' },
  { id: 'local_search', label: 'Local Explore', hint: 'Players, schools, sponsors', surface: 'local', fanHref: '/local', adminHref: '/admin/features', flag: 'layouts.localSearch' },
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
  { id: 'game_play_malo', label: 'Play-card Mālo', hint: 'Compact tip on a live play', surface: 'local', fanHref: '/local', adminHref: '/admin/money', flag: 'buttons.malo' },

  { id: 'tab.spotlight', label: 'Spotlight tab', hint: 'Fan bar', surface: 'spotlight', fanHref: '/spotlight', adminHref: '/admin/features', flag: 'tabs.spotlight', telemetry: 'tab.spotlight' },
  { id: 'spotlight_card', label: 'Award card', hint: 'Replay Player of the Week', surface: 'spotlight', fanHref: '/spotlight', adminHref: '/admin/spotlight', telemetry: 'spotlight_card' },

  { id: 'tab.drip', label: 'Drip tab', hint: 'Fan bar', surface: 'drip', fanHref: '/drip', adminHref: '/admin/features', flag: 'tabs.drip', telemetry: 'tab.drip' },
  { id: 'drip_item', label: 'Gear card', hint: 'Opens ProductSheet', surface: 'drip', fanHref: '/drip', adminHref: '/admin/drip', telemetry: 'drip_item' },
  { id: 'drip_buy', label: 'Buy Now', hint: 'PaymentSheet + shop_orders', surface: 'drip', fanHref: '/drip', adminHref: '/admin/drip', telemetry: 'drip_buy' },
  { id: 'drip_categories', label: 'Category chips', hint: 'Chip labels live in Look Copy', surface: 'drip', fanHref: '/drip', adminHref: '/admin/look' },
  { id: 'drip_size_qty', label: 'Size + quantity', hint: 'ProductSheet picker, clamped to stock', surface: 'drip', fanHref: '/drip', adminHref: '/admin/drip' },

  { id: 'tab.profile', label: 'Profile tab', hint: 'Fan bar', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'tabs.profile', telemetry: 'tab.profile' },
  { id: 'subscribe', label: 'Subscribe', hint: 'Exclusive pass on/off', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.subscribe' },
  { id: 'exclusive_price', label: 'Exclusive pass price', hint: 'Dollars + Aura grant', surface: 'profile', fanHref: '/profile', adminHref: '/admin/catalog' },
  { id: 'crew', label: 'Join Crew', hint: 'The Crew ⚡', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.crew' },
  { id: 'vault', label: 'Vault lock', hint: 'Open / Lock Vault', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.vault' },
  { id: 'flashUnlock', label: 'Flash Unlock', hint: '2-hour Crew window', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.flashUnlock' },
  { id: 'profile_suggest', label: 'Send a suggestion', hint: 'Feedback desk', surface: 'profile', fanHref: '/profile', adminHref: '/admin/feedback', flag: 'buttons.suggest', telemetry: 'suggestion' },
  { id: 'profile_stats', label: 'Stats 📊 rows', hint: 'Combine + career per sport (Look hides the tab)', surface: 'profile', fanHref: '/profile', adminHref: '/admin/sports' },
  { id: 'wishlist', label: 'Locker Room Wishlist', hint: 'Gear cards on Stats 📊', surface: 'profile', fanHref: '/profile', adminHref: '/admin/wishlist', flag: 'layouts.wishlist' },
  { id: 'wishlist_gift', label: 'Gift Item Directly', hint: 'Retailer link per gear goal', surface: 'profile', fanHref: '/profile', adminHref: '/admin/wishlist', flag: 'layouts.wishlist', telemetry: 'wishlist_gift' },
  { id: 'wishlist_chip_in', label: 'Chip In', hint: 'Mālo toward gear + 500 Aura equip (first Catalogs preset)', surface: 'profile', fanHref: '/profile', adminHref: '/admin/catalog', flag: 'layouts.wishlist', telemetry: 'wishlist_chip_in' },
  { id: 'share_qr', label: 'Share & Fund QR', hint: 'ShareQrModal gift flyer tapuai.app/gift/{handle}', surface: 'profile', fanHref: '/profile', adminHref: '/admin/people', telemetry: 'share_qr', owner: 'code' },
  { id: 'profile_avatar', label: 'Profile photo', hint: 'ProfileAvatarPicker 1:1 crop → avatars bucket', surface: 'profile', fanHref: '/profile', adminHref: '/admin/people', telemetry: 'profile_avatar', owner: 'code' },
  { id: 'profile_tabs', label: 'Highlights / Stats / Vault tabs', hint: 'Look hides a pane; Sports fills Stats', surface: 'profile', fanHref: '/profile', adminHref: '/admin/look' },
  { id: 'profile_malo', label: 'Drop Mālo · Athlete', hint: 'Profile quick support naming the athlete — first Catalogs preset', surface: 'profile', fanHref: '/profile', adminHref: '/admin/catalog', flag: 'buttons.malo' },
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
  { id: 'receipts', label: 'Tip History & Receipts', hint: '/receipts', surface: 'receipts', fanHref: '/receipts', adminHref: '/admin/money', flag: 'layouts.receipts', telemetry: 'receipts' },
  { id: 'receipt_open_clip', label: 'Receipt → highlight', hint: 'Jump from a receipt to the clip', surface: 'receipts', fanHref: '/receipts', adminHref: '/admin/highlights', flag: 'layouts.receipts' },
  { id: 'malo_amounts', label: 'Mālo amount presets', hint: 'Tip chips + cover fee — Catalogs', surface: 'receipts', fanHref: '/receipts', adminHref: '/admin/catalog' },

  { id: 'soft_wall.malo', label: 'Mālo Soft Wall', hint: 'Guest tip → SoftWallModal → resume tip sheet', surface: 'auth', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.malo', telemetry: 'soft_wall.malo', owner: 'code' },
  { id: 'soft_wall.crew', label: 'Crew Soft Wall', hint: 'Guest Join Crew → SoftWallModal → resume toggle', surface: 'auth', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.crew', telemetry: 'soft_wall.crew', owner: 'code' },
  { id: 'soft_wall.wishlist', label: 'Chip In Soft Wall', hint: 'Guest Chip In → SoftWallModal → resume Mālo', surface: 'auth', fanHref: '/profile', adminHref: '/admin/wishlist', flag: 'layouts.wishlist', telemetry: 'soft_wall.wishlist', owner: 'code' },
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
  { id: 'upload_category', label: 'Upload category pills', hint: 'Game Play / Train / Serve labels — Catalogs', surface: 'upload', fanHref: '/', adminHref: '/admin/catalog', flag: 'tabs.upload' },
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

/**
 * @purpose Count live vs paused fan controls for Overview and Coverage.
 */
export function coverageHealth(live: AppRuntimeConfig): { total: number; liveCount: number; paused: number } {
  const paused = COVERAGE_CONTROLS.filter((item) => item.flag && !getRuntimeFlag(live, item.flag)).length;
  return { total: COVERAGE_CONTROLS.length, liveCount: COVERAGE_CONTROLS.length - paused, paused };
}
