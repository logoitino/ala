import { fireEvent, render, screen } from '@testing-library/react-native';

import { FilmerCard } from '@/components/Filmers/FilmerCard';
import { FilmerSheet } from '@/components/Filmers/FilmerSheet';

const mockGiveProps = jest.fn();
const mockRequireAuth = jest.fn();
let mockUser: { id: string } | null = { id: 'fan-1' };

jest.mock('@/lib/haptics', () => ({ impactPress: jest.fn(), selectionPress: jest.fn() }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));
jest.mock('@/hooks/useFilmerStats', () => ({
  useFilmerStats: () => ({
    stats: { clips: 6, views: 1500, hype: 40, props: 3, auraEarned: 83 },
    loading: false,
    refresh: jest.fn(),
  }),
}));
jest.mock('@/lib/filmers', () => ({
  ...jest.requireActual('@/lib/filmers'),
  giveFilmerProps: (...args: unknown[]) => mockGiveProps(...args),
}));

const sheet = () => (
  <FilmerSheet visible filmerName="hawksmom" filmerProfileId="p-9" reelId="r-1" onClose={jest.fn()} />
);

describe('FilmerSheet', () => {
  beforeEach(() => {
    mockGiveProps.mockReset();
    mockRequireAuth.mockReset();
    mockUser = { id: 'fan-1' };
  });

  it('shows the filmer tier and sends Props once', async () => {
    mockGiveProps.mockResolvedValue({ ok: true, total: 4 });
    await render(sheet());
    expect(screen.getByText('Sideline Filmer')).toBeTruthy();
    expect(screen.getByText('+83 Aura earned from filming')).toBeTruthy();

    await fireEvent.press(screen.getByText('Give Props 🎥'));
    expect(mockGiveProps).toHaveBeenCalledWith('r-1');
    expect(await screen.findByText('Props sent 🎥')).toBeTruthy();

    await fireEvent.press(screen.getByText('Props sent 🎥'));
    expect(mockGiveProps).toHaveBeenCalledTimes(1);
  });

  it('shows the server reason when Props are refused', async () => {
    mockGiveProps.mockResolvedValue({ ok: false, message: 'You filmed this one' });
    await render(sheet());
    await fireEvent.press(screen.getByText('Give Props 🎥'));
    expect(await screen.findByText('You filmed this one')).toBeTruthy();
  });

  it('asks a guest to sign in instead of sending', async () => {
    mockUser = null;
    await render(sheet());
    await fireEvent.press(screen.getByText('Give Props 🎥'));
    expect(mockRequireAuth).toHaveBeenCalledWith(expect.objectContaining({ kind: 'signin' }));
    expect(mockGiveProps).not.toHaveBeenCalled();
  });
});

describe('FilmerCard', () => {
  it('invites your own profile to film before the first clip, and hides for others', async () => {
    const empty = { clips: 0, views: 0, hype: 0, props: 0, auraEarned: 0 };
    const own = await render(<FilmerCard stats={empty} own onFilm={jest.fn()} />);
    expect(screen.getByText('Film a teammate’s play')).toBeTruthy();
    await own.unmount();
    await render(<FilmerCard stats={empty} />);
    expect(screen.queryByText('Film a teammate’s play')).toBeNull();
  });
});
