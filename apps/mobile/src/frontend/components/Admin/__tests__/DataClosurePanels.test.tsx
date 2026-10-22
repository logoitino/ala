/** DATA-01 closures on screen: Athletes desk Stats and custodial terms, Schools desk branding and
 * confirmers (link shown once), Live games check-ins with purge, Activity Crew alerts with Clear.
 * Every write goes through lib/adminControls or lib/crew; fixtures are synthetic. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AthleteRecordsPanel } from '../AthleteRecordsPanel';
import { OperatorCheckinsPanel } from '../OperatorCheckinsPanel';
import { SchoolStaffPanel } from '../SchoolStaffPanel';
import { CrewAlertsCard } from '@/components/Activity/CrewAlertsCard';
import * as controls from '@/lib/adminControls';
import * as crew from '@/lib/crew';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, []),
  usePathname: () => '/admin',
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: require('@/lib/runtime').DEFAULT_APP_RUNTIME, dirty: false }) }));
jest.mock('@/context/AdminLensContext', () => ({ useAdminLens: () => ({ lens: 'all', setLens: jest.fn() }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'fixture-admin' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('@/lib/adminControls', () => ({
  ...jest.requireActual('@/lib/adminControls'),
  fetchAthleteRecords: jest.fn(), classifyGameLogSport: jest.fn(), saveCareerStats: jest.fn(), addGameLog: jest.fn(), removeGameLog: jest.fn(), setCustodialTerms: jest.fn(),
  fetchSchoolConfirmers: jest.fn(), addSchoolConfirmer: jest.fn(), revokeSchoolConfirmer: jest.fn(), setSchoolBranding: jest.fn(), fetchSchoolBranding: jest.fn(),
  fetchOperatorCheckins: jest.fn(), purgeOperatorCheckins: jest.fn(),
}));
jest.mock('@/lib/crew', () => ({ fetchMyCrewAlerts: jest.fn(), clearMyCrewAlerts: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const m = jest.mocked(controls);
beforeEach(() => {
  jest.clearAllMocks();
  m.fetchAthleteRecords.mockResolvedValue({ career: { sport: 'Rugby', gamesPlayed: 8, scoringValue: 40, volumeValue: 120, mvpBadges: 2 }, logs: [{ id: 'log-1', playedOn: '2026-10-02', opponentSchool: 'Kahuku', statLine: '2 tries', scoringValue: 10, volumeValue: 30 }] });
  m.fetchSchoolConfirmers.mockResolvedValue([{ id: 'k1', fullName: 'Ana Tui', email: 'ana@school.org', staffRole: 'athletic_director', sport: null, active: true, expiresAt: '2027-10-01T00:00:00Z', lastUsedAt: null }]);
  m.fetchOperatorCheckins.mockResolvedValue([{ id: 'c1', gigId: null, checkedInAt: '2026-10-12T18:00:00Z', latitudeApprox: 21.31, longitudeApprox: -157.86 }]);
  m.fetchSchoolBranding.mockResolvedValue({ logoUrl: 'https://example.org/crest.png', colorPrimary: '#1D3F8F', colorSecondary: '#FFFFFF' });
});

it('writes career stats and game lines for the selected athlete', async () => {
  await render(<AthleteRecordsPanel playerId="p1" name="Kaleo" defaultSport="Rugby" />);
  expect(await screen.findByText('2026-10-02 · Kahuku')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Games played'), '9');
  await fireEvent.press(screen.getByLabelText('Save career stats'));
  await waitFor(() => expect(m.saveCareerStats).toHaveBeenCalledWith({ playerId: 'p1', sport: 'Rugby', gamesPlayed: 9, scoringValue: 40, volumeValue: 120, mvpBadges: 2 }));
  await fireEvent.press(screen.getByLabelText('Remove'));
  await waitFor(() => expect(m.removeGameLog).toHaveBeenCalledWith('log-1'));
});

it('refuses a handover age outside 18–21 before calling the database', async () => {
  await render(<AthleteRecordsPanel playerId="p1" name="Kaleo" defaultSport="Rugby" />);
  await fireEvent.changeText(screen.getByLabelText('Handover age (18–21)'), '16');
  await fireEvent.press(screen.getByLabelText('Update custodial terms'));
  expect(await screen.findByText(/18 to 21/)).toBeTruthy();
  expect(m.setCustodialTerms).not.toHaveBeenCalled();
});

it('adds a confirmer, shows the one-time link and revokes another', async () => {
  m.addSchoolConfirmer.mockResolvedValue({ id: 'k2', link: 'alasports://school-confirm?t=raw' });
  await render(<SchoolStaffPanel schoolId="s1" schoolName="Kahuku" />);
  expect(await screen.findByText(/Ana Tui · Athletic director/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Coach K');
  await fireEvent.changeText(screen.getByLabelText('School email'), 'k@school.org');
  await fireEvent.press(screen.getByLabelText('Add confirmer'));
  expect(await screen.findByText('alasports://school-confirm?t=raw')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Revoke link'));
  await waitFor(() => expect(m.revokeSchoolConfirmer).toHaveBeenCalledWith('k1'));
});

it('prefills the current branding so saving one colour keeps the others', async () => {
  await render(<SchoolStaffPanel schoolId="s1" schoolName="Kahuku" />);
  await waitFor(() => expect(screen.getByLabelText('Primary colour').props.value).toBe('#1D3F8F'));
  await fireEvent.changeText(screen.getByLabelText('Primary colour'), '#00733C');
  await fireEvent.press(screen.getByLabelText('Save branding'));
  await waitFor(() => expect(m.setSchoolBranding).toHaveBeenCalledWith({ schoolId: 's1', logoUrl: 'https://example.org/crest.png', colorPrimary: '#00733C', colorSecondary: '#FFFFFF' }));
});

it('keeps Save branding off until the current branding is read', async () => {
  m.fetchSchoolBranding.mockReturnValue(new Promise(() => {}));
  await render(<SchoolStaffPanel schoolId="s1" schoolName="Kahuku" />);
  expect(screen.getByLabelText('Save branding')).toBeDisabled();
});

it('checks colours and crest links before saving branding', async () => {
  await render(<SchoolStaffPanel schoolId="s1" schoolName="Kahuku" />);
  await waitFor(() => expect(screen.getByLabelText('Save branding')).toBeEnabled());
  await fireEvent.changeText(screen.getByLabelText('Primary colour'), 'blue');
  await fireEvent.press(screen.getByLabelText('Save branding'));
  expect(await screen.findByText(/Colours look like/)).toBeTruthy();
  expect(m.setSchoolBranding).not.toHaveBeenCalled();
});

it('lists check-ins with rounded location and purges old ones only after a second tap', async () => {
  m.purgeOperatorCheckins.mockResolvedValue(2);
  await render(<OperatorCheckinsPanel />);
  expect(await screen.findByText('Near 21.31, -157.86')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Purge check-ins older than 30 days'));
  expect(m.purgeOperatorCheckins).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Confirm: delete check-ins older than 30 days'));
  expect(await screen.findByText('Removed 2 check-ins older than 30 days.')).toBeTruthy();
  expect(m.purgeOperatorCheckins).toHaveBeenCalledTimes(1);
});

it('says a control is not switched on when its migration is missing', async () => {
  m.fetchOperatorCheckins.mockRejectedValue(new Error(controls.NOT_SWITCHED_ON));
  await render(<OperatorCheckinsPanel />);
  expect(await screen.findByText(controls.NOT_SWITCHED_ON)).toBeTruthy();
  expect(screen.getByLabelText('Purge check-ins older than 30 days')).toBeDisabled();
});

it('never shows one athlete\'s stats under another when a slow response lands last', async () => {
  let resolveSlow: (value: controls.AthleteRecords) => void = () => {};
  m.fetchAthleteRecords
    .mockImplementationOnce(() => new Promise((resolve) => { resolveSlow = resolve; }))
    .mockResolvedValueOnce({ career: { sport: 'Volleyball', gamesPlayed: 3, scoringValue: 1, volumeValue: 2, mvpBadges: 0 }, logs: [] });
  const view = await render(<AthleteRecordsPanel playerId="p1" name="Kaleo" defaultSport="Rugby" />);
  await view.rerender(<AthleteRecordsPanel playerId="p2" name="Sina" defaultSport="Volleyball" />);
  expect((await screen.findByLabelText('Games played')).props.value).toBe('3');
  resolveSlow({ career: { sport: 'Rugby', gamesPlayed: 99, scoringValue: 0, volumeValue: 0, mvpBadges: 0 }, logs: [] });
  await waitFor(() => expect(screen.getByLabelText('Games played').props.value).toBe('3'));
});

it('blocks saving stats when the read failed instead of offering zeros', async () => {
  m.fetchAthleteRecords.mockRejectedValue(new Error('permission denied'));
  await render(<AthleteRecordsPanel playerId="p1" name="Kaleo" defaultSport="Rugby" />);
  expect(await screen.findByText(/permission denied Saving is off/)).toBeTruthy();
  expect(screen.getByLabelText('Save career stats')).toBeDisabled();
});

it('shows Crew alerts, opens the athlete and clears them', async () => {
  jest.mocked(crew.fetchMyCrewAlerts).mockResolvedValue([{ id: 'a1', title: 'Flash unlock', body: 'Kaleo opened a clip', reelId: 'r1', athleteId: 'p1', createdAt: '2026-10-12T00:00:00Z' }]);
  jest.mocked(crew.clearMyCrewAlerts).mockResolvedValue(1);
  await render(<CrewAlertsCard />);
  await fireEvent.press(await screen.findByLabelText('Flash unlock'));
  expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('p1'));
  await fireEvent.press(screen.getByLabelText('Clear Crew alerts'));
  await waitFor(() => expect(screen.queryByText('Crew alerts')).toBeNull());
});

it('loads and writes the selected sport without carrying the previous sport values',async()=>{
 m.fetchAthleteRecords.mockImplementation(async(_id,sport)=>({career:{sport,gamesPlayed:sport==='Volleyball'?3:8,scoringValue:0,volumeValue:0,mvpBadges:0},logs:[]}));
 await render(<AthleteRecordsPanel playerId="p1" name="Kaleo" defaultSport="Football" />);
 await waitFor(()=>expect(screen.getByLabelText('Games played').props.value).toBe('8'));
 await fireEvent.changeText(screen.getByLabelText('Sport'), 'Volleyball');
 await fireEvent.press(screen.getByLabelText('Load selected sport'));
 await waitFor(()=>expect(screen.getByLabelText('Games played').props.value).toBe('3'));
 await fireEvent.press(screen.getByLabelText('Add game line'));
 await waitFor(()=>expect(m.addGameLog).toHaveBeenCalledWith(expect.objectContaining({sport:'Volleyball'})));
});
it('classifies the original unassigned game line without deleting it',async()=>{
 m.fetchAthleteRecords.mockResolvedValue({career:null,logs:[],unassignedLogs:[{id:'old',playedOn:'2026-10-01',opponentSchool:'Other',statLine:'Original',scoringValue:3,volumeValue:4}]});
 await render(<AthleteRecordsPanel playerId="p1" name="Kaleo" defaultSport="Volleyball" />);
 await fireEvent.press(await screen.findByLabelText('Assign sport to old'));
 await waitFor(()=>expect(m.classifyGameLogSport).toHaveBeenCalledWith('old','p1','Volleyball',null));
 expect(m.removeGameLog).not.toHaveBeenCalled();
});
