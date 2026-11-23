/** UX14 actual Sports tool submission races; synthetic helpers and touch boundaries, no hosted writes. */
import { act, render, screen } from '@testing-library/react-native';
import { SportsTool } from '../SportsTool';
let mockAuth = { user: { id: 'admin-A' }, isSessionCurrent: () => true };
const mockRead = jest.fn(); const mockClient = jest.fn(); const mockSave = jest.fn(); const mockDelete = jest.fn(); const mockSeed = jest.fn();
const mockButtons: Record<string, () => void> = {};
const mockSport = { id:'sport-A',sport:'Synthetic Sport',emoji:'ball',isActive:true,sortOrder:0,scoring:[],callouts:[],statFields:[],measurables:[],positions:[],periods:['Q1'],periodLabel:'Quarter',usesClock:false,clockSeconds:0 };
jest.mock('@/context/AuthContext', () => ({ useOptionalAuth: () => mockAuth }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: (id: string) => ({ userId: id, isCurrent: () => mockAuth.user.id === id }) } }));
jest.mock('@/lib/offlineActor', () => ({ ...jest.requireActual('@/lib/offlineActor'), createOfflineActorClient: (...args: unknown[]) => mockClient(...args) }));
jest.mock('@/components/Admin/AthleteSportsTool', () => ({ AthleteSportsTool: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({push:jest.fn()}), useFocusEffect: (fn: () => void) => require('react').useEffect(fn,[fn]) }));
jest.mock('@/lib/sports', () => ({ fetchStoredSportConfigs: (...args:unknown[]) => mockRead(...args), fetchSportUsage: async () => ({}), saveSportConfig: (...args: unknown[]) => mockSave(...args), deleteSportConfig: (...args:unknown[])=>mockDelete(...args), seedSportConfigs: (...args:unknown[])=>mockSeed(...args) }));
jest.mock('@/components/Admin/AdminChrome', () => {
 const React=require('react'); const {Text,View}=jest.requireActual('react-native');
 return { AdminPage:({children,error}:any)=>React.createElement(View,null,error?React.createElement(Text,null,error):null,children), AdminPanel:({children}:any)=>React.createElement(View,null,children),AdminRow:({children}:any)=>React.createElement(View,null,children),AdminNotice:({text}:any)=>React.createElement(Text,null,text),AdminEmpty:()=>null,AdminField:()=>null,AdminPills:()=>null,
 AdminBtn:(props:any)=>{mockButtons[props.label]=props.onPress;return React.createElement(Text,null,props.label)} };
});
function later<T>() { let resolve!: (value:T)=>void; const promise=new Promise<T>(done=>resolve=done);return {promise,resolve}; }
beforeEach(()=>{mockAuth={user:{id:'admin-A'},isSessionCurrent:()=>true};mockRead.mockReset().mockResolvedValue([mockSport]);mockClient.mockReset().mockResolvedValue('bound-A');mockSave.mockReset().mockResolvedValue(mockSport);mockDelete.mockReset().mockResolvedValue(undefined);mockSeed.mockReset().mockResolvedValue(3);});
it('one synchronous flight covers two save callbacks before busy renders', async()=>{
 const saved=later<typeof mockSport>();mockSave.mockReturnValue(saved.promise);await render(<SportsTool/>);await screen.findByText('Edit');await act(async()=>mockButtons.Edit());
 await act(async()=>{mockButtons['Save playbook']();mockButtons['Save playbook']();});expect(mockSave).toHaveBeenCalledTimes(1);await act(async()=>saved.resolve(mockSport));
});
it('refuses a save when its initiating actor leaves before client setup completes', async()=>{
 await render(<SportsTool/>);await screen.findByText('Edit');await act(async()=>mockButtons.Edit());const client=later<string>();mockClient.mockReturnValueOnce(client.promise);
 await act(async()=>mockButtons['Save playbook']());mockAuth={user:{id:'admin-B'},isSessionCurrent:()=>true};await act(async()=>client.resolve('bound-A'));expect(mockSave).not.toHaveBeenCalled();
});

it('a refused save keeps the editor available for a successful explicit retry',async()=>{
 mockSave.mockRejectedValueOnce(new Error('Synthetic save refused')).mockResolvedValueOnce(mockSport);
 await render(<SportsTool/>);await screen.findByText('Edit');await act(async()=>mockButtons.Edit());
 await act(async()=>mockButtons['Save playbook']());expect(await screen.findByText('Synthetic save refused')).toBeTruthy();expect(screen.getByText('Save playbook')).toBeTruthy();
 await act(async()=>mockButtons['Save playbook']());expect(await screen.findByText('Synthetic Sport playbook saved.')).toBeTruthy();expect(mockSave).toHaveBeenCalledTimes(2);
});
it('a delayed outgoing save cannot announce success or close a new account editor',async()=>{
 const saved=later<typeof mockSport>();mockSave.mockReturnValue(saved.promise);
 const view=await render(<SportsTool/>);await screen.findByText('Edit');await act(async()=>mockButtons.Edit());await act(async()=>mockButtons['Save playbook']());
 mockAuth={user:{id:'admin-B'},isSessionCurrent:()=>true};await view.rerender(<SportsTool/>);await screen.findByText('Edit');await act(async()=>mockButtons.Edit());
 await act(async()=>saved.resolve(mockSport));expect(screen.queryByText('Synthetic Sport playbook saved.')).toBeNull();expect(screen.getByText('Save playbook')).toBeTruthy();
});

it('a failed current bound config read is visible and Retry reloads the actual playbook list',async()=>{
 mockRead.mockRejectedValueOnce(new Error('Synthetic sport read denied')).mockResolvedValueOnce([mockSport]);
 await render(<SportsTool/>);expect(await screen.findByText('Synthetic sport read denied')).toBeTruthy();
 await act(async()=>mockButtons['Retry sports']());expect(await screen.findByText('Edit')).toBeTruthy();expect(mockRead).toHaveBeenCalledTimes(2);
});
