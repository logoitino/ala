/** Restricted admin entry may open existing guest sign-in, but the same admin gate must still reject fan accounts. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AdminShell } from '@/components/Admin/AdminShell';

const mockRequireAuth = jest.fn();
const mockReplace = jest.fn();
const mockUnlockStudio = jest.fn();
let mockDevMode = false;
let mockAuth = { isAdmin: false, loading: false, user: null as { id: string } | null, unlockStudio: mockUnlockStudio };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));
jest.mock('@/context/AdminLensContext', () => ({ AdminLensProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@/data/devPersonas', () => ({ isDevMode: () => mockDevMode }));

beforeEach(() => {
  jest.clearAllMocks();
  mockDevMode = false;
  mockAuth = { isAdmin: false, loading: false, user: null, unlockStudio: mockUnlockStudio };
});

it('opens the existing guest sign-in intent and keeps desk access restricted after resume', async () => {
  await render(<AdminShell><Text>Private desk controls</Text></AdminShell>);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(mockRequireAuth).toHaveBeenCalledTimes(1);
  const intent = mockRequireAuth.mock.calls[0][0];
  expect(intent.kind).toBe('signin');
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockUnlockStudio).not.toHaveBeenCalled();
  await act(async () => intent.resume());
  expect(mockReplace).toHaveBeenLastCalledWith('/admin');
  expect(screen.queryByText('Private desk controls')).toBeNull();
});

it('does not offer a no-op Sign in to a signed-in fan or mount private controls', async () => {
  mockAuth.user = { id: 'synthetic-fan' };
  await render(<AdminShell><Text>Private desk controls</Text></AdminShell>);
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  expect(screen.queryByText('Private desk controls')).toBeNull();
  expect(mockRequireAuth).not.toHaveBeenCalled();
});

it('retains the existing explicit Studio unlock and Back to Home controls', async () => {
  mockDevMode = true;
  await render(<AdminShell><Text>Private desk controls</Text></AdminShell>);
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock Studio' }));
  expect(mockUnlockStudio).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Back to Home' }));
  expect(mockReplace).toHaveBeenLastCalledWith('/');
  expect(mockRequireAuth).not.toHaveBeenCalled();
});
