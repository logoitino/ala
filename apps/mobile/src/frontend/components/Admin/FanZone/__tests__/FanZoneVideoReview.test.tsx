/** FUN-01 private-review lifetime regressions: failed, cancelled and backgrounded bytes are never retained. */
import { fireEvent, render, screen, act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { FanZoneVideoReview } from '@/components/Admin/FanZone/FanZoneVideoReview';
import { loadFanZoneVideo } from '@/lib/fanZoneMedia';
import { FUN_IDS } from '@/lib/__tests__/fanZoneFixtures';
jest.mock('@/components/Admin/AdminChrome',()=>{
 const React=require('react');const {Text,Pressable}=require('react-native');return {AdminBtn:({label,onPress,disabled}:{label:string;onPress:()=>void;disabled:boolean})=>React.createElement(Pressable,{accessibilityLabel:label,onPress,disabled},React.createElement(Text,null,label)),AdminNotice:({text}:{text:string})=>text?React.createElement(Text,null,text):null};
});
jest.mock('expo-router',()=>({useFocusEffect:(callback:()=>void)=>{require('react').useEffect(callback,[callback]);}}));
jest.mock('expo-video',()=>({useVideoPlayer:()=>({play:jest.fn(),pause:jest.fn(),addListener:()=>({remove:jest.fn()})}),VideoView:()=>null}));
jest.mock('@/lib/fanZoneMedia',()=>({loadFanZoneVideo:jest.fn()}));
beforeEach(()=>jest.clearAllMocks());
it('shows a fixed private video error without original bearer/path text',async()=>{
 jest.mocked(loadFanZoneVideo).mockRejectedValue(new Error('token=private/path'));await render(<FanZoneVideoReview entryId={FUN_IDS.entry} revision={2}/>);
 await fireEvent.press(screen.getByLabelText('Review private video'));expect(await screen.findByText('Private video is unavailable. Refresh before reviewing this revision.')).toBeTruthy();expect(screen.queryByText(/token=private/)).toBeNull();
});
it('cancels pending load and releases late delivered bytes',async()=>{
 let finish:(result:Awaited<ReturnType<typeof loadFanZoneVideo>>)=>void=()=>{};const release=jest.fn();jest.mocked(loadFanZoneVideo).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 await render(<FanZoneVideoReview entryId={FUN_IDS.entry} revision={2}/>);await fireEvent.press(screen.getByLabelText('Review private video'));await fireEvent.press(screen.getByLabelText('Cancel video load'));
 await act(async()=>finish({source:{uri:'blob:late'},release}));expect(release).toHaveBeenCalledTimes(1);expect(screen.queryByLabelText('Close private video')).toBeNull();
});
it('releases delivered browser bytes on background and unmount without double release',async()=>{
 const release=jest.fn();let background:((state:AppStateStatus)=>void)|undefined;
 jest.spyOn(AppState,'addEventListener').mockImplementation((_type,listener)=>{background=listener;return{remove:jest.fn()};});
 jest.mocked(loadFanZoneVideo).mockResolvedValue({source:{uri:'blob:private'},release});const view=await render(<FanZoneVideoReview entryId={FUN_IDS.entry} revision={2}/>);
 await fireEvent.press(screen.getByLabelText('Review private video'));await screen.findByLabelText('Close private video');await act(()=>background?.('background'));await view.unmount();expect(release).toHaveBeenCalledTimes(1);
 jest.restoreAllMocks();
});
