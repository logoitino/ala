/**
 * Profile hero integration keeps the viewer's sport, position and class on their linked roster identity.
 * Matching display names are not enough to lend another public athlete the viewer's credentials.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AthleteProfileView } from '@/components/Profile/AthleteProfileView';
import type { AthleteStatsBundle } from '@/data/athleteStats';
import { TAGLINE_HEADLINE } from '@/data/malo';
import type { Player, Profile } from '@/types/database';

let mockProfile: Profile;

jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ profile: mockProfile }) }));
jest.mock('@/context/AppRuntimeContext', () => ({
  useAppRuntime: () => {
    const { DEFAULT_APP_RUNTIME } = jest.requireActual('@/lib/runtime');
    return { live: {
      ...DEFAULT_APP_RUNTIME,
      profile: { ...DEFAULT_APP_RUNTIME.profile, showCard: false, showCrew: false, statsFirst: false },
    } };
  },
}));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/hooks/useSchoolBadge', () => ({ useSchoolBadge: () => null }));
jest.mock('@/hooks/useSportConfigs', () => ({ useSportConfigs: () => ({ configFor: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/leaderboards', () => ({ fetchAthleteHighlightViews: async () => 0 }));
jest.mock('@/lib/wishlist', () => ({ fetchWishlistItems: async () => [] }));
jest.mock('@/lib/haptics', () => ({ impactPress: jest.fn() }));

// These independent surfaces load media, storage or account data; credential selection stays real.
jest.mock('@/components/Profile/ExclusivePaywall', () => ({ VaultLockedCard: () => null }));
jest.mock('@/components/Profile/AthleteReelManager', () => ({ AthleteReelManager: () => null }));
jest.mock('@/components/Profile/AthleteStatsTab', () => ({ AthleteStatsTab: ({ stats }: { stats: AthleteStatsBundle }) => {
  const { Text } = jest.requireActual('react-native');
  return <Text>Stats: {stats.career.sport}; {stats.topThree.map(row => `${row.label}: ${row.value}`).join(', ')}</Text>;
} }));
jest.mock('@/components/Profile/AuraTradingCard', () => ({ AuraTradingCard: () => null }));
jest.mock('@/components/Profile/LockerRoomWishlist', () => ({ LockerRoomWishlist: () => {
  const { Text } = jest.requireActual('react-native'); return <Text>Wishlist content</Text>;
} }));
jest.mock('@/components/Profile/AccountTagInbox', () => ({ AccountTagInbox: () => null }));
jest.mock('@/components/Profile/ReceivedMaloPanel', () => ({ ReceivedMaloPanel: () => {
  const { Text } = jest.requireActual('react-native'); return <Text>Donation thank-yous</Text>;
} }));
jest.mock('@/components/Rally/RallyCard', () => ({ RallyCard: () => null }));
jest.mock('@/components/Profile/ShareQrModal', () => ({ ShareQrModal: () => null }));
jest.mock('@/components/Profile/SubscriberQnA', () => ({ SubscriberQnA: () => null }));
jest.mock('@/components/Profile/TeamRosterStrip', () => ({ TeamRosterStrip: () => null }));
jest.mock('@/components/Profile/VaultLockCard', () => ({ VaultLockCard: () => null }));
jest.mock('@/components/Profile/TaggedReelGrid', () => ({ TaggedReelGrid: () => null }));
jest.mock('@/components/Profile/ProfileAvatarPicker', () => ({
  ProfileAvatarPicker: ({ children }: { children: React.ReactNode }) => children,
}));

const player: Player = {
  id: 'public-athlete', name: 'Alex Lee', jersey_number: 12, position: 'Quarterback',
  height: '', school_name: 'North Valley High School', backer_count: 0,
};
const stats: AthleteStatsBundle = {
  physicals: { height: '', weight: '', fortyYard: '', verticalJump: '' },
  career: { sport: 'Football', gamesPlayed: 0, scoringValue: 0, volumeValue: 0,
    mvpBadges: 0, columns: { scoring: 'Points', volume: 'Yards' } },
  logs: [], topThree: [],
};

describe('AthleteProfileView hero credential ownership', () => {
  beforeEach(() => {
    mockProfile = {
      id: 'viewer-profile', user_id: 'viewer-user', full_name: 'Alex Lee',
      role: 'athlete', is_verified: false, player_id: 'viewer-athlete',
      athlete_sport: 'Volleyball', athlete_position: 'Setter', athlete_class_year: '27',
    };
  });

  it('keeps a same-name public athlete on their own roster credentials', async () => {
    await render(<AthleteProfileView player={player} name={player.name} role="athlete"
      clips={[]} stats={stats} auraPoints={0} />);

    expect(screen.getByRole('header', { name: 'Alex Lee' })).toBeTruthy();
    expect(screen.queryByLabelText('Sport: Volleyball')).toBeNull();
    expect(screen.queryByLabelText("Class: '27")).toBeNull();
    expect(screen.queryByLabelText('Position: Setter')).toBeNull();
    expect(screen.getByLabelText('Position: Quarterback')).toBeTruthy();
  });

  it('shows viewer credentials on the matching linked player identity', async () => {
    mockProfile.player_id = player.id;
    await render(<AthleteProfileView player={player} name={player.name} role="athlete"
      clips={[]} stats={stats} auraPoints={0} />);

    expect(screen.getByLabelText('Sport: Volleyball')).toBeTruthy();
    expect(screen.getByLabelText("Class: '27")).toBeTruthy();
    expect(screen.getByLabelText('Position: Setter')).toBeTruthy();
    expect(screen.queryByLabelText('Position: Quarterback')).toBeNull();
  });
});

/** Section selection changes the content directly instead of placing goals after a long stats table. */
describe('AthleteProfileView direct navigation', () => {
  beforeEach(() => { mockProfile = { id: 'fan', user_id: 'fan-user', full_name: 'Fan', role: 'fan', is_verified: false }; });
  it('opens wishlist directly from Goals and keeps it out of Stats', async () => {
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]} stats={stats} auraPoints={0} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Goals' }));
    expect(screen.getByText('Wishlist content')).toBeTruthy();
    expect(screen.queryByText(/^Stats:/)).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: /Stats/ }));
    expect(screen.queryByText('Wishlist content')).toBeNull();
    expect(screen.getByText(/^Stats: Football/)).toBeTruthy();
  });
  it('keeps owner thank-yous under Manage', async () => {
    mockProfile = { id: 'owner', user_id: 'owner-user', full_name: player.name, role: 'athlete', is_verified: false, player_id: player.id };
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]} stats={stats} auraPoints={0} />);
    expect(screen.queryByText('Donation thank-yous')).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Manage' }));
    expect(screen.getByText('Donation thank-yous')).toBeTruthy();
  });
  it('shows missing volleyball stats rather than relabeling an old football total', async () => {
    mockProfile = { id: 'owner', user_id: 'owner-user', full_name: player.name, role: 'athlete', is_verified: false, player_id: player.id, athlete_sport: 'Volleyball' };
    const football = { ...stats, career: { ...stats.career, scoringValue: 99 } };
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]} stats={football} auraPoints={0} />);
    await fireEvent.press(screen.getByRole('tab', { name: /Stats/ }));
    expect(screen.getByText(/^Stats: Volleyball/)).toBeTruthy();
    expect(screen.getByText(/Kills: —/)).toBeTruthy();
    expect(screen.queryByText(/99/)).toBeNull();
  });
});

