/** Crew state and mutations follow one signed-in owner and athlete lifetime. */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCrew } from '@/hooks/useCrew';
const mockFetch = jest.fn(), mockSet = jest.fn();
let mockUser='A', mockGeneration=0;
let mockGuard = () => true;
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user:{id:mockUser},isSessionCurrent:mockGuard }) }));
jest.mock('@/lib/crew', () => ({ fetchCrewGraph: (...args:unknown[])=>mockFetch(...args), setCrewFollow:(...args:unknown[])=>mockSet(...args) }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue:{ captureActor:()=>{const id=mockUser,g=mockGeneration;return {userId:id,isCurrent:()=>id===mockUser&&g===mockGeneration};} } }));
jest.mock('@/lib/offlineActor', () => ({ createOfflineActorClient: async()=>({}), assertCurrent:(actor:{isCurrent:()=>boolean})=>{if(!actor.isCurrent())throw new Error('Account changed');} }));
const empty={crew_count:0,squad_count:0,following:false,mutual:false};
beforeEach(()=>{jest.clearAllMocks();mockUser='A';mockGeneration=0;mockGuard=()=>true;mockFetch.mockResolvedValue(empty);mockSet.mockResolvedValue({...empty,following:true});});
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
