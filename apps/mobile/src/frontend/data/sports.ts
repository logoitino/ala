/** Career slots the admin builder can relabel or hide. These are the values `athlete_career_stats` actually stores. */
export type SportStatSource = 'games' | 'scoring' | 'volume' | 'mvp';

export type SportStatField = {
  source: SportStatSource;
  label: string;
  show: boolean;
};

/** Combine rows on Stats 📊. Football cares about the 40; volleyball cares about the vertical. */
export type SportMeasurableKey = 'height' | 'weight' | 'fortyYard' | 'verticalJump';

export type SportMeasurable = {
  key: SportMeasurableKey;
  label: string;
  show: boolean;
};

/** One operator scoring button: label, points it adds, and the `game_events.event_type` it writes. */
export type SportScoreAction = {
  id: string;
  label: string;
  points: number;
  eventType: string;
};

/** Roster position for this sport: `QB` on the pill, `Quarterback` in the field. */
export type SportPosition = {
  short: string;
  full: string;
};

/** One sideline callout button broadcast to fan Reel cards. */
export type SportCallout = {
  id: string;
  label: string;
  emoji: string;
  eventType: string;
};

export type SportConfig = {
  id: string;
  sport: string;
  emoji: string;
  /** What a segment is called on the operator console: Quarter / Half / Set / Inning / Period. */
  periodLabel: string;
  periods: string[];
  /** Volleyball, baseball, and track run untimed — the console hides the clock. */
  usesClock: boolean;
  clockSeconds: number;
  scoring: SportScoreAction[];
  callouts: SportCallout[];
  statFields: SportStatField[];
  measurables: SportMeasurable[];
  /** Position pills on `/admin/athletes`. Empty means free-text only. */
  positions: SportPosition[];
  isActive: boolean;
  sortOrder: number;
};

export const SPORT_STAT_SOURCES: { id: SportStatSource; label: string }[] = [
  { id: 'games', label: 'Games played' },
  { id: 'scoring', label: 'Scoring total' },
  { id: 'volume', label: 'Volume total' },
  { id: 'mvp', label: 'MVP badges' },
];

export const SPORT_MEASURABLE_KEYS: { id: SportMeasurableKey; label: string; label40?: string }[] = [
  { id: 'height', label: 'Height' },
  { id: 'weight', label: 'Weight' },
  { id: 'fortyYard', label: '40-Yard Dash' },
  { id: 'verticalJump', label: 'Vertical Jump' },
];

const ALL_MEASURABLES: SportMeasurableKey[] = ['height', 'weight', 'fortyYard', 'verticalJump'];

function statFields(scoring: string, volume: string, games = 'Games Played'): SportStatField[] {
  return [
    { source: 'games', label: games, show: true },
    { source: 'scoring', label: scoring, show: true },
    { source: 'volume', label: volume, show: true },
    { source: 'mvp', label: 'MVP Badges', show: true },
  ];
}

function measurableRows(...shown: SportMeasurableKey[]): SportMeasurable[] {
  return SPORT_MEASURABLE_KEYS.map((item) => ({
    key: item.id,
    label: item.label,
    show: shown.includes(item.id),
  }));
}

/**
 * @purpose Any sport nobody has built yet still gets a working console and Stats table.
 */
export const GENERIC_SPORT_CONFIG: SportConfig = {
  id: 'generic',
  sport: 'Sport',
  emoji: '🏅',
  periodLabel: 'Period',
  periods: ['P1', 'P2', 'OT'],
  usesClock: true,
  clockSeconds: 20 * 60,
  scoring: [
    { id: 'score-1', label: 'Score +1', points: 1, eventType: 'Score' },
    { id: 'score-2', label: 'Score +2', points: 2, eventType: 'Score' },
    { id: 'score-3', label: 'Score +3', points: 3, eventType: 'Score' },
  ],
  callouts: [
    { id: 'big-play', label: 'Big Play', emoji: '⚡', eventType: 'Big Play' },
    { id: 'score', label: 'Score', emoji: '🏆', eventType: 'Score' },
    { id: 'defense', label: 'Big Defense', emoji: '🤙', eventType: 'Big Defense' },
    { id: 'turnover', label: 'Turnover', emoji: '🛑', eventType: 'Turnover' },
  ],
  statFields: statFields('Points', 'Volume'),
  measurables: measurableRows(...ALL_MEASURABLES),
  positions: [],
  isActive: true,
  sortOrder: 900,
};

