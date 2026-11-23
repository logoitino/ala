/** Bounded public directory navigation must retain context, expose retry and refuse stale read/action completions. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import type { ComponentType } from 'react';
import type { DirectoryPlayer, DirectorySchool } from '@/lib/schoolDirectory';
import { userProfileHref } from '@/lib/navigation';

const mockRetainedActions = new Map<string, () => void>();
const mockSchools = jest.fn(); const mockRoster = jest.fn(); const mockPush = jest.fn(); const mockBack = jest.fn();
let mockUser = 'A'; let mockGuard = () => true; let mockLocal = true;
// Capture the screen's actual callback while retaining production kit/native rendering; RNTL14 exposes host nodes only.
jest.mock('@/components/UI/Kit', () => {
  const actual = jest.requireActual('@/components/UI/Kit'); const React = jest.requireActual('react');
  return { ...actual, KitButton: (props: { accessibilityLabel?: string; label: string; onPress: () => void }) => {
    mockRetainedActions.set(props.accessibilityLabel ?? props.label, props.onPress);
    return React.createElement(actual.KitButton, props);
  } };
});
jest.mock('@/components/UI/HapticPressable', () => {
  const actual = jest.requireActual('@/components/UI/HapticPressable'); const React = jest.requireActual('react');
  return { ...actual, HapticPressable: (props: { accessibilityLabel?: string; onPress: () => void }) => {
    if (props.accessibilityLabel) mockRetainedActions.set(props.accessibilityLabel, props.onPress);
    return React.createElement(actual.HapticPressable, props);
  } };
});
jest.mock('@/lib/schoolDirectory', () => ({ listDirectorySchools: (...args: unknown[]) => mockSchools(...args), listDirectoryRoster: (...args: unknown[]) => mockRoster(...args) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUser }, isSessionCurrent: mockGuard, isAdmin: false }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { tabs: { local: mockLocal } } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }), Stack: { Screen: () => null } }));
jest.mock('@/components/TabScreen', () => ({ TabScreen: ({ children }: { children: import('react').ReactNode }) => {
  const React = jest.requireActual('react'); const Native = jest.requireActual('react-native'); return React.createElement(Native.View, null, children);
} }));
jest.mock('@/components/RuntimePaused', () => ({ RuntimePaused: ({ title }: { title: string }) => {
  const React = jest.requireActual('react'); const Native = jest.requireActual('react-native'); return React.createElement(Native.Text, null, title);
} }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => {
  const React = jest.requireActual('react'); const Native = jest.requireActual('react-native'); return React.createElement(Native.View);
} }));

// Initial RED uses a fixture-only absent-screen placeholder; unexpected implementation loader failures still throw.
let Directory: ComponentType = () => <Text>Directory not implemented.</Text>;
let Route: ComponentType = () => <View><Directory /></View>;
try { Directory = require('../SchoolDirectory').SchoolDirectory as ComponentType; } catch (error) {
  if (!String(error).includes("Cannot find module '../SchoolDirectory'")) throw error;
}
try { Route = require('../../../../../app/(tabs)/local/directory').default as ComponentType; } catch (error) {
  if (!String(error).includes("Cannot find module '../../../../../app/(tabs)/local/directory'")) throw error;
}
const A: DirectorySchool = { id: '11111111-1111-4111-8111-111111111111', name: 'School A', mascot: 'Owls', level: 'high_school', division: 'Varsity', region: 'UT', city: 'Town' };
const B: DirectorySchool = { ...A, id: '22222222-2222-4222-8222-222222222222', name: 'School B' };
const P: DirectoryPlayer = { id: '33333333-3333-4333-8333-333333333333', name: 'Jordan', jerseyNumber: 7, position: 'Wing', schoolName: A.name, team: 'Girls Rugby' };
const Q: DirectoryPlayer = { ...P, id: '44444444-4444-4444-8444-444444444444', name: 'Casey', team: 'Football' };
function page<T>(items: T[], hasMore = false, nextOffset: number | null = null) { return { items, hasMore, nextOffset }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function settle() { await act(async () => {}); }
async function press(label: string) { await fireEvent.press(screen.getByLabelText(label)); await settle(); }
function retainedPress(label: string): () => void {
  expect(screen.getByLabelText(label)).toBeTruthy();
  const callback = mockRetainedActions.get(label);
  if (!callback) throw new Error('Rendered production control has no captured feature callback.');
  return callback;
}

beforeEach(() => {
  jest.clearAllMocks(); mockRetainedActions.clear(); mockUser = 'A'; mockGuard = () => true; mockLocal = true;
  mockSchools.mockReset().mockResolvedValue(page([A, B])); mockRoster.mockReset().mockResolvedValue(page([P]));
});

it('browses current school/team/roster identities and opens only the exact existing athlete route', async () => {
  await render(<Directory />); await settle();
  await press('Browse School A');
  expect(mockRoster).toHaveBeenLastCalledWith({ schoolId: A.id, schoolName: A.name, offset: 0, limit: 20 });
  await press('Browse team Girls Rugby');
  expect(mockRoster).toHaveBeenLastCalledWith({ schoolId: A.id, schoolName: A.name, team: P.team, search: '', offset: 0, limit: 20 });
  expect(screen.getByText('Jordan')).toBeTruthy();
  expect(screen.getByText('Roster entries do not confirm account ownership or verification.')).toBeTruthy();
  await press('Open roster entry Jordan');
  expect(mockPush).toHaveBeenCalledWith(userProfileHref(P.id));
});
it('keeps true empty catalog distinct from unavailable and does not substitute demonstration records', async () => {
  mockSchools.mockResolvedValue(page([])); await render(<Directory />); await settle();
  expect(screen.getByText('No schools found')).toBeTruthy(); expect(screen.queryByText('School A')).toBeNull();
  expect(screen.queryByLabelText('Retry directory read')).toBeNull();
});
it('offers a reachable retry without displaying provider details', async () => {
  mockSchools.mockRejectedValueOnce(new Error('42501 private provider detail')).mockResolvedValueOnce(page([A]));
  await render(<Directory />); await settle();
  expect(screen.getByText('Schools are unavailable. Please retry.')).toBeTruthy();
  expect(screen.queryByText(/42501/)).toBeNull();
  await press('Retry directory read'); expect(screen.getByText(A.name)).toBeTruthy();
});
it('bounds catalog paging and refuses duplicate load-more callbacks before React settles', async () => {
  const pending = deferred<ReturnType<typeof page<DirectorySchool>>>();
  mockSchools.mockResolvedValueOnce(page([A], true, 20)).mockReturnValueOnce(pending.promise);
  await render(<Directory />); await settle();
  const send = retainedPress('Load more directory records');
  await act(async () => { send(); send(); });
  expect(mockSchools).toHaveBeenCalledTimes(2); expect(mockSchools).toHaveBeenLastCalledWith({ search: '', offset: 20, limit: 20 });
  await act(async () => { pending.resolve(page([B])); });
  expect(screen.getByText(A.name)).toBeTruthy(); expect(screen.getByText(B.name)).toBeTruthy();
});
it('discovers team labels through explicit roster paging and preserves loaded context on Back', async () => {
  mockRoster.mockResolvedValueOnce(page([P], true, 20)).mockResolvedValueOnce(page([Q])).mockResolvedValueOnce(page([P]));
  await render(<Directory />); await settle(); await press('Browse School A');
  expect(screen.queryByLabelText('Browse team Football')).toBeNull();
  expect(screen.getByText(/More records may contain other teams/)).toBeTruthy();
  await press('Load more directory records'); expect(screen.getByLabelText('Browse team Football')).toBeTruthy();
  await press('Browse team Girls Rugby'); await press('Back to teams');
  expect(screen.getByLabelText('Browse team Football')).toBeTruthy();
  await press('Back to schools'); expect(screen.getByText(B.name)).toBeTruthy(); expect(mockSchools).toHaveBeenCalledTimes(1);
});
it('keeps missing team/jersey/position metadata explicit and does not fabricate a team', async () => {
  mockRoster.mockResolvedValue(page([{ ...P, team: null, jerseyNumber: null, position: null }]));
  await render(<Directory />); await settle(); await press('Browse School A');
  expect(screen.getByText('Team not recorded')).toBeTruthy(); expect(screen.getByText(P.name)).toBeTruthy();
  expect(screen.queryByLabelText('Browse team Team not recorded')).toBeNull(); expect(screen.queryByText('#0')).toBeNull();
});
it('replaces roster search only for the chosen exact team', async () => {
  mockRoster.mockResolvedValueOnce(page([P])).mockResolvedValueOnce(page([P])).mockResolvedValueOnce(page([]));
  await render(<Directory />); await settle(); await press('Browse School A'); await press('Browse team Girls Rugby');
  await fireEvent.changeText(screen.getByLabelText('Search roster names'), 'Casey'); await press('Search directory');
  expect(mockRoster).toHaveBeenLastCalledWith({ schoolId: A.id, schoolName: A.name, team: P.team, search: 'Casey', offset: 0, limit: 20 });
  expect(screen.getByText('No matching roster entries')).toBeTruthy(); expect(screen.queryByText(P.name)).toBeNull();
});
it('refuses an old catalog result/finally after a newer search is pending', async () => {
  const old = deferred<ReturnType<typeof page<DirectorySchool>>>(); const fresh = deferred<ReturnType<typeof page<DirectorySchool>>>();
  mockSchools.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  await render(<Directory />);
  await fireEvent.changeText(screen.getByLabelText('Search school names'), 'School B'); await press('Search directory');
  await act(async () => { old.resolve(page([A])); });
  expect(screen.queryByText(A.name)).toBeNull(); expect(screen.getByText('Loading schools…')).toBeTruthy();
  await act(async () => { fresh.resolve(page([B])); }); expect(screen.getByText(B.name)).toBeTruthy(); expect(screen.queryByText(A.name)).toBeNull();
});
it('refuses the old school roster after Back and selecting another school', async () => {
  const old = deferred<ReturnType<typeof page<DirectoryPlayer>>>(); mockRoster.mockReturnValueOnce(old.promise).mockResolvedValueOnce(page([{ ...Q, schoolName: B.name }]));
  await render(<Directory />); await settle(); await press('Browse School A'); await press('Back to schools'); await press('Browse School B');
  await act(async () => { old.resolve(page([P])); });
  expect(screen.getByLabelText('Browse team Football')).toBeTruthy(); expect(screen.queryByLabelText('Browse team Girls Rugby')).toBeNull();
});
it('refuses stale Auth lifetime reads while the incoming lifetime loads its current page', async () => {
  const old = deferred<ReturnType<typeof page<DirectorySchool>>>(); const fresh = deferred<ReturnType<typeof page<DirectorySchool>>>();
  mockSchools.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  const view = await render(<Directory />);
  mockUser = 'B'; mockGuard = () => true; await view.rerender(<Directory />);
  await act(async () => { old.resolve(page([A])); }); expect(screen.queryByText(A.name)).toBeNull();
  await act(async () => { fresh.resolve(page([B])); }); expect(screen.getByText(B.name)).toBeTruthy();
});
it('retains loaded rows after refresh failure and accepts only current rows after retry', async () => {
  mockSchools.mockResolvedValueOnce(page([A])).mockRejectedValueOnce(new Error('Network')).mockResolvedValueOnce(page([B]));
  await render(<Directory />); await settle(); await press('Refresh directory');
  expect(screen.getByText(A.name)).toBeTruthy(); await press('Retry directory read');
  expect(screen.getByText(B.name)).toBeTruthy(); expect(screen.queryByText(A.name)).toBeNull();
});
it('refuses a retained roster action after the component unmounts', async () => {
  const view = await render(<Directory />); await settle(); await press('Browse School A'); await press('Browse team Girls Rugby');
  const send = retainedPress('Open roster entry Jordan');
  await view.unmount(); await act(async () => { send(); }); expect(mockPush).not.toHaveBeenCalled();
});
it('honors the existing Local runtime pause on a direct route without issuing directory reads', async () => {
  mockLocal = false; await render(<Route />); await settle();
  expect(screen.getByText('Local is paused')).toBeTruthy(); expect(mockSchools).not.toHaveBeenCalled(); expect(mockRoster).not.toHaveBeenCalled();
});
it('recovers a changed school association through a fresh catalog choice rather than retrying its stale name', async () => {
  mockSchools.mockResolvedValueOnce(page([A])).mockResolvedValueOnce(page([{ ...A, name: 'School A Renamed' }]));
  mockRoster.mockRejectedValueOnce(new Error('School association changed. Choose the current school and retry.'));
  await render(<Directory />); await settle(); await press('Browse School A');
  expect(screen.getByText('School details changed. Choose the school again to refresh its roster.')).toBeTruthy();
  await press('Choose school again');
  expect(mockSchools).toHaveBeenCalledTimes(2); expect(screen.getByLabelText('Browse School A Renamed')).toBeTruthy();
  expect(screen.queryByLabelText('Browse School A')).toBeNull();
});
it('refuses a retained roster action after a refresh removes the current row', async () => {
  mockRoster.mockResolvedValueOnce(page([P])).mockResolvedValueOnce(page([P])).mockResolvedValueOnce(page([]));
  await render(<Directory />); await settle(); await press('Browse School A'); await press('Browse team Girls Rugby');
  const send = retainedPress('Open roster entry Jordan'); await press('Refresh directory');
  await act(async () => { send(); }); expect(mockPush).not.toHaveBeenCalled();
});
