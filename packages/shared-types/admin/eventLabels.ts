/**
 * People words for telemetry keys, shared by every portal page that lists them (Health, Trends,
 * Analytics, Departments). The app logs `feature_tap` keys ("reel.seki") and `ui_issue` rows that
 * `get_admin_reports.issues` joins as "event · surface" ("upload.retry · upload"), plus open bug
 * reports as "<surface> bug". A raw dotted key is never shown to a person: a key not mapped here is
 * spelled out in sentence case ("vault.subscribe.sheet" becomes "Vault subscribe sheet").
 * Money words follow docs/product/VOICE.md: `malo` and `tip` keys read as "Donate" / "donation",
 * never "Mālo" or "tip". Pure functions, no React, so `node --test` can check them.
 */

/**
 * `feature_tap` keys the app sends (`telemetry.trackFeature` in apps/mobile), plus the older or
 * mock keys seen in report reads. Hype buttons sit on a Highlight, so they say so.
 */
const FEATURE_LABELS: Record<string, string> = {
  malo: 'Donate',
  'malo.blocked': 'Donate (not available)',
  'reel.malo.open': 'Donate on a Highlight',
  'peek.malo': 'Donate from the athlete card',
  'peek.open': 'Open the athlete card',
  'peek.profile': 'Full profile from the athlete card',
  'peek.close': 'Close the athlete card',
  'crew.join': 'Join Crew',
  'crew.follow': 'Join Crew',
  'crew.leave': 'Leave Crew',
  'crew.unfollow': 'Leave Crew',
  'hype.seki': 'Seki on a Highlight',
  'hype.aura': 'Aura on a Highlight',
  'hype.flex': 'Flex on a Highlight',
  'reel.seki': 'Seki on a Highlight',
  'reel.aura': 'Aura on a Highlight',
  'reel.flex': 'Flex on a Highlight',
  save: 'Save a Highlight',
  'reel.save': 'Save a Highlight',
  share: 'Share',
  more: 'More',
  share_qr: 'QR donation link',
  'share_qr.copy': 'Copy the QR donation link',
  'share_qr.save': 'Save the QR donation link',
  'share_qr.native': 'Share the QR donation link',
  upload: 'Upload',
  home_search: 'Search',
  home_search_clip: 'Open a clip from search',
  'feed.local_jump': 'Jump to Local from Home',
  'spotlight.open_modal': 'Open Spotlight',
  spotlight_card: 'Spotlight card',
  leaderboards: 'Leaderboards',
  cheer_poll: 'Cheer poll vote',
  'poll.vote': 'Cheer poll vote',
  rally_donate: 'Donate to a Rally',
  rally_create: 'Start a Rally',
  wishlist_gift: 'Gear goal',
  wishlist_chip_in: 'Donate to a gear goal',
  vault_unlock: 'Vault unlock',
  'vault.subscribe.sheet': 'Open Vault subscribe',
  drip_item: 'Drip item',
  drip_buy: 'Drip buy',
  live_banner: 'Live game banner',
  live_game: 'Live game',
  rivalry_week: 'Rivalry week',
  sponsorship: 'Sponsorship',
  sponsor_rivalry: 'Sponsor rivalry banner',
  sponsor_sideline: 'Sponsor sideline',
  athlete_profile: 'Athlete profile',
  athlete_verify: 'Athlete verification',
  'athlete_verify.redeem': 'Redeem an athlete code',
  'athlete_verify.request': 'Ask for athlete verification',
  profile_avatar: 'Change profile photo',
  receipts: 'Receipts',
  'activity.receipts': 'Receipts from Activity',
  'activity.tag': 'Tag from Activity',
  'activity.thanks': 'Say thanks from Activity',
  'activity.thanks_received': 'Thanks received',
  suggestion: 'Send a suggestion',
  legal_terms: 'Terms',
  legal_ack: 'Accept the terms',
  slang: 'Slang guide',
  parent_consent: 'Parent consent',
  booster_csv: 'Booster CSV export',
  booster_verify: 'Booster verification',
  operator_claim: 'Operator claim',
  operator_checkin: 'Operator check-in',
  operator_scorer: 'Operator scorer',
};

/**
 * `ui_issue` events (`telemetry.trackIssue`). The issue key is the control that failed, so the
 * words say what went wrong, not just the button.
 */
const ISSUE_LABELS: Record<string, string> = {
  upload: 'Upload failed',
  'upload.retry': 'Upload retry',
  checkout: 'Donation checkout error',
  'malo.sheet.dismiss_error': 'Donate sheet closed with an error',
  report: 'Report or hide a Highlight',
  suggestion_bug: 'Bug report sent',
  wishlist_gift: 'Gear goal donation failed',
  received_malo_unavailable: 'Received donations did not load',
  'video.stall_overlay': 'Video stalled',
  'poll.vote_timeout': 'Cheer poll vote timed out',
  control: 'Unnamed control',
};

