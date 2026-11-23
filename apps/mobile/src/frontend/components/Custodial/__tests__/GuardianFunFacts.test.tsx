/** QUIZ-05 guardian side: an under-16's fun fact waits in the guardian panel with the prompt and the answer and only
 * Approve / Decline (no edit, no text field, no withdraw); a refusal is said plainly; nothing shows on a server without
 * QUIZ-05. The shared summary shows "Fun facts shared: n" and the fun facts audience, and fun-fact events read plainly.
 * Synthetic data. */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import { GuardianSupervisionPanel } from '@/components/Custodial/GuardianSupervisionPanel';
import { SupervisionSummary } from '@/components/Custodial/SupervisionSummary';
import * as fresh from '@/lib/freshQuestions';
import * as minors from '@/lib/minors';
import { NOT_SWITCHED_ON } from '@/lib/rpc';

const mockBoundClient = {};
const mockAuth = { user: { id: 'guardian-user-A' }, isSessionCurrent: () => true };
jest.mock('@/context/AuthContext', () => ({ useOptionalAuth: () => mockAuth }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: (id: string) => ({ userId: id, isCurrent: () => true }) } }));
jest.mock('@/lib/offlineActor', () => ({ ...jest.requireActual('@/lib/offlineActor'), createOfflineActorClient: async () => mockBoundClient }));

jest.mock('@/lib/minors', () => ({ ...jest.requireActual('@/lib/minors'), fetchGuardianMinors: jest.fn(), fetchGuardianSupervision: jest.fn() }));
jest.mock('@/lib/freshQuestions', () => ({ ...jest.requireActual('@/lib/freshQuestions'), fetchGuardianFunFacts: jest.fn(), decideGuardianFunFact: jest.fn() }));
const m = jest.mocked(minors);
const f = jest.mocked(fresh);

const linked: minors.GuardianMinorRow = {
  profileId: 'm1', firstName: 'Lani', username: 'teenlani', ageBand: 'teen_13_15', linkId: 'l1', linkStatus: 'linked',
  accountPrivate: true, myConsent: null, canAllowDonations: false, pendingApprovals: 1,
};
const pending = (over: Partial<fresh.GuardianFunFacts['facts'][number]> = {}) => ({ fact_id: 'fact-1', minor_profile_id: 'm1', first_name: 'Lani',
  prompt_key: 'hidden_talent' as const, label: 'Hidden talent', answer_text: 'Juggling', requested_at: '2026-10-15T00:00:00Z', ...over });
const summary = (extra: Record<string, unknown> = {}) => minors.parseSupervision({ settings: { audience: { fun_facts: 'friends' } }, summary: { friends: 2, fun_facts_shared: 1, ...extra }, events: [] });

beforeEach(() => {
  jest.clearAllMocks();
  m.fetchGuardianMinors.mockResolvedValue([linked]);
  m.fetchGuardianSupervision.mockResolvedValue(summary());
  f.fetchGuardianFunFacts.mockResolvedValue({ contract_version: 5, profile_id: 'guardian-1', facts: [pending(), pending({ fact_id: 'other', minor_profile_id: 'm2', first_name: 'Sione' })] });
});

async function openLani() {
  await render(<GuardianSupervisionPanel />);
  await fireEvent.press(await screen.findByLabelText('Lani, show summary'));
}

it('shows the teen’s fun fact with the prompt and answer and only Approve / Decline', async () => {
  await openLani();
  const heading = await screen.findByText('Lani wants to share a fun fact');
  const card = heading.parent!;
  expect(within(card).getByText('Hidden talent')).toBeTruthy();
  expect(within(card).getByText('Juggling')).toBeTruthy();
  expect(within(card).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Approve fun fact: Hidden talent', 'Decline fun fact: Hidden talent']);
  expect(screen.queryByDisplayValue('Juggling')).toBeNull();
  expect(screen.queryByRole('button', { name: /edit|withdraw|remove/i })).toBeNull();
  // Another teen's fact is not shown on Lani's card.
  expect(screen.queryByText('Sione wants to share a fun fact')).toBeNull();
});

it.each([[true, 'Approved Lani\'s fun fact. An admin checks it next.'], [false, 'Declined Lani\'s fun fact.']])('approve=%s sends the decision as this guardian and reloads', async (approve, words) => {
  f.decideGuardianFunFact.mockResolvedValue({ contract_version: 5, fact_id: 'fact-1', status: approve ? 'admin_review' : 'declined' });
  await openLani();
  await fireEvent.press(await screen.findByLabelText(`${approve ? 'Approve' : 'Decline'} fun fact: Hidden talent`));
  await waitFor(() => expect(f.decideGuardianFunFact).toHaveBeenCalledWith('fact-1', approve, 'guardian-1', mockBoundClient));
  expect(await screen.findByText(words)).toBeTruthy();
  expect(f.fetchGuardianFunFacts).toHaveBeenCalledTimes(2);
});

it('says plainly when the fact was already decided or withdrawn', async () => {
  f.decideGuardianFunFact.mockRejectedValue(new Error('quiz_fact_already_decided'));
  await openLani();
  await fireEvent.press(await screen.findByLabelText('Approve fun fact: Hidden talent'));
  expect(await screen.findByText('This fun fact was already decided or withdrawn.')).toBeTruthy();
});

it('shows nothing about fun facts on a server without QUIZ-05', async () => {
  f.fetchGuardianFunFacts.mockRejectedValue(new Error(NOT_SWITCHED_ON));
  await openLani();
  expect(await screen.findByText('2 friends')).toBeTruthy();
  expect(screen.queryByText(/wants to share a fun fact/)).toBeNull();
  expect(screen.queryByText(NOT_SWITCHED_ON)).toBeNull();
});

it('the summary shows "Fun facts shared: n" and the audience; it is absent when the server does not send it', async () => {
  const view = await render(<SupervisionSummary data={summary({ fun_facts_shared: 2 })} />);
  expect(screen.getByText('Fun facts shared: 2')).toBeTruthy();
  expect(screen.getByText(/Fun facts: Friends/)).toBeTruthy();
  await view.rerender(<SupervisionSummary data={minors.parseSupervision({ settings: {}, summary: { friends: 1 }, events: [] })} />);
  expect(screen.queryByText(/Fun facts shared/)).toBeNull();
  expect(screen.queryByText(/Fun facts:/)).toBeNull();
});

it('fun-fact approval events read plainly (never as "make the profile public")', () => {
  const at = '2026-10-15T00:00:00Z';
  expect(minors.describeEvent({ kind: 'approval_decided', detail: { change: 'fun_fact', approved: true }, at, byTeen: false })).toBe('A fun fact was approved.');
  expect(minors.describeEvent({ kind: 'approval_requested', detail: { changes: ['fun_fact'] }, at, byTeen: true })).toBe('Asked the guardian to approve a fun fact.');
  expect(minors.describeEvent({ kind: 'approval_decided', detail: { change: 'account_public', approved: false }, at, byTeen: false })).toBe('Make the profile public: declined.');
});
