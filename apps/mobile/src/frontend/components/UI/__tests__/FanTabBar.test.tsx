/** Fan-bar routing/visibility: four destinations around Upload; Beyond and Local open from the Highlights pill row (owner 2026-10-16). */
import {render,screen,fireEvent,within} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import type {BottomTabBarProps} from 'expo-router/tabs';
import {FanTabBar} from '../FanTabBar';
import {cloneAppRuntime,DEFAULT_APP_RUNTIME} from '@/lib/runtime';
import {colors} from '@/constants/theme';
import {FOCAL} from '@/theme/motion';
import * as Reanimated from 'react-native-reanimated';
const mockNavigate=jest.fn(),mockEmit=jest.fn(()=>({defaultPrevented:false})),mockUpload=jest.fn();
const mockRestore=jest.fn(), mockMeasure=jest.fn();
let mockSoftened=false, mockReduceTransparency=false, mockReduceMotion=false;
let mockLive=cloneAppRuntime(DEFAULT_APP_RUNTIME);
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-blur',()=>{const {View:MockView}=jest.requireActual('react-native');return {BlurView:(p:object)=><MockView testID="fan-dock-blur" {...p}/>};});
jest.mock('@/context/AppRuntimeContext',()=>({useAppRuntime:()=>({live:mockLive})}));
jest.mock('@/context/UploadSheetContext',()=>({useUploadSheet:()=>({openUpload:mockUpload})}));
jest.mock('@/context/FanNavigationContext',()=>({useFanNavigation:()=>({restore:mockRestore}),useFanDockSoftened:()=>mockSoftened,useMeasureFanDock:()=>mockMeasure}));
jest.mock('@/hooks/useReduceTransparency',()=>({useReduceTransparency:()=>mockReduceTransparency}));
jest.mock('@/hooks/useReduceMotion',()=>({useReduceMotion:()=>mockReduceMotion}));
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:false,supabase:{}}));
const props={state:{index:0,routes:['index','beyond','activity','spotlight','drip','profile','local'].map(name=>({name,key:name}))},emitter:{emit:mockEmit},navigateToTab:mockNavigate,insets:{top:0,right:0,left:0,bottom:0},descriptors:{}} as unknown as BottomTabBarProps;
beforeEach(()=>{mockLive=cloneAppRuntime(DEFAULT_APP_RUNTIME);mockLive.tabs.drip=true;mockSoftened=false;mockReduceTransparency=false;mockReduceMotion=false;jest.clearAllMocks();});
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

it('measures the complete absolute dock wrap including safe footer and enlarged labels', async () => {
 await render(<FanTabBar {...props} insets={{ ...props.insets, bottom: 34 }} />);
 const wrap=screen.getByTestId('fan-dock-wrap');
 expect(StyleSheet.flatten(wrap.props.style)).toMatchObject({ position: 'absolute', bottom: 0, paddingBottom: 34 });
 await fireEvent(wrap,'layout',{nativeEvent:{layout:{height:118,width:390,x:0,y:0}}});
 // UX-19 review I2: the 24pt fade above the bar is reserved too, so scrolled-to-bottom content is never painted over.
 expect(mockMeasure).toHaveBeenCalledWith(142);
});

