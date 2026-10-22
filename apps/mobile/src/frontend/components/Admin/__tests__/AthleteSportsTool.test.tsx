/** MULTISPORT-01: admin revisions, drafts and account/query isolation are checked through real controls. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AthleteSportsTool } from '@/components/Admin/AthleteSportsTool';
import { fetchAdminAthleteSports, saveAthleteSports, type AdminAthleteSportsProfile } from '@/lib/athleteSports';
let mockAccount = 'admin-a';
const mockReloadCatalog=jest.fn();
let mockChoices = { sportNames: ['Football','Basketball'], status: 'ready' };
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), Link: ({children}: any) => children }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: require('@/lib/runtime').DEFAULT_APP_RUNTIME }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockAccount }, isAdmin: true }) }));
jest.mock('@/hooks/useStoredSportChoices', () => ({ useStoredSportChoices: () => ({...mockChoices,reload:mockReloadCatalog}) }));
jest.mock('@/hooks/useTeamSearch', () => ({ useTeamSearch: () => ({ teams: [{id:'school-b',name:'Second School',mascot:'Eagles'}],loading:false }) }));
jest.mock('@/lib/athleteSports', () => ({ fetchAdminAthleteSports:jest.fn(), saveAthleteSports:jest.fn() }));
const athlete: AdminAthleteSportsProfile = { profileId:'athlete-a', fullName:'Ana Player',username:'ana',playerId:null,primarySport:'Football',revision:4,sports:[{sport:'Football',schoolId:'school-a',teamName:'First School',position:'QB',jersey:'7'}] };
beforeEach(() => { jest.clearAllMocks(); mockAccount='admin-a'; mockChoices={sportNames:['Football','Basketball'],status:'ready'}; jest.mocked(fetchAdminAthleteSports).mockResolvedValue([athlete]); jest.mocked(saveAthleteSports).mockImplementation(async(id,primary,sports,revision)=>({profileId:id,primarySport:primary,sports,revision:revision+1})); });
async function edit() { await render(<AthleteSportsTool/>); await fireEvent.press(await screen.findByRole('button',{name:'Edit sports for Ana Player'})); }
it('adds a secondary sport without moving the primary and saves its own school and credentials',async()=>{
 await edit(); await fireEvent.press(screen.getByRole('button',{name:'Add Basketball'}));
 expect(screen.getByText('Football · Primary')).toBeTruthy();
 await fireEvent.changeText(screen.getByLabelText('Basketball position'),'Guard'); await fireEvent.changeText(screen.getByLabelText('Basketball jersey'),'12');
 await fireEvent.press(screen.getByRole('button',{name:'Use Second School for Basketball'}));
 await fireEvent.press(screen.getByRole('button',{name:'Save athlete sports'}));
 await waitFor(()=>expect(saveAthleteSports).toHaveBeenCalledWith('athlete-a','Football',[athlete.sports[0],{sport:'Basketball',schoolId:'school-b',teamName:'Second School',position:'Guard',jersey:'12'}],4));
 expect(await screen.findByText('Athlete sports saved.')).toBeTruthy();
});
it('requires a replacement when removing the primary',async()=>{
 await edit(); await fireEvent.press(screen.getByRole('button',{name:'Add Basketball'})); await fireEvent.press(screen.getByRole('button',{name:'Remove Football'}));
 expect(screen.getByRole('button',{name:'Save athlete sports'})).toBeDisabled();
 await fireEvent.press(screen.getByRole('button',{name:'Make Basketball primary'}));
 await fireEvent.press(screen.getByRole('button',{name:'Save athlete sports'}));
 await waitFor(()=>expect(saveAthleteSports).toHaveBeenCalledWith('athlete-a','Basketball',expect.any(Array),4));
});
it('keeps the exact failed draft and locks all competing actions during a save',async()=>{
 let fail!:(error:Error)=>void; jest.mocked(saveAthleteSports).mockImplementation(()=>new Promise((_,reject)=>{fail=reject;}));
 await edit(); await fireEvent.changeText(screen.getByLabelText('Football position'),'Receiver'); await fireEvent.press(screen.getByRole('button',{name:'Save athlete sports'}));
 expect(screen.getByRole('button',{name:'Find athletes'})).toBeDisabled(); expect(screen.getByRole('button',{name:'Remove Football'})).toBeDisabled(); expect(screen.getByLabelText('Football position').props.editable).toBe(false);
 await act(async()=>fail(new Error('Sports changed. Reload before saving.')));
 expect(await screen.findByText('Sports changed. Reload before saving.')).toBeTruthy(); expect(screen.getByLabelText('Football position').props.value).toBe('Receiver');
});
it('shows missing source explicitly instead of reporting an empty healthy list',async()=>{
 jest.mocked(fetchAdminAthleteSports).mockRejectedValue(new Error('Athlete sports are not switched on.')); await render(<AthleteSportsTool/>);
 expect(await screen.findByText('Athlete sports are not switched on.')).toBeTruthy(); expect(screen.queryByText('No matching athletes.')).toBeNull();
});
it('rejects an earlier search response after a newer one',async()=>{
 let old!:(rows:AdminAthleteSportsProfile[])=>void; jest.mocked(fetchAdminAthleteSports).mockImplementationOnce(()=>new Promise(resolve=>{old=resolve;}));
 await render(<AthleteSportsTool/>); await fireEvent.changeText(screen.getByLabelText('Search athletes'),'new'); await fireEvent.press(screen.getByRole('button',{name:'Find athletes'})); await screen.findByText('Ana Player');
 await act(async()=>old([{...athlete,fullName:'Old private result'}])); expect(screen.queryByText('Old private result')).toBeNull();
});
it('cannot restore an old private result when accounts cycle A to B to A',async()=>{
 let old!:(rows:AdminAthleteSportsProfile[])=>void; jest.mocked(fetchAdminAthleteSports).mockImplementationOnce(()=>new Promise(resolve=>{old=resolve;}));
 const view=await render(<AthleteSportsTool/>); mockAccount='admin-b'; await view.rerender(<AthleteSportsTool/>); await screen.findByText('Ana Player'); mockAccount='admin-a'; mockChoices={sportNames:['Football','Basketball'],status:'ready'}; await view.rerender(<AthleteSportsTool/>);
 await act(async()=>old([{...athlete,fullName:'Old private result'}])); expect(screen.queryByText('Old private result')).toBeNull();
});

it('invalidates a search begun before a confirmed sport save',async()=>{
 let old!:(rows:AdminAthleteSportsProfile[])=>void; await edit();jest.mocked(fetchAdminAthleteSports).mockImplementationOnce(()=>new Promise(resolve=>{old=resolve;}));
 await fireEvent.press(screen.getByRole('button',{name:'Find athletes'}));await fireEvent.press(screen.getByRole('button',{name:'Add Basketball'}));await fireEvent.press(screen.getByRole('button',{name:'Save athlete sports'}));await screen.findByText('Athlete sports saved.');
 await act(async()=>old([athlete]));expect(screen.getByText(/revision 5/)).toBeTruthy();
});

it('an empty published catalog offers no additions but can correct retained participation',async()=>{
 mockChoices={sportNames:[],status:'ready'};await edit();expect(screen.queryByRole('button',{name:'Add Basketball'})).toBeNull();
 await fireEvent.changeText(screen.getByLabelText('Football position'),'Receiver');await fireEvent.press(screen.getByRole('button',{name:'Save athlete sports'}));expect(saveAthleteSports).toHaveBeenCalledWith('athlete-a','Football',expect.arrayContaining([expect.objectContaining({position:'Receiver'})]),4);
});
it('keeps a new sport draft when its catalog becomes unavailable and blocks the save',async()=>{
 const view=await render(<AthleteSportsTool/>);await fireEvent.press(await screen.findByRole('button',{name:'Edit sports for Ana Player'}));await fireEvent.press(screen.getByRole('button',{name:'Add Basketball'}));mockChoices={sportNames:[],status:'unavailable'};await view.rerender(<AthleteSportsTool/>);
 expect(screen.getByText('Basketball')).toBeTruthy();expect(screen.getByRole('button',{name:'Save athlete sports'})).toBeDisabled();expect(saveAthleteSports).not.toHaveBeenCalled();
});

it('retries published sports without losing the current participation draft',async()=>{
 const view=await render(<AthleteSportsTool/>);await fireEvent.press(await screen.findByRole('button',{name:'Edit sports for Ana Player'}));await fireEvent.changeText(screen.getByLabelText('Football position'),'Receiver');mockChoices={sportNames:[],status:'unavailable'};await view.rerender(<AthleteSportsTool/>);
 await fireEvent.press(screen.getByRole('button',{name:'Reload published sports'}));expect(mockReloadCatalog).toHaveBeenCalledTimes(1);mockChoices={sportNames:['Football','Basketball'],status:'ready'};await view.rerender(<AthleteSportsTool/>);expect(screen.getByLabelText('Football position').props.value).toBe('Receiver');expect(screen.getByRole('button',{name:'Save athlete sports'})).toBeEnabled();
});