/** Seeded playbooks. `/admin/sports` edits these into `public.sport_configs`; unlisted sports fall back to generic. */
export const SPORT_CONFIG_SEEDS: SportConfig[] = [
  {
    id: 'football',
    sport: 'Football',
    emoji: '🏈',
    periodLabel: 'Quarter',
    periods: ['Q1', 'Q2', 'Q3', 'Q4', 'OT'],
    usesClock: true,
    clockSeconds: 12 * 60,
    scoring: [
      { id: 'td', label: 'Touchdown +6', points: 6, eventType: 'Touchdown' },
      { id: 'fg', label: 'Field Goal +3', points: 3, eventType: 'Field Goal' },
      { id: 'xp', label: 'Extra Point +1', points: 1, eventType: 'Extra Point' },
      { id: 'two', label: 'Safety / 2pt +2', points: 2, eventType: 'Safety' },
    ],
    callouts: [
      { id: 'big-play', label: 'Big Play', emoji: '⚡', eventType: 'Big Play' },
      { id: 'touchdown', label: 'Touchdown', emoji: '🏆', eventType: 'Touchdown' },
      { id: 'big-hit', label: 'Big Hit', emoji: '🤙', eventType: 'Big Hit' },
      { id: 'turnover', label: 'Turnover', emoji: '🛑', eventType: 'Turnover' },
    ],
    statFields: statFields('Points', 'Yards'),
    measurables: measurableRows(...ALL_MEASURABLES),
    positions: [{ short: 'QB', full: 'Quarterback' }, { short: 'RB', full: 'Running Back' }, { short: 'WR', full: 'Wide Receiver' }, { short: 'TE', full: 'Tight End' }, { short: 'OL', full: 'Offensive Line' }, { short: 'DL', full: 'Defensive Line' }, { short: 'LB', full: 'Linebacker' }, { short: 'DB', full: 'Defensive Back' }, { short: 'K', full: 'Kicker' }],
    isActive: true,
    sortOrder: 0,
  },
  {
    id: 'basketball',
    sport: 'Basketball',
    emoji: '🏀',
    periodLabel: 'Quarter',
    periods: ['Q1', 'Q2', 'Q3', 'Q4', 'OT'],
    usesClock: true,
    clockSeconds: 8 * 60,
    scoring: [
      { id: 'ft', label: 'Free Throw +1', points: 1, eventType: 'Free Throw' },
      { id: 'two', label: 'Bucket +2', points: 2, eventType: 'Field Goal' },
      { id: 'three', label: 'Three +3', points: 3, eventType: 'Three Pointer' },
    ],
    callouts: [
      { id: 'bucket', label: 'Bucket', emoji: '🔥', eventType: 'Bucket' },
      { id: 'and-one', label: 'And-1', emoji: '⚡', eventType: 'And One' },
      { id: 'block', label: 'Block', emoji: '🛑', eventType: 'Block' },
      { id: 'steal', label: 'Steal', emoji: '🤙', eventType: 'Steal' },
    ],
    statFields: statFields('Points', 'Rebounds'),
    measurables: measurableRows('height', 'weight', 'verticalJump'),
    positions: [{ short: 'PG', full: 'Point Guard' }, { short: 'SG', full: 'Shooting Guard' }, { short: 'SF', full: 'Small Forward' }, { short: 'PF', full: 'Power Forward' }, { short: 'C', full: 'Center' }],
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'rugby',
    sport: 'Rugby',
    emoji: '🏉',
    periodLabel: 'Half',
    periods: ['H1', 'H2', 'ET'],
    usesClock: true,
    clockSeconds: 40 * 60,
    scoring: [
      { id: 'try', label: 'Try +5', points: 5, eventType: 'Try' },
      { id: 'conv', label: 'Conversion +2', points: 2, eventType: 'Conversion' },
      { id: 'pen', label: 'Penalty +3', points: 3, eventType: 'Penalty Kick' },
      { id: 'drop', label: 'Drop Goal +3', points: 3, eventType: 'Drop Goal' },
    ],
    callouts: [
      { id: 'try', label: 'Try', emoji: '🏆', eventType: 'Try' },
      { id: 'big-tackle', label: 'Big Tackle', emoji: '🤙', eventType: 'Big Tackle' },
      { id: 'lineout', label: 'Lineout Steal', emoji: '⚡', eventType: 'Lineout Steal' },
      { id: 'turnover', label: 'Turnover', emoji: '🛑', eventType: 'Turnover' },
    ],
    statFields: statFields('Tries', 'Tackles'),
    measurables: measurableRows('height', 'weight', 'fortyYard'),
    positions: [{ short: 'PR', full: 'Prop' }, { short: 'HK', full: 'Hooker' }, { short: 'FL', full: 'Flanker' }, { short: 'SH', full: 'Scrum-half' }, { short: 'FH', full: 'Fly-half' }, { short: 'CT', full: 'Centre' }, { short: 'WG', full: 'Wing' }, { short: 'FB', full: 'Fullback' }],
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'volleyball',
    sport: 'Volleyball',
    emoji: '🏐',
    periodLabel: 'Set',
    periods: ['S1', 'S2', 'S3', 'S4', 'S5'],
    usesClock: false,
    clockSeconds: 0,
    scoring: [{ id: 'point', label: 'Point +1', points: 1, eventType: 'Point' }],
    callouts: [
      { id: 'kill', label: 'Kill', emoji: '🔥', eventType: 'Kill' },
      { id: 'ace', label: 'Ace', emoji: '⚡', eventType: 'Ace' },
      { id: 'block', label: 'Block', emoji: '🛑', eventType: 'Block' },
      { id: 'dig', label: 'Dig', emoji: '🤙', eventType: 'Dig' },
    ],
    statFields: statFields('Kills', 'Digs', 'Matches Played'),
    measurables: measurableRows('height', 'verticalJump'),
    positions: [{ short: 'OH', full: 'Outside Hitter' }, { short: 'OP', full: 'Opposite' }, { short: 'S', full: 'Setter' }, { short: 'MB', full: 'Middle Blocker' }, { short: 'L', full: 'Libero' }],
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'soccer',
    sport: 'Soccer',
    emoji: '⚽',
    periodLabel: 'Half',
    periods: ['H1', 'H2', 'ET', 'PK'],
    usesClock: true,
    clockSeconds: 45 * 60,
    scoring: [{ id: 'goal', label: 'Goal +1', points: 1, eventType: 'Goal' }],
    callouts: [
      { id: 'goal', label: 'Goal', emoji: '🥅', eventType: 'Goal' },
      { id: 'assist', label: 'Assist', emoji: '⚡', eventType: 'Assist' },
      { id: 'save', label: 'Big Save', emoji: '🧤', eventType: 'Save' },
      { id: 'card', label: 'Card', emoji: '🟨', eventType: 'Card' },
    ],
    statFields: statFields('Goals', 'Assists'),
    measurables: measurableRows('height', 'weight', 'fortyYard'),
    positions: [{ short: 'GK', full: 'Goalkeeper' }, { short: 'DF', full: 'Defender' }, { short: 'MF', full: 'Midfielder' }, { short: 'FW', full: 'Forward' }],
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'baseball',
    sport: 'Baseball',
    emoji: '⚾',
    periodLabel: 'Inning',
    periods: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    usesClock: false,
    clockSeconds: 0,
    scoring: [
      { id: 'run', label: 'Run +1', points: 1, eventType: 'Run' },
      { id: 'hr', label: 'Grand Slam +4', points: 4, eventType: 'Home Run' },
    ],
    callouts: [
      { id: 'homer', label: 'Home Run', emoji: '💥', eventType: 'Home Run' },
      { id: 'strikeout', label: 'Strikeout', emoji: '⚡', eventType: 'Strikeout' },
      { id: 'double-play', label: 'Double Play', emoji: '🛑', eventType: 'Double Play' },
      { id: 'steal', label: 'Stolen Base', emoji: '🤙', eventType: 'Stolen Base' },
    ],
    statFields: statFields('Runs', 'Hits'),
    measurables: measurableRows('height', 'weight'),
    positions: [{ short: 'P', full: 'Pitcher' }, { short: 'C', full: 'Catcher' }, { short: '1B', full: 'First Base' }, { short: '2B', full: 'Second Base' }, { short: '3B', full: 'Third Base' }, { short: 'SS', full: 'Shortstop' }, { short: 'OF', full: 'Outfielder' }, { short: 'DH', full: 'Designated Hitter' }],
    isActive: true,
    sortOrder: 5,
  },
  {
    id: 'softball',
    sport: 'Softball',
    emoji: '🥎',
    periodLabel: 'Inning',
    periods: ['1', '2', '3', '4', '5', '6', '7'],
    usesClock: false,
    clockSeconds: 0,
    scoring: [
      { id: 'run', label: 'Run +1', points: 1, eventType: 'Run' },
      { id: 'hr', label: 'Grand Slam +4', points: 4, eventType: 'Home Run' },
    ],
    callouts: [
      { id: 'homer', label: 'Home Run', emoji: '💥', eventType: 'Home Run' },
      { id: 'strikeout', label: 'Strikeout', emoji: '⚡', eventType: 'Strikeout' },
      { id: 'double-play', label: 'Double Play', emoji: '🛑', eventType: 'Double Play' },
      { id: 'steal', label: 'Stolen Base', emoji: '🤙', eventType: 'Stolen Base' },
    ],
    statFields: statFields('Runs', 'Hits'),
    measurables: measurableRows('height', 'weight'),
    positions: [{ short: 'P', full: 'Pitcher' }, { short: 'C', full: 'Catcher' }, { short: '1B', full: 'First Base' }, { short: '2B', full: 'Second Base' }, { short: '3B', full: 'Third Base' }, { short: 'SS', full: 'Shortstop' }, { short: 'OF', full: 'Outfielder' }],
    isActive: true,
    sortOrder: 6,
  },
  {
    id: 'wrestling',
    sport: 'Wrestling',
    emoji: '🤼',
    periodLabel: 'Period',
    periods: ['P1', 'P2', 'P3', 'OT'],
    usesClock: true,
    clockSeconds: 2 * 60,
    scoring: [
      { id: 'escape', label: 'Escape +1', points: 1, eventType: 'Escape' },
      { id: 'takedown', label: 'Takedown +2', points: 2, eventType: 'Takedown' },
      { id: 'near-fall', label: 'Near Fall +3', points: 3, eventType: 'Near Fall' },
      { id: 'pin', label: 'Pin +6', points: 6, eventType: 'Pin' },
    ],
    callouts: [
      { id: 'pin', label: 'Pin', emoji: '💥', eventType: 'Pin' },
      { id: 'takedown', label: 'Takedown', emoji: '⚡', eventType: 'Takedown' },
      { id: 'reversal', label: 'Reversal', emoji: '🔁', eventType: 'Reversal' },
      { id: 'escape', label: 'Escape', emoji: '🤙', eventType: 'Escape' },
    ],
    statFields: statFields('Team Points', 'Takedowns', 'Matches Wrestled'),
    measurables: measurableRows('height', 'weight'),
    positions: [{ short: '106', full: '106 lb' }, { short: '120', full: '120 lb' }, { short: '138', full: '138 lb' }, { short: '157', full: '157 lb' }, { short: '175', full: '175 lb' }, { short: '215', full: '215 lb' }, { short: '285', full: '285 lb' }],
    isActive: true,
    sortOrder: 7,
  },
  {
    id: 'track',
    sport: 'Track & Field',
    emoji: '🏃',
    periodLabel: 'Flight',
    periods: ['Prelims', 'Finals'],
    usesClock: false,
    clockSeconds: 0,
    scoring: [
      { id: 'first', label: '1st +10', points: 10, eventType: 'First Place' },
      { id: 'second', label: '2nd +8', points: 8, eventType: 'Second Place' },
      { id: 'third', label: '3rd +6', points: 6, eventType: 'Third Place' },
    ],
    callouts: [
      { id: 'pr', label: 'Personal Record', emoji: '🔥', eventType: 'Personal Record' },
      { id: 'anchor', label: 'Anchor Leg', emoji: '⚡', eventType: 'Anchor Leg' },
      { id: 'handoff', label: 'Clean Handoff', emoji: '🤝', eventType: 'Handoff' },
      { id: 'false-start', label: 'False Start', emoji: '🛑', eventType: 'False Start' },
    ],
    statFields: statFields('Team Points', 'Event Wins', 'Meets'),
    measurables: measurableRows('height', 'weight', 'fortyYard', 'verticalJump'),
    positions: [{ short: 'SP', full: 'Sprints' }, { short: 'MD', full: 'Middle Distance' }, { short: 'DIS', full: 'Distance' }, { short: 'HUR', full: 'Hurdles' }, { short: 'JMP', full: 'Jumps' }, { short: 'THR', full: 'Throws' }, { short: 'REL', full: 'Relays' }],
    isActive: true,
    sortOrder: 8,
  },
  {
    id: 'lacrosse',
    sport: 'Lacrosse',
    emoji: '🥍',
    periodLabel: 'Quarter',
    periods: ['Q1', 'Q2', 'Q3', 'Q4', 'OT'],
    usesClock: true,
    clockSeconds: 12 * 60,
    scoring: [{ id: 'goal', label: 'Goal +1', points: 1, eventType: 'Goal' }],
    callouts: [
      { id: 'goal', label: 'Goal', emoji: '🥅', eventType: 'Goal' },
      { id: 'assist', label: 'Assist', emoji: '⚡', eventType: 'Assist' },
      { id: 'save', label: 'Big Save', emoji: '🧤', eventType: 'Save' },
      { id: 'ground-ball', label: 'Ground Ball', emoji: '🤙', eventType: 'Ground Ball' },
    ],
    statFields: statFields('Goals', 'Assists'),
    measurables: measurableRows('height', 'weight', 'fortyYard'),
    positions: [{ short: 'A', full: 'Attack' }, { short: 'M', full: 'Midfield' }, { short: 'D', full: 'Defense' }, { short: 'G', full: 'Goalie' }, { short: 'FO', full: 'Faceoff' }],
    isActive: true,
    sortOrder: 9,
  },
  {
    id: 'hockey',
    sport: 'Ice Hockey',
    emoji: '🏒',
    periodLabel: 'Period',
    periods: ['P1', 'P2', 'P3', 'OT', 'SO'],
    usesClock: true,
    clockSeconds: 20 * 60,
    scoring: [{ id: 'goal', label: 'Goal +1', points: 1, eventType: 'Goal' }],
    callouts: [
      { id: 'goal', label: 'Goal', emoji: '🥅', eventType: 'Goal' },
      { id: 'assist', label: 'Assist', emoji: '⚡', eventType: 'Assist' },
      { id: 'save', label: 'Big Save', emoji: '🧤', eventType: 'Save' },
      { id: 'penalty', label: 'Penalty', emoji: '🛑', eventType: 'Penalty' },
    ],
    statFields: statFields('Goals', 'Assists'),
    measurables: measurableRows('height', 'weight'),
    positions: [{ short: 'C', full: 'Center' }, { short: 'LW', full: 'Left Wing' }, { short: 'RW', full: 'Right Wing' }, { short: 'D', full: 'Defense' }, { short: 'G', full: 'Goalie' }],
    isActive: true,
    sortOrder: 10,
  },
  {
    id: 'tennis',
    sport: 'Tennis',
    emoji: '🎾',
    periodLabel: 'Set',
    periods: ['S1', 'S2', 'S3'],
    usesClock: false,
    clockSeconds: 0,
    scoring: [
      { id: 'game', label: 'Game +1', points: 1, eventType: 'Game Won' },
      { id: 'set', label: 'Set +1', points: 1, eventType: 'Set Won' },
    ],
    callouts: [
      { id: 'ace', label: 'Ace', emoji: '⚡', eventType: 'Ace' },
      { id: 'winner', label: 'Winner', emoji: '🔥', eventType: 'Winner' },
      { id: 'break', label: 'Break Point', emoji: '🛑', eventType: 'Break Point' },
      { id: 'rally', label: 'Long Rally', emoji: '🤙', eventType: 'Rally' },
    ],
    statFields: statFields('Sets Won', 'Matches Won', 'Matches Played'),
    measurables: measurableRows('height', 'weight'),
    positions: [{ short: 'S1', full: 'Singles 1' }, { short: 'S2', full: 'Singles 2' }, { short: 'D1', full: 'Doubles 1' }, { short: 'D2', full: 'Doubles 2' }],
    isActive: true,
    sortOrder: 11,
  },
];