/** Public same-name sheets keep donation available; only an exact linked owner gets management. */
it('retains public donation and supports direct teammate navigation', async () => {
  mockProfile = { id: 'viewer', user_id: 'viewer-user', full_name: player.name, role: 'athlete', is_verified: false, player_id: 'another-row' };
  const donate = jest.fn();
  await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]} stats={stats}
    auraPoints={0} onDropMalo={donate} rosterPlayers={[player]} />);
  expect(screen.getByRole('tab', { name: 'Team' })).toBeTruthy();
  expect(screen.queryByRole('tab', { name: 'Manage' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: `Donate 5 dollars to ${player.name}` }));
  expect(donate).toHaveBeenCalledTimes(1);
});

/** Explicit hidden school remains hidden even though the public roster still carries a school string. */
it('respects hidden school on public hero and teammate navigation', async () => {
  mockProfile = { id: 'viewer', user_id: 'viewer-user', full_name: 'Viewer', role: 'fan', is_verified: false };
  await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]} stats={stats}
    auraPoints={0} schoolVisible={false} rosterPlayers={[player]} />);
  expect(screen.queryByText(player.school_name)).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Team' })).toBeNull();
});

/** Brand line (BRAND-01) sits under Donate only for an athlete who can receive donations, never on owner views. */
describe('AthleteProfileView donate tagline', () => {
  it('shows the tagline under Donate for a public athlete', async () => {
    mockProfile = { id: 'fan', user_id: 'fan-user', full_name: 'Fan', role: 'fan', is_verified: false };
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]} stats={stats}
      auraPoints={0} onDropMalo={jest.fn()} />);
    expect(screen.getByRole('button', { name: `Donate 5 dollars to ${player.name}` })).toBeTruthy();
    expect(screen.queryByText(/One-time Exclusive/)).toBeNull();
    expect(screen.getByText(TAGLINE_HEADLINE)).toBeTruthy();
    expect(screen.queryByRole('header', { name: TAGLINE_HEADLINE })).toBeNull();
  });
  it('hides the tagline when there is no Donate button or the viewer owns the profile', async () => {
    mockProfile = { id: 'fan', user_id: 'fan-user', full_name: 'Fan', role: 'fan', is_verified: false };
    const view = await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]}
      stats={stats} auraPoints={0} />);
    expect(screen.queryByText(TAGLINE_HEADLINE)).toBeNull();
    await view.unmount();
    mockProfile = { id: 'owner', user_id: 'owner-user', full_name: player.name, role: 'athlete', is_verified: false, player_id: player.id };
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]} stats={stats}
      auraPoints={0} onDropMalo={jest.fn()} />);
    expect(screen.queryByText(TAGLINE_HEADLINE)).toBeNull();
  });
  it('hides the tagline on a community (non-athlete) profile', async () => {
    mockProfile = { id: 'fan', user_id: 'fan-user', full_name: 'Fan', role: 'fan', is_verified: false };
    await render(<AthleteProfileView player={player} name="Community Fan" role="fan" clips={[]} stats={stats}
      auraPoints={0} onDropMalo={jest.fn()} />);
    expect(screen.queryByText(TAGLINE_HEADLINE)).toBeNull();
  });
});
