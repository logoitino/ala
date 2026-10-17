/** Dev-only trivia preview: the production gate (redirect to Home, nothing rendered) and a smoke run of the demo
 * round (one question answered, the reveal, Next). Local scripted state only; nothing touches the network. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import TriviaPreviewRoute from '../../../../../app/dev/trivia-preview';

const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock('expo-router', () => ({ Redirect: (props: { href: string }) => mockRedirect(props), useIsFocused: () => true, usePathname: () => '/dev/trivia-preview', useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }) }));
jest.mock('@/context/UploadSheetContext', () => ({ useUploadSheet: () => ({ openUpload: jest.fn() }) }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@/lib/quizSound', () => ({ playQuizCue: jest.fn(), armQuizSound: jest.fn(() => () => {}) }));
jest.mock('react-native-confetti-cannon', () => () => null);
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { theme: { background: '#F3FAF6', surface: '#FFFFFF' }, tabs: { home: true, activity: true, spotlight: true, profile: true, upload: true } } }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockSupabase = jest.fn();
jest.mock('@/lib/supabase', () => ({ get supabase() { mockSupabase(); return {}; }, isSupabaseConfigured: true }));

const original = process.env.EXPO_PUBLIC_APP_ENV;
afterEach(() => { if (original === undefined) delete process.env.EXPO_PUBLIC_APP_ENV; else process.env.EXPO_PUBLIC_APP_ENV = original; jest.clearAllMocks(); });

it('production builds redirect to Home and render nothing of the demo', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    await render(<TriviaPreviewRoute/>);
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/' });
    expect(screen.queryByText('Demo only: nothing is saved.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Play a demo round' })).toBeNull();
});

it('the demo renders with its banner and plays one question: answer, reveal, Next', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'development';
    await render(<TriviaPreviewRoute/>);
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Demo only: nothing is saved.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Play a demo round' }));
    expect(screen.getByText('Question 1 of 5')).toBeTruthy();
    expect(screen.getByText(/How high above the floor is the rim/)).toBeTruthy();
    expect(screen.getByText(/seconds left/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Answer 3: 10 feet' }));
    expect(await screen.findByText('That’s right!')).toBeTruthy();
    expect(screen.getByText(/The rim is 10 feet above the floor/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Question 2 of 5')).toBeTruthy();
    for (const label of ['Show time up', 'Show round end', 'Show level up', 'Life Playbook cards']) await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(screen.getByText('Money Huddle')).toBeTruthy();
    expect(mockSupabase).not.toHaveBeenCalled();
});
