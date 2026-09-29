#!/usr/bin/env node
/**
 * Sync front-of-house memos from product constants in source.
 * Usage: node scripts/sync-front-docs.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const START = '<!-- product-facts:start -->';
const END = '<!-- product-facts:end -->';

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function must(rel, source, re, label) {
  const match = source.match(re);
  if (!match) {
    throw new Error(`docs:sync could not find ${label} in ${rel}`);
  }
  return match[1];
}

function dollars(n) {
  if (!Number.isFinite(n)) {
    throw new Error(`docs:sync expected a number, got ${n}`);
  }
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

const players = read('apps/mobile/src/frontend/data/players.ts');
const exclusive = read('apps/mobile/src/frontend/data/exclusive.ts');
const finance = read('apps/mobile/src/frontend/data/finance.ts');
const sponsors = read('apps/mobile/src/frontend/data/sponsorships.ts');
const aura = read('apps/mobile/src/frontend/lib/aura.ts');
const operator = read('apps/mobile/src/frontend/lib/operator.ts');
const motion = read('apps/mobile/src/frontend/theme/motion.ts');
const payouts = read('apps/mobile/src/backend/services/payouts.ts');
const schemaDoc = read('docs/SCHEMA.md');
const connect = read('apps/mobile/src/backend/api/createStripeAccount.ts');

const tipAmounts = must('players.ts', players, /export const TIP_AMOUNTS = \[([^\]]+)\]/, 'TIP_AMOUNTS')
  .split(',')
  .map((part) => Number(part.trim()));
const auraPerDollar = Number(must('players.ts', players, /export const AURA_PER_DOLLAR = ([0-9.]+)/, 'AURA_PER_DOLLAR'));
const feeAmount = Number(must('players.ts', players, /export const FEE_AMOUNT = ([0-9.]+)/, 'FEE_AMOUNT'));
const maloDisclaimer = must('players.ts', players, /export const MALO_DISCLAIMER =\s*"([^"]+)"/, 'MALO_DISCLAIMER');

const exclusiveDollars = Number(
  must('exclusive.ts', exclusive, /export const EXCLUSIVE_MONTHLY_DOLLARS = ([0-9.]+)/, 'EXCLUSIVE_MONTHLY_DOLLARS'),
);
const exclusiveAura = Number(
  must('exclusive.ts', exclusive, /export const EXCLUSIVE_AURA_GRANT = ([0-9.]+)/, 'EXCLUSIVE_AURA_GRANT'),
);
const maloCutBps = Number(
  must('finance.ts', finance, /export const MALO_PLATFORM_CUT_BPS = ([0-9]+)/, 'MALO_PLATFORM_CUT_BPS'),
);
const boosterCutBps = Number(
  must('finance.ts', finance, /export const BOOSTER_PLATFORM_CUT_BPS = ([0-9]+)/, 'BOOSTER_PLATFORM_CUT_BPS'),
);
const vaultCutBps = Number(
  must('finance.ts', finance, /export const VAULT_PLATFORM_CUT_BPS = ([0-9]+)/, 'VAULT_PLATFORM_CUT_BPS'),
);
const merchCutBps = Number(
  must('finance.ts', finance, /export const MERCH_PLATFORM_CUT_BPS = ([0-9]+)/, 'MERCH_PLATFORM_CUT_BPS'),
);
function bpsLabel(bps) {
  return `${(bps / 100).toFixed(0)}%`;
}

const sponsorBlock = must(
  'sponsorships.ts',
  sponsors,
  /export const SPONSOR_TIERS: SponsorTier\[\] = \[([\s\S]*?)\n\];/,
  'SPONSOR_TIERS',
);
const sponsorNames = [...sponsorBlock.matchAll(/^\s+name: '([^']+)'/gm)].map((m) => m[1]);
const sponsorDollars = [...sponsorBlock.matchAll(/^\s+dollars: ([0-9]+)/gm)].map((m) => Number(m[1]));
if (sponsorNames.length < 3 || sponsorDollars.length !== sponsorNames.length) {
  throw new Error('docs:sync expected matching name/dollars pairs in SPONSOR_TIERS');
}

const auraBlock = must('aura.ts', aura, /export const AURA_TIERS: AuraTier\[\] = \[([\s\S]*?)\n\];/, 'AURA_TIERS');
const auraTitles = [...auraBlock.matchAll(/title: '([^']+)'/g)].map((m) => m[1]);
if (auraTitles.length < 2) {
  throw new Error('docs:sync expected Aura tier titles');
}
const pin = must('operator.ts', operator, /export const OPERATOR_TEST_PIN = '([^']+)'/, 'OPERATOR_TEST_PIN');
const jade = must('motion.ts', motion, /neonJade: '(#[0-9A-Fa-f]+)'/, 'FOCAL.neonJade');
const gold = must('motion.ts', motion, /electricGold: '(#[0-9A-Fa-f]+)'/, 'FOCAL.electricGold');
const obsidian = must('motion.ts', motion, /backgroundBase: '(#[0-9A-Fa-f]+)'/, 'FOCAL.backgroundBase');

const queuesAdmin = /queued for admin disbursement/i.test(payouts);
const demoRls = /Tighten before production/i.test(schemaDoc);
const connectIndividual = /entity_type:\s*'individual'/i.test(connect);
const connectCountryUs = /country:\s*'us'/i.test(connect);

const teamsSrc = read('apps/mobile/src/frontend/data/teams.ts');
const schemaSql = read('apps/mobile/src/backend/db/schema.sql');
const sportLine = must('teams.ts', teamsSrc, /export const ATHLETE_SPORTS = \[([^\]]+)\]/, 'ATHLETE_SPORTS');
const athleteSports = [...sportLine.matchAll(/'([^']+)'/g)].map((m) => m[1]);
if (athleteSports.length < 2) throw new Error('docs:sync expected ATHLETE_SPORTS');
const yearLine = must('teams.ts', teamsSrc, /export const ATHLETE_CLASS_YEARS = \[([^\]]+)\]/, 'ATHLETE_CLASS_YEARS');
const classYears = [...yearLine.matchAll(/'([^']+)'/g)].map((m) => `'${m[1].replace(/^'+/, '')}`);
if (classYears.length < 2) throw new Error('docs:sync expected ATHLETE_CLASS_YEARS');
const sportsLabel = athleteSports.join(' / ');
const classLabel = classYears.join(' / ');
const highlightsSrc = read('apps/mobile/src/frontend/data/highlights.ts');
const highlightTab = must('highlights.ts', highlightsSrc, /export const HIGHLIGHT_TAB_LABEL = '([^']+)'/, 'HIGHLIGHT_TAB_LABEL');
const statsTab = must('highlights.ts', highlightsSrc, /export const STATS_TAB_LABEL = '([^']+)'/, 'STATS_TAB_LABEL');
const vaultTab = must('highlights.ts', highlightsSrc, /export const VAULT_TAB_LABEL = '([^']+)'/, 'VAULT_TAB_LABEL');
const highlightNav = must('highlights.ts', highlightsSrc, /export const HIGHLIGHT_NAV_LABEL = '([^']+)'/, 'HIGHLIGHT_NAV_LABEL');
const spotlightNav = must('highlights.ts', highlightsSrc, /export const SPOTLIGHT_NAV_LABEL = '([^']+)'/, 'SPOTLIGHT_NAV_LABEL');
const vaultLockAction = must('exclusive.ts', exclusive, /export const VAULT_LOCK_ACTION = '([^']+)'/, 'VAULT_LOCK_ACTION');
const vaultOpenAction = must('exclusive.ts', exclusive, /export const VAULT_OPEN_ACTION = '([^']+)'/, 'VAULT_OPEN_ACTION');
const flashUnlockHours = Number(
  must('exclusive.ts', exclusive, /export const FLASH_UNLOCK_HOURS = ([0-9.]+)/, 'FLASH_UNLOCK_HOURS'),
);
const crewSrc = read('apps/mobile/src/frontend/data/crew.ts');
const crewLabel = must('crew.ts', crewSrc, /export const CREW_COUNTER_LABEL = '([^']+)'/, 'CREW_COUNTER_LABEL');
const squadLabel = must('crew.ts', crewSrc, /export const SQUAD_COUNTER_LABEL = '([^']+)'/, 'SQUAD_COUNTER_LABEL');
const joinCrewLabel = must('crew.ts', crewSrc, /export const JOIN_CREW_LABEL = '([^']+)'/, 'JOIN_CREW_LABEL');
const doubleTapAura = Number(
  must('highlights.ts', highlightsSrc, /export const DOUBLE_TAP_AURA_POINTS = ([0-9.]+)/, 'DOUBLE_TAP_AURA_POINTS'),
);
const serveAuraMultiplier = Number(
  must('highlights.ts', highlightsSrc, /export const SERVE_LIKE_ME_AURA_MULTIPLIER = ([0-9.]+)/, 'SERVE_LIKE_ME_AURA_MULTIPLIER'),
);

const tipLabel = tipAmounts.map(dollars).join(' / ');
const boosterLabel = sponsorNames
  .map((name, i) => `${name.split(' ')[0]} ${dollars(sponsorDollars[i])}`)
  .join(' / ');
const auraRange = `${auraTitles[0]} → ${auraTitles[auraTitles.length - 1]}`;

const factsMd = `# Product facts (generated)

Do not edit this file by hand. Source constants live in \`apps/mobile/src/frontend/data/\`, \`apps/mobile/src/frontend/lib/\`, and \`apps/mobile/src/frontend/theme/motion.ts\`. Refresh with \`pnpm docs:sync\`. CI runs \`pnpm docs:check\`.

| Fact | Value | Source |
| --- | --- | --- |
| Donation amounts | ${tipLabel} + custom | \`TIP_AMOUNTS\` |
| Processing fee option | ${dollars(feeAmount)} | \`FEE_AMOUNT\` |
| Aura per tip dollar | ${auraPerDollar} | \`AURA_PER_DOLLAR\` |
| Donation disclaimer | ${maloDisclaimer} | \`MALO_DISCLAIMER\` |
| Admin donation split | ${bpsLabel(maloCutBps)} platform / ${bpsLabel(10000 - maloCutBps)} athlete | \`MALO_PLATFORM_CUT_BPS\` |
| Admin booster split | ${bpsLabel(boosterCutBps)} platform / ${bpsLabel(10000 - boosterCutBps)} operator | \`BOOSTER_PLATFORM_CUT_BPS\` |
| Admin Vault split | ${bpsLabel(vaultCutBps)} platform / ${bpsLabel(10000 - vaultCutBps)} athlete | \`VAULT_PLATFORM_CUT_BPS\` |
| Admin Drip merch | ${bpsLabel(merchCutBps)} platform | \`MERCH_PLATFORM_CUT_BPS\` |
| Exclusive pass | ${dollars(exclusiveDollars)} (one-time PaymentIntent, app copy says /mo) | \`EXCLUSIVE_MONTHLY_DOLLARS\` |
| Exclusive Aura grant | +${exclusiveAura} to payer | \`EXCLUSIVE_AURA_GRANT\` |
| Booster first month | ${boosterLabel} | \`SPONSOR_TIERS\` |
| Aura bands | ${auraTitles.length}-tier (${auraRange}) | \`AURA_TIERS\` |
| Focal colors | Daylight ${obsidian}, Neon Jade ${jade}, Electric Gold ${gold} | \`FOCAL\` |
| Operator test PIN | \`${pin}\` (prototype) | \`OPERATOR_TEST_PIN\` |
| Stripe Connect identity | ${connectIndividual && connectCountryUs ? 'US individual Express' : 'see createStripeAccount.ts'} | Connect handler |
| Custodial payout without destination | ${queuesAdmin ? 'queues for admin disbursement' : 'see payouts.ts'} | \`queueCustodialPayout\` |
| RLS | ${demoRls ? 'demo-open — tighten before production' : 'see docs/SCHEMA.md'} | \`docs/SCHEMA.md\` |
| Payments | Stripe **test mode** until production keys + legal sign-off | engineer docs |
| Athlete sports | ${sportsLabel} | \`ATHLETE_SPORTS\` |
| Graduation class years | ${classLabel} | \`ATHLETE_CLASS_YEARS\` |
| Team catalog | HS \`[ High School • UT ]\` + NCAA \`[ NCAA D1 • Big 12 ]\` via \`schools_and_teams\` ILIKE | \`search_schools_and_teams\` |
| Fan bar | ${highlightNav} / ${spotlightNav} | \`HIGHLIGHT_NAV_LABEL\` / \`SPOTLIGHT_NAV_LABEL\` |
| Athlete profile tabs | ${highlightTab} / ${statsTab} / ${vaultTab} | \`HIGHLIGHT_TAB_LABEL\` |
| Athlete Vault lock | ${vaultLockAction} / ${vaultOpenAction} (default locked; subscribe to watch) | \`players.vault_locked\` |
| Crew / Squad | ${crewLabel} / ${squadLabel} · ${joinCrewLabel} | \`CREW_COUNTER_LABEL\` |
| Vault Flash Unlock | ${flashUnlockHours} hours | \`FLASH_UNLOCK_HOURS\` |
| Double-tap Aura | ${doubleTapAura} (Serve Like Me ×${serveAuraMultiplier}) | \`DOUBLE_TAP_AURA_POINTS\` / \`SERVE_LIKE_ME_AURA_MULTIPLIER\` |

Narrative memos ([PUBLIC.md](PUBLIC.md), [INVESTOR.md](INVESTOR.md), [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md)) splice a live block between \`product-facts\` HTML comments. Legal analysis outside those comments stays human-written.
`;

const publicBlock = `${START}
**Live numbers (from code):** Donations ${tipLabel} or custom. Exclusive ${dollars(exclusiveDollars)}. Boosters ${boosterLabel}. Aura ${auraPerDollar} points per tip dollar, ${auraTitles.length} tiers (${auraRange}). Double-tap ${doubleTapAura} Aura (Serve Like Me ×${serveAuraMultiplier}). Crew ${crewLabel} / ${squadLabel}. Flash Unlock ${flashUnlockHours}h. Athlete roster: ${sportsLabel}, class ${classLabel}, High School or NCAA. Profile tabs: ${highlightTab} / ${statsTab} / ${vaultTab}. Fan bar: ${highlightNav} / ${spotlightNav}. Stripe is in test mode. The operator PIN is a prototype.
${END}`;

const investorBlock = `${START}
| Line | Price (as coded) | Notes |
| --- | --- | --- |
| Donations | ${tipLabel} + custom | ${maloDisclaimer} |
| Admin splits | Donations ${bpsLabel(maloCutBps)}/${bpsLabel(10000 - maloCutBps)} athlete · Boosters ${bpsLabel(boosterCutBps)}/${bpsLabel(10000 - boosterCutBps)} operator · Vault ${bpsLabel(vaultCutBps)}/${bpsLabel(10000 - vaultCutBps)} athlete · Drip ${bpsLabel(merchCutBps)} platform | Control plane on \`/admin/money\`. Fan donation copy unchanged until counsel. |
| Exclusive | ${dollars(exclusiveDollars)} one-time PaymentIntent stored as a \`subscriptions\` row | +${exclusiveAura} Aura to the payer. Not Stripe Billing yet. |
| Boosters | ${boosterLabel} first month | Silver / Gold / Platinum |
| Aura | ${auraPerDollar} points per tip dollar | ${auraTitles.length}-tier card (${auraRange}). Double-tap ${doubleTapAura}; Serve Like Me ×${serveAuraMultiplier}. Not cash. |
| Operator PIN | \`${pin}\` | Prototype. Demo RLS: ${demoRls ? 'tighten before production' : 'see SCHEMA'}. |
| Athlete roster | Same flow for HS + NCAA | Sports ${sportsLabel}. Class ${classLabel}. \`profiles.school_id\` + \`athlete_division\`. |
| Athlete profile | Unified sheet | Tabs ${highlightTab} / ${statsTab} / ${vaultTab}. Fan bar ${highlightNav} / ${spotlightNav}. Vault ${vaultLockAction} (default locked). Crew ${crewLabel} / ${squadLabel}. Flash Unlock ${flashUnlockHours}h. |
${END}`;

const legalBlock = `${START}
| Fact | Where it lives |
| --- | --- |
| Donation amounts | ${tipLabel} + custom (\`TIP_AMOUNTS\`) |
| In-app claim | ${maloDisclaimer} |
| Admin donation rake | ${bpsLabel(maloCutBps)} platform / ${bpsLabel(10000 - maloCutBps)} athlete (\`MALO_PLATFORM_CUT_BPS\`) — control plane only |
| Exclusive | ${dollars(exclusiveDollars)}; +${exclusiveAura} Aura (\`EXCLUSIVE_MONTHLY_DOLLARS\`) |
| Boosters | ${boosterLabel} (\`SPONSOR_TIERS\`) |
| Stripe Express | ${connectIndividual && connectCountryUs ? 'US individual' : 'see handler'} (\`createStripeAccount.ts\`) |
| Payout without destination | ${queuesAdmin ? 'queued for admin disbursement' : 'see payouts.ts'} |
| Operator PIN | \`${pin}\` |
| Athlete catalog | HS + NCAA \`schools_and_teams\`; \`profiles.school_id\` / \`athlete_division\` |
| Athlete profile tabs | ${highlightTab} / ${statsTab} / ${vaultTab} |
| Athlete Vault | ${vaultLockAction} default on; fans subscribe to watch (\`players.vault_locked\`) |
| Crew / Squad | ${crewLabel} / ${squadLabel} (\`${joinCrewLabel}\`) |
| Vault Flash Unlock | ${flashUnlockHours} hours (\`FLASH_UNLOCK_HOURS\`) |
| Serve Like Me Aura | Double-tap ${doubleTapAura} ×${serveAuraMultiplier} (\`SERVE_LIKE_ME_AURA_MULTIPLIER\`) |
| RLS | ${demoRls ? 'demo-open — tighten before production' : 'see SCHEMA.md'} |
${END}`;

function splice(rel, block) {
  const file = path.join(root, rel);
  const current = fs.readFileSync(file, 'utf8');
  if (!current.includes(START) || !current.includes(END)) {
    throw new Error(`${rel} is missing ${START} … ${END} markers`);
  }
  const next = current.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block.trim());
  return { file, current, next };
}

function assertSchemaDocCoversSql() {
  const tables = [...schemaSql.matchAll(/create table if not exists public\.([a-z0-9_]+)/gi)].map((m) => m[1]);
  const missingTables = [...new Set(tables)].filter((name) => !schemaDoc.includes(name));
  const fns = [...schemaSql.matchAll(/create or replace function public\.([a-z0-9_]+)/gi)].map((m) => m[1]);
  const missingFns = [...new Set(fns)].filter((name) => !schemaDoc.includes(name));
  const missing = [
    ...missingTables.map((name) => `table public.${name}`),
    ...missingFns.map((name) => `RPC ${name}`),
  ];
  if (missing.length === 0) return;
  const message = `docs:check SCHEMA.md is missing: ${missing.join(', ')}`;
  if (check) {
    console.error(message);
    process.exit(1);
  }
  throw new Error(message);
}

assertSchemaDocCoversSql();

const writes = [
  { file: path.join(root, 'docs/PRODUCT_FACTS.md'), current: fs.existsSync(path.join(root, 'docs/PRODUCT_FACTS.md')) ? read('docs/PRODUCT_FACTS.md') : '', next: factsMd },
  splice('docs/PUBLIC.md', publicBlock),
  splice('docs/INVESTOR.md', investorBlock),
  splice('docs/LEGAL_BRIEFING.md', legalBlock),
];

let dirty = false;
for (const item of writes) {
  if (item.current === item.next) continue;
  dirty = true;
  if (check) {
    console.error(`docs:check stale: ${path.relative(root, item.file)}`);
    continue;
  }
  fs.writeFileSync(item.file, item.next);
  console.log(`docs:sync wrote ${path.relative(root, item.file)}`);
}

if (check && dirty) {
  console.error('Front-of-house docs are behind product constants. Run `pnpm docs:sync` and commit.');
  process.exit(1);
}

if (!dirty) {
  console.log(check ? 'docs:check ok' : 'docs:sync already up to date');
}
