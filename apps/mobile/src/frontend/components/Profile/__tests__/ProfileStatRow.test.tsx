/** Compact stat row: four counts on one line, Join at the end with a 44pt touch target, Join hidden on your own profile. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ProfileStatRow } from '@/components/Profile/ProfileStatRow';

const mockToggle = jest.fn();
const mockRequireAuth = jest.fn((intent: { resume: () => void }) => intent.resume());
let mockCrew = { crew_count: 3, squad_count: 1, following: false, mutual: false, busy: false, toggle: mockToggle };
let mockRealCrew = false, mockUser: string | null = null;
let mockGuard = () => true;
const mockFetch = jest.fn(), mockSet = jest.fn();
let mockProfile: { player_id: string | null } = { player_id: null };

jest.mock('@/hooks/useCrew', () => ({ useCrew: (id: string) => mockRealCrew ? jest.requireActual('@/hooks/useCrew').useCrew(id) : mockCrew }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ profile: mockProfile, user: mockUser ? { id: mockUser } : null, isSessionCurrent: mockGuard }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: jest.requireActual('@/lib/runtime').DEFAULT_APP_RUNTIME }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));

jest.mock('@/lib/crew', () => ({ fetchCrewGraph: (...args: unknown[]) => mockFetch(...args), setCrewFollow: (...args: unknown[]) => mockSet(...args) }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: () => { const owner = mockUser, guard = mockGuard; return owner ? { userId: owner, isCurrent: () => mockUser === owner && mockGuard === guard } : null; } } }));
jest.mock('@/lib/offlineActor', () => ({ createOfflineActorClient: async () => ({}) }));
const player = { id: 'p1', name: 'Mele' } as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockCrew = { crew_count: 3, squad_count: 1, following: false, mutual: false, busy: false, toggle: mockToggle };
  mockProfile = { player_id: null };
  mockRealCrew = false; mockUser = null; mockGuard = () => true;
  mockRequireAuth.mockImplementation(intent => intent.resume());
  mockFetch.mockResolvedValue({ crew_count: 3, squad_count: 1, following: false, mutual: false });
  mockSet.mockResolvedValue({ crew_count: 4, squad_count: 1, following: true, mutual: false });
});

describe('ProfileStatRow (compact)', () => {
  it('reads each count once and puts Join last with a 44pt touch target', async () => {
    await render(<ProfileStatRow player={player} sekiCount={14} flexCount={16} showCrew />);
    for (const label of ['14 Seki', '16 riding with Mele']) expect(screen.getByLabelText(label)).toBeTruthy();
    const join = screen.getByRole('button', { name: 'Join Crew ⚡' });
    const box = StyleSheet.flatten(join.props.style);
    const slop = join.props.hitSlop ?? 0;
    expect((box.width ?? 0) + 2 * (typeof slop === 'number' ? slop : 0)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(join);
    expect(mockRequireAuth).toHaveBeenCalledWith(expect.objectContaining({ kind: 'crew', athleteId: 'p1' }));
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('never offers Join on your own profile', async () => {
    mockProfile = { player_id: 'p1' };
    await render(<ProfileStatRow player={player} sekiCount={0} flexCount={0} showCrew />);
    expect(screen.queryByRole('button', { name: /Crew/ })).toBeNull();
  });
});

it('resumes a still-mounted guest Join exactly once with the newly signed-in owner', async () => {
 mockRealCrew = true;
 let resume!: () => void;
 mockRequireAuth.mockImplementation(intent => { resume = intent.resume; });
 const view = await render(<ProfileStatRow player={player} sekiCount={0} flexCount={0} showCrew />);
 await waitFor(() => expect(mockFetch).toHaveBeenCalled());
 await fireEvent.press(screen.getByRole('button', { name: 'Join Crew ⚡' }));
 mockUser = 'A'; mockGuard = () => true;
 await view.rerender(<ProfileStatRow player={player} sekiCount={0} flexCount={0} showCrew />);
 await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
 await act(async () => { resume(); });
 expect(mockSet).toHaveBeenCalledWith('p1', 'A', true, expect.objectContaining({ userId: 'A' }));
 await act(async () => { resume(); });
 expect(mockSet).toHaveBeenCalledTimes(1);
});
