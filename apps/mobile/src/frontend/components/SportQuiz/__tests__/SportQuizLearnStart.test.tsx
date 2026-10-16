/** QUIZ-05 Learn-card entry on the trivia screen: the Learn card's own sport round starts through quiz_learn_start
 * with the athlete id; an older server falls back silently to the ordinary Start; nothing about the athlete is shown
 * unless the server returns a fun fact; a normal entry (or another sport) uses the ordinary Start; the route accepts
 * only a UUID-shaped athlete id with a sport. Database replies are synthetic. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { SportQuizScreen } from '@/components/SportQuiz/SportQuizScreen';
import SportQuizRoute from '../../../../../app/sport-quiz';
import { quizHistory } from '@/lib/__fixtures__/timedSportQuizFixtures';
import { roundSnapshot, roundStart } from '@/lib/__fixtures__/triviaRoundFixtures';
import type { UserRole } from '@/types/database';

jest.mock('@/lib/quizSound', () => ({ playQuizCue: jest.fn(), armQuizSound: jest.fn(() => () => {}) }));
jest.mock('react-native-confetti-cannon', () => { const { View } = require('react-native'); return () => <View testID="confetti-cannon"/>; });
const mockAuth = { user: { id: 'auth-a' }, profile: { id: 'profile-a', user_id: 'auth-a', age_blocked_at: null as string | null }, role: 'fan' as UserRole, isGuest: false, loading: false };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { theme: { background: '#F3FAF6' } } }) }));
jest.mock('@/services/SupportSignalManager', () => ({ supportSignals: { capture: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true }), usePathname: () => '/sport-quiz',
    useIsFocused: () => true, useLocalSearchParams: () => mockParams }));
let mockNonce = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-0000-0000-${String(++mockNonce).padStart(12, '0')}`, getRandomValues: (bytes: Uint8Array) => { bytes.fill(42); return bytes; } }));
type Handler = (fn: string, args: Record<string, unknown>) => unknown;
const mockClient = { calls: [] as { fn: string; args: Record<string, unknown> }[], handler: (() => null) as Handler,
    async rpc(fn: string, args: Record<string, unknown>) {
        this.calls.push({ fn, args });
        const data = await this.handler(fn, args) as { __error?: unknown } | null;
        return data && typeof data === 'object' && '__error' in data ? { data: null, error: data.__error } : { data, error: null };
    } };
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
const ATHLETE = '11111111-2222-3333-4444-555555555555';
const missing = { __error: { code: 'PGRST202', message: 'Could not find the function in the schema cache' } };
const calls = (fn: string) => mockClient.calls.filter(c => c.fn === fn);
let learnMissing = false;

beforeEach(() => {
    jest.clearAllMocks(); mockNonce = 0; mockClient.calls = []; learnMissing = false; mockParams = {};
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
    mockClient.handler = (fn, args) => {
        const request = String(args.p_request_id ?? '');
        switch (fn) {
            case 'quiz_snapshot': return roundSnapshot;
            case 'quiz_history': return quizHistory();
            case 'quiz_learn_start': return learnMissing ? missing : roundStart(request);
            case 'quiz_start': return roundStart(request);
            default: return missing;
        }
    };
});
afterEach(() => jest.restoreAllMocks());

async function startRound(sport = 'Basketball') {
    await fireEvent.press(await screen.findByRole('button', { name: `Choose ${sport}` }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I understand the trivia notice' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start trivia' }));
    await screen.findByRole('button', { name: 'Answer 1: One' });
}

it('the Learn entry starts with quiz_learn_start and the athlete id, and shows nothing about the athlete without a fun fact', async () => {
    await render(<SportQuizScreen initialSport="Basketball" learnAthlete={ATHLETE}/>);
    await startRound();
    expect(calls('quiz_learn_start')[0].args).toMatchObject({ p_athlete_player_id: ATHLETE, p_sport: 'Basketball' });
    expect(calls('quiz_start')).toHaveLength(0);
    expect(screen.queryByText(/Fun fact/)).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toContain(ATHLETE);
});

it('an older server falls back silently to the ordinary Start', async () => {
    learnMissing = true;
    await render(<SportQuizScreen initialSport="Basketball" learnAthlete={ATHLETE}/>);
    await startRound();
    expect(calls('quiz_start')).toHaveLength(1);
    expect(calls('quiz_start')[0].args.p_request_id).toBe(calls('quiz_learn_start')[0].args.p_request_id);
    expect(screen.queryByRole('alert')).toBeNull();
});

it('a normal entry, or a different sport than the Learn card’s, uses the ordinary Start', async () => {
    const view = await render(<SportQuizScreen initialSport="Basketball"/>);
    await startRound();
    expect(calls('quiz_learn_start')).toHaveLength(0);
    await view.unmount();
    mockClient.calls = [];
    await render(<SportQuizScreen initialSport="Basketball" learnAthlete={ATHLETE}/>);
    await startRound('American football');
    expect(calls('quiz_learn_start')).toHaveLength(0);
    expect(calls('quiz_start')[0].args).toMatchObject({ p_sport: 'American football' });
});

it('the route passes a UUID-shaped athlete id only together with a sport', async () => {
    mockParams = { sport: 'Basketball', athlete: 'not-a-uuid' };
    const view = await render(<SportQuizRoute/>);
    await startRound();
    expect(calls('quiz_learn_start')).toHaveLength(0);
    await view.unmount();
    mockClient.calls = []; mockParams = { sport: 'Basketball', athlete: ATHLETE };
    await render(<SportQuizRoute/>);
    await startRound();
    await waitFor(() => expect(calls('quiz_learn_start')).toHaveLength(1));
});
