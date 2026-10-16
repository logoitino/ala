/** QUIZ-05 athlete "Share a fun fact": the opt-in copy, the six prompts, the pre-game meal picker, the server's refusal
 * in plain words, the status per fact, Remove, the private monthly bucket (hidden when absent or paused), hidden for
 * non-athletes / no recorded age / switched off / a failed read, no guardian-invite push for a 13–15, and the sign-up
 * step that is skippable from the first frame and closes itself when sharing isn't open. Synthetic data. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FUN_FACT_INTRO, FunFactShare } from '@/components/Profile/FunFactShare';
import type { FunFact, FunFactMine, FunFactPrompt } from '@shared/freshQuestions';

type Handler = (fn: string, args: Record<string, unknown>) => unknown;
const mockClient = { calls: [] as { fn: string; args: Record<string, unknown> }[], handler: (() => null) as Handler,
  async rpc(fn: string, args: Record<string, unknown>) {
    this.calls.push({ fn, args });
    const data = await this.handler(fn, args) as { __error?: unknown } | null;
    return data && typeof data === 'object' && '__error' in data ? { data: null, error: data.__error } : { data, error: null };
  } };
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
const calls = (fn: string) => mockClient.calls.filter((c) => c.fn === fn);
/** Let the read settle (the shown cases find their text within the same few ticks). */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const MEALS = ['Pasta', 'Chicken and rice', 'Pancakes', 'Poke bowl'];
const PROMPTS: FunFactPrompt[] = [
  { key: 'pregame_meal', label: 'Pre-game meal', answers: MEALS }, { key: 'hype_song', label: 'Hype song', answers: null },
  { key: 'pro_athlete', label: 'Favorite pro athlete', answers: null }, { key: 'pregame_ritual', label: 'Pre-game ritual', answers: null },
  { key: 'hidden_talent', label: 'Hidden talent', answers: null }, { key: 'other_sport', label: 'Other sport you love', answers: null },
];
const fact = (over: Partial<FunFact> = {}): FunFact => ({ id: 'f1', prompt_key: 'hype_song', label: 'Hype song', answer_text: 'Thunderstruck', status: 'approved',
  submitted_at: '2026-09-01T00:00:00Z', guardian_decision: null, guardian_decided_at: null, admin_decided_at: '2026-09-02T00:00:00Z', decline_reason: null, cleared_at: null, ...over });
const mine = (over: Partial<FunFactMine> = {}): FunFactMine => ({ contract_version: 5, profile_id: 'profile-a', enabled: true, can_submit: true, needs_birth: false,
  guardian_needed: false, has_guardian: false, verified: true, audience: 'friends', effective_audience: 'friends', max_live: 3, live: 0, prompts: PROMPTS, facts: [], ...over });
let state: FunFactMine;
let counts: unknown;
beforeEach(() => {
  jest.clearAllMocks(); mockClient.calls = []; state = mine();
  counts = { contract_version: 5, profile_id: 'profile-a', facts: [] };
  mockClient.handler = (fn) => fn === 'quiz_fact_mine' ? state : fn === 'quiz_fact_counts' ? counts : null;
});

