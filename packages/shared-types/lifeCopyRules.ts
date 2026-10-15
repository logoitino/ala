/**
 * QUIZ-04 Life copy rules as one shared check (2026-10-15): the admin "Add a question" form and
 * `scripts/life-bank-sql.mjs` run this same code, so the desk refuses before saving exactly what CI refuses in the bank.
 * The rule data stays in one file, `supabase/content/life_copy_rules.json` (also embedded in SQL as
 * quiz_life_copy_rules(), which the server runs at approval); callers pass it in, so this module never reads files.
 * Written as erasable-only TypeScript so Node can run it directly (type stripping) from the bank script.
 * @purpose Return the broken rule names, in the same names and order as SQL quiz_life_copy_problems.
 */

/** The rule file's fields (everything except `_comment`). */
export type LifeCopyRuleSet = {
  version: number;
  advice: string[];
  brands: string[];
  money_words: string[];
  money_patterns: string[];
  nil_eligibility: string[];
  tax_loan_credit: string[];
  money_symbols: string;
  number_words: string[];
  figure_words: string[];
  currency_words: string[];
  currency_prefixes: string[];
  amount_suffixes: string[];
  magnitude_words: string[];
  year_pattern: string;
  scam_chapter: string;
  scam_end: string;
  prompt_max: number;
  explanation_max: number;
  allowed_non_ascii: string;
};

/** The item fields the rules read; `chapter` decides the Scam Defense ending rule. */
export type LifeCopyItem = { prompt: string; options?: string[]; explanation: string; chapter?: string | null };

const W = 'a-z0-9_';
/** NFKC, zero-width characters removed, plain spaces and quotes, lowercase (the same steps as SQL). */
export const normalizeLifeCopy = (s: unknown): string => {
  const raw = String(s ?? '');
  const n = typeof raw.normalize === 'function' ? raw.normalize('NFKC') : raw;
  return n.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ').replace(/[\u2018\u2019\u02BB\u02BC`\u00B4\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"').toLowerCase();
};
/** Matching runs on macron-stripped text (ā→a …), so "dōnation" or "Yōu should" cannot slip past a phrase. */
const MACRONS: Record<string, string> = { ā: 'a', ē: 'e', ī: 'i', ō: 'o', ū: 'u' };
const strip = (s: string) => s.replace(/[āēīōū]/g, c => MACRONS[c] ?? c);
const escape = (x: string) => x.replace(/[.^$*+?()[\]{}|\\]/g, '\\$&');
const alt = (list: string[]) => `(?:${list.map(x => escape(strip(x)).replace(/ /g, '\\s+')).join('|')})`;
const phraseRe = (list: string[]) => `(?<![${W}])${alt(list)}(?![${W}])`;
/** Codepoint length after trimming, matching Postgres char_length(btrim(...)). */
export const lifeCopyLength = (s: unknown): number => [...String(s ?? '').trim()].length;

type Compiled = { advice: RegExp; brands: RegExp; money: RegExp; moneyPattern: RegExp; nil: RegExp; tax: RegExp; figure: RegExp; year: RegExp };
const cache = new WeakMap<LifeCopyRuleSet, Compiled>();
function compile(r: LifeCopyRuleSet): Compiled {
  const hit = cache.get(r);
  if (hit) return hit;
  // Money figures (same pattern as SQL quiz_life_figure_re): any money symbol or %, digits or number words with a
  // currency / percent / "grand" word, "a" / "an" with a currency word, a currency code before digits, digits with
  // k / m / bn, or million / billion / trillion on their own.
  const figure = new RegExp(`[${r.money_symbols.replace(/[\]\\^-]/g, '\\$&')}]|[0-9][0-9,.]*\\s*-?\\s*${alt(r.figure_words)}(?![${W}])`
    + `|${phraseRe(r.number_words)}\\s*-?\\s*${alt(r.figure_words)}(?![${W}])|(?<![${W}])(?:a|an)\\s+${alt(r.currency_words)}(?![${W}])`
    + `|(?<![${W}])${alt(r.currency_prefixes)}\\s*[0-9]|[0-9][0-9,.]*\\s*${alt(r.amount_suffixes)}(?![${W}])|${phraseRe(r.magnitude_words)}`);
  const out: Compiled = {
    advice: new RegExp(phraseRe(r.advice)), brands: new RegExp(phraseRe(r.brands)), money: new RegExp(phraseRe(r.money_words)),
    moneyPattern: new RegExp(`(?<![${W}])(?:${r.money_patterns.join('|')})(?![${W}])`), nil: new RegExp(phraseRe(r.nil_eligibility)),
    tax: new RegExp(phraseRe(r.tax_loan_credit)), figure, year: new RegExp(r.year_pattern),
  };
  cache.set(r, out);
  return out;
}

/** @purpose The broken Life copy rule names for one item, same names and order as SQL quiz_life_copy_problems. */
export function lifeCopyProblems(rules: LifeCopyRuleSet, { prompt, options = [], explanation, chapter }: LifeCopyItem): string[] {
  const c = compile(rules);
  const p = normalizeLifeCopy(prompt);
  const e = normalizeLifeCopy(explanation).trim();
  const t = `${p} ${e} ${normalizeLifeCopy((Array.isArray(options) ? options : []).join(' '))}`;
  const m = strip(t);
  const out: string[] = [];
  if ([...t].some(ch => ch.charCodeAt(0) > 126 && !rules.allowed_non_ascii.includes(ch))) out.push('non_latin_text');
  if (c.advice.test(m)) out.push('advice_you_should');
  if (c.brands.test(m)) out.push('brand_name');
  if (c.money.test(m) || c.moneyPattern.test(m)) out.push('tapuai_money_word');
  if (c.nil.test(m)) out.push('nil_eligibility');
  if (c.tax.test(m)) out.push('tax_loan_credit');
  if (c.figure.test(m)) out.push('money_figure');
  if (c.year.test(m)) out.push('year');
  if (chapter === rules.scam_chapter && !e.endsWith(rules.scam_end)) out.push('scam_missing_report_line');
  if (lifeCopyLength(prompt) > rules.prompt_max) out.push('prompt_too_long');
  if (lifeCopyLength(explanation) > rules.explanation_max) out.push('explanation_too_long');
  return out;
}
