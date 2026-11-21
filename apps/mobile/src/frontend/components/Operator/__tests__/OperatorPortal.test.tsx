import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import OperatorPortal from '../../../../../app/operator/index';
let mockPin:any;let mockLive=true;let mockAuth:any;const mockClaim=jest.fn();const mockClient=jest.fn();const mockLocation=jest.fn();const mockPush=jest.fn();
const game={id:'game-A',home_team:'Synthetic Home',away_team:'Synthetic Away',venue:'Synthetic Venue'};
jest.mock('expo-router',()=>({useRouter:()=>({push:mockPush}),Stack:{Screen:()=>null}}));
jest.mock('expo-location',()=>({requestForegroundPermissionsAsync:(...a:unknown[])=>mockLocation(...a),getCurrentPositionAsync:async()=>({coords:{latitude:40,longitude:-111}})}));
jest.mock('@/context/AuthContext',()=>({useAuth:()=>mockAuth}));
jest.mock('@/context/AppRuntimeContext',()=>({useAppRuntime:()=>({live:{copy:{},layouts:{}}})}));
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:true}));
jest.mock('@/services/TelemetryManager',()=>({telemetry:{trackFeature:jest.fn()}}));
jest.mock('@/services/OfflineQueue',()=>({offlineQueue:{captureActor:()=>({userId:'A',isCurrent:()=>mockLive})}}));
jest.mock('@/lib/offlineActor',()=>({...jest.requireActual('@/lib/offlineActor'),createOfflineActorClient:(...a:unknown[])=>mockClient(...a)}));
jest.mock('@/lib/operator',()=>({OPERATOR_TEST_PIN:'1234',claimOperatorGame:(...a:unknown[])=>mockClaim(...a),fetchOperatorGames:async()=>({games:[game],error:null}),subscribeOperatorGames:()=>()=>{},saveOperatorCheckIn:async()=>({ok:true})}));
jest.mock('@/components/Operator/PINClaimModal',()=>({PINClaimModal:(props:any)=>{mockPin=props;return null}}));
jest.mock('@/components/ScreenShell',()=>({ScreenShell:({children}:any)=>children}));
jest.mock('@/components/ScreenHeading',()=>({ScreenHeading:()=>null}));
jest.mock('@/components/FamilyFun/FamilyFunDiscovery',()=>({FamilyFunDiscovery:()=>null}));
jest.mock('@/components/Spotlight/TagConfirmList',()=>({TagConfirmList:()=>null}));
jest.mock('@/hooks/usePendingPlayerTags',()=>({usePendingPlayerTags:()=>({tags:[],resolve:jest.fn()})}));
function pending<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve}}
beforeEach(()=>{mockLive=true;mockAuth={profile:{id:'profile-A',user_id:'A'},user:{id:'A'},isSessionCurrent:()=>mockLive};mockClaim.mockReset();mockClient.mockReset().mockResolvedValue('bound-A');mockLocation.mockReset().mockResolvedValue({status:'granted'});mockPush.mockReset()});
async function selected(){await render(<OperatorPortal/>);await fireEvent.press(await screen.findByLabelText('Synthetic Home versus Synthetic Away at Synthetic Venue'))}
it('hands PIN a real awaited claim promise and preserves its rejection',async()=>{const later=pending<void>();mockClaim.mockReturnValue(later.promise);await selected();let task!:Promise<void>;await act(async()=>{task=mockPin.onUnlock()});expect(task).toBeInstanceOf(Promise);await act(async()=>{later.resolve();await task});expect(mockClaim).toHaveBeenCalledWith('game-A','profile-A','bound-A',expect.objectContaining({userId:'A'}))});
it('refuses a claim whose actor leaves during bound-client setup',async()=>{const later=pending<unknown>();await selected();mockClient.mockReturnValue(later.promise);let task!:Promise<unknown>;await act(async()=>{task=mockPin.onUnlock().catch((e:unknown)=>e)});mockLive=false;await act(async()=>{later.resolve('bound-A');await task});expect(mockClaim).not.toHaveBeenCalled();expect(mockPush).not.toHaveBeenCalled()});
it('does not navigate on an outgoing issued claim after account change',async()=>{const later=pending<void>();mockClaim.mockReturnValue(later.promise);await selected();let task!:Promise<void>;await act(async()=>{task=mockPin.onUnlock();await Promise.resolve()});mockLive=false;await act(async()=>{later.resolve();await task.catch(()=>undefined)});expect(mockPush).not.toHaveBeenCalled()});
it('shows permission lookup rejection as a retryable GPS failure',async()=>{const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});mockLocation.mockRejectedValue(new Error('Synthetic location failure'));await selected();await fireEvent.press(screen.getByLabelText('Check in at venue'));expect(alert).toHaveBeenCalledWith('Check-in not saved','Synthetic location failure');alert.mockRestore()});
