/** Compact initial dock clearance yields to measured enlarged content; full-screen Highlights stays intact. */
import { render, screen, fireEvent } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { FanNavigationProvider, useFanDockHeight, useMeasureFanDock } from '@/context/FanNavigationContext';
import { TabScreen } from '@/components/TabScreen';
let mockSafeBottom = 34;
jest.mock('expo-router', () => ({ usePathname: () => '/' }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { theme: { background: '#fff' } } }) }));
jest.mock('@/components/Common/FeatureBoundary', () => ({ FeatureBoundary: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/services/supportRuntime', () => ({ supportFeatureForPath: () => 'highlights' }));
jest.mock('react-native-safe-area-context', () => {
 const { View } = require('react-native');
 return { SafeAreaView: View, useSafeAreaInsets: () => ({ top:0, left:0, right:0, bottom:mockSafeBottom }) };
});
jest.mock('react-native-reanimated', () => {
 const { View } = require('react-native');
 const transition = { duration: () => undefined };
 return { __esModule:true, default:{View}, useReducedMotion:()=>true, FadeIn:transition, FadeOut:transition, FadeInDown:transition };
});
function Probe({ dark = false }: { dark?: boolean }) {
 const height = useFanDockHeight();
 const measure = useMeasureFanDock();
 return <TabScreen dark={dark}><View testID="dock-measure" onLayout={({nativeEvent})=>measure(nativeEvent.layout.height)}><Text>{`clearance:${height}`}</Text></View></TabScreen>;
}
function shell() {
 let node = screen.getByTestId('dock-measure').parent;
 while(node?.parent && !Array.isArray(node.props.edges)) node=node.parent;
 return node!;
}
it('reserves safe initial clearance, then uses actual enlarged dock height without truncating fan content', async () => {
 await render(<FanNavigationProvider><Probe /></FanNavigationProvider>);
 expect(screen.getByText('clearance:78')).toBeTruthy();
 expect(StyleSheet.flatten(shell().props.style).paddingBottom).toBe(78);
 await fireEvent(screen.getByTestId('dock-measure'),'layout',{nativeEvent:{layout:{height:118}}});
 expect(screen.getByText('clearance:118')).toBeTruthy();
 expect(StyleSheet.flatten(shell().props.style).paddingBottom).toBe(118);
 await fireEvent(screen.getByTestId('dock-measure'),'layout',{nativeEvent:{layout:{height:Number.NaN}}});
 expect(screen.getByText('clearance:118')).toBeTruthy();
});
it('dark Highlights keeps full shell height even while its chrome knows the measured dock', async () => {
 await render(<FanNavigationProvider><Probe dark /></FanNavigationProvider>);
 await fireEvent(screen.getByTestId('dock-measure'),'layout',{nativeEvent:{layout:{height:118}}});
 expect(screen.getByText('clearance:118')).toBeTruthy();
 expect(StyleSheet.flatten(shell().props.style).paddingBottom).toBe(0);
});
it('role screens outside fan navigation reserve no dock', async () => {
 await render(<Probe />);
 expect(screen.getByText('clearance:0')).toBeTruthy();
 expect(StyleSheet.flatten(shell().props.style).paddingBottom).toBe(0);
});
