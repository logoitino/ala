/** QUIZ-05 Privacy sheet "Fun facts" audience: the same control as the other items, shown for athletes when the server
 * has the item; "Everyone" is not offered for 13–15 (the server caps fun facts at friends); the save sends `fun_facts`
 * only when the server returned it. Also the parse / payload rule in lib/privacy. Synthetic data. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { PrivacySettingsSheet } from '@/components/Profile/PrivacySettingsSheet';
import * as minors from '@/lib/minors';
import * as privacy from '@/lib/privacy';

jest.mock('@/lib/privacy', () => ({ ...jest.requireActual('@/lib/privacy'), fetchMyBlocks: jest.fn(async () => []) }));
jest.mock('@/lib/minors', () => ({ ...jest.requireActual('@/lib/minors'), fetchMyPrivacyStatus: jest.fn(), saveMyPrivacyStatus: jest.fn() }));
const mockGuard = () => true;
const mockClient = {};
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: () => ({ userId: 'A', isCurrent: mockGuard }) } }));
jest.mock('@/lib/offlineActor', () => ({ createOfflineActorClient: async () => mockClient }));
let mockAthlete = true;
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'A' }, isSessionCurrent: mockGuard, recordBirthMonth: jest.fn(), isAthlete: mockAthlete }) }));
jest.mock('@/components/Custodial/GuardianSupervisionPanel', () => ({ GuardianSupervisionPanel: () => null }));
const mm = jest.mocked(minors);
const status = (band: string) => minors.parseMinorStatus({ guardian_links_enabled: true, age_band: band });
const withFunFacts = (fun: string) => privacy.parsePrivacy({ account_private: true, audience: { bio: 'friends', fun_facts: fun } });

beforeEach(() => {
  jest.clearAllMocks(); mockAthlete = true;
  mm.saveMyPrivacyStatus.mockImplementation(async (next) => ({ settings: next as privacy.PrivacySettings, minor: null, heldForApproval: [] }));
});

it('parses fun_facts only when the server sends it, and sends it back only then', () => {
  expect(privacy.parsePrivacy({ audience: { bio: 'everyone' } })).not.toHaveProperty('funFacts');
  expect(withFunFacts('only_me').funFacts).toBe('only_me');
  const old = privacy.parsePrivacy({ audience: {} });
  expect((privacy.privacyPayload(old).audience as Record<string, unknown>).fun_facts).toBeUndefined();
  expect((privacy.privacyPayload({ ...old, funFacts: 'friends' }).audience as Record<string, unknown>).fun_facts).toBe('friends');
});

it('an adult athlete chooses Everyone for fun facts and saves it', async () => {
  mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: withFunFacts('friends'), minor: status('adult') });
  await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
  expect(await screen.findByText('Fun facts')).toBeTruthy();
  expect(screen.getByText('Trivia fun facts you share.')).toBeTruthy();
  expect(screen.getByLabelText('Fun facts: Friends').props.accessibilityState).toMatchObject({ selected: true });
  await fireEvent.press(screen.getByLabelText('Fun facts: Everyone'));
  await fireEvent.press(screen.getByLabelText('Save privacy'));
  await waitFor(() => expect(mm.saveMyPrivacyStatus).toHaveBeenCalledWith(expect.objectContaining({ funFacts: 'everyone' }), mockClient));
});

it('13–15: Everyone is not offered (capped at friends) and the sheet says why', async () => {
  mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: withFunFacts('friends'), minor: status('teen_13_15') });
  await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
  expect(await screen.findByText('Trivia fun facts you share. Under 16, fun facts go to friends at most.')).toBeTruthy();
  expect(screen.getByLabelText('Fun facts: Everyone')).toBeDisabled();
  expect(screen.getByLabelText('Fun facts: Friends')).toBeEnabled();
  expect(screen.getByLabelText('Fun facts: Only me')).toBeEnabled();
  // Other items stay the teen's own choice.
  expect(screen.getByLabelText('Bio: Everyone')).toBeEnabled();
});

it('13–15 with a stored Everyone reads as Friends (what the server applies)', async () => {
  mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: withFunFacts('everyone'), minor: status('teen_13_15') });
  await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
  expect((await screen.findByLabelText('Fun facts: Friends')).props.accessibilityState).toMatchObject({ selected: true });
});

it('hidden for non-athletes and on servers without the fun facts item', async () => {
  mockAthlete = false;
  mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: withFunFacts('friends'), minor: status('adult') });
  const view = await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
  expect(await screen.findByLabelText('Bio: Friends')).toBeTruthy();
  expect(screen.queryByText('Fun facts')).toBeNull();
  await view.unmount();
  mockAthlete = true;
  mm.fetchMyPrivacyStatus.mockResolvedValue({ settings: privacy.parsePrivacy({ account_private: true }), minor: status('adult') });
  await render(<PrivacySettingsSheet visible onClose={jest.fn()} />);
  expect(await screen.findByLabelText('Bio: Friends')).toBeTruthy();
  expect(screen.queryByText('Fun facts')).toBeNull();
});
