/** UX-17: optional current roster choices remain captured-account pending claims, not copied profile identity.
 * Actual rendered sheet callbacks run against synthetic Auth/public-reader boundaries; no hosted write occurs. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RoleSwitcherModal } from '../RoleSwitcherModal';
import type { DirectoryPlayer } from '@/lib/schoolDirectory';

const mockSchool = { id: '11111111-1111-4111-8111-111111111111', name: 'School A', mascot: 'Owls', level: 'high_school', division: 'High School', region: 'UT', city: null };
const mockSchoolB = { ...mockSchool, id: '22222222-2222-4222-8222-222222222222', name: 'School B' };
const PLAYER: DirectoryPlayer = { id: '33333333-3333-4333-8333-333333333333', name: 'Roster Name', jerseyNumber: null, position: null, schoolName: mockSchool.name, team: 'Girls Rugby' };
const mockRead = jest.fn();
const mockComplete = jest.fn();
const mockToast = jest.fn();
const mockClose = jest.fn();
const mockClient = {};
const mockCreateClient = jest.fn();
const mockHandlers = new Map<string, () => unknown>();
const mockDismissCallbacks: Array<() => void> = [];
let mockHoldDismiss = false;
let mockCurrent = true;
let mockAccepted = true;
let mockAuth: any;
const mockActor = { userId: 'A', isCurrent: () => mockCurrent };

jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/CelebrationContext', () => ({ useCelebration: () => ({ showToast: mockToast }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { catalog: { classYears: [], exclusiveDollars: 5 } } }) }));
jest.mock('@/hooks/useLegalAck', () => ({ useLegalAck: () => ({ accepted: mockAccepted, accept: jest.fn() }) }));
jest.mock('@/hooks/useSportConfigs', () => ({ useSportConfigs: () => ({ configs: [] }) }));
jest.mock('@/hooks/useSheetFrame', () => ({ useSheetFrame: () => ({ dock: {}, card: {} }) }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: (id: string) => id === 'A' && mockCurrent ? mockActor : null } }));
jest.mock('@/lib/offlineActor', () => ({ createOfflineActorClient: (...args: unknown[]) => mockCreateClient(...args) }));
jest.mock('@/lib/schoolDirectory', () => ({ listDirectoryRoster: (...args: unknown[]) => mockRead(...args) }));
jest.mock('@/components/UI/MenuChrome', () => ({ MenuBackdrop: () => null }));
jest.mock('@/components/UI/SheetHandle', () => ({ SheetHandle: () => null }));
jest.mock('@/components/Profile/FunFactShare', () => ({ FunFactShare: () => require('react').createElement(require('react-native').Text, null, 'Optional fun fact') }));
jest.mock('@/components/Legal/LegalModal', () => ({ LegalAckToggle: () => null, LegalModal: () => null }));
jest.mock('expo-blur', () => ({ BlurView: () => null }));
jest.mock('react-native-reanimated', () => {
  const React = require('react'); const { View } = require('react-native');
  return { __esModule: true, default: { View }, useSharedValue: (value: unknown) => React.useRef({ value }).current,
    useAnimatedStyle: (read: () => unknown) => read(), withSpring: (value: unknown) => value,
    withTiming: (value: unknown, _config: unknown, done?: (finished: boolean) => void) => { if (done && mockHoldDismiss) mockDismissCallbacks.push(() => done(true)); else done?.(true); return value; },
    runOnJS: (callback: unknown) => callback, Easing: { in: (easing: unknown) => easing, out: (easing: unknown) => easing, cubic: (value: number) => value } };
});
jest.mock('@/components/UI/AnimatedButton', () => {
  const React = require('react'); const { Pressable } = require('react-native');
  return { AnimatedButton: ({ contentStyle, children, ...props }: any) => {
    mockHandlers.set(props.accessibilityLabel, props.onPress);
    return React.createElement(Pressable, { ...props, style: contentStyle, accessibilityRole: props.accessibilityRole ?? 'button' }, children);
  } };
});
jest.mock('@/components/UI/HapticPressable', () => ({ HapticPressable: require('react-native').Pressable }));
jest.mock('@/components/UI/FilterPills', () => {
  const React = require('react'); const { View, Pressable, Text } = require('react-native');
  return { FilterPills: ({ items, onChange }: any) => React.createElement(View, null, items.map((item: any) => React.createElement(Pressable, { key: item.id, accessibilityRole: 'button', accessibilityLabel: `Pick ${item.label}`, onPress: () => onChange(item.id) }, React.createElement(Text, null, item.label)))) };
});
jest.mock('@/components/Profile/TeamSearchField', () => {
  const React = require('react'); const { View, Pressable, Text } = require('react-native');
  return { TeamSearchField: ({ onSelect, onClear }: any) => React.createElement(View, null,
    [mockSchool, mockSchoolB].map((school) => React.createElement(Pressable, { key: school.id, accessibilityRole: 'button', accessibilityLabel: `Pick ${school.name}`, onPress: () => onSelect(school) }, React.createElement(Text, null, school.name))),
    React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Clear school', onPress: onClear }, React.createElement(Text, null, 'Clear school'))) };
});

beforeEach(() => {
  mockCurrent = true; mockAccepted = true;
  mockHandlers.clear();
  mockHoldDismiss = false; mockDismissCallbacks.length = 0;
  mockComplete.mockReset().mockResolvedValue(undefined); mockToast.mockReset(); mockClose.mockReset();
  mockCreateClient.mockReset().mockResolvedValue(mockClient);
  mockRead.mockReset().mockResolvedValue({ items: [PLAYER], hasMore: false, nextOffset: null });
  mockAuth = { activeRole: 'fan', isAthlete: false, user: { id: 'A' }, profile: { id: 'profile-A', user_id: 'A', full_name: 'My Own Name', team: null }, isSessionCurrent: () => mockCurrent, completeAthleteOnboarding: mockComplete, setActiveRole: jest.fn() };
});
async function prepare() {
  const view = await render(<RoleSwitcherModal visible onClose={mockClose} />);
  await fireEvent.press(screen.getByLabelText('Pick School A'));
  await fireEvent.press(screen.getByLabelText('Pick Rugby'));
  return view;
}
async function choose() {
  await fireEvent.press(screen.getByLabelText('Choose existing athlete (optional)'));
  await fireEvent.press(await screen.findByLabelText(`Choose ${PLAYER.name}`));
}
it('forwards an exact optional record without copying its name, number or verification', async () => {
  await prepare(); await choose();
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  expect(mockRead).toHaveBeenCalledWith(expect.objectContaining({ schoolId: mockSchool.id, schoolName: mockSchool.name, limit: 20 }), mockClient);
  expect(mockCreateClient).toHaveBeenCalledWith(mockActor);
  expect(mockComplete).toHaveBeenCalledWith({ team: mockSchool, sport: 'Rugby', jersey: '', position: '', classYear: '' }, PLAYER.id);
  expect(mockAuth.profile.full_name).toBe('My Own Name');
});

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
it('continues with no new target and leaves optional form fields independent', async () => {
  await prepare();
  await fireEvent.changeText(screen.getByLabelText('Roster number'), '17');
  await fireEvent.changeText(screen.getByLabelText('Position'), 'Wing');
  await fireEvent.press(screen.getByLabelText("Pick '26"));
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  expect(mockComplete).toHaveBeenCalledWith({ team: mockSchool, sport: 'Rugby', jersey: '17', position: 'Wing', classYear: '26' }, null);
  expect(mockRead).not.toHaveBeenCalled();
});
it('keeps mandatory legal acceptance before an optional roster claim', async () => {
  mockAccepted = false; await prepare();
  await act(async () => { mockHandlers.get('Claim athlete profile')!(); });
  expect(mockComplete).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith('Agree to Terms of Service & NIL Compliance first.');
});
it('shows a denied read as unavailable with a working explicit retry', async () => {
  mockRead.mockRejectedValueOnce(new Error('Private server detail'));
  await prepare(); await fireEvent.press(screen.getByLabelText('Choose existing athlete (optional)'));
  expect(await screen.findByText('Existing roster is unavailable. Please retry.')).toBeTruthy();
  expect(screen.queryByText(/No matching records/)).toBeNull();
  expect(screen.queryByText('Private server detail')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Retry existing roster'));
  expect(await screen.findByLabelText(`Choose ${PLAYER.name}`)).toBeTruthy();
});
it('preserves selected claim and safe partial-save feedback on failed submit then explicit retry', async () => {
  mockComplete.mockRejectedValueOnce(new Error('Athlete claim is unavailable. Your profile fields may be saved; retry the claim.'));
  await prepare(); await choose();
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  expect(await screen.findByText('Athlete claim is unavailable. Your profile fields may be saved; retry the claim.')).toBeTruthy();
  expect(mockToast).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  expect(mockComplete).toHaveBeenCalledTimes(2);
  expect(mockComplete.mock.calls.every((call) => call[1] === PLAYER.id)).toBe(true);
  expect(mockToast).toHaveBeenCalledTimes(1);
});
it('releases visible busy after a held school-A save is replaced by school B', async () => {
  const held = deferred<void>(); mockComplete.mockReturnValueOnce(held.promise);
  await prepare(); await choose();
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  await fireEvent.press(screen.getByLabelText('Pick School B'));
  await act(async () => { held.resolve(); await held.promise; });
  expect(screen.getByLabelText('Claim athlete profile').props.accessibilityState?.disabled).toBe(false);
  expect(mockToast).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  expect(mockComplete).toHaveBeenLastCalledWith(expect.objectContaining({ team: mockSchoolB }), null);
});
it('expires a selected row and busy state when this profile name changes during a held save', async () => {
  const held = deferred<void>(); mockComplete.mockReturnValueOnce(held.promise);
  const view = await prepare(); await choose();
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  mockAuth = { ...mockAuth, profile: { ...mockAuth.profile, full_name: 'Current Name' } };
  await view.rerender(<RoleSwitcherModal visible onClose={mockClose} />);
  await act(async () => { held.resolve(); await held.promise; });
  expect(mockToast).not.toHaveBeenCalled();
  expect(screen.queryByText(`Selected: ${PLAYER.name}`)).toBeNull();
  expect(screen.getByLabelText('Claim athlete profile').props.accessibilityState?.disabled).toBe(false);
});
it('rejects a retained old-query row callback after the roster search changes', async () => {
  await prepare(); await choose();
  await fireEvent.press(screen.getByLabelText('No new roster choice'));
  const oldChoose = mockHandlers.get(`Choose ${PLAYER.name}`)!;
  mockRead.mockResolvedValueOnce({ items: [], hasMore: false, nextOffset: null });
  await fireEvent.changeText(screen.getByLabelText('Search existing athletes'), 'Another');
  await act(async () => { oldChoose(); });
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  expect(mockComplete).toHaveBeenLastCalledWith(expect.any(Object), null);
});
it('a held outgoing read cannot publish into a different school frame', async () => {
  const held = deferred<{ items: DirectoryPlayer[]; hasMore: boolean; nextOffset: null }>();
  mockRead.mockReturnValueOnce(held.promise);
  await prepare(); await fireEvent.press(screen.getByLabelText('Choose existing athlete (optional)'));
  await waitFor(() => expect(mockRead).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByLabelText('Pick School B'));
  await act(async () => { held.resolve({ items: [PLAYER], hasMore: false, nextOffset: null }); await held.promise; });
  expect(screen.queryByLabelText(`Choose ${PLAYER.name}`)).toBeNull();
});
it('a held submit cannot toast or close the incoming account frame', async () => {
  const held = deferred<void>(); mockComplete.mockReturnValueOnce(held.promise);
  const view = await prepare(); await choose();
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  mockCurrent = false; mockAuth = { ...mockAuth, user: { id: 'B' }, profile: { id: 'profile-B', full_name: 'B', team: null }, isSessionCurrent: () => true };
  await view.rerender(<RoleSwitcherModal visible onClose={mockClose} />);
  await act(async () => { held.resolve(); await held.promise; });
  expect(mockToast).not.toHaveBeenCalled(); expect(mockClose).not.toHaveBeenCalled();
  expect(screen.queryByText(`Selected: ${PLAYER.name}`)).toBeNull();
});
it('coalesces two same-turn submits and closes a current athlete missing its roster after success', async () => {
  mockAuth.isAthlete = true;
  const held = deferred<void>(); mockComplete.mockReturnValueOnce(held.promise);
  await prepare(); const submit = mockHandlers.get('Save athlete roster')!;
  await act(async () => { submit(); submit(); });
  expect(mockComplete).toHaveBeenCalledTimes(1);
  await act(async () => { held.resolve(); await held.promise; });
  expect(mockClose).toHaveBeenCalledTimes(1);
});
it('does not newly choose a hidden row after collapsing the optional selector', async () => {
  await prepare(); await choose(); await fireEvent.press(screen.getByLabelText('No new roster choice'));
  const oldChoose = mockHandlers.get(`Choose ${PLAYER.name}`)!;
  await fireEvent.press(screen.getByLabelText('Choose existing athlete (optional)'));
  await act(async () => { oldChoose(); });
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  expect(mockComplete).toHaveBeenLastCalledWith(expect.any(Object), null);
});
it('a collapsed held read settles without reopening or publishing its old rows', async () => {
  const held = deferred<{ items: DirectoryPlayer[]; hasMore: boolean; nextOffset: null }>(); mockRead.mockReturnValueOnce(held.promise);
  await prepare(); await fireEvent.press(screen.getByLabelText('Choose existing athlete (optional)'));
  await waitFor(() => expect(mockRead).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByLabelText('Choose existing athlete (optional)'));
  await act(async () => { held.resolve({ items: [PLAYER], hasMore: false, nextOffset: null }); await held.promise; });
  expect(screen.queryByLabelText(`Choose ${PLAYER.name}`)).toBeNull();
  await choose(); expect(mockRead).toHaveBeenCalledTimes(2);
});
it('preserves loaded rows and retries the exact next page after a paging refusal', async () => {
  const later = { ...PLAYER, id: '44444444-4444-4444-8444-444444444444', name: 'Later Athlete', team: null };
  mockRead.mockResolvedValueOnce({ items: [PLAYER], hasMore: true, nextOffset: 20 }).mockRejectedValueOnce(new Error('Denied page')).mockResolvedValueOnce({ items: [later], hasMore: false, nextOffset: null });
  await prepare(); await choose();
  await fireEvent.press(screen.getByLabelText('Load more existing athletes'));
  expect(await screen.findByText('Existing roster is unavailable. Please retry.')).toBeTruthy();
  expect(screen.getByLabelText(`Choose ${PLAYER.name}`)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Retry existing roster'));
  expect(await screen.findByLabelText('Choose Later Athlete')).toBeTruthy();
  expect(mockRead.mock.calls.map((call) => call[0].offset)).toEqual([0, 20, 20]);
  expect(screen.getByText('Showing 2 loaded records.')).toBeTruthy();
  expect(screen.getByText('No team label recorded')).toBeTruthy();
});
it('refuses configured signed-in reads without a captured matching actor', async () => {
  mockAuth = { ...mockAuth, user: { id: 'B' }, profile: { id: 'profile-B', full_name: 'B', team: null }, isSessionCurrent: () => true };
  await prepare(); await fireEvent.press(screen.getByLabelText('Choose existing athlete (optional)'));
  expect(await screen.findByText('Existing roster is unavailable. Please retry.')).toBeTruthy();
  expect(mockCreateClient).not.toHaveBeenCalled(); expect(mockRead).not.toHaveBeenCalled();
});
it('same-user new Auth lifetime masks the old choice immediately', async () => {
  const view = await prepare(); await choose();
  mockAuth = { ...mockAuth, isSessionCurrent: () => true };
  await view.rerender(<RoleSwitcherModal visible onClose={mockClose} />);
  expect(screen.queryByText(`Selected: ${PLAYER.name}`)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  expect(mockComplete).toHaveBeenLastCalledWith(expect.any(Object), null);
});
it('held successful-dismiss completion cannot close a replacement name frame', async () => {
  mockAuth.isAthlete = true; mockHoldDismiss = true;
  const view = await prepare(); await fireEvent.press(screen.getByLabelText('Save athlete roster'));
  expect(mockDismissCallbacks).toHaveLength(1); expect(mockClose).not.toHaveBeenCalled();
  mockAuth = { ...mockAuth, profile: { ...mockAuth.profile, full_name: 'Replacement Name' } };
  await view.rerender(<RoleSwitcherModal visible onClose={mockClose} />);
  await act(async () => { mockDismissCallbacks.forEach((done) => done()); });
  expect(mockClose).not.toHaveBeenCalled();
});
it('keeps a failed claim retry reachable when the confirmed partial profile save hydrates its school', async () => {
  mockComplete.mockRejectedValueOnce(new Error('Athlete claim is unavailable. Your profile fields may be saved; retry the claim.'));
  const view = await prepare(); await choose(); await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  mockAuth = { ...mockAuth, profile: { ...mockAuth.profile, team: mockSchool } };
  await view.rerender(<RoleSwitcherModal visible onClose={mockClose} />);
  expect(screen.getByText('Athlete claim is unavailable. Your profile fields may be saved; retry the claim.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  expect(mockComplete).toHaveBeenCalledTimes(2);
  expect(mockComplete.mock.calls[1][1]).toBe(PLAYER.id);
});
it('keeps visible busy during a held retry after the partial school save hydrated', async () => {
  const held = deferred<void>();
  mockComplete.mockRejectedValueOnce(new Error('Athlete claim is unavailable. Your profile fields may be saved; retry the claim.')).mockReturnValueOnce(held.promise);
  const view = await prepare(); await choose(); await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  mockAuth = { ...mockAuth, profile: { ...mockAuth.profile, team: mockSchool } };
  await view.rerender(<RoleSwitcherModal visible onClose={mockClose} />);
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  const visibleBusy = screen.queryByLabelText('Claim athlete profile')?.props.accessibilityState?.disabled;
  await act(async () => { held.resolve(); await held.promise; });
  expect(visibleBusy).toBe(true);
});
it.each(['school', 'choice'])('refuses a retained Apply after its rendered %s target was replaced', async (target) => {
  await prepare(); await choose();
  const oldApply = mockHandlers.get('Claim athlete profile')!;
  if (target === 'school') await fireEvent.press(screen.getByLabelText('Pick School B'));
  else await fireEvent.press(screen.getByLabelText('No new roster choice'));
  await act(async () => { oldApply(); });
  expect(mockComplete).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});
it.each(['complete', 'fail'])('serializes same-account school replacement until the issued save %s settles', async (outcome) => {
  const held = deferred<void>();
  mockComplete.mockReturnValueOnce(held.promise.then(() => { if (outcome === 'fail') throw new Error('Old school write refused'); }));
  const view = await prepare(); await choose(); await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  await fireEvent.press(screen.getByLabelText('Pick School B'));
  const attemptB = mockHandlers.get('Claim athlete profile')!;
  await act(async () => { attemptB(); });
  const issuedBeforeSettlement = mockComplete.mock.calls.length;
  const visibleBusyBeforeSettlement = screen.getByLabelText('Claim athlete profile').props.accessibilityState?.disabled;
  await act(async () => { held.resolve(); await held.promise; });
  expect(issuedBeforeSettlement).toBe(1);
  expect(visibleBusyBeforeSettlement).toBe(true);
  // The old, legitimate save may publish its school to Auth. The replacement draft still needs a reachable save.
  mockAuth = { ...mockAuth, profile: { ...mockAuth.profile, team: mockSchool } };
  await view.rerender(<RoleSwitcherModal visible onClose={mockClose} />);
  expect(screen.getByLabelText('Claim athlete profile').props.accessibilityState?.disabled).toBe(false);
  expect(mockToast).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Claim athlete profile'));
  expect(mockComplete).toHaveBeenCalledTimes(2);
  expect(mockComplete).toHaveBeenLastCalledWith(expect.objectContaining({ team: mockSchoolB }), null);
});
