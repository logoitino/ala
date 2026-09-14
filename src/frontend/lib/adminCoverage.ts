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
  | 'sponsor';

export type CoverageControl = {
  id: string;
  label: string;
  hint: string;
  surface: CoverageSurface;
  fanHref: string;
  adminHref: AdminNavHref;
  flag?: AppRuntimeFlagPath;
  telemetry?: string;
};

export const COVERAGE_SURFACES: { id: CoverageSurface; label: string }[] = [
  { id: 'home', label: 'Home · Highlights ⚡' },
  { id: 'local', label: 'Local' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'drip', label: 'Drip' },
  { id: 'profile', label: 'Profile' },
  { id: 'upload', label: 'Upload +' },
  { id: 'receipts', label: 'Receipts' },
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
  { id: 'malo', label: 'Mālo', hint: 'Tip rail + PaymentSheet', surface: 'home', fanHref: '/', adminHref: '/admin/money', flag: 'buttons.malo', telemetry: 'malo' },
  { id: 'more', label: 'More sheet', hint: 'Share / Save / Report', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.more', telemetry: 'more' },
  { id: 'share', label: 'Share', hint: 'Deep link sheet', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.more', telemetry: 'share' },
  { id: 'save', label: 'Save', hint: 'saved_reels bookmark', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.more', telemetry: 'save' },
  { id: 'report', label: 'Report / Hide', hint: 'Moderation queue', surface: 'home', fanHref: '/', adminHref: '/admin/moderation', flag: 'buttons.more', telemetry: 'report' },
  { id: 'suggest', label: 'Suggest an improvement', hint: 'Feedback inbox', surface: 'home', fanHref: '/', adminHref: '/admin/feedback', flag: 'buttons.suggest', telemetry: 'suggestion' },
  { id: 'vault_unlock', label: 'Open Vault', hint: 'Exclusive PaymentSheet', surface: 'home', fanHref: '/', adminHref: '/admin/features', flag: 'buttons.vault', telemetry: 'vault_unlock' },
  { id: 'athlete_profile', label: 'Athlete name', hint: 'Opens /user/[id]', surface: 'home', fanHref: '/', adminHref: '/admin/athletes', telemetry: 'athlete_profile' },

  { id: 'tab.local', label: 'Local tab', hint: 'Fan bar', surface: 'local', fanHref: '/local', adminHref: '/admin/features', flag: 'tabs.local', telemetry: 'tab.local' },
  { id: 'local_search', label: 'Local Explore', hint: 'Players, schools, sponsors', surface: 'local', fanHref: '/local', adminHref: '/admin/features', flag: 'layouts.localSearch' },
  { id: 'hub.matches', label: 'Live Matches', hint: 'Scoreboard list', surface: 'local', fanHref: '/local', adminHref: '/admin/games', flag: 'layouts.liveMatches', telemetry: 'hub.matches' },
  { id: 'live_game', label: 'Open match', hint: '/local/game/[id]', surface: 'local', fanHref: '/local', adminHref: '/admin/games', telemetry: 'live_game' },
  { id: 'hub.polls', label: 'School Polls', hint: 'Cheer matchups', surface: 'local', fanHref: '/local', adminHref: '/admin/polls', flag: 'layouts.cheerPolls', telemetry: 'hub.polls' },
  { id: 'cheer_poll', label: 'Cast a cheer', hint: 'cast_cheer_vote', surface: 'local', fanHref: '/local', adminHref: '/admin/polls', telemetry: 'cheer_poll' },
  { id: 'hub.boosters', label: 'Top Boosters', hint: 'Sponsorship rail', surface: 'local', fanHref: '/local', adminHref: '/admin/boosters', flag: 'layouts.topBoosters', telemetry: 'hub.boosters' },
  { id: 'sponsorship', label: 'Become a sponsor', hint: 'Silver / Gold / Platinum', surface: 'local', fanHref: '/local', adminHref: '/admin/boosters', flag: 'layouts.sponsorshipModal', telemetry: 'sponsorship' },

  { id: 'tab.spotlight', label: 'Spotlight tab', hint: 'Fan bar', surface: 'spotlight', fanHref: '/spotlight', adminHref: '/admin/features', flag: 'tabs.spotlight', telemetry: 'tab.spotlight' },
  { id: 'spotlight_card', label: 'Award card', hint: 'Replay Player of the Week', surface: 'spotlight', fanHref: '/spotlight', adminHref: '/admin/spotlight', telemetry: 'spotlight_card' },

  { id: 'tab.drip', label: 'Drip tab', hint: 'Fan bar', surface: 'drip', fanHref: '/drip', adminHref: '/admin/features', flag: 'tabs.drip', telemetry: 'tab.drip' },
  { id: 'drip_item', label: 'Gear card', hint: 'Opens ProductSheet', surface: 'drip', fanHref: '/drip', adminHref: '/admin/drip', telemetry: 'drip_item' },
  { id: 'drip_buy', label: 'Buy Now', hint: 'PaymentSheet + shop_orders', surface: 'drip', fanHref: '/drip', adminHref: '/admin/drip', telemetry: 'drip_buy' },

  { id: 'tab.profile', label: 'Profile tab', hint: 'Fan bar', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'tabs.profile', telemetry: 'tab.profile' },
  { id: 'subscribe', label: 'Subscribe', hint: '$4.99 exclusive', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.subscribe' },
  { id: 'crew', label: 'Join Crew', hint: 'The Crew ⚡', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.crew' },
  { id: 'vault', label: 'Vault lock', hint: 'Open / Lock Vault', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.vault' },
  { id: 'flashUnlock', label: 'Flash Unlock', hint: '2-hour Crew window', surface: 'profile', fanHref: '/profile', adminHref: '/admin/features', flag: 'buttons.flashUnlock' },
  { id: 'profile_suggest', label: 'Send a suggestion', hint: 'Feedback desk', surface: 'profile', fanHref: '/profile', adminHref: '/admin/feedback', flag: 'buttons.suggest', telemetry: 'suggestion' },
  { id: 'wishlist', label: 'Locker Room Wishlist', hint: 'Gear cards on Stats 📊', surface: 'profile', fanHref: '/profile', adminHref: '/admin/drip', flag: 'layouts.wishlist' },
  { id: 'wishlist_gift', label: 'Gift Item Directly', hint: 'Retailer link', surface: 'profile', fanHref: '/profile', adminHref: '/admin/drip', flag: 'layouts.wishlist', telemetry: 'wishlist_gift' },
  { id: 'wishlist_chip_in', label: 'Chip In $5', hint: 'Mālo toward gear + 500 Aura equip', surface: 'profile', fanHref: '/profile', adminHref: '/admin/money', flag: 'layouts.wishlist', telemetry: 'wishlist_chip_in' },
  { id: 'receipts', label: 'Tip History & Receipts', hint: '/receipts', surface: 'receipts', fanHref: '/receipts', adminHref: '/admin/money', flag: 'layouts.receipts', telemetry: 'receipts' },

  { id: 'tab.upload', label: 'Upload +', hint: 'Center FAB', surface: 'upload', fanHref: '/', adminHref: '/admin/features', flag: 'tabs.upload', telemetry: 'tab.upload' },
  { id: 'upload', label: 'Publish Reel', hint: 'game_highlights Storage', surface: 'upload', fanHref: '/', adminHref: '/admin/highlights', telemetry: 'upload' },

  { id: 'operator', label: 'Operator console', hint: 'Sideline scorekeeper', surface: 'operator', fanHref: '/operator', adminHref: '/admin/games', flag: 'layouts.operatorConsole' },
  { id: 'operator_claim', label: 'Claim game (PIN)', hint: 'Operator PIN', surface: 'operator', fanHref: '/operator', adminHref: '/admin/games', flag: 'layouts.operatorConsole', telemetry: 'operator_claim' },
  { id: 'operator_checkin', label: 'GPS check-in', hint: 'operator_checkins', surface: 'operator', fanHref: '/operator', adminHref: '/admin/games', flag: 'layouts.operatorConsole', telemetry: 'operator_checkin' },
  { id: 'operator_scorer', label: 'Player-tagged macros', hint: '/operator/scorer', surface: 'operator', fanHref: '/operator', adminHref: '/admin/games', flag: 'layouts.operatorConsole', telemetry: 'operator_scorer' },
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
