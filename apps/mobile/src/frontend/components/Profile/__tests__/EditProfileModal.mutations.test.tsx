/** UX-13 profile mutation integration: denied writes and expired UI/account frames never publish success or close another account's sheet. Synthetic Auth only. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { EditProfileModal } from '@/components/Profile/EditProfileModal';
const mockAuth = { profile: { id: 'owner-a', full_name: 'Malia', username: null, bio: null, social_links: {}, profile_visibility: {} }, user: { id: 'owner-a' }, isAthlete: false, isSessionCurrent: () => true, updateProfile: jest.fn(async (_patch: unknown) => {}) };
const mockToast = jest.fn();
const mockPlayOpen = jest.fn();
const mockPlayClose = jest.fn((done: () => void) => done());
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/CelebrationContext', () => ({ useCelebration: () => ({ showToast: mockToast }) }));
jest.mock('@/hooks/useFanSheetMotion', () => ({ useFanSheetMotion: () => ({ sheetStyle: {}, backdropStyle: {}, playOpen: mockPlayOpen, playClose: mockPlayClose }) }));
jest.mock('@/hooks/useAthleteSports', () => ({ useAthleteSports: () => ({ snapshot: null }) }));
jest.mock('@/lib/privacy', () => ({ fetchMyPrivacy: jest.fn(async () => ({})) }));
jest.mock('@/components/Profile/FunFactShare', () => ({ FunFactShare: () => null }));
jest.mock('@/components/Profile/MySportsModal', () => ({ MySportsModal: () => null }));
jest.mock('expo-blur', () => ({ BlurView: require('react-native').View }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
beforeEach(() => { jest.clearAllMocks(); mockAuth.profile.id = 'owner-a'; mockAuth.user.id = 'owner-a'; mockAuth.isSessionCurrent = () => true; mockAuth.updateProfile.mockReset().mockResolvedValue(undefined); mockPlayClose.mockReset().mockImplementation(done => done()); });
it('keeps the form open with friendly feedback when the write is denied', async () => {
  mockAuth.updateProfile.mockRejectedValue(new Error('backend refused write'));
  const onClose = jest.fn(); await render(<EditProfileModal visible onClose={onClose} />);
  await fireEvent.press(screen.getByLabelText('Save profile'));
  expect(screen.getByText("Couldn't save your profile. Please try again.")).toBeTruthy();
  expect(mockToast).not.toHaveBeenCalledWith('Profile updated ✅'); expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Save profile')).toBeEnabled();
});
it('a confirmed same-account save publishes success and closes once', async () => {
  const onClose=jest.fn(); await render(<EditProfileModal visible onClose={onClose}/>);
  await fireEvent.press(screen.getByLabelText('Save profile'));
  expect(mockAuth.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ full_name:'Malia' }));
  expect(mockToast).toHaveBeenCalledWith('Profile updated ✅'); expect(onClose).toHaveBeenCalledTimes(1);
});
it('an ABA account lifetime change suppresses a late resolved save', async () => {
  let release!: () => void; let originalCurrent=true;
  mockAuth.isSessionCurrent=()=>originalCurrent;
  mockAuth.updateProfile.mockImplementation(()=>new Promise<void>(done=>{ release=done; }));
  const onClose=jest.fn(); const view=await render(<EditProfileModal visible onClose={onClose}/>);
  await fireEvent.press(screen.getByLabelText('Save profile')); originalCurrent=false; mockAuth.isSessionCurrent=()=>true;
  await view.rerender(<EditProfileModal visible onClose={onClose}/>); await act(async()=>release());
  expect(mockToast).not.toHaveBeenCalledWith('Profile updated ✅'); expect(onClose).not.toHaveBeenCalled();
});
it('deferred close completion cannot close a later account frame', async () => {
  let finish!: () => void; mockPlayClose.mockImplementation(done=>{ finish=done; });
  const onClose=jest.fn(); const view=await render(<EditProfileModal visible onClose={onClose}/>);
  await fireEvent.press(screen.getByLabelText('Save profile')); mockAuth.profile.id='owner-b'; mockAuth.user.id='owner-b';
  await view.rerender(<EditProfileModal visible onClose={onClose}/>); await act(async()=>finish());
  expect(onClose).not.toHaveBeenCalled();
});
