/** Compact stat row: four counts on one line, Join at the end with a 44pt touch target, Join hidden on your own profile. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ProfileStatRow } from '@/components/Profile/ProfileStatRow';

const mockToggle = jest.fn();
const mockRequireAuth = jest.fn((intent: { resume: () => void }) => intent.resume());
let mockCrew = { crew_count: 3, squad_count: 1, following: false, mutual: false, busy: false, toggle: mockToggle };
let mockProfile: { player_id: string | null } = { player_id: null };

jest.mock('@/hooks/useCrew', () => ({ useCrew: () => mockCrew }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ profile: mockProfile }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: jest.requireActual('@/lib/runtime').DEFAULT_APP_RUNTIME }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));

const player = { id: 'p1', name: 'Mele' } as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockCrew = { crew_count: 3, squad_count: 1, following: false, mutual: false, busy: false, toggle: mockToggle };
  mockProfile = { player_id: null };
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
