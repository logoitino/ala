/** QUIZ-03 "Learn {sport} with {first name}": shown only when trivia is ready for this viewer and the sport has unseen
 * approved questions; opens /sport-quiz with the sport preselected and never starts or spends anything itself.
 * QUIZ-05 copy (design §6.7): the athlete may see a monthly total for their fun facts, never who played. The card
 * passes the athlete's player id as `?athlete=` (a server-validated hint for quiz_learn_start) when it has one. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LearnSportCard } from '@/components/SportQuiz/LearnSportCard';
import { roundSnapshot } from '@/lib/__fixtures__/triviaRoundFixtures';
import type { TimedQuizSnapshot } from '@shared/timedSportQuiz';
let mockAuth: Record<string, unknown> = {};
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
const mockClient = { calls: [] as string[], snapshot: roundSnapshot as TimedQuizSnapshot | Error, async rpc(fn: string) { this.calls.push(fn); return this.snapshot instanceof Error ? { data: null, error: { message: this.snapshot.message } } : { data: this.snapshot, error: null }; } };
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
const signedIn = { user: { id: 'auth-a' }, profile: { id: 'profile-a', user_id: 'auth-a', age_blocked_at: null }, isGuest: false, loading: false };
beforeEach(() => { jest.clearAllMocks(); mockAuth = signedIn; mockClient.calls = []; mockClient.snapshot = roundSnapshot; });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

it('shows the card for a ready viewer and opens the preselected personal round without any write', async () => {
    await render(<LearnSportCard sport="basketball" athleteName="Malia Tuilagi"/>);
    const button = await screen.findByRole('button', { name: 'Learn Basketball with Malia' });
    expect(screen.getByText(/Your answers are just for you\. Malia never sees who played, only a rough monthly count if one of their fun facts comes up\./)).toBeTruthy();
    expect(screen.queryByText(/doesn’t see it/)).toBeNull();
    await fireEvent.press(button);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/sport-quiz', params: { sport: 'Basketball' } });
    expect(mockClient.calls).toEqual(['quiz_snapshot']);
});

it('passes the athlete’s player id along with the sport when it has one', async () => {
    await render(<LearnSportCard sport="Basketball" athleteName="Malia" athletePlayerId="11111111-2222-3333-4444-555555555555"/>);
    await fireEvent.press(await screen.findByRole('button', { name: 'Learn Basketball with Malia' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/sport-quiz', params: { sport: 'Basketball', athlete: '11111111-2222-3333-4444-555555555555' } });
});

it.each<[string, () => void]>([
    ['a guest', () => { mockAuth = { ...signedIn, isGuest: true, user: null }; }],
    ['paused trivia', () => { mockClient.snapshot = { ...roundSnapshot, availability: 'paused' }; }],
    ['a viewer not in the testing cohort', () => { mockClient.snapshot = { ...roundSnapshot, availability: 'not_enrolled' }; }],
    ['a spent week', () => { mockClient.snapshot = { ...roundSnapshot, week_spent: true }; }],
    ['a sport with no unseen questions', () => { mockClient.snapshot = { ...roundSnapshot, pools: [{ topic_category: 'sport', sport: 'Basketball', unseen_count: 0, allowed: true }] }; }],
    ['a failed read', () => { mockClient.snapshot = Error('quiz_unavailable'); }],
])('stays hidden for %s', async (_label, arrange) => {
    arrange();
    await render(<LearnSportCard sport="Basketball" athleteName="Malia"/>);
    await flush();
    expect(screen.queryByRole('button', { name: /Learn Basketball/ })).toBeNull();
});

it('stays hidden when the athlete’s sport is unknown or has no questions', async () => {
    const view = await render(<LearnSportCard sport="" athleteName="Malia"/>);
    await flush();
    expect(screen.queryByRole('button', { name: /^Learn / })).toBeNull();
    await view.rerender(<LearnSportCard sport="Curling" athleteName="Malia"/>);
    await flush();
    expect(screen.queryByRole('button', { name: /^Learn / })).toBeNull();
});
