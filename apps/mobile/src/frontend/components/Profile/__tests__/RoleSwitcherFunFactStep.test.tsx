/** QUIZ-05 sign-up integration: inside RoleSwitcherModal the optional "Share a fun fact?" step appears only after a
 * first roster claim has finished (claim and toast first), for an athlete the server says can share; Not now completes
 * the sign-up (the sheet closes) and writes nothing; the step never blocks: the claim never waits for the fun-fact
 * read, Not now works before it answers, and an account that can't share closes straight away. An existing athlete
 * saving a roster never sees the step. Synthetic data. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRef } from 'react';
import * as Reanimated from 'react-native-reanimated';
import { RoleSwitcherModal } from '@/components/Profile/RoleSwitcherModal';
import type { FunFactMine } from '@shared/freshQuestions';

const team = { id: 'team-1', name: 'Kahuku High', mascot: 'Red Raiders', level: 'high_school' as const, division: 'High School', region: 'HI' };
const mockAuth = { activeRole: 'fan' as const, isAthlete: false, profile: { team: null }, setActiveRole: jest.fn(), completeAthleteOnboarding: jest.fn(async () => {}) };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
const mockToast = jest.fn();
jest.mock('@/context/CelebrationContext', () => ({ useCelebration: () => ({ showToast: mockToast }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { catalog: { classYears: ['27'], exclusiveDollars: 4.99 } } }) }));
jest.mock('@/hooks/useSportConfigs', () => ({ useSportConfigs: () => ({ configs: [] }) }));
jest.mock('@/hooks/useLegalAck', () => ({ useLegalAck: () => ({ accepted: true, accept: jest.fn() }) }));
jest.mock('@/components/Legal/LegalModal', () => ({ LegalAckToggle: () => null, LegalModal: () => null }));
jest.mock('@/components/Profile/TeamSearchField', () => ({
  TeamSearchField: ({ onSelect }: { onSelect: (t: unknown) => void }) => {
    const { Pressable: P, Text: T } = require('react-native');
    return <P accessibilityRole="button" accessibilityLabel="Pick Kahuku" onPress={() => onSelect(team)}><T>Pick Kahuku</T></P>;
  },
}));
jest.mock('expo-blur', () => ({ BlurView: require('react-native').View }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
type Handler = (fn: string) => unknown;
const mockClient = { calls: [] as string[], handler: (() => null) as Handler,
  async rpc(fn: string) { this.calls.push(fn); const data = await this.handler(fn) as { __error?: unknown } | null;
    return data && typeof data === 'object' && '__error' in data ? { data: null, error: data.__error } : { data, error: null }; } };
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));

const mine = (over: Partial<FunFactMine> = {}): FunFactMine => ({ contract_version: 5, profile_id: 'profile-a', enabled: true, can_submit: true, needs_birth: false,
  guardian_needed: false, has_guardian: false, verified: false, audience: 'friends', effective_audience: 'friends', max_live: 3, live: 0,
  prompts: [{ key: 'hype_song', label: 'Hype song', answers: null }], facts: [], ...over });

beforeEach(() => {
  jest.clearAllMocks(); mockClient.calls = []; mockAuth.isAthlete = false;
  mockClient.handler = (fn) => fn === 'quiz_fact_mine' ? mine() : null;
  // The test Reanimated mock never runs animation callbacks; run the close callback so dismiss finishes.
  // The shared test mock hands out a new shared value every render, which would re-run the sheet's open effect (and
  // reset the form) on each render; a real shared value is stable.
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation(((initial: unknown) => useRef({ value: initial }).current) as never);
  jest.spyOn(Reanimated, 'withTiming').mockImplementation(((value: number, _config?: unknown, done?: (finished: boolean) => void) => { done?.(true); return value; }) as never);
});
afterEach(() => jest.restoreAllMocks());

async function claim() {
  await fireEvent.press(await screen.findByLabelText('Pick Kahuku'));
  await fireEvent.press(screen.getByRole('tab', { name: 'Basketball' }));
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
}

it('appears after a first claim for an athlete who can share; Not now closes the sheet and writes nothing', async () => {
  const onClose = jest.fn();
  await render(<RoleSwitcherModal visible onClose={onClose} />);
  expect(screen.queryByText('Share a fun fact?')).toBeNull();
  expect(mockClient.calls).toEqual([]);
  await claim();
  expect(mockAuth.completeAthleteOnboarding).toHaveBeenCalledWith(expect.objectContaining({ team, sport: 'Basketball' }));
  expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('School claimed'));
  expect(await screen.findByText('Share a fun fact?')).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(mockClient.calls).toEqual(['quiz_fact_mine']);
});

it('never blocks: the claim finishes before the read, and Not now works while the read is still pending', async () => {
  let release: (v: unknown) => void = () => {};
  mockClient.handler = () => new Promise((r) => { release = r; });
  const onClose = jest.fn();
  await render(<RoleSwitcherModal visible onClose={onClose} />);
  await claim();
  expect(mockToast).toHaveBeenCalled();
  await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => { release(mine()); });
});

it('an account that can’t share (no recorded age) closes straight after the claim', async () => {
  mockClient.handler = (fn) => fn === 'quiz_fact_mine' ? mine({ can_submit: false, needs_birth: true }) : null;
  const onClose = jest.fn();
  await render(<RoleSwitcherModal visible onClose={onClose} />);
  await claim();
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(screen.queryByText('Share a fun fact?')).toBeNull();
});

it('an existing athlete saving a roster never sees the step', async () => {
  mockAuth.isAthlete = true;
  const onClose = jest.fn();
  await render(<RoleSwitcherModal visible onClose={onClose} />);
  await fireEvent.press(await screen.findByLabelText('Pick Kahuku'));
  await fireEvent.press(screen.getByRole('tab', { name: 'Basketball' }));
  await fireEvent.press(screen.getByLabelText('Save athlete roster'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(mockClient.calls).toEqual([]);
});