/** App surfaces (the `channel` column). Tabs are names, so they are capitalised. */
const SURFACE_LABELS: Record<string, string> = {
  home: 'Home',
  spotlight: 'Spotlight',
  local: 'Local',
  drip: 'Drip',
  profile: 'Profile',
  activity: 'Activity',
  auth: 'sign-in',
  app: 'app',
  other: 'other',
};

/** Words inside an unmapped key. Product names keep their capital; money words follow VOICE.md. */
const KEY_WORDS: Record<string, string> = {
  seki: 'Seki',
  aura: 'Aura',
  flex: 'Flex',
  crew: 'Crew',
  spotlight: 'Spotlight',
  highlight: 'Highlight',
  highlights: 'Highlights',
  rally: 'Rally',
  vault: 'Vault',
  drip: 'Drip',
  local: 'Local',
  malo: 'donate',
  tip: 'donation',
  tips: 'donations',
  qr: 'QR',
  ui: 'UI',
};

const HYPE = ['Seki', 'Aura', 'Flex'];

function spell(raw: string): string[] {
  return raw
    .split(/[._\s-]+/)
    .filter(Boolean)
    .map((word) => KEY_WORDS[word.toLowerCase()] ?? word.toLowerCase());
}

function sentence(words: string[]): string {
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * @purpose Spell out any telemetry key as words, for a key no map knows.
 * @param key A raw key such as "vault.subscribe.sheet".
 * @returns Sentence-case words ("Vault subscribe sheet"); empty when the key is blank.
 */
export function readableKey(key: string): string {
  return sentence(spell(key.trim()));
}

/**
 * @purpose A people word for one `feature_tap` key, so no page prints "reel.seki".
 * @param key The raw key from `get_admin_reports.features`.
 * @returns The mapped label ("Seki on a Highlight", "Join Crew"), or the key spelled out.
 */
export function featureLabel(key: string): string {
  const raw = key.trim();
  if (!raw) return 'Unknown button';
  if (FEATURE_LABELS[raw]) return FEATURE_LABELS[raw];
  const words = spell(raw);
  const last = words[words.length - 1];
  // An unlisted "<place>.seki" is still the hype button on a Highlight.
  if (words.length === 2 && HYPE.includes(last)) return `${last} on a Highlight`;
  return sentence(words);
}

/**
 * @purpose A people word for an app surface (the telemetry `channel`).
 * @param surface Raw surface such as "home" or "upload".
 * @returns "Home", "Spotlight", "sign-in", or the surface spelled out in lower case.
 */
export function surfaceLabel(surface: string): string {
  const raw = surface.trim();
  if (!raw) return 'app';
  return SURFACE_LABELS[raw.toLowerCase()] ?? spell(raw).join(' ');
}

/**
 * @purpose A people word for one `get_admin_reports.issues` row, so no page prints
 *   "upload.retry · upload".
 * @param key "event · surface" for a UI issue, or "<surface> bug" for open bug reports.
 * @returns "Upload retry (upload)", "Donate sheet closed with an error (Home)",
 *   "Open bug reports (Profile)", or the parts spelled out in the same shape.
 */
export function issueLabel(key: string): string {
  const raw = key.trim();
  if (!raw) return 'Unknown issue';
  const split = raw.indexOf(' · ');
  if (split === -1) {
    const bug = /^(.*)\s+bug$/i.exec(raw);
    if (bug) return `Open bug reports (${surfaceLabel(bug[1])})`;
    return ISSUE_LABELS[raw] ?? readableKey(raw);
  }
  const event = raw.slice(0, split).trim();
  const surface = raw.slice(split + 3).trim();
  const what = ISSUE_LABELS[event] ?? (readableKey(event) || ISSUE_LABELS.control);
  return `${what} (${surfaceLabel(surface)})`;
}

/**
 * @purpose Name every row of a telemetry list for display. Two keys that read the same
 *   ("crew.join" and "crew.follow" are both "Join Crew") become one row with their counts added,
 *   so a chart never shows the same words twice.
 * @param rows Report rows whose `label` is a raw key, already read (never null here).
 * @param label `featureLabel` for `get_admin_reports.features`, `issueLabel` for `.issues`.
 * @returns New rows with people words, largest first (ties by label), in a new array.
 */
export function labelRows(rows: readonly { label: string; value: number }[], label: (key: string) => string): { label: string; value: number }[] {
  const merged = new Map<string, number>();
  for (const row of rows) {
    const name = label(row.label);
    merged.set(name, (merged.get(name) ?? 0) + row.value);
  }
  return [...merged].map(([name, value]) => ({ label: name, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}
