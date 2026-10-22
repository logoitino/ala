/** Fan-bar routing/visibility: four destinations around Upload; Beyond and Local open from the Highlights pill row (owner 2026-10-16). */
import {render,screen,fireEvent} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import type {BottomTabBarProps} from 'expo-router/tabs';
import {FanTabBar} from '../FanTabBar';
import {cloneAppRuntime,DEFAULT_APP_RUNTIME} from '@/lib/runtime';
const mockNavigate=jest.fn(),mockEmit=jest.fn(()=>({defaultPrevented:false})),mockUpload=jest.fn();
const mockRestore=jest.fn();
let mockSoftened=false, mockReduceTransparency=false;
let mockLive=cloneAppRuntime(DEFAULT_APP_RUNTIME);
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@/context/AppRuntimeContext',()=>({useAppRuntime:()=>({live:mockLive})}));
jest.mock('@/context/UploadSheetContext',()=>({useUploadSheet:()=>({openUpload:mockUpload})}));
jest.mock('@/context/FanNavigationContext',()=>({useFanNavigation:()=>({restore:mockRestore}),useFanDockSoftened:()=>mockSoftened}));
jest.mock('@/hooks/useReduceTransparency',()=>({useReduceTransparency:()=>mockReduceTransparency}));
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:false,supabase:{}}));
const props={state:{index:0,routes:['index','beyond','activity','spotlight','drip','profile','local'].map(name=>({name,key:name}))},emitter:{emit:mockEmit},navigateToTab:mockNavigate,insets:{top:0,right:0,left:0,bottom:0},descriptors:{}} as unknown as BottomTabBarProps;
beforeEach(()=>{mockLive=cloneAppRuntime(DEFAULT_APP_RUNTIME);mockLive.tabs.drip=true;mockSoftened=false;mockReduceTransparency=false;jest.clearAllMocks();});
it('softens only its backdrop while every destination and Upload stay visible and opaque',async()=>{
 mockSoftened=true;
 await render(<FanTabBar {...props}/>);
 expect(StyleSheet.flatten(screen.getByTestId('fan-dock-backdrop').props.style).opacity).toBeLessThan(1);
 for(const tab of screen.getAllByRole('tab')) expect(StyleSheet.flatten(tab.props.style).opacity).toBe(1);
 expect(screen.getByText('Upload')).toBeTruthy();
 await fireEvent.press(screen.getByRole('tab',{name:'Home'}));
 expect(mockRestore).toHaveBeenCalled();
});
it('uses an opaque backdrop when Reduce Transparency is enabled even during downward scroll',async()=>{
 mockSoftened=true;mockReduceTransparency=true;
 await render(<FanTabBar {...props}/>);
 expect(StyleSheet.flatten(screen.getByTestId('fan-dock-backdrop').props.style).opacity).toBe(1);
 expect(screen.getAllByRole('tab')).toHaveLength(4);
});
it('restores the backdrop when keyboard focus reaches a dock control', async () => {
 mockSoftened=true;
 await render(<FanTabBar {...props}/>);
 mockRestore.mockClear();
 await fireEvent(screen.getByRole('tab',{name:'Activity'}),'focus');
 expect(mockRestore).toHaveBeenCalledTimes(1);
 await fireEvent(screen.getByLabelText('Upload'),'focus');
 expect(mockRestore).toHaveBeenCalledTimes(2);
});
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
it('preserves prevented tab presses and focused-tab stack events', async () => {
 await render(<FanTabBar {...props}/>);
 mockEmit.mockReturnValueOnce({ defaultPrevented: true });
 await fireEvent.press(screen.getByRole('tab', { name: 'Activity' }));
 expect(mockNavigate).not.toHaveBeenCalled();
 expect(mockEmit).toHaveBeenCalledWith({ type: 'tabPress', target: 'activity', canPreventDefault: true });
 await fireEvent.press(screen.getByRole('tab', { name: 'Home', selected: true }));
 expect(mockNavigate).not.toHaveBeenCalled();
 expect(mockEmit).toHaveBeenLastCalledWith({ type: 'tabPress', target: 'index', canPreventDefault: true });
});
