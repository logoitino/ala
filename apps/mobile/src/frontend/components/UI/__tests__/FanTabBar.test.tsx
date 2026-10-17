/** Fan-bar routing/visibility: four destinations around Upload; Beyond and Local open from the Highlights pill row (owner 2026-10-16). */
import {render,screen,fireEvent} from '@testing-library/react-native';
import type {BottomTabBarProps} from 'expo-router/tabs';
import {FanTabBar} from '../FanTabBar';
import {cloneAppRuntime,DEFAULT_APP_RUNTIME} from '@/lib/runtime';
const mockNavigate=jest.fn(),mockEmit=jest.fn(()=>({defaultPrevented:false})),mockUpload=jest.fn();
let mockLive=cloneAppRuntime(DEFAULT_APP_RUNTIME);
jest.mock('@/context/AppRuntimeContext',()=>({useAppRuntime:()=>({live:mockLive})}));
jest.mock('@/context/UploadSheetContext',()=>({useUploadSheet:()=>({openUpload:mockUpload})}));
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:false,supabase:{}}));
const props={state:{index:0,routes:['index','beyond','activity','spotlight','drip','profile','local'].map(name=>({name,key:name}))},emitter:{emit:mockEmit},navigateToTab:mockNavigate,insets:{top:0,right:0,left:0,bottom:0},descriptors:{}} as unknown as BottomTabBarProps;
beforeEach(()=>{mockLive=cloneAppRuntime(DEFAULT_APP_RUNTIME);mockLive.tabs.drip=true;jest.clearAllMocks();});
it('shows four destinations without Beyond, Drip or Local and keeps the Upload action',async()=>{
 await render(<FanTabBar {...props}/>);
 expect(screen.getAllByRole('tab').map(tab=>tab.props.accessibilityLabel)).toEqual(['Home','Activity','Spotlight','Profile']);
 expect(screen.queryByRole('tab',{name:'Beyond the Game'})).toBeNull();
 expect(screen.queryByRole('tab',{name:'Drip'})).toBeNull();
 await fireEvent.press(screen.getByRole('tab',{name:'Activity'}));expect(mockNavigate).toHaveBeenCalledWith('activity');
 await fireEvent.press(screen.getByLabelText('Upload'));expect(mockUpload).toHaveBeenCalledTimes(1);
});
it('respects published destination/upload disable even with a still-routable Drip screen',async()=>{
 mockLive.tabs.spotlight=false;mockLive.tabs.upload=false;
 await render(<FanTabBar {...props}/>);
 expect(screen.queryByRole('tab',{name:'Spotlight'})).toBeNull();
 expect(screen.queryByRole('tab',{name:'Drip'})).toBeNull();expect(screen.queryByLabelText('Upload')).toBeNull();
 expect(screen.getAllByRole('tab')).toHaveLength(3);
});
