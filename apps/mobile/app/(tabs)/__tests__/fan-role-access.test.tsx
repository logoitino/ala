/** Any supported fan capability reaches the fan destinations (Beyond via the Highlights pill); domain HQ gates remain narrowly authorized. SDK58 shared fan presentation reads the route pathname from this boundary. */
import {render,screen} from '@testing-library/react-native';
import {Text} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
const safeMetrics={frame:{x:0,y:0,width:390,height:844},insets:{top:0,right:0,left:0,bottom:34}};
import FanTabsLayout from '../_layout';
import {RoleGate} from '@/context/RoleGate';
let mockRole='parent';
jest.mock('@/context/AuthContext',()=>({useAuth:()=>({role:mockRole,roles:[mockRole],loading:false})}));
jest.mock('expo-router',()=>{const {Text}=require('react-native');const Tabs=()=> <Text>Fan destinations</Text>;Tabs.Screen=()=>null;return {usePathname:()=> '/',Tabs,Redirect:()=> <Text>Role redirect</Text>};});
jest.mock('@/components/UI/FanTabBar',()=>({FanTabBar:()=>null}));
jest.mock('@/components/Reels/UploadVideoModal',()=>({UploadVideoModal:()=>null}));
jest.mock('@/components/Reels/UploadChoiceSheet',()=>({UploadChoiceSheet:()=>null}));
jest.mock('@/context/UploadSheetContext',()=>({useUploadSheet:()=>({visible:false})}));
jest.mock('@/context/AppRuntimeContext',()=>({useAppRuntime:()=>({live:jest.requireActual('@/lib/runtime').DEFAULT_APP_RUNTIME})}));
jest.mock('@/hooks/useRoster',()=>({useRoster:()=>({players:[]})}));
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:false,supabase:{}}));
it.each(['parent','operator','booster','sponsor','fan','athlete','guest','admin'])('lets %s reach the fan destinations',async role=>{mockRole=role;await render(<SafeAreaProvider initialMetrics={safeMetrics}><FanTabsLayout/></SafeAreaProvider>);expect(screen.getByText('Fan destinations')).toBeTruthy();expect(screen.queryByText('Role redirect')).toBeNull();});
it('keeps the admin domain gate closed to a parent',async()=>{mockRole='parent';await render(<RoleGate allow={['admin']}><Text>Admin domain</Text></RoleGate>);expect(screen.queryByText('Admin domain')).toBeNull();expect(screen.getByText('Role redirect')).toBeTruthy();});
