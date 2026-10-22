#!/usr/bin/env node
/**
 * Transaction-language check (owner, 2026-10-22). Individual support is a personal gift; program
 * contributions are donations, with optional tips to Tapua'i kept separate. This script
 * fails when on-screen copy in the apps uses the words we retired or words that are risky for
 * student-athletes. Rules and reasons: docs/product/VOICE.md. The VOICE agent (.claude/agents/voice.md)
 * reviews what a regex can't (tone, performance ties, missing "where does it go" lines).
 *
 * Only human copy is checked: string literals that contain a space or start with a capital letter,
 * and JSX text lines. Code names (`malo`, `tips`, `useTipCheckout`) are fine.
 * To allow one line on purpose, put `copy-ok: <reason>` in a comment on that line or the line above.
 *
 * Usage: node scripts/check-copy.mjs   (pnpm copy:check)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_DIRS = ['apps/mobile/app', 'apps/mobile/src/frontend', 'packages/shared-types', 'apps/admin-portal/app', 'apps/admin-portal/components', 'apps/admin-portal/lib', 'apps/mobile/src/backend/api', 'supabase/functions/_shared/money'];
const SKIP = /(__tests__|\.test\.|\.d\.ts$|node_modules)/;

/**
 * [pattern, why, say instead, allow?] — keep in step with docs/product/VOICE.md "Retired words".
 * `allow` skips the rule when the snippet or its line matches it: "tip" is fine only for the optional tip
 * *to Tapua'i* at checkout (owner 2026-09-29) — never for money to an athlete.
 */
const RULES = [
  [/M[āĀ]LO(?!!)|Mālo(?!!)/, '"Mālo" is only a thank-you ("Mālo! Your gift is on its way")', 'Give / gift'],
  [/\b[Tt]ip(s|ped|ping|per)?\b/, '"tip" sounds like paying for a service or a play', 'give / gift', /Tapua['’]i/],
  [/\b[Bb]ack(ed|ing|ers?)\b/, '"backing" is vague about money', 'give / gifts'],
  [/\bChip In\b/i, '"Chip In" hides the personal gift', 'Give $5 toward this goal'],
  [/\b[Ff]und(s|ed|ing)?\b/, '"fund" reads like an investment', 'give / gifts'],
  [/\b[Ii]nvest(s|ed|ing|ment|ments|or|ors)?\b/, 'investment language is banned for athletes (STORY.md guardrails)', 'give'],
  [/(?<!not |never |isn't |aren't )\btax[- ]deductible\b/i, 'gifts to individuals are NOT tax-deductible', '"not tax-deductible"'],
  [/\b(earn|get paid|paid) (per|for (a|the|that|every)) (touchdown|play|point|goal|stat|win|basket)\b/i, 'money tied to performance can cost a kid eligibility', 'personal gifts for sports costs'],
];

function walk(dir, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (SKIP.test(rel)) continue;
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

function isCopy(text) {
  return /\s/.test(text.trim()) || /^[A-ZÀ-ɏ\u{1F300}-\u{1FAFF}]/u.test(text.trim());
}

/** Copy snippets on a line: human-looking string literals, or the whole line when it looks like JSX text. */
function copyOn(line, isTsx) {
  const trimmed = line.trim();
  if (!trimmed || /^(\/\/|\*|\/\*|import\b)/.test(trimmed)) return [];
  const found = [];
  for (const m of line.matchAll(LITERAL)) {
    const text = m[1] ?? m[2] ?? m[3] ?? '';
    if (isCopy(text)) found.push(text);
  }
  const jsxText = isTsx && /^[A-Za-z0-9$‘’"“(—–-][^;=]*$/.test(trimmed) && !/[{(,]$/.test(trimmed) && !/^(return|const|let|if|else|export|type|case)\b/.test(trimmed);
  if (jsxText) found.push(trimmed.replace(/\{[^}]*\}/g, ' '));
  // Text after a JSX tag on the same line: <Text>Chip In</Text>
  for (const m of line.matchAll(/>([^<>{}]+)</g)) if (/[A-Za-z]/.test(m[1])) found.push(m[1]);
  return found;
}

const problems = [];
for (const rel of SCAN_DIRS.flatMap((d) => walk(d))) {
  const lines = fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/copy-ok:/.test(line) || /copy-ok:/.test(lines[i - 1] ?? '')) return;
    for (const text of copyOn(line, rel.endsWith('x'))) {
      for (const [re, why, instead, allow] of RULES) {
        // Test the whole line too: an apostrophe in "Tapua'i" can split JSX text into fake literals.
        if (allow && (allow.test(text) || allow.test(line))) continue;
        const hit = text.match(re);
        if (hit) problems.push(`${rel}:${i + 1}  "${hit[0]}" — ${why}. Say: ${instead}.\n    ${line.trim().slice(0, 140)}`);
      }
    }
  });
}

const unique = [...new Set(problems)];
if (unique.length) {
  console.error(`copy:check found ${unique.length} line(s) off the transaction voice (docs/product/VOICE.md):\n`);
  console.error(unique.join('\n'));
  process.exit(1);
}
console.log('copy:check ok');
