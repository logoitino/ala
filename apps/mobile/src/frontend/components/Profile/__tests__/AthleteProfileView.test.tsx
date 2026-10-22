/**
 * Profile hero integration keeps the viewer's sport, position and class on their linked roster identity.
 * Matching display names are not enough to lend another public athlete the viewer's credentials.
 * Story presentation uses only supplied subject text/links and remains inside the selected Highlights pane.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { AthleteProfileView } from '@/components/Profile/AthleteProfileView';
import type { AthleteStatsBundle } from '@/data/athleteStats';
import { TAGLINE_HEADLINE } from '@/data/malo';
import type { HighlightClip } from '@/data/highlights';
import type { Player, Profile } from '@/types/database';

let mockProfile: Profile;
let mockActionsOnTop = false;
let mockStatsFirst = false;

jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ profile: mockProfile }) }));
jest.mock('@/context/AppRuntimeContext', () => ({
  useAppRuntime: () => {
    const { DEFAULT_APP_RUNTIME } = jest.requireActual('@/lib/runtime');
    return { live: {
      ...DEFAULT_APP_RUNTIME,
      profile: { ...DEFAULT_APP_RUNTIME.profile, showCard: false, showCrew: false, statsFirst: mockStatsFirst, actionsOnTop: mockActionsOnTop },
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
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

// These independent surfaces load media, storage or account data; credential selection stays real.
jest.mock('@/components/Profile/ExclusivePaywall', () => ({ VaultLockedCard: () => null }));
jest.mock('@/components/Profile/AthleteReelManager', () => ({ AthleteReelManager: ({ clips }: { clips: HighlightClip[] }) => {
  const { Text } = jest.requireActual('react-native');
  return <Text>{`Managed clips: ${clips.map(clip => clip.id).join(', ')}`}</Text>;
} }));
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
jest.mock('@/components/Profile/TaggedReelGrid', () => ({ TaggedReelGrid: ({ clips }: { clips: HighlightClip[] }) => {
  const { Text } = jest.requireActual('react-native');
  return <Text>{`Visible clips: ${clips.map(clip => clip.id).join(', ')}`}</Text>;
} }));
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

/** A temporary sport chip selects recorded media and independent credentials without changing the primary hero. */
describe('multi-sport profile display', () => {
  const sports = [
    { sport: 'Football', schoolId: null, teamName: 'North High', position: 'QB', jersey: '8' },
    { sport: 'Volleyball', schoolId: null, teamName: 'South High', position: 'Setter', jersey: '12' },
  ];
  const clips = [
    { id: 'old', athleteName: 'Ana', school: '', tag: 'Legacy', videoUrl: 'old.mp4' },
    { id: 'football', athleteName: 'Ana', school: '', tag: 'Game', videoUrl: 'football.mp4', sport: 'Football' },
    { id: 'volley', athleteName: 'Ana', school: '', tag: 'Serve', videoUrl: 'volley.mp4', sport: 'Volleyball' },
  ];
  beforeEach(() => { mockProfile = { id: 'owner', user_id: 'owner-user', full_name: 'Ana', role: 'athlete', is_verified: false,
    player_id: player.id, athlete_sport: 'Football', athlete_position: 'QB' }; });
  it('renders All including untagged history and filters only recorded sport tags', async () => {
    const onDisplaySportChange = jest.fn();
    const view = await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={clips} stats={stats}
      auraPoints={9} primarySport="Football" displaySport={null} sportEntries={sports} onDisplaySportChange={onDisplaySportChange} />);
    expect(screen.getByText('Visible clips: old, football, volley')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Volleyball sport' }));
    expect(onDisplaySportChange).toHaveBeenCalledWith('Volleyball');
    await view.rerender(<AthleteProfileView player={player} name={player.name} role="athlete" clips={clips} stats={stats}
      auraPoints={9} primarySport="Football" displaySport="Volleyball" sportEntries={sports} onDisplaySportChange={onDisplaySportChange} />);
    expect(screen.getByText('Visible clips: volley')).toBeTruthy();
    expect(screen.getByLabelText('Sport: Football')).toBeTruthy();
    expect(screen.getByText(/Viewing Volleyball/)).toBeTruthy();
    expect(screen.getByText(/South High/)).toBeTruthy();
    expect(screen.getByText(/Setter/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: /Stats/ }));
    expect(screen.getByText(/^Stats: Volleyball/)).toBeTruthy();
    expect(screen.getByText(/Kills: —/)).toBeTruthy();
  });
});

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