/**
 * @purpose Resolve the playbook for a sport name. Unknown sports inherit the generic console so nothing is unscoreable.
 * @param sport `games.sport`, `athlete_career_stats.sport`, or a roster guess.
 * @param configs Live rows from `sport_configs` (falls back to the seeds).
 */
export function sportConfigFor(
  sport: string | null | undefined,
  configs: SportConfig[] = SPORT_CONFIG_SEEDS,
): SportConfig {
  const key = (sport ?? '').trim().toLowerCase();
  if (!key) return configs[0] ?? GENERIC_SPORT_CONFIG;
  const exact = configs.find((row) => row.sport.trim().toLowerCase() === key);
  if (exact) return exact;
  const partial = configs.find(
    (row) => key.includes(row.sport.trim().toLowerCase()) || row.sport.trim().toLowerCase().includes(key),
  );
  if (partial) return partial;
  return { ...GENERIC_SPORT_CONFIG, sport: (sport ?? '').trim() || GENERIC_SPORT_CONFIG.sport };
}

/** @purpose Sport pills for onboarding / admin pickers, active rows only. */
export function activeSportNames(configs: SportConfig[]): string[] {
  return configs.filter((row) => row.isActive).map((row) => row.sport);
}

/** @purpose `12:00` seed for the operator clock (blank when the sport is untimed). */
export function sportClockLabel(config: SportConfig): string {
  if (!config.usesClock || config.clockSeconds <= 0) return '';
  const minutes = Math.floor(config.clockSeconds / 60);
  const seconds = config.clockSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** @purpose Career rows the Stats table should render for this sport, in builder order. */
export function visibleStatFields(config: SportConfig): SportStatField[] {
  return config.statFields.filter((field) => field.show);
}

/** @purpose Combine tiles the Stats table should render for this sport. */
export function visibleMeasurables(config: SportConfig): SportMeasurable[] {
  return config.measurables.filter((row) => row.show);
}

/** @purpose Scoring column header for legacy two-column callers (`careerColumnsForSport`). */
export function statLabelFor(config: SportConfig, source: SportStatSource, fallback: string): string {
  const field = config.statFields.find((row) => row.source === source);
  return field?.label?.trim() || fallback;
}
