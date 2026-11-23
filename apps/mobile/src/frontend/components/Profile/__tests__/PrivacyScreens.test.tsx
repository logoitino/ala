/** PRIV-01 / MINOR-01 app screens: settings sheet (with the teen pieces), friend / block controls, friend requests. Synthetic data. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { FriendRequestsCard } from '@/components/Activity/FriendRequestsCard';
import { PrivacySettingsSheet } from '@/components/Profile/PrivacySettingsSheet';
import { ProfileFriendActions } from '@/components/Profile/ProfileFriendActions';
import * as minors from '@/lib/minors';
import * as privacy from '@/lib/privacy';

jest.mock('@/lib/privacy', () => ({
  ...jest.requireActual('@/lib/privacy'),
  fetchMyPrivacy: jest.fn(), fetchMyBlocks: jest.fn(), unblockUser: jest.fn(),
  getPublicProfiles: jest.fn(), fetchMyFriends: jest.fn(), requestFriend: jest.fn(), respondFriend: jest.fn(),
  removeFriend: jest.fn(), blockUser: jest.fn(),
}));
jest.mock('@/lib/minors', () => ({
  ...jest.requireActual('@/lib/minors'),
  fetchMyPrivacyStatus: jest.fn(), saveMyPrivacyStatus: jest.fn(), createGuardianInvite: jest.fn(), respondGuardianLink: jest.fn(),
  endGuardianLink: jest.fn(), cancelApprovalRequest: jest.fn(), fetchMySupervision: jest.fn(),
}));
let mockUser = 'A';
let mockGuard = () => true;
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: () => { const owner = mockUser, guard = mockGuard; return { userId: owner, isCurrent: () => owner === mockUser && guard === mockGuard }; } } }));
const mockClient = {};
jest.mock('@/lib/offlineActor', () => ({ createOfflineActorClient: async () => mockClient }));
const mockRecordBirthMonth = jest.fn();
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUser }, isSessionCurrent: mockGuard, recordBirthMonth: mockRecordBirthMonth }) }));
jest.mock('@/components/Custodial/GuardianSupervisionPanel', () => ({ GuardianSupervisionPanel: () => null }));
const m = jest.mocked(privacy);
const mm = jest.mocked(minors);
const status = (raw: Record<string, unknown>) => minors.parseMinorStatus({ guardian_links_enabled: true, ...raw });
const settings = (raw: Record<string, unknown> = {}) => privacy.parsePrivacy({ account_private: true, ...raw });
const account = (rel: string, extra: Record<string, unknown> = {}) => ({ id: 'prof-a', player_id: 'pl-1', username: 'kaleo', full_name: 'Kaleo Fua', viewer_relation: rel, account_private: true, ...extra }) as never;

beforeEach(() => {
  jest.clearAllMocks(); mockUser = 'A'; mockGuard = () => true;
  m.fetchMyBlocks.mockResolvedValue([{ profileId: 'b1', name: 'Rude Fan', blockedAt: '2026-10-14' }]);
  m.fetchMyFriends.mockResolvedValue([]);
});

describe('PrivacySettingsSheet', () => {
  it('saves a changed audience and unblocks someone', async () => {
    mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: settings(), minor: status({ age_band: 'adult' }) });
    mm.saveMyPrivacyStatus.mockImplementation(async (next) => ({ settings: { ...settings(), ...next } as privacy.PrivacySettings, minor: null, heldForApproval: [] }));
    await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
    expect(screen.getByLabelText('Save privacy')).toBeDisabled();
    await fireEvent.press(await screen.findByLabelText('Bio: Only me'));
    await fireEvent.press(screen.getByLabelText('Save privacy'));
    await waitFor(() => expect(mm.saveMyPrivacyStatus).toHaveBeenCalledWith(expect.objectContaining({ audience: expect.objectContaining({ bio: 'only_me' }) }), mockClient));
    expect(await screen.findByText('Privacy saved.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Unblock Rude Fan'));
    await waitFor(() => expect(m.unblockUser).toHaveBeenCalledWith('b1', mockClient));
  });

  it('a solo teen: public waits for a signed consent, and they can invite a parent or guardian', async () => {
    mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: settings({ friend_requests_from: 'teens' }), minor: status({ age_band: 'teen_13_15' }) });
    mm.createGuardianInvite.mockResolvedValue({ code: 'K7M2Q9XA', expiresAt: '2026-10-16T00:00:00Z' });
    await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
    expect(await screen.findByLabelText('Account: Public')).toBeDisabled();
    expect(screen.getByText(/signs the consent before a teen profile can be public/)).toBeTruthy();
    // No dictatorship: everything else stays the teen's own choice.
    expect(screen.getByLabelText('Bio: Everyone')).toBeEnabled();
    expect(screen.getByLabelText('Friend requests: Only other teens')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Invite a parent or guardian'));
    expect(await screen.findByText('K7M2Q9XA')).toBeTruthy();
    expect(screen.getByText(/Share this only with your parent or legal guardian/)).toBeTruthy();
  });

  it('an under-16 with consent: going public is sent to the guardian, and the sheet says so', async () => {
    const minor = status({ age_band: 'teen_13_15', has_public_consent: true, guardians: [{ link_id: 'l1', first_name: 'Mele', since: '2026-10-14', consent: { signed_at: '2026-10-14', allows_public_profile: true } }] });
    mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: settings({ friend_requests_from: 'teens' }), minor });
    mm.saveMyPrivacyStatus.mockResolvedValue({ settings: settings({ friend_requests_from: 'teens' }), minor, heldForApproval: ['account_public'] });
    await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
    expect(await screen.findByText('Going public is sent to Mele to approve.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Account: Public'));
    await fireEvent.press(screen.getByLabelText('Save privacy'));
    expect(await screen.findByText(/Sent to Mele to approve: make the profile public/)).toBeTruthy();
    expect(screen.getByText(/Consent: public profile/)).toBeTruthy();
  });

  it('the teen confirms a guardian link, and can see what the guardian sees', async () => {
    mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: settings({ friend_requests_from: 'teens' }), minor: status({ age_band: 'teen_16_17', pending_links: [{ link_id: 'l9', first_name: 'Mele', username: 'guardmele', requested_at: '2026-10-14' }] }) });
    mm.respondGuardianLink.mockResolvedValue(null);
    mm.fetchMySupervision.mockResolvedValue(minors.parseSupervision({ settings: {}, summary: { friends: 4 }, events: [{ kind: 'guardian_linked', detail: { guardian: 'Mele' }, at: '2026-10-14' }] }));
    await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
    expect(await screen.findByText('Is Mele (@guardmele) your parent or guardian?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Yes, Mele is my parent or guardian'));
    await waitFor(() => expect(mm.respondGuardianLink).toHaveBeenCalledWith('l9', true, mockClient));
    await fireEvent.press(screen.getByLabelText('What your guardian sees'));
    expect(await screen.findByText('4 friends')).toBeTruthy();
    expect(screen.getByText(/Mele was linked as a parent or guardian/)).toBeTruthy();
  });

  it('a new account with no age adds it before taking friend requests', async () => {
    mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: settings({ friend_requests_from: 'nobody' }), minor: status({ age_band: 'not_given', needs_birth: true }) });
    mockRecordBirthMonth.mockResolvedValue('ok');
    await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
    expect(await screen.findByLabelText('Friend requests: Anyone can send')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Choose birth month'));
    await fireEvent.press(screen.getByLabelText('Mar'));
    await fireEvent.press(screen.getByLabelText('Choose birth year'));
    await fireEvent.press(screen.getByLabelText('2001'));
    await fireEvent.press(screen.getByLabelText('Save birth month and year'));
    await waitFor(() => expect(mockRecordBirthMonth).toHaveBeenCalledWith(2001, 3));
  });
});

describe('ProfileFriendActions', () => {
  it('a stranger sees the private note and can add a friend', async () => {
    m.getPublicProfiles.mockResolvedValue([account('stranger')]);
    m.requestFriend.mockResolvedValue('requested');
    await render(<ProfileFriendActions playerId="pl-1" />);
    expect(await screen.findByText(/This profile is private/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add friend'));
    await waitFor(() => expect(m.requestFriend).toHaveBeenCalledWith('prof-a'));
  });

  it('accepts an incoming request, and blocks only after confirming', async () => {
    m.getPublicProfiles.mockResolvedValue([account('stranger')]);
    m.fetchMyFriends.mockResolvedValue([{ requestId: 'r1', profileId: 'prof-a', name: 'Kaleo', username: null, avatarUrl: null, status: 'incoming', since: '' }]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _b, buttons) => { buttons?.find((b) => b.style === 'destructive')?.onPress?.(); });
    await render(<ProfileFriendActions playerId="pl-1" />);
    await fireEvent.press(await screen.findByLabelText('Accept friend request'));
    await waitFor(() => expect(m.respondFriend).toHaveBeenCalledWith('r1', true));
    await fireEvent.press(screen.getByLabelText('Block Kaleo Fua'));
    expect(alert).toHaveBeenLastCalledWith('Block Kaleo Fua?', expect.stringContaining("They aren't told"), expect.any(Array));
    await waitFor(() => expect(m.blockUser).toHaveBeenCalledWith('prof-a'));
    alert.mockRestore();
  });

  it('shows Unblock to the blocker, and nothing on your own profile', async () => {
    m.getPublicProfiles.mockResolvedValue([account('blocked')]);
    const view = await render(<ProfileFriendActions playerId="pl-1" />);
    expect(await screen.findByLabelText('Unblock')).toBeTruthy();
    m.getPublicProfiles.mockResolvedValue([account('self')]);
    await view.rerender(<ProfileFriendActions playerId="pl-2" />);
    await waitFor(() => expect(screen.queryByLabelText('Unblock')).toBeNull());
  });
});

it('FriendRequestsCard accepts and declines', async () => {
  m.fetchMyFriends.mockResolvedValue([
    { requestId: 'r1', profileId: 'p1', name: 'Sina', username: null, avatarUrl: null, status: 'incoming', since: '' },
    { requestId: 'r2', profileId: 'p2', name: 'Tavita', username: null, avatarUrl: null, status: 'incoming', since: '' },
  ]);
  await render(<FriendRequestsCard />);
  await fireEvent.press(await screen.findByLabelText('Accept Sina'));
  expect(await screen.findByText('You and Sina are friends.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Decline Tavita'));
  await waitFor(() => expect(m.respondFriend).toHaveBeenLastCalledWith('r2', false));
});

it('masks outgoing private blocks immediately and rejects a delayed A load after B', async () => {
 let release!: (value: Awaited<ReturnType<typeof minors.fetchMyPrivacyStatus>>) => void;
 mm.fetchMyPrivacyStatus.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
 mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: settings(), minor: status({ age_band: 'adult' }) });
 const view = await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
 await waitFor(() => expect(mm.fetchMyPrivacyStatus).toHaveBeenCalledTimes(1));
 mockUser = 'B'; mockGuard = () => true;
 m.fetchMyBlocks.mockResolvedValue([]);
 await view.rerender(<PrivacySettingsSheet visible onClose={jest.fn()} />);
 await waitFor(() => expect(mm.fetchMyPrivacyStatus).toHaveBeenCalledTimes(2));
 await act(async () => release({ settings: settings({ account_private: false }), minor: status({ age_band: 'adult' }) }));
 expect(screen.queryByText('Rude Fan')).toBeNull();
 expect(screen.getByLabelText('Account: Private').props.accessibilityState.selected).toBe(true);
});
it('rejects a delayed A save success after B and freezes edits during that save', async () => {
 mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: settings(), minor: status({ age_band: 'adult' }) });
 let release!: (value: Awaited<ReturnType<typeof minors.saveMyPrivacyStatus>>) => void;
 mm.saveMyPrivacyStatus.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
 const view = await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
 await fireEvent.press(await screen.findByLabelText('Bio: Only me'));
 await fireEvent.press(screen.getByLabelText('Save privacy'));
 expect(screen.getByLabelText('Bio: Everyone')).toBeDisabled();
 mockUser = 'B'; mockGuard = () => true;
 await view.rerender(<PrivacySettingsSheet visible onClose={jest.fn()} />);
 await act(async () => release({ settings: settings({ account_private: false }), minor: null, heldForApproval: [] }));
 expect(screen.queryByText('Privacy saved.')).toBeNull();
 expect((await screen.findByLabelText('Account: Private')).props.accessibilityState.selected).toBe(true);
});
it('offers Retry after a real current-owner privacy load failure', async () => {
 mm.fetchMyPrivacyStatus.mockRejectedValueOnce(new Error('Privacy unavailable'));
 mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: settings(), minor: status({ age_band: 'adult' }) });
 await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
 expect(await screen.findByText('Privacy unavailable')).toBeTruthy();
 await fireEvent.press(screen.getByRole('button', { name: 'Retry privacy' }));
 expect(await screen.findByLabelText('Bio: Friends')).toBeTruthy();
});

it('keeps a denied own privacy save retryable without publishing saved settings', async () => {
 mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: settings(), minor: status({ age_band: 'adult' }) });
 mm.saveMyPrivacyStatus.mockRejectedValueOnce(new Error('Permission denied'));
 await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
 await fireEvent.press(await screen.findByLabelText('Bio: Only me'));
 await fireEvent.press(screen.getByLabelText('Save privacy'));
 expect(await screen.findByText('Permission denied')).toBeTruthy();
 expect(screen.queryByText('Privacy saved.')).toBeNull();
 expect(screen.getByLabelText('Bio: Only me').props.accessibilityState.selected).toBe(true);
 expect(screen.getByLabelText('Save privacy')).toBeEnabled();
 mm.saveMyPrivacyStatus.mockResolvedValueOnce({ settings: settings({ audience: { bio: 'only_me' } }), minor: null, heldForApproval: [] });
 await fireEvent.press(screen.getByLabelText('Save privacy'));
 expect(await screen.findByText('Privacy saved.')).toBeTruthy();
});
it('does not dispatch a retained unlink confirmation after the account changes', async () => {
 mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: settings(), minor: status({ age_band: 'teen_16_17', guardians: [{ link_id: 'l1', first_name: 'Mele' }] }) });
 let confirm!: () => void;
 const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => { confirm = buttons?.find(button => button.style === 'destructive')?.onPress as () => void; });
 try {
  const view = await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
  await fireEvent.press(await screen.findByLabelText('Unlink Mele'));
  mockUser = 'B'; mockGuard = () => true;
  await view.rerender(<PrivacySettingsSheet visible onClose={jest.fn()} />);
  await act(async () => confirm());
  expect(mm.endGuardianLink).not.toHaveBeenCalled();
 } finally { alert.mockRestore(); }
});
