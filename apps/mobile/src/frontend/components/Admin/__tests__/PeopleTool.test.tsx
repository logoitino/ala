/**
 * DATA-01 QA: on the People desk, Unverify only removes the badge; unlinking an athlete is a separate,
 * clearly warned "Revoke and unlink" that goes through the verification ladder RPC. Synthetic data.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { PeopleTool } from '../PeopleTool';
import { fetchAdminPeople, fetchVerificationQueue, patchAdminPerson } from '@/lib/adminCatalog';
import { revokeVerification } from '@/lib/adminControls';

jest.mock('expo-router', () => ({
  usePathname: () => '/admin/people',
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), canGoBack: () => false }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: require('@/lib/runtime').DEFAULT_APP_RUNTIME, draft: require('@/lib/runtime').DEFAULT_APP_RUNTIME, published: require('@/lib/runtime').DEFAULT_APP_RUNTIME, pendingCount: 0, saveDraft: jest.fn(), dirty: false }) }));
jest.mock('@/context/AdminLensContext', () => ({ useAdminLens: () => ({ lens: 'all', setLens: jest.fn() }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'fixture-admin' } }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('@/lib/adminCatalog', () => ({
  fetchAdminPeople: jest.fn(), fetchVerificationQueue: jest.fn(), patchAdminPerson: jest.fn(),
  setMaloFreeze: jest.fn(), setVerificationStatus: jest.fn(),
}));
jest.mock('@/lib/adminControls', () => ({ revokeVerification: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchAdminPeople).mockResolvedValue([{ id: 'u1', full_name: 'Kaleo Fua', is_verified: true, is_admin: false, role: 'athlete', malo_frozen: false } as never]);
  jest.mocked(fetchVerificationQueue).mockResolvedValue([]);
  jest.mocked(patchAdminPerson).mockResolvedValue(undefined as never);
  jest.mocked(revokeVerification).mockResolvedValue(undefined);
});

it('Unverify only removes the badge; Revoke and unlink uses the verification ladder after a clear warning', async () => {
  // Press the destructive choice in whichever confirmation opens.
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => { buttons?.find((b) => b.style === 'destructive')?.onPress?.(); });
  await render(<PeopleTool />);
  await fireEvent.press(await screen.findByLabelText('Unverify'));
  await waitFor(() => expect(patchAdminPerson).toHaveBeenCalledWith('u1', { is_verified: false }));
  expect(revokeVerification).not.toHaveBeenCalled();
  await fireEvent.press(await screen.findByLabelText('Revoke and unlink'));
  expect(alert).toHaveBeenLastCalledWith('Revoke verification and unlink?', expect.stringContaining('athlete roster row'), expect.any(Array));
  await waitFor(() => expect(revokeVerification).toHaveBeenCalledWith('u1', 'Revoked from the People desk'));
  alert.mockRestore();
});

it('offers Revoke and unlink only to verified people', async () => {
  jest.mocked(fetchAdminPeople).mockResolvedValue([{ id: 'u2', full_name: 'Sina Tui', is_verified: false, is_admin: false, role: 'fan', malo_frozen: false } as never]);
  await render(<PeopleTool />);
  expect(await screen.findByLabelText('Verify')).toBeTruthy();
  expect(screen.queryByLabelText('Revoke and unlink')).toBeNull();
});