it('shows the opt-in copy and the six prompts; a free-text prompt shares the trimmed answer and reads its status', async () => {
  mockClient.handler = (fn, args) => {
    if (fn === 'quiz_fact_submit') {
      const saved = fact({ id: 'f2', status: 'admin_review', answer_text: String(args.p_answer) });
      state = mine({ live: 1, facts: [saved] });
      return { contract_version: 5, fact: saved };
    }
    return fn === 'quiz_fact_mine' ? state : null;
  };
  await render(<FunFactShare />);
  expect(await screen.findByText(FUN_FACT_INTRO)).toBeTruthy();
  expect(FUN_FACT_INTRO).toBe('Share a fun fact? Pick up to 3. An admin checks each one, and a parent or guardian approves if you’re under 16. Only people your privacy settings allow will see it. Remove one any time.');
  for (const p of PROMPTS) expect(screen.getByRole('radio', { name: `Prompt: ${p.label}` })).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Prompt: Hype song' }));
  expect(screen.getByRole('button', { name: 'Share this fun fact' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Your answer: Hype song'), '  Thunderstruck ');
  await fireEvent.press(screen.getByRole('button', { name: 'Share this fun fact' }));
  await waitFor(() => expect(calls('quiz_fact_submit')[0]?.args).toEqual({ p_prompt_key: 'hype_song', p_answer: 'Thunderstruck', p_expected_profile_id: 'profile-a' }));
  const notice = await screen.findByText('Shared. Status: Waiting for review.');
  expect(notice.props.accessibilityLiveRegion).toBe('polite');
  expect(await screen.findByText('Status: Waiting for review')).toBeTruthy();
  // The used prompt is no longer offered.
  expect(screen.queryByRole('radio', { name: 'Prompt: Hype song' })).toBeNull();
});

it('the pre-game meal is a picker from the curated list (no typing)', async () => {
  mockClient.handler = (fn, args) => fn === 'quiz_fact_submit' ? { contract_version: 5, fact: fact({ prompt_key: 'pregame_meal', label: 'Pre-game meal', answer_text: String(args.p_answer), status: 'admin_review' }) }
    : fn === 'quiz_fact_mine' ? state : null;
  await render(<FunFactShare />);
  await fireEvent.press(await screen.findByRole('radio', { name: 'Prompt: Pre-game meal' }));
  expect(screen.queryByRole('textbox')).toBeNull();
  for (const meal of MEALS) expect(screen.getByRole('radio', { name: `Pre-game meal: ${meal}` })).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Pre-game meal: Poke bowl' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Share this fun fact' }));
  await waitFor(() => expect(calls('quiz_fact_submit')[0]?.args.p_answer).toBe('Poke bowl'));
});

it('shows the server’s refusal in plain words', async () => {
  mockClient.handler = (fn) => fn === 'quiz_fact_submit' ? { __error: { message: 'quiz_fact_text: link, digits' } } : fn === 'quiz_fact_mine' ? state : null;
  await render(<FunFactShare />);
  await fireEvent.press(await screen.findByRole('radio', { name: 'Prompt: Hidden talent' }));
  await fireEvent.changeText(screen.getByLabelText('Your answer: Hidden talent'), 'see example.com 123');
  await fireEvent.press(screen.getByRole('button', { name: 'Share this fun fact' }));
  expect(await screen.findByText('No links or websites. No numbers (that keeps phone numbers, addresses and times out).')).toBeTruthy();
  expect(screen.getByRole('alert')).toBeTruthy();
});