// UX-19: one continuous frosted bar that adapts to the screen behind it.
const onActivity={...props,state:{...props.state,index:2}} as unknown as BottomTabBarProps;
const tint=()=>StyleSheet.flatten(screen.getByTestId('fan-dock-tint',{includeHiddenElements:true}).props.style);
it('draws one continuous bar: destinations paint no face of their own',async()=>{
 await render(<FanTabBar {...props}/>);
 for(const tab of screen.getAllByRole('tab')){const style=StyleSheet.flatten(tab.props.style);expect(style.backgroundColor).toBeUndefined();expect(style.minHeight).toBe(44);}
});
it('uses dark glass while Home is focused and light glass elsewhere',async()=>{
 const {unmount}=await render(<FanTabBar {...props}/>);
 expect(tint().backgroundColor).toBe(colors.videoSurface);
 await unmount();
 await render(<FanTabBar {...onActivity}/>);
 expect(tint().backgroundColor).toBe(mockLive.theme.surface);
});
it('keeps the solid dark bar without blur under Reduce Transparency on Home',async()=>{
 mockReduceTransparency=true;
 await render(<FanTabBar {...props}/>);
 expect(tint()).toMatchObject({backgroundColor:colors.videoSurface,opacity:1});
});
it('shows the active pill and the fade, also with Reduce Motion',async()=>{
 const {unmount}=await render(<FanTabBar {...props}/>);
 expect(screen.getByTestId('fan-dock-pill',{includeHiddenElements:true})).toBeTruthy();
 expect(screen.getByTestId('fan-dock-fade',{includeHiddenElements:true})).toBeTruthy();
 await unmount();
 mockReduceMotion=true;
 await render(<FanTabBar {...props}/>);
 expect(screen.getByTestId('fan-dock-pill',{includeHiddenElements:true})).toBeTruthy();
});
it('softened backdrop stays at least 0.78 opaque',async()=>{
 mockSoftened=true;
 await render(<FanTabBar {...props}/>);
 expect(StyleSheet.flatten(screen.getByTestId('fan-dock-backdrop').props.style).opacity).toBeGreaterThanOrEqual(0.78);
});
// UX-19 review I1: 12pt captions over bright video need full on-video ink and a denser dark glass.
it('keeps Home labels readable on dark glass, even while softened',async()=>{
 mockSoftened=true;
 await render(<FanTabBar {...props}/>);
 const activity=screen.getByRole('tab',{name:'Activity'});
 expect(StyleSheet.flatten(within(activity).getByText('Activity').props.style).color).toBe(colors.onVideo);
 expect(tint().opacity).toBeGreaterThanOrEqual(0.85);
 expect(StyleSheet.flatten(screen.getByTestId('fan-dock-backdrop').props.style).opacity).toBeGreaterThanOrEqual(0.9);
});

// UX-19 follow-up M1: Reduce Motion must jump the pill (no spring), and Reduce Transparency must render no blur.
const layoutSlots=async()=>{
 for(const name of ['Home','Activity','Spotlight','Profile']){
  const slot=screen.getByRole('tab',{name}).parent!;
  const index=['Home','Activity','Spotlight','Profile'].indexOf(name);
  await fireEvent(slot,'layout',{nativeEvent:{layout:{x:index*78,y:0,width:78,height:44}}});
 }
};
it('slides the pill with a spring normally and jumps it under Reduce Motion',async()=>{
 const spring=jest.spyOn(Reanimated,'withSpring');
 const view=await render(<FanTabBar {...props}/>);
 await layoutSlots();
 spring.mockClear();
 await view.rerender(<FanTabBar {...onActivity}/>);
 expect(spring).toHaveBeenCalled();
 await view.unmount();
 mockReduceMotion=true;
 const reduced=await render(<FanTabBar {...props}/>);
 await layoutSlots();
 spring.mockClear();
 await reduced.rerender(<FanTabBar {...onActivity}/>);
 expect(spring).not.toHaveBeenCalled();
 spring.mockRestore();
});
it('renders no blur layer under Reduce Transparency',async()=>{
 const {unmount}=await render(<FanTabBar {...props}/>);
 expect(screen.queryByTestId('fan-dock-blur',{includeHiddenElements:true})).not.toBeNull();
 await unmount();
 mockReduceTransparency=true;
 await render(<FanTabBar {...props}/>);
 expect(screen.queryByTestId('fan-dock-blur',{includeHiddenElements:true})).toBeNull();
});
// M2: the dark pill derives from the neon jade token.
it('tints the Home pill from the neon jade token',async()=>{
 await render(<FanTabBar {...props}/>);
 expect(StyleSheet.flatten(screen.getByTestId('fan-dock-pill',{includeHiddenElements:true}).props.style).backgroundColor).toBe(`${FOCAL.neonJade}29`);
});
