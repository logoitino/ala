/** GUEST-ACCESS-01 preview has a real last step, retry, legal access and no fourth free clip. Playback is mocked, not device acceptance. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { GuestHighlightsPreview } from '@/components/Auth/GuestHighlightsPreview';
const mockRead=jest.fn(),mockRequire=jest.fn(),mockPause=jest.fn(),mockPlay=jest.fn();
jest.mock('@/lib/guestPreview',()=>({fetchGuestHighlightPreview:()=>mockRead()}));
jest.mock('@/context/SoftWallContext',()=>({useSoftWall:()=>({requireAuth:mockRequire})}));
jest.mock('@/components/UI/BrandMark',()=>({BrandMark:()=>null}));
jest.mock('@/components/Legal/LegalModal',()=>({LegalModal:()=>{const {Text}=require('react-native');return <Text>Guest legal information</Text>;}}));
jest.mock('expo-video',()=>({useVideoPlayer:()=>({pause:mockPause,play:mockPlay}),VideoView:'VideoView'}));
jest.mock('expo-router',()=>({useFocusEffect:(cb:()=>unknown)=>require('react').useEffect(cb,[])}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
const clips=Array.from({length:3},(_,i)=>({id:'clip'+i,video_url:'https://example.invalid/'+i,title:'Preview '+i,created_at:'2026-11-25'}));
beforeEach(()=>{jest.clearAllMocks();mockRead.mockResolvedValue(clips);});
it('only three preview steps are available, then the account action',async()=>{await render(<GuestHighlightsPreview />);await waitFor(()=>expect(screen.getByText('Highlight 1 of 3')).toBeTruthy());await fireEvent.press(screen.getByRole('button',{name:'Next preview Highlight'}));await fireEvent.press(screen.getByRole('button',{name:'Next preview Highlight'}));expect(screen.getByText('Highlight 3 of 3')).toBeTruthy();expect(screen.queryByRole('button',{name:'Next preview Highlight'})).toBeNull();await fireEvent.press(screen.getByRole('button',{name:'Continue with an account'}));expect(mockRequire).toHaveBeenCalledWith(expect.objectContaining({kind:'browse'}));});
it('failed preview gives retry without opening another source',async()=>{mockRead.mockRejectedValueOnce(new Error('missing source'));await render(<GuestHighlightsPreview />);await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());await fireEvent.press(screen.getByRole('button',{name:'Retry Highlights preview'}));await waitFor(()=>expect(screen.getByText('Highlight 1 of 3')).toBeTruthy());expect(mockRead).toHaveBeenCalledTimes(2);});
it('legal notices are accessible before account creation',async()=>{await render(<GuestHighlightsPreview />);await fireEvent.press(screen.getByRole('button',{name:'Terms and privacy'}));expect(screen.getByText('Guest legal information')).toBeTruthy();expect(mockRequire).not.toHaveBeenCalled();});