describe('Look desk "Actions on top" (profile.actionsOnTop, DATA-01 F7)', () => {
  const order = () => {
    const tree = JSON.stringify(screen.toJSON());
    return { share: tree.indexOf('"Share"'), tabs: tree.indexOf('Athlete profile sections') };
  };
  beforeEach(() => {
    mockProfile = { id: 'viewer-profile', user_id: 'viewer-user', full_name: 'Viewer', role: 'fan', is_verified: false, player_id: null };
  });
  afterEach(() => { mockActionsOnTop = false; });

  it('keeps Donate / Share under the athlete card when off (shipping)', async () => {
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]} stats={stats} auraPoints={0} />);
    const { share, tabs } = order();
    expect(share).toBeGreaterThan(-1);
    expect(share).toBeLessThan(tabs);
  });

  it('parks Donate / Share under the section tabs when on', async () => {
    mockActionsOnTop = true;
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]} stats={stats} auraPoints={0} />);
    const { share, tabs } = order();
    expect(share).toBeGreaterThan(tabs);
  });
});

/** QUIZ-03: the "Learn {sport} with {name}" card sits on someone else's athlete profile only; never on your own. */
jest.mock('@/components/SportQuiz/LearnSportCard', () => ({
  LearnSportCard: ({ sport, athleteName }: { sport: string; athleteName: string }) => {
    const { Text } = require('react-native');
    return <Text>{`Learn card: ${sport} / ${athleteName}`}</Text>;
  },
}));
describe('AthleteProfileView Learn your athlete’s sport card', () => {
  it('passes the athlete’s sport and name to the viewer’s card on another athlete’s profile', async () => {
    mockProfile = { id: 'fan', user_id: 'fan-user', full_name: 'Fan', role: 'fan', is_verified: false };
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]} stats={stats} auraPoints={0} />);
    expect(screen.getByText('Learn card: Football / Alex Lee')).toBeTruthy();
  });
  it('never shows the card to the athlete on their own profile', async () => {
    mockProfile = { id: 'owner', user_id: 'owner-user', full_name: player.name, role: 'athlete', is_verified: false, player_id: player.id };
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]} stats={stats} auraPoints={0} />);
    expect(screen.queryByText(/^Learn card:/)).toBeNull();
  });
  it('is not shown on a non-athlete profile', async () => {
    mockProfile = { id: 'fan', user_id: 'fan-user', full_name: 'Fan', role: 'fan', is_verified: false };
    await render(<AthleteProfileView player={player} name={player.name} role="fan" clips={[]} stats={stats} auraPoints={0} />);
    expect(screen.queryByText(/^Learn card:/)).toBeNull();
  });
});

