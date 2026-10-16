/** QUIZ-05 athlete "Share a fun fact" (design §6.3, §6.4, §6.7, §6.13; §6 overrides §1–§5).
 * Used in the athlete's own Edit profile sheet and as the optional last step after claiming an athlete roster. The
 * server decides everything: who may share (athletes with a recorded 13+ age), the switch, the six preset prompts and
 * the curated pre-game meal list, the text filter, the guardian step for under-16s and the admin check. This screen:
 * - shows the opt-in copy, up to 3 facts with a plain status (Waiting for a guardian / Waiting for review / Live /
 *   Paused for a check / Declined) and Remove on each (the athlete can always remove one; the words are deleted);
 * - offers the prompts not already used; the pre-game meal is a picker, the rest a 40-character answer;
 * - shows the server's refusal in plain words (no guessing on the phone);
 * - shows the private monthly bucket line ("Last month, 10+ fans learned your hype song.") only when the server sends a
 *   bucket for last month, never on a paused fact, never who;
 * - renders nothing for non-athletes, accounts with no recorded age, a failed read, or when the server says fun facts
 *   are off (if facts are still kept while off, only the list with Remove shows so removal stays possible);
 * - never asks a 13–15 to invite a guardian: a draft simply reads "Waiting for a guardian".
 * In sign-up it is skippable ("Not now" is there from the first frame) and never blocks or slows the claim, which has
 * already finished before this step shows.
 * @sideEffects `quiz_fact_mine`, `quiz_fact_counts`, `quiz_fact_submit`, `quiz_fact_withdraw` through lib/freshQuestions.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { QuizButton } from '@/components/SportQuiz/QuizButton';
import { colors, radii } from '@/constants/theme';
import {
  FUN_FACT_MAX_LENGTH, FUN_FACT_TEXT_WORDS, fetchFunFactCounts, fetchMyFunFacts, funFactTextCodes, submitFunFact, withdrawFunFact,
  type FunFact, type FunFactCounts, type FunFactMine, type FunFactOwnerStatus, type FunFactPromptKey,
} from '@/lib/freshQuestions';
import { FOCAL } from '@/theme/motion';

export const FUN_FACT_INTRO = 'Share a fun fact? Pick up to 3. An admin checks each one, and a parent or guardian approves if you’re under 16. Only people your privacy settings allow will see it. Remove one any time.';
/** Plain status words; never colour alone. Withdrawn and removed facts are not listed. */
export const FUN_FACT_STATUS_LABEL: Record<Exclude<FunFactOwnerStatus, 'withdrawn' | 'removed'>, string> = {
  waiting_guardian: 'Waiting for a guardian', guardian_review: 'Waiting for a guardian', admin_review: 'Waiting for review',
  approved: 'Live', paused: 'Paused for a check', declined: 'Declined',
};
/** What fans learned, for the private monthly line. */
const FUN_FACT_NOUN: Record<FunFactPromptKey, string> = {
  pregame_meal: 'your pre-game meal', hype_song: 'your hype song', pro_athlete: 'your favorite pro athlete',
  pregame_ritual: 'your pre-game ritual', hidden_talent: 'your hidden talent', other_sport: 'the other sport you love',
};
const GONE: FunFactOwnerStatus[] = ['withdrawn', 'removed'];
/** Facts that hold a prompt (the server's "live" count: not declined, withdrawn or removed). */
const HOLDS_PROMPT = (f: FunFact) => !['declined', 'withdrawn', 'removed'].includes(f.status);

/** @purpose Plain words for a refused or failed fun-fact action; text refusals come from the server's codes. */
export function funFactProblem(caught: unknown): string {
  const text = caught instanceof Error ? caught.message : '';
  const codes = funFactTextCodes(text);
  if (codes.length) return codes.map((code) => FUN_FACT_TEXT_WORDS[code]).join(' ');
  if (text.includes('quiz_fact_limit')) return 'You can share up to 3 at a time. Remove one to add another.';
  if (text.includes('quiz_fact_prompt_taken')) return 'You already shared one for this prompt. Remove it first to change it.';
  if (text.includes('quiz_facts_paused')) return 'Fun facts aren’t open right now.';
  if (text.includes('quiz_fact_missing')) return 'That fun fact is already gone.';
  if (text.includes('quiz_identity_changed')) return 'Your account changed. Close this and try again.';
  return 'That didn’t work. Check your connection and try again.';
}
/** @purpose Last month's bucket for one fact, or null (under 5 fans, no data, or not sent). */
export function lastMonthBucket(counts: FunFactCounts | null, factId: string): string | null {
  return counts?.facts.find((f) => f.id === factId)?.months[0]?.bucket ?? null;
}

