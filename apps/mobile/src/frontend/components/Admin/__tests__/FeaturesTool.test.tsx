/** MONEY-TIPS-01: Features edits optional extras only as a draft and states migration/fee gaps.
 * Real row/button rendering with synthetic runtime state; no publication or hosted money runs. */
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { FeaturesTool } from '../FeaturesTool';
import { cloneAppRuntime, DEFAULT_APP_RUNTIME } from '@/lib/runtime';

const mockPush = jest.fn();
const mockSaveDraft = jest.fn(async () => undefined);
let mockDraft = cloneAppRuntime(DEFAULT_APP_RUNTIME);
let mockPublished = cloneAppRuntime(DEFAULT_APP_RUNTIME);
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ draft: mockDraft, published: mockPublished, live: mockPublished, saveDraft: mockSaveDraft, dirty: false, pendingCount: 0 }) }));
jest.mock('../Notifications/NotificationAdminPanel', () => ({ NotificationAdminPanel: () => null }));
jest.mock('expo-router', () => ({ usePathname: () => '/admin/features', useRouter: () => ({ push: mockPush, canGoBack: () => false }), Link: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/context/AdminLensContext', () => ({ useAdminLens: () => ({ lens: 'all', setLens: jest.fn() }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'fixture-admin' } }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

beforeEach(() => {
  jest.clearAllMocks();
  mockDraft = cloneAppRuntime(DEFAULT_APP_RUNTIME);
  mockPublished = cloneAppRuntime(DEFAULT_APP_RUNTIME);
});

it('states OFF default, zero-cut independence and missing actual processor cost', async () => {
  await render(<FeaturesTool />);
  expect(screen.getByText("Tip Tapua'i (optional) and processing-fee coverage are OFF (default).")).toBeTruthy();
  expect(screen.getByText(/turning this flag OFF does not restore the old 90 \/ 10 model/)).toBeTruthy();
  expect(screen.getByText(/Actual Stripe processing costs are not measured here/)).toBeTruthy();
});

it('saves an ON draft while published authority stays OFF', async () => {
  await render(<FeaturesTool />);
  const label = screen.getByText("Tip Tapua'i (optional) and fee coverage");
  const row = label.parent?.parent;
  if (!row) throw new Error('Flag row missing');
  await fireEvent.press(within(row).getByRole('button', { name: 'Off' }));
  expect(mockSaveDraft).toHaveBeenCalledWith(expect.objectContaining({ buttons: expect.objectContaining({ MONETIZATION_TIPS_ENABLED: true }) }));
  expect(mockPublished.buttons.MONETIZATION_TIPS_ENABLED).toBe(false);
});

it('distinguishes an ON draft from live OFF before Publish', async () => {
  mockDraft.buttons.MONETIZATION_TIPS_ENABLED = true;
  await render(<FeaturesTool />);
  expect(screen.getByText("Tip Tapua'i (optional) and processing-fee coverage are draft ON, live OFF. Publish is required.")).toBeTruthy();
});