/** A section label never grants access to the viewer's biography, hidden school or Vault-only clips. */
describe('AthleteProfileView Story in Highlights', () => {
  const publicClip: HighlightClip = {
    id: 'public-play', athleteName: player.name, school: player.school_name,
    tag: 'Game Day', videoUrl: 'https://example.test/public.mp4', playerId: player.id,
  };
  const vaultClip: HighlightClip = { ...publicClip, id: 'vault-play', isVaultOnly: true };
  beforeEach(() => {
    mockProfile = { id: 'viewer', user_id: 'viewer-user', full_name: 'Viewer', role: 'fan', is_verified: false,
      bio: 'Viewer biography must stay private to this fixture' };
  });
  afterEach(() => { mockStatsFirst = false; jest.clearAllMocks(); });

  it('names the subject Story before Highlights without restoring hidden school or viewer data', async () => {
    await render(<AthleteProfileView player={player} name={player.name} role="athlete"
      clips={[publicClip, vaultClip]} stats={stats} auraPoints={0} schoolVisible={false}
      bio="Generated school and position summary" aboutBio="  Practice, family, and the game.  "
      socialLinks={{ instagram: '@alexlee' }} />);
    expect(screen.getByRole('header', { name: 'Story' })).toBeTruthy();
    expect(screen.getByText('Practice, family, and the game.')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Highlights' })).toBeTruthy();
    expect(screen.getByText('Visible clips: public-play')).toBeTruthy();
    expect(screen.queryByText(player.school_name)).toBeNull();
    expect(screen.queryByText(mockProfile.bio!)).toBeNull();
    expect(screen.queryByText('Generated school and position summary')).toBeNull();
    expect(screen.queryByText('No public Highlights to show here yet.')).toBeNull();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Practice, family, and the game.')).toBeLessThan(tree.indexOf('Visible clips: public-play'));
  });

  it('omits Story when caller-visible text and links are empty, without inventing a biography', async () => {
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]}
      stats={stats} auraPoints={0} aboutBio={' \n '} socialLinks={{ instagram: '', twitter: '  ' }}
      bio="Generated roster summary" />);
    expect(screen.queryByRole('header', { name: 'Story' })).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(mockProfile.bio!)).toBeNull();
    expect(screen.queryByText('Generated roster summary')).toBeNull();
    expect(screen.getByRole('header', { name: 'Highlights' })).toBeTruthy();
    expect(screen.getByText('No public Highlights to show here yet.')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Highlights ⚡', selected: true })).toBeTruthy();
  });

  it('renders links-only Story and keeps the existing resolved browser action', async () => {
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]}
      stats={stats} auraPoints={0} aboutBio={null} socialLinks={{ instagram: '@alexlee', twitter: ' ' }} />);
    expect(screen.getByRole('header', { name: 'Story' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Open X' })).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'Open Instagram' }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://instagram.com/alexlee');
  });

  it('uses the same supplied Story for an exact owner and hides it in other panes', async () => {
    mockProfile = { ...mockProfile, role: 'athlete', player_id: player.id };
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[publicClip]}
      stats={stats} auraPoints={0} aboutBio="My own authored story." manageVault />);
    expect(screen.getByRole('header', { name: 'Story' })).toBeTruthy();
    expect(screen.getByText('Managed clips: public-play')).toBeTruthy();
    for (const pane of ['Stats 📊', 'Goals', 'Vault 🔒', 'Manage']) {
      await fireEvent.press(screen.getByRole('tab', { name: pane }));
      expect(screen.queryByRole('header', { name: 'Story' })).toBeNull();
      expect(screen.queryByText('My own authored story.')).toBeNull();
      expect(screen.queryByRole('header', { name: 'Highlights' })).toBeNull();
    }
    await fireEvent.press(screen.getByRole('tab', { name: 'Highlights ⚡' }));
    expect(screen.getByText('My own authored story.')).toBeTruthy();
    expect(screen.queryByText(mockProfile.bio!)).toBeNull();
  });

  it('keeps Stats first when configured and only reveals supplied Story after selecting Highlights', async () => {
    mockStatsFirst = true;
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[]}
      stats={stats} auraPoints={0} aboutBio="A real subject story." />);
    expect(screen.getByRole('tab', { name: 'Stats 📊', selected: true })).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Story' })).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Highlights ⚡' }));
    expect(screen.getByText('A real subject story.')).toBeTruthy();
  });

  it('describes only public emptiness even when Vault clips exist and keeps their pane intact', async () => {
    await render(<AthleteProfileView player={player} name={player.name} role="athlete" clips={[vaultClip]}
      stats={stats} auraPoints={0} subscribed />);
    expect(screen.getByRole('header', { name: 'Highlights' })).toBeTruthy();
    expect(screen.getByText('No public Highlights to show here yet.')).toBeTruthy();
    expect(screen.queryByText(/^Visible clips:/)).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Vault 🔒' }));
    expect(screen.queryByText('No public Highlights to show here yet.')).toBeNull();
    expect(screen.getByText('Visible clips: vault-play')).toBeTruthy();
  });
});