/** A 44-point choice in a radio group (prompts, meals). */
function Choice({ label, group, selected, disabled, onPress }: { label: string; group: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={`${group}: ${label}`} accessibilityState={{ selected, checked: selected, disabled: !!disabled }} disabled={disabled}
    onPress={onPress} style={[styles.choice, selected && styles.choiceOn, disabled && styles.dim]}>
    <Text style={[styles.choiceLabel, selected && styles.choiceLabelOn]}>{selected ? `✓ ${label}` : label}</Text>
  </Pressable>;
}

/** @purpose The athlete's fun facts: share, statuses, private counts and Remove. `variant="signup"` adds Not now. */
export function FunFactShare({ variant = 'settings', onSkip, onHidden }: {
  variant?: 'settings' | 'signup';
  /** Sign-up: "Not now" (and "Done" after sharing) — writes nothing. */
  onSkip?: () => void;
  /** Sign-up: the server says this account can't share, so the step closes itself. */
  onHidden?: () => void;
}) {
  const [mine, setMine] = useState<FunFactMine | null>(null);
  const [failed, setFailed] = useState(false);
  const [counts, setCounts] = useState<FunFactCounts | null>(null);
  const [prompt, setPrompt] = useState<FunFactPromptKey | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const load = useCallback(async () => {
    try {
      const next = await fetchMyFunFacts();
      if (!live.current) return;
      setMine(next);
      // Counts only matter for live facts; a failed count read just hides the line.
      if (next.facts.some((f) => f.status === 'approved')) fetchFunFactCounts().then((c) => { if (live.current) setCounts(c); }, () => {});
    } catch {
      if (live.current) setFailed(true);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const listed = mine ? mine.facts.filter((f) => !GONE.includes(f.status)) : [];
  const hidden = failed || (!!mine && (!mine.can_submit || mine.needs_birth || (!mine.enabled && listed.length === 0)));
  useEffect(() => { if (hidden) onHidden?.(); }, [hidden]); // eslint-disable-line react-hooks/exhaustive-deps -- tell the step once
  // iOS ignores live regions: announce each status change once (Android reads the polite region below).
  useEffect(() => { if (notice && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility?.(notice); }, [notice]);

  const share = async () => {
    if (!mine || !prompt || busy) return;
    setBusy(true); setProblem(null); setNotice(null);
    try {
      const fact = await submitFunFact(prompt, answer.trim(), mine.profile_id);
      setPrompt(null); setAnswer('');
      setNotice(`Shared. Status: ${FUN_FACT_STATUS_LABEL[fact.status as keyof typeof FUN_FACT_STATUS_LABEL] ?? 'Waiting for review'}.`);
      await load();
    } catch (caught) {
      setProblem(funFactProblem(caught));
    } finally {
      if (live.current) setBusy(false);
    }
  };
  const remove = async (fact: FunFact) => {
    if (!mine || busy) return;
    setBusy(true); setProblem(null); setNotice(null);
    try {
      await withdrawFunFact(fact.id, mine.profile_id);
      setRemoving(null);
      setNotice(`Removed your ${fact.label.toLowerCase()} fun fact.`);
      await load();
    } catch (caught) {
      setProblem(funFactProblem(caught));
    } finally {
      if (live.current) setBusy(false);
    }
  };

  const skip = variant === 'signup' && onSkip
    ? <QuizButton quiet label={listed.length ? 'Done' : 'Not now'} hint="Skips this step. You can share a fun fact later from Edit profile." onPress={onSkip}/>
    : null;
  if (hidden) return null;
  if (!mine) return skip ? <View style={styles.wrap}>{skip}</View> : null;

  const used = new Set(mine.facts.filter(HOLDS_PROMPT).map((f) => f.prompt_key));
  const open = mine.prompts.filter((p) => !used.has(p.key));
  const canAdd = mine.enabled && mine.live < mine.max_live && open.length > 0;
  const chosen = mine.prompts.find((p) => p.key === prompt) ?? null;
  const ready = !!chosen && (chosen.answers ? chosen.answers.includes(answer) : answer.trim().length >= 2);

  return <View style={styles.wrap}>
    <Text accessibilityRole="header" style={styles.title}>Share a fun fact?</Text>
    <Text style={styles.copy}>{FUN_FACT_INTRO}</Text>
    {!mine.enabled ? <Text style={styles.copy}>Fun facts aren’t open right now. You can still remove yours.</Text> : null}
    {mine.enabled && mine.effective_audience === 'only_me' ? <Text style={styles.copy}>Your Fun facts privacy is set to Only me, so nobody sees them in trivia. You can change it in Privacy.</Text> : null}
    {mine.enabled && !mine.verified && listed.some((f) => f.status === 'approved') ? <Text style={styles.copy}>Fans see your live fun facts once your account is verified.</Text> : null}

    {listed.map((fact) => {
      const status = FUN_FACT_STATUS_LABEL[fact.status as keyof typeof FUN_FACT_STATUS_LABEL];
      const bucket = fact.status === 'approved' ? lastMonthBucket(counts, fact.id) : null;
      return <View key={fact.id} style={styles.fact}>
        <Text style={styles.factPrompt}>{fact.label}</Text>
        {fact.answer_text ? <Text style={styles.factAnswer}>{fact.answer_text}</Text> : null}
        <Text style={styles.status}>{`Status: ${status}`}</Text>
        {bucket ? <Text style={styles.copy}>{`Last month, ${bucket} fans learned ${FUN_FACT_NOUN[fact.prompt_key]}.`}</Text> : null}
        {removing === fact.id ? <>
          <Text style={styles.copy}>Remove this fun fact? Fans stop seeing it right away and your words are deleted.</Text>
          <View style={styles.row}>
            <QuizButton label="Remove" disabled={busy} onPress={() => { void remove(fact); }}/>
            <QuizButton quiet label="Keep" disabled={busy} onPress={() => setRemoving(null)}/>
          </View>
        </> : <QuizButton quiet label={`Remove ${fact.label}`} disabled={busy} onPress={() => setRemoving(fact.id)}/>}
      </View>;
    })}

    {canAdd ? <View style={styles.add}>
      <Text style={styles.section}>Pick a prompt</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Fun fact prompt">
        {open.map((p) => <Choice key={p.key} group="Prompt" label={p.label} selected={prompt === p.key} disabled={busy}
          onPress={() => { setPrompt(p.key); setAnswer(''); setProblem(null); }}/>)}
      </View>
      {chosen?.answers ? <>
        <Text style={styles.section}>{`${chosen.label}: pick one`}</Text>
        <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={`${chosen.label} choices`}>
          {chosen.answers.map((a) => <Choice key={a} group={chosen.label} label={a} selected={answer === a} disabled={busy} onPress={() => setAnswer(a)}/>)}
        </View>
      </> : chosen ? <>
        <Text style={styles.section}>{chosen.label}</Text>
        <TextInput accessibilityLabel={`Your answer: ${chosen.label}`} value={answer} onChangeText={setAnswer} maxLength={FUN_FACT_MAX_LENGTH}
          placeholder={`Up to ${FUN_FACT_MAX_LENGTH} characters`} placeholderTextColor={colors.textMuted} editable={!busy} style={styles.input}/>
        <Text style={styles.hint}>{`${answer.length}/${FUN_FACT_MAX_LENGTH}. No names of places, schools, times or numbers.`}</Text>
      </> : null}
      {chosen ? <QuizButton label="Share this fun fact" disabled={busy || !ready} onPress={() => { void share(); }}/> : null}
    </View> : null}

    {problem ? <Text accessibilityRole="alert" style={styles.problem}>{problem}</Text> : null}
    {/* Kept mounted so Android reads each status change. */}
    <Text accessibilityLiveRegion="polite" style={notice ? styles.notice : styles.offscreen}>{notice ?? ''}</Text>
    {skip}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 10, padding: 14, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  copy: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  section: { fontSize: 14, fontWeight: '800', color: colors.text },
  fact: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  factPrompt: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  factAnswer: { fontSize: 16, fontWeight: '700', color: colors.text },
  status: { fontSize: 14, fontWeight: '700', color: FOCAL.violetInk },
  add: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  choiceOn: { borderWidth: 2, borderColor: FOCAL.violetInk, backgroundColor: FOCAL.mistViolet },
  choiceLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  choiceLabelOn: { color: FOCAL.violetInk },
  dim: { opacity: 0.5 },
  input: { minHeight: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, fontSize: 16, color: colors.text, backgroundColor: colors.background },
  hint: { fontSize: 12, color: colors.textMuted },
  problem: { fontSize: 14, fontWeight: '600', color: colors.danger },
  notice: { fontSize: 14, fontWeight: '600', color: colors.text },
  offscreen: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
