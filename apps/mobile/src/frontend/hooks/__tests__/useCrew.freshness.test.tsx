/** Crew state and mutations follow one signed-in owner and athlete lifetime. */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCrew } from '@/hooks/useCrew';
const mockFetch = jest.fn(), mockSet = jest.fn();
let mockUser='A', mockGeneration=0, mockCaptureAvailable=true;
let mockGuard = () => true;
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user:mockUser?{id:mockUser}:null,isSessionCurrent:mockGuard }) }));
jest.mock('@/lib/crew', () => ({ fetchCrewGraph: (...args:unknown[])=>mockFetch(...args), setCrewFollow:(...args:unknown[])=>mockSet(...args) }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue:{ captureActor:()=>{if(!mockCaptureAvailable || !mockUser)return null;const id=mockUser,g=mockGeneration;return {userId:id,isCurrent:()=>id===mockUser&&g===mockGeneration};} } }));
jest.mock('@/lib/offlineActor', () => ({ createOfflineActorClient: async()=>({}), assertCurrent:(actor:{isCurrent:()=>boolean})=>{if(!actor.isCurrent())throw new Error('Account changed');} }));
const empty={crew_count:0,squad_count:0,following:false,mutual:false};
beforeEach(()=>{jest.clearAllMocks();mockUser='A';mockGeneration=0;mockCaptureAvailable=true;mockGuard=()=>true;mockFetch.mockResolvedValue(empty);mockSet.mockResolvedValue({...empty,following:true});});
it('refuses a delayed A read after B and after A signs in again',async()=>{
 let release!:(value:unknown)=>void;
 mockFetch.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
 const {result,rerender}=await renderHook(()=>useCrew('athlete'));
 await waitFor(()=>expect(mockFetch).toHaveBeenCalled());
 mockUser='B';mockGeneration++;await rerender({});
 mockUser='A';mockGeneration++;await rerender({});
 await act(async()=>release({...empty,following:true}));
 expect(result.current.following).toBe(false);
});
it('refuses a retained old-owner toggle callback',async()=>{
 const {result,rerender}=await renderHook(()=>useCrew('athlete'));
 await waitFor(()=>expect(result.current.loading).toBe(false));
 const old=result.current.toggle;
 mockUser='B';mockGeneration++;await rerender({});
 await act(async()=>{await old();});
 expect(mockSet).not.toHaveBeenCalled();
});

it('masks already-loaded follow state when A→B→A is batched into one render',async()=>{
 mockFetch.mockResolvedValueOnce({...empty,following:true});
 const {result,rerender}=await renderHook(()=>useCrew('athlete'));
 await waitFor(()=>expect(result.current.following).toBe(true));
 let release!:(value:unknown)=>void;
 mockFetch.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
 mockGeneration+=2;mockGuard=()=>true;
 await rerender({});
 expect(result.current.following).toBe(false);
 await act(async()=>release(empty));
});

it('exposes a failed Crew load for Retry and does not act on unknown membership', async () => {
 mockFetch.mockRejectedValueOnce(new Error('Crew unavailable'));
 const { result } = await renderHook(() => useCrew('athlete'));
 await waitFor(() => expect(result.current.loading).toBe(false));
 expect(result.current.error).toMatch(/Crew/);
 await act(async () => { await result.current.toggle(); });
 expect(mockSet).not.toHaveBeenCalled();
 await act(async () => { await result.current.refresh(); });
 expect(result.current.error).toBeNull();
 await act(async () => { await result.current.toggle(); });
 expect(mockSet).toHaveBeenCalledTimes(1);
});

it('refuses a retained refresh as soon as its Auth guard becomes false, before a consumer rerender', async () => {
 let active = true; mockGuard = () => active;
 const { result } = await renderHook(() => useCrew('athlete'));
 await waitFor(() => expect(result.current.loading).toBe(false));
 const reads = mockFetch.mock.calls.length;
 active = false;
 await act(async () => { await result.current.refresh(); });
 expect(mockFetch).toHaveBeenCalledTimes(reads);
});
it('never sends a signed-in read through the global client when actor capture is unavailable', async () => {
 mockCaptureAvailable = false;
 const { result } = await renderHook(() => useCrew('athlete'));
 await waitFor(() => expect(result.current.loading).toBe(false));
 expect(mockFetch).not.toHaveBeenCalled();
 expect(result.current.error).toMatch(/account changed/);
});

it('does not adopt B when a guest resume waits for the first signed-in A Crew read', async () => {
 mockUser = '';
 const { result, rerender } = await renderHook(() => useCrew('athlete'));
 await waitFor(() => expect(result.current.loading).toBe(false));
 const resume = result.current.resumeGuestJoin;
 let release!: (value: typeof empty) => void;
 mockFetch.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
 mockUser = 'A'; mockGeneration++; mockGuard = () => true;
 await rerender({});
 await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
 await act(async () => resume());
 mockUser = 'B'; mockGeneration++; mockGuard = () => true;
 await rerender({});
 await waitFor(() => expect(result.current.loading).toBe(false));
 expect(mockSet).not.toHaveBeenCalled();
 await act(async () => release(empty));
 expect(mockSet).not.toHaveBeenCalled();
});

it('preserves guest resume when the queue binds A before the Auth consumer renders A', async () => {
 mockUser = '';
 const { result, rerender } = await renderHook(() => useCrew('athlete'));
 await waitFor(() => expect(result.current.loading).toBe(false));
 const resume = result.current.resumeGuestJoin;
 mockUser = 'A'; mockGeneration++; mockGuard = () => true;
 await act(async () => resume());
 expect(mockSet).not.toHaveBeenCalled();
 await rerender({});
 await waitFor(() => expect(mockSet).toHaveBeenCalledTimes(1));
 expect(mockSet).toHaveBeenCalledWith('athlete', 'A', true, expect.objectContaining({ userId: 'A' }));
});