it('lists each status in words and removes a fact after confirming', async () => {
  state = mine({ live: 3, facts: [
    fact({ id: 'a', status: 'waiting_guardian', prompt_key: 'hype_song', label: 'Hype song' }),
    fact({ id: 'b', status: 'admin_review', prompt_key: 'hidden_talent', label: 'Hidden talent', answer_text: 'Juggling' }),
    fact({ id: 'c', status: 'approved', prompt_key: 'pro_athlete', label: 'Favorite pro athlete', answer_text: 'Mia Hamm' }),
    fact({ id: 'd', status: 'paused', prompt_key: 'pregame_ritual', label: 'Pre-game ritual', answer_text: 'Deep breaths' }),
    fact({ id: 'e', status: 'declined', prompt_key: 'other_sport', label: 'Other sport you love', answer_text: 'Golf' }),
    fact({ id: 'g', status: 'withdrawn', prompt_key: 'pregame_meal', label: 'Pre-game meal', answer_text: null }),
  ] });
  mockClient.handler = (fn, args) => {
    if (fn === 'quiz_fact_withdraw') { state = mine({ live: 2, facts: state.facts.filter((f) => f.id !== args.p_fact_id) }); return { contract_version: 5, fact: fact({ id: String(args.p_fact_id), status: 'withdrawn', answer_text: null }) }; }
    return fn === 'quiz_fact_mine' ? state : fn === 'quiz_fact_counts' ? counts : null;
  };
  await render(<FunFactShare />);
  for (const words of ['Status: Waiting for a guardian', 'Status: Waiting for review', 'Status: Live', 'Status: Paused for a check', 'Status: Declined'])
    expect(await screen.findByText(words)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Remove Pre-game meal' })).toBeNull();
  // Three live facts: no new prompt is offered.
  expect(screen.queryByText('Pick a prompt')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Hidden talent' }));
  expect(screen.getByText('Remove this fun fact? Fans stop seeing it right away and your words are deleted.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(calls('quiz_fact_withdraw')[0]?.args).toEqual({ p_fact_id: 'b', p_expected_profile_id: 'profile-a' }));
  expect(await screen.findByText('Removed your hidden talent fun fact.')).toBeTruthy();
  expect(screen.queryByText('Juggling')).toBeNull();
});

it('shows the private bucket only when the server sends one for last month, never on a paused fact', async () => {
  state = mine({ live: 3, facts: [fact({ id: 'a' }), fact({ id: 'b', prompt_key: 'hidden_talent', label: 'Hidden talent', answer_text: 'Juggling' }),
    fact({ id: 'c', prompt_key: 'pregame_ritual', label: 'Pre-game ritual', answer_text: 'Deep breaths', status: 'paused' })] });
  counts = { contract_version: 5, profile_id: 'profile-a', facts: [
    { id: 'a', prompt_key: 'hype_song', months: [{ month: '2026-09', bucket: '10+' }, { month: '2026-08', bucket: '5+' }] },
    { id: 'b', prompt_key: 'hidden_talent', months: [{ month: '2026-09', bucket: null }, { month: '2026-08', bucket: '25+' }] },
    { id: 'c', prompt_key: 'pregame_ritual', months: [{ month: '2026-09', bucket: '5+' }] },
  ] };
  await render(<FunFactShare />);
  expect(await screen.findByText('Last month, 10+ fans learned your hype song.')).toBeTruthy();
  expect(screen.queryByText(/fans learned your hidden talent/)).toBeNull();
  expect(screen.queryByText(/fans learned your pre-game ritual/)).toBeNull();
});

it('a 13–15 without a guardian sees "Waiting for a guardian" and no prompt to invite one', async () => {
  state = mine({ guardian_needed: true, has_guardian: false, live: 1, facts: [fact({ status: 'waiting_guardian' })] });
  await render(<FunFactShare />);
  expect(await screen.findByText('Status: Waiting for a guardian')).toBeTruthy();
  expect(screen.queryByText(/invite/i)).toBeNull();
  expect(screen.queryByRole('button', { name: /invite/i })).toBeNull();
});

it.each<[string, Partial<FunFactMine>]>([
  ['a non-athlete', { can_submit: false }],
  ['no recorded age', { can_submit: false, needs_birth: true }],
  ['fun facts switched off', { enabled: false }],
])('renders nothing for %s', async (_label, over) => {
  state = mine(over);
  await render(<FunFactShare />);
  await waitFor(() => expect(calls('quiz_fact_mine')).toHaveLength(1));
  await settle();
  expect(screen.queryByText('Share a fun fact?')).toBeNull();
  expect(screen.queryByRole('radio')).toBeNull();
});

it('renders nothing when the read fails (for example QUIZ-05 not applied)', async () => {
  mockClient.handler = () => ({ __error: { code: 'PGRST202', message: 'Could not find the function' } });
  await render(<FunFactShare />);
  await settle();
  expect(screen.queryByText('Share a fun fact?')).toBeNull();
});

it('switched off with facts still kept: only the list with Remove, no new prompts', async () => {
  state = mine({ enabled: false, live: 1, facts: [fact()] });
  await render(<FunFactShare />);
  expect(await screen.findByText('Fun facts aren’t open right now. You can still remove yours.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Remove Hype song' })).toBeTruthy();
  expect(screen.queryByText('Pick a prompt')).toBeNull();
});

describe('sign-up step', () => {
  it('Not now is there from the first frame, before the read answers, and writes nothing', async () => {
    let release: (v: unknown) => void = () => {};
    mockClient.handler = () => new Promise((r) => { release = r; });
    const onSkip = jest.fn();
    await render(<FunFactShare variant="signup" onSkip={onSkip} onHidden={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(mockClient.calls.map((c) => c.fn)).toEqual(['quiz_fact_mine']);
    await act(async () => { release(state); });
  });

  it('closes itself when sharing isn’t open for this account', async () => {
    state = mine({ needs_birth: true, can_submit: false });
    const onHidden = jest.fn();
    await render(<FunFactShare variant="signup" onSkip={jest.fn()} onHidden={onHidden} />);
    await waitFor(() => expect(onHidden).toHaveBeenCalledTimes(1));
  });

  it('after sharing, the skip reads Done', async () => {
    state = mine({ live: 1, facts: [fact({ status: 'admin_review' })] });
    await render(<FunFactShare variant="signup" onSkip={jest.fn()} />);
    expect(await screen.findByRole('button', { name: 'Done' })).toBeTruthy();
  });
});
