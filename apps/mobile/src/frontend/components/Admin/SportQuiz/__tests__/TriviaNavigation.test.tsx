/** Trivia control tower navigation (2026-10-15): the Operations menu item is "Trivia" with its new hint, the saved
 * /admin/sport-quiz route is kept, and desk search finds it by "trivia", "quiz", "questions" and "Life Playbook". */
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { AdminReportHeader } from '@/components/Admin/AdminChrome';
import { ADMIN_NAV_GROUPS, adminTrailForPath } from '@/lib/admin';

const mockPush = jest.fn();
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: jest.requireActual('@/lib/runtime').DEFAULT_APP_RUNTIME, dirty: false, pendingCount: 0, publishedAt: null, saveError: null, publishLive: jest.fn(), discardDraft: jest.fn() }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: true, loading: false, user: null, signOut: jest.fn() }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/context/AdminLensContext', () => ({ useAdminLens: () => ({ lens: 'all', setLens: jest.fn() }) }));
jest.mock('expo-router', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => false }),
  Link: ({ href, children }: { href: string; children: React.ReactElement }) =>
    require('react').createElement(jest.requireActual('expo-router/build/ui/Slot').Slot, { href, onPress: () => mockPush(href) }, children),
}));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('@/lib/spotlight', () => ({ parseSpotlightAward: jest.fn(), utcWeekStart: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));

it('labels the quiz desk Trivia in Operations and keeps its saved route', () => {
  const item = ADMIN_NAV_GROUPS.find(g => g.id === 'operations')!.items.find(i => i.href === '/admin/sport-quiz')!;
  expect(item.label).toBe('Trivia');
  expect(item.hint).toBe('Questions, Life Playbook, groups and switches');
  expect(adminTrailForPath('/admin/sport-quiz').desk.label).toBe('Trivia');
});

it.each(['trivia', 'quiz', 'questions', 'Life Playbook', 'sport pop quiz'])('desk search finds Trivia by "%s"', async query => {
  await render(<AdminReportHeader />);
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  await fireEvent.changeText(screen.getByLabelText('Find an admin desk'), query);
  const results = within(screen.getByLabelText('Production desks'));
  await fireEvent.press(results.getByRole('link', { name: 'Trivia' }));
  expect(mockPush).toHaveBeenLastCalledWith('/admin/sport-quiz');
});
