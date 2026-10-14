/**
 * QUIZ-01 admin-first desk: draft facts/version approval, enforced local tester scope, private badge corrections,
 * complete <=100 question Data view and cursor audit. No fan prompt, payment or public reward behavior.
 * @sideEffects Admin quiz RPCs via lib/sportQuiz, and existing Analytics/Health/Support navigation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  AdminBtn, AdminField, AdminMetrics, AdminNotice, AdminPage, AdminPanel, AdminPills, AdminSectionTitle,
} from '@/components/Admin/AdminChrome';
import { AdminShell } from '@/components/Admin/AdminShell';
import { useAdminAction } from '@/hooks/useAdminAction';
import {
  fetchSportQuizAdmin, saveSportQuizQuestion, saveSportQuizSettings,
  type QuizAdminQuestion, type QuizAdminSnapshot, type QuizQuestionAction,
} from '@/lib/sportQuiz';

const empty = { sport: '', prompt: '', options: ['', '', '', ''], correct: '1', explanation: '' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @purpose Gate desk mounting, not just visibility, on the existing authenticated admin shell. */
export function SportQuizTool() { return <AdminShell><SportQuizDesk /></AdminShell>; }

/** @purpose Operate paused/testing-only learning with no participant identity or answer list. */
function SportQuizDesk() {
  const router = useRouter();
  const [data, setData] = useState<QuizAdminSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'operate' | 'data'>('operate');
  const [selected, setSelected] = useState<QuizAdminQuestion | null>(null);
  const [form, setForm] = useState(empty);
  const [reason, setReason] = useState('');
  const [testers, setTesters] = useState('');
  const live = useRef(true);
  const load = useCallback(async () => {
    if (live.current) setLoading(true);
    try {
      const next = await fetchSportQuizAdmin();
      if (live.current) {
        setData(next); setError(null); setTesters(next.settings.pilot_accounts.join('\n'));
        setSelected(old => old ? next.questions.find(q => q.id === old.id) ?? null : null);
      }
    } catch (caught) {
      if (live.current) { setData(null); setError(caught instanceof Error ? caught.message : 'Sport Pop Quiz is unavailable.'); }
    } finally { if (live.current) setLoading(false); }
  }, []);
  useEffect(() => { live.current = true; void load(); return () => { live.current = false; }; }, [load]);
  const { busy, message, run } = useAdminAction();
  const hasReason = reason.trim().length >= 10 && reason.trim().length <= 500;
  const pilotIds = testers.split(/[\s,]+/).filter(Boolean);
  const validTesters = pilotIds.length <= 100 && pilotIds.every(id => uuid.test(id)) && new Set(pilotIds).size === pilotIds.length;
  const validForm = form.sport.trim().length >= 2 && form.prompt.trim().length >= 10 && form.explanation.trim().length >= 10
    && form.options.every(o => o.trim().length > 0) && new Set(form.options.map(o => o.trim())).size === 4 && /^[1-4]$/.test(form.correct);
  const choose = (q: QuizAdminQuestion) => {
    setSelected(q); setForm({ sport: q.sport, prompt: q.prompt, options: [...q.options], correct: String(q.correct_option + 1), explanation: q.explanation });
  };
  const writeQuestion = (action: QuizQuestionAction) => {
    void run(action, async () => {
      const payload = action === 'create' || action === 'edit'
        ? { reason: reason.trim(), sport: form.sport, prompt: form.prompt, options: form.options, correct_option: Number(form.correct) - 1, explanation: form.explanation }
        : { reason: reason.trim() };
      await saveSportQuizQuestion(action === 'create' ? null : selected?.id ?? null, action, payload);
      setReason(''); await load();
      return action === 'void' ? 'Question voided. Affected badges are hidden with a private correction.'
        : action === 'edit' ? 'New draft version created. Issued questions stay unchanged.'
          : action === 'create' ? 'Draft created; verify the facts before approval.' : `Question ${action === 'approve' ? 'approved' : 'archived'}.`;
    });
  };
  const configure = (enabled: boolean, ids: string[]) => {
    void run('settings', async () => {
      await saveSportQuizSettings({ enabled, pilot_accounts: ids }, reason.trim());
      setReason(''); await load(); return enabled ? 'Enabled for listed local testers only.' : 'Paused for local testing.';
    });
  };
  const moreAudit = () => {
    if (!data?.next_before) return;
    const cursor = data.next_before;
    void run('audit', async () => {
      const next = await fetchSportQuizAdmin(cursor);
      setData(old => old ? { ...old, audit: [...old.audit, ...next.audit], next_before: next.next_before } : null);
      return 'Earlier audit loaded.';
    });
  };

  return (
    <AdminPage title="Sport Pop Quiz" lede="Optional weekly learning. Private noncash completion badges, even after a wrong answer; no money, Aura or vote effects."
      refreshing={loading} onRefresh={() => { if (!busy) void load(); }} error={error}>
      <View style={styles.links}>
        {(['analytics', 'health', 'support'] as const).map(path => <AdminBtn key={path} label={path === 'analytics' ? 'Analytics' : path === 'health' ? 'Health' : 'Support'}
          onPress={() => router.push(`/admin/${path}` as Href)} />)}
      </View>
      <AdminNotice text={message?.text ?? null} tone={message?.tone} />
      {loading && !data && !error ? <Text>Reading quiz source…</Text> : null}
      {data ? <>
        <AdminPanel title="Testing audience">
          <Text>{`${data.settings.enabled ? 'Enabled for listed testers' : 'Paused'} · testing only · ${data.settings.pilot_accounts.length}/100 tester accounts`}</Text>
          <Text>{`UTC week: ${data.week_start} to ${data.week_end} (end excluded). Source read ${data.generated_at}.`}</Text>
          <AdminField label="Review or correction reason" value={reason} onChangeText={setReason} multiline />
          <AdminField label="Tester profile IDs" value={testers} onChangeText={setTesters} multiline placeholder="Canonical profile UUIDs, separated by commas or new lines" />
          <Text>No Stripe, athlete or school verification requirement. The server checks accepted age and enrolled account capability.</Text>
          <AdminBtn label="Enable for listed testers" kind="primary" disabled={!!busy || !hasReason || !validTesters || pilotIds.length === 0}
            onPress={() => configure(true, pilotIds)} />
          <AdminBtn label="Save tester list while paused" disabled={!!busy || !hasReason || !validTesters} onPress={() => configure(false, pilotIds)} />
          <AdminBtn label="Pause quiz" kind="danger" disabled={!!busy || !hasReason} onPress={() => configure(false, data.settings.pilot_accounts)} />
        </AdminPanel>
        <AdminMetrics items={[
          { label: 'Draft questions', value: data.counts.questions_draft }, { label: 'Approved questions', value: data.counts.questions_approved },
          { label: 'Archived questions', value: data.counts.questions_archived }, { label: 'Void questions', value: data.counts.questions_void },
          { label: 'Issued this UTC week', value: data.counts.week_issued }, { label: 'Completed this UTC week', value: data.counts.week_completed },
          { label: 'Skipped this UTC week', value: data.counts.week_skipped }, { label: 'Voided this UTC week', value: data.counts.week_void },
          { label: 'Private badges issued', value: data.counts.badges_issued }, { label: 'Badges void', value: data.counts.badges_void },
        ]} />
        <AdminPills label="Quiz desk" items={[{ id: 'operate', label: 'Operate' }, { id: 'data', label: 'Data' }]} value={tab} onChange={setTab} />
        <AdminSectionTitle>Question bank</AdminSectionTitle>
        <Text>{`${data.questions.length}/100 stored versions · complete bank, including draft/archived/void. Editing creates a new draft; issued content is immutable.`}</Text>
        {tab === 'operate' ? <>
          <AdminPanel title={selected ? `Selected ${selected.sport} · version ${selected.version} · ${selected.status}` : 'New draft question'}>
            <AdminBtn label="Clear selection" disabled={!!busy} onPress={() => { setSelected(null); setForm(empty); }} />
            <AdminField label="Sport and rule context" value={form.sport} onChangeText={sport => setForm(old => ({ ...old, sport }))} />
            <AdminField label="Question" value={form.prompt} onChangeText={prompt => setForm(old => ({ ...old, prompt }))} multiline />
            {form.options.map((value, i) => <AdminField key={i} label={`Answer option ${i + 1}`} value={value} onChangeText={text => setForm(old => ({ ...old, options: old.options.map((o, j) => i === j ? text : o) }))} />)}
            <AdminField label="Correct option (1 to 4)" value={form.correct} keyboardType="number-pad" onChangeText={correct => setForm(old => ({ ...old, correct }))} />
            <AdminField label="Explanation" value={form.explanation} onChangeText={explanation => setForm(old => ({ ...old, explanation }))} multiline />
            <Text>Draft examples need human fact approval. Void erroneous issued wording; do not rewrite a person's answer or claim learning proficiency.</Text>
            <AdminBtn label="Create draft" disabled={!!busy || !hasReason || !validForm || data.questions.length >= 100 || selected !== null} onPress={() => writeQuestion('create')} />
            <AdminBtn label="Create new draft version" disabled={!!busy || !hasReason || !validForm || !selected || data.questions.length >= 100} onPress={() => writeQuestion('edit')} />
            <AdminBtn label={busy === 'approve' ? 'Working…' : 'Approve question'} kind="primary" disabled={!!busy || !hasReason || selected?.status !== 'draft'} onPress={() => writeQuestion('approve')} />
            <AdminBtn label="Archive question" disabled={!!busy || !hasReason || !selected || !['draft','approved'].includes(selected.status)} onPress={() => writeQuestion('archive')} />
            <AdminBtn label="Void erroneous question and badges" kind="danger" disabled={!!busy || !hasReason || !selected || selected.status === 'void'} onPress={() => writeQuestion('void')} />
          </AdminPanel>
          {data.questions.map(q => <AdminBtn key={q.id} label={`Select ${q.sport} question version ${q.version}`} disabled={!!busy} onPress={() => choose(q)} />)}
        </> : <>
          {data.questions.map(q => <AdminPanel key={q.id} title={`${q.sport} · version ${q.version} · ${q.status}`}>
            <Text>{q.prompt}</Text>
            {q.options.map((option, i) => <Text key={i}>{`${i + 1}. ${option}${q.correct_option === i ? ' · correct' : ''}`}</Text>)}
            <Text>{q.explanation}</Text><Text>{`Reason: ${q.reason}`}</Text>
            <Text>{`Version ID ${q.id} · question key ${q.question_key}`}</Text>
            <Text>{`Created ${q.created_at} · by ${q.created_by ?? 'draft seed'} · reviewed ${q.reviewed_at ?? 'not reviewed'} · by ${q.reviewed_by ?? 'none'}`}</Text>
          </AdminPanel>)}
          <AdminSectionTitle>Audit and corrections</AdminSectionTitle>
          <Text>Server actor/time; participant answers and identities are withheld. Voiding hides invalid badges and gives the account a private correction.</Text>
          {data.audit.length === 0 ? <Text>No recorded quiz actions.</Text> : data.audit.map(a => <Text key={a.id} style={styles.audit}>{`${a.created_at} · ${a.action} · actor ${a.actor_id ?? 'withheld'} · question ${a.question_id ?? 'none'}${a.reason ? ` · ${a.reason}` : ''}`}</Text>)}
          <AdminBtn label="Load earlier audit" disabled={!!busy || !data.next_before} onPress={moreAudit} />
        </>}
      </> : null}
    </AdminPage>
  );
}
const styles = StyleSheet.create({ links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, audit: { fontSize: 13, marginVertical: 5 } });
