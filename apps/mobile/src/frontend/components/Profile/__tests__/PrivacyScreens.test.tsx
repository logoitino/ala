/** PRIV-01 / MINOR-01 app screens: settings sheet (with the teen pieces), friend / block controls, friend requests. Synthetic data. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
const mockRecordBirthMonth = jest.fn();
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ recordBirthMonth: mockRecordBirthMonth }) }));
jest.mock('@/components/Custodial/GuardianSupervisionPanel', () => ({ GuardianSupervisionPanel: () => null }));
const m = jest.mocked(privacy);
const mm = jest.mocked(minors);
const status = (raw: Record<string, unknown>) => minors.parseMinorStatus({ guardian_links_enabled: true, ...raw });
const settings = (raw: Record<string, unknown> = {}) => privacy.parsePrivacy({ account_private: true, ...raw });
const account = (rel: string, extra: Record<string, unknown> = {}) => ({ id: 'prof-a', player_id: 'pl-1', username: 'kaleo', full_name: 'Kaleo Fua', viewer_relation: rel, account_private: true, ...extra }) as never;

beforeEach(() => {
  jest.clearAllMocks();
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
    await waitFor(() => expect(mm.saveMyPrivacyStatus).toHaveBeenCalledWith(expect.objectContaining({ audience: expect.objectContaining({ bio: 'only_me' }) })));
    expect(await screen.findByText('Privacy saved.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Unblock Rude Fan'));
    await waitFor(() => expect(m.unblockUser).toHaveBeenCalledWith('b1'));
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
    await waitFor(() => expect(mm.respondGuardianLink).toHaveBeenCalledWith('l9', true));
    await fireEvent.press(screen.getByLabelText('What your guardian sees'));
    expect(await screen.findByText('4 friends')).toBeTruthy();
    expect(screen.getByText(/Mele was linked as a parent or guardian/)).toBeTruthy();
  });

  it('a new account with no age adds it before taking friend requests', async () => {
    mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: settings({ friend_requests_from: 'nobody' }), minor: status({ age_band: 'not_given', needs_birth: true }) });
    mockRecordBirthMonth.mockResolvedValue('ok');
    await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
    expect(await screen.findByLabelText('Friend requests: Anyone can send')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Birth month: Mar'));
    await fireEvent.changeText(screen.getByLabelText('Birth year'), '2001');
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
