import { fireEvent, render, screen } from '@testing-library/react-native';

import { RallyCard } from '@/components/Rally/RallyCard';
import type { Rally } from '@/lib/rallies';
import type { Player } from '@/types/database';

let mockActive: Rally | null = null;
let mockMine: Rally[] = [];
let mockAvailable = true;
const mockRequireAuth = jest.fn((opts: { resume: () => void }) => opts.resume());
const mockApprove = jest.fn(async () => ({ ok: true, rally: mockActive }));

jest.mock('@/hooks/useRally', () => ({
  useRally: () => ({
    rally: mockActive,
    mine: mockMine,
    available: mockAvailable,
    loading: false,
    refresh: jest.fn(async () => undefined),
  }),
}));
jest.mock('@/lib/rallies', () => ({
  ...jest.requireActual('@/lib/rallies'),
  approveRally: (...args: unknown[]) => mockApprove(...(args as [])),
}));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { buttons: { malo: true } } }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));
jest.mock('@/context/CelebrationContext', () => ({ useOptionalCelebration: () => ({ showToast: jest.fn() }) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('@/components/TipSheetModal', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    MaloTipModal: ({ player, rallyId, origin }: { player: unknown; rallyId?: string; origin?: string }) =>
      player ? <Text>{`donate sheet ${origin} ${rallyId}`}</Text> : null,
  };
});
jest.mock('@/components/Profile/ShareQrModal', () => ({ ShareQrModal: () => null }));
jest.mock('@/components/Rally/CreateRallySheet', () => ({ CreateRallySheet: () => null }));
jest.mock('react-native-confetti-cannon', () => () => null);
jest.mock('@/components/UI/HapticPressable', () => {
  const { Pressable } = jest.requireActual('react-native');
  return { HapticPressable: Pressable };
});

const PLAYER = { id: 'p1', name: 'Kaleo' } as Player;
const RALLY: Rally = {
  id: 'r1',
  playerId: 'p1',
  title: 'New cleats',
  story: 'Mine are split.',
  costKind: 'gear',
  targetCents: 25000,
  raisedCents: 14000,
  donationCount: 12,
  endsOn: null,
  status: 'live',
  filledAt: null,
  thanksKey: null,
  thanksReelId: null,
  thankedAt: null,
  createdAt: '2026-09-29T00:00:00Z',
};

describe('RallyCard', () => {
  beforeEach(() => {
    mockActive = null;
    mockMine = [];
    mockAvailable = true;
    mockRequireAuth.mockClear();
    mockApprove.mockClear();
  });

  it('is invisible to fans when there is no Rally', async () => {
    await render(<RallyCard player={PLAYER} athleteName="Kaleo" />);
    expect(screen.queryByText(/Rally/)).toBeNull();
  });

  it('shows progress and opens the donate sheet tagged with the Rally', async () => {
    mockActive = RALLY;
    await render(<RallyCard player={PLAYER} athleteName="Kaleo" />);
    expect(screen.getByText('New cleats')).toBeTruthy();
    expect(screen.getByText('$140 of $250')).toBeTruthy();
    expect(screen.getByText('12 donations')).toBeTruthy();

    await fireEvent.press(screen.getByText(/Donate/));
    expect(mockRequireAuth).toHaveBeenCalledWith(expect.objectContaining({ kind: 'malo', athleteId: 'p1' }));
    expect(screen.getByText('donate sheet rally r1')).toBeTruthy();
  });

  it('hides the invite until Rallies are available (SQL not applied)', async () => {
    mockAvailable = false;
    await render(<RallyCard player={PLAYER} athleteName="Kaleo" manage />);
    expect(screen.queryByText('Start a Rally')).toBeNull();
  });

  it('invites the family to start one, and lets the guardian approve a pending Rally', async () => {
    await render(<RallyCard player={PLAYER} athleteName="Kaleo" manage />);
    expect(screen.getByText('Start a Rally')).toBeTruthy();

    mockMine = [{ ...RALLY, status: 'pending_guardian' }];
    await render(<RallyCard player={PLAYER} athleteName="Kaleo" manage guardian />);
    await fireEvent.press(screen.getByText('Approve this Rally'));
    expect(mockApprove).toHaveBeenCalledWith('r1');
  });

  it('asks the family to thank everyone once it fills, and shows fans the thanks', async () => {
    mockMine = [{ ...RALLY, status: 'filled', raisedCents: 25000 }];
    await render(<RallyCard player={PLAYER} athleteName="Kaleo" manage />);
    expect(screen.getByText('Say thanks to everyone 🙏')).toBeTruthy();

    mockActive = { ...RALLY, status: 'filled', thanksKey: 'work', thankedAt: '2026-09-30T00:00:00Z' };
    await render(<RallyCard player={PLAYER} athleteName="Kaleo" />);
    expect(screen.getByText(/Kaleo: Thank you for believing in me/)).toBeTruthy();
  });
});
