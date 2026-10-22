/** MULTISPORT-01: recorded tags are corrected in the existing Highlights desk with retained, confirmed drafts. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HighlightSportPanel } from '@/components/Admin/HighlightSportPanel';
import { fetchAdminHighlightSport, saveAdminHighlightSport } from '@/lib/athleteSports';
const mockReloadCatalog=jest.fn();
let mockChoices={sportNames:['Football','Basketball'],status:'ready'};
jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()}),Link:({children}:any)=>children}));
jest.mock('@/context/AppRuntimeContext',()=>({useAppRuntime:()=>({live:require('@/lib/runtime').DEFAULT_APP_RUNTIME})}));
jest.mock('@/context/AuthContext',()=>({useAuth:()=>({user:{id:'admin-a'},isAdmin:true})}));
jest.mock('@/hooks/useStoredSportChoices',()=>({useStoredSportChoices:()=>({...mockChoices,reload:mockReloadCatalog})}));
jest.mock('@/lib/athleteSports',()=>({fetchAdminHighlightSport:jest.fn(),saveAdminHighlightSport:jest.fn()}));
beforeEach(()=>{jest.clearAllMocks();mockChoices={sportNames:['Football','Basketball'],status:'ready'};jest.mocked(fetchAdminHighlightSport).mockResolvedValue({id:'reel-a',sport:'Football'});jest.mocked(saveAdminHighlightSport).mockImplementation(async(id,sport)=>({id,sport}));});
it('uses original recorded sport as its revision and can explicitly clear the tag',async()=>{
 await render(<HighlightSportPanel reelId="reel-a"/>);await screen.findByText('Recorded: Football');await fireEvent.press(screen.getByRole('button',{name:'Leave sport unassigned'}));await fireEvent.press(screen.getByRole('button',{name:'Save recorded sport'}));
 expect(saveAdminHighlightSport).toHaveBeenCalledWith('reel-a',null,'Football');expect(await screen.findByText('Recorded sport saved.')).toBeTruthy();
});
it('locks competing tag choices and retains the requested sport after a conflict',async()=>{
 let fail!:(error:Error)=>void;jest.mocked(saveAdminHighlightSport).mockImplementation(()=>new Promise((_,reject)=>{fail=reject;}));await render(<HighlightSportPanel reelId="reel-a"/>);await screen.findByText('Recorded: Football');await fireEvent.press(screen.getByRole('button',{name:'Set recorded sport Basketball'}));await fireEvent.press(screen.getByRole('button',{name:'Save recorded sport'}));
 expect(screen.getByRole('button',{name:'Set recorded sport Football'})).toBeDisabled();await act(async()=>fail(new Error('Recorded sport changed. Reload.')));expect(await screen.findByText('Draft: Basketball')).toBeTruthy();expect(screen.getByText('Recorded sport changed. Reload.')).toBeTruthy();
});
it('cannot restore an old reel result after the selection changes',async()=>{
 let old!:(value:{id:string,sport:string|null})=>void;jest.mocked(fetchAdminHighlightSport).mockImplementationOnce(()=>new Promise(resolve=>{old=resolve;})).mockResolvedValue({id:'reel-b',sport:'Basketball'});const view=await render(<HighlightSportPanel reelId="reel-a"/>);await view.rerender(<HighlightSportPanel reelId="reel-b"/>);await screen.findByText('Recorded: Basketball');await act(async()=>old({id:'reel-a',sport:'Football'}));expect(screen.queryByText('Recorded: Football')).toBeNull();
});
it('keeps unavailable data distinct from an unassigned sport',async()=>{
 jest.mocked(fetchAdminHighlightSport).mockRejectedValue(new Error('This control is not switched on yet.'));await render(<HighlightSportPanel reelId="reel-a"/>);expect(await screen.findByText('This control is not switched on yet.')).toBeTruthy();expect(screen.getByRole('button',{name:'Save recorded sport'})).toBeDisabled();expect(screen.queryByText('Recorded: Unassigned')).toBeNull();
});

it('keeps a selected correction when catalog fails and still permits explicitly clearing it',async()=>{
 const view=await render(<HighlightSportPanel reelId="reel-a"/>);await screen.findByText('Recorded: Football');await fireEvent.press(screen.getByRole('button',{name:'Set recorded sport Basketball'}));mockChoices={sportNames:[],status:'unavailable'};await view.rerender(<HighlightSportPanel reelId="reel-a"/>);
 expect(screen.getByText('Draft: Basketball')).toBeTruthy();expect(screen.getByRole('button',{name:'Save recorded sport'})).toBeDisabled();
 await fireEvent.press(screen.getByRole('button',{name:'Leave sport unassigned'}));await fireEvent.press(screen.getByRole('button',{name:'Save recorded sport'}));expect(saveAdminHighlightSport).toHaveBeenCalledWith('reel-a',null,'Football');
});
it('an empty published catalog does not advertise starter tags',async()=>{
 mockChoices={sportNames:[],status:'ready'};await render(<HighlightSportPanel reelId="reel-a"/>);await screen.findByText('Recorded: Football');expect(screen.queryByRole('button',{name:'Set recorded sport Basketball'})).toBeNull();
});

it('retries published sports without losing the requested recorded correction',async()=>{
 const view=await render(<HighlightSportPanel reelId="reel-a"/>);await screen.findByText('Recorded: Football');await fireEvent.press(screen.getByRole('button',{name:'Set recorded sport Basketball'}));mockChoices={sportNames:[],status:'unavailable'};await view.rerender(<HighlightSportPanel reelId="reel-a"/>);
 await fireEvent.press(screen.getByRole('button',{name:'Reload published sports'}));expect(mockReloadCatalog).toHaveBeenCalledTimes(1);mockChoices={sportNames:['Football','Basketball'],status:'ready'};await view.rerender(<HighlightSportPanel reelId="reel-a"/>);expect(screen.getByText('Draft: Basketball')).toBeTruthy();expect(screen.getByRole('button',{name:'Save recorded sport'})).toBeEnabled();
});
