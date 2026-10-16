/** CHAL-01 participant lifetime: synthetic actors, real hook state and deferred reads/actions. */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useChallenges } from '@/hooks/useChallenges';
jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]) }));
const auth = jest.mocked(useAuth);
let mockFocused = true;
const A = { user: { id: '11111111-1111-4111-8111-111111111111' }, profile: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user_id: '11111111-1111-4111-8111-111111111111' }, loading: false };
const B = { user: { id: '22222222-2222-4222-8222-222222222222' }, profile: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', user_id: '22222222-2222-4222-8222-222222222222' }, loading: false };
const setAuth = (value: typeof A) => auth.mockReturnValue(value as ReturnType<typeof useAuth>);
function deferred<T>() { let resolve!: (v:T)=>void; let reject!: (e:Error)=>void; const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject}; }
afterEach(() => jest.restoreAllMocks());
beforeEach(() => { jest.spyOn(AppState,'addEventListener').mockReturnValue({remove:jest.fn()}); mockFocused=true; setAuth(A); Object.defineProperty(AppState,'currentState',{configurable:true,value:'active'}); });
it('discards a late A response and rejects retained A actions after A B A', async () => {
 const old=deferred<string>();const reader=jest.fn().mockReturnValueOnce(old.promise).mockResolvedValue('fresh');
 const h=await renderHook(()=>useChallenges('inbox',true,reader));
 const retained=h.result.current.run;
 setAuth(B);await h.rerender({}); await waitFor(()=>expect(h.result.current.data).toBe('fresh'));
 setAuth(A);await h.rerender({}); await waitFor(()=>expect(reader).toHaveBeenCalledTimes(3));
 const write=jest.fn().mockResolvedValue('saved');await act(async()=>{await retained(write);old.resolve('private A');});
 expect(write).not.toHaveBeenCalled();expect(h.result.current.data).toBe('fresh');
 expect(reader).toHaveBeenLastCalledWith(A.profile.id);
});
it('clears data synchronously on closure or focus loss and does not revive prior callbacks on reopen',async()=>{
 const reader=jest.fn().mockResolvedValue('private');const h=await renderHook(()=>useChallenges('settings',true,reader));
 await waitFor(()=>expect(h.result.current.data).toBe('private'));const old=h.result.current.run;
 setAuth({...A,profile:{...A.profile,age_blocked_at:'2026-10-16T02:00:00Z'}} as typeof A);await h.rerender({});expect(h.result.current.data).toBeNull();
 setAuth(A);await h.rerender({});await waitFor(()=>expect(reader).toHaveBeenCalledTimes(2));
 mockFocused=false;await h.rerender({});expect(h.result.current.data).toBeNull();mockFocused=true;await h.rerender({});await waitFor(()=>expect(reader).toHaveBeenCalledTimes(3));
 const write=jest.fn();await act(async()=>{await old(write);});expect(write).not.toHaveBeenCalled();
});
it('binds to target changes, blocks duplicate writes, and drops a late mutation after incoming actor',async()=>{
 const reader=jest.fn().mockResolvedValue('ready');const h=await renderHook(({target}: {target:string})=>useChallenges(target,true,reader),{initialProps:{target:'r1'}});
 await waitFor(()=>expect(h.result.current.data).toBe('ready'));const old=h.result.current.run;
 await h.rerender({target:'r2'});await waitFor(()=>expect(reader).toHaveBeenCalledTimes(2));const rejected=jest.fn();await act(async()=>{await old(rejected);});expect(rejected).not.toHaveBeenCalled();
 const d=deferred<string>();const write=jest.fn().mockReturnValue(d.promise);let first!:Promise<unknown>;
 await act(async()=>{first=h.result.current.run(write);void h.result.current.run(write);});expect(write).toHaveBeenCalledTimes(1);expect(write).toHaveBeenCalledWith(A.profile.id,expect.any(Function));
 setAuth(B);await h.rerender({target:'r2'});await waitFor(()=>expect(reader).toHaveBeenCalledTimes(3));await act(async()=>{d.resolve('Old saved');await first;});
 expect(h.result.current.notice).toBeNull();expect(reader).toHaveBeenCalledTimes(3);
});
it('clears an uncertain write and requires a successful explicit refresh before a new write',async()=>{
 const reader=jest.fn().mockResolvedValue('ready');const h=await renderHook(()=>useChallenges('x',true,reader));await waitFor(()=>expect(h.result.current.ready).toBe(true));
 const old=h.result.current.run;await act(async()=>{await old(jest.fn().mockRejectedValue(new Error('Reply lost')));});
 expect(h.result.current.data).toBeNull();expect(h.result.current.error).toBe('Reply lost');const next=jest.fn();await act(async()=>{await h.result.current.run(next);});expect(next).not.toHaveBeenCalled();
 reader.mockRejectedValueOnce(new Error('Read failed'));await act(async()=>{await h.result.current.refresh();});expect(h.result.current.data).toBeNull();
 await act(async()=>{await h.result.current.refresh();});expect(h.result.current.ready).toBe(true);await act(async()=>{await old(next);});expect(next).not.toHaveBeenCalled();
});
it('background invalidates pending reads without issuing a background request',async()=>{
 let change!: (s:AppStateStatus)=>void;const spy=jest.spyOn(AppState,'addEventListener').mockImplementation((_event,fn)=>{change=fn;return {remove:jest.fn()};});
 const d=deferred<string>();const reader=jest.fn().mockReturnValueOnce(d.promise).mockResolvedValue('current');const h=await renderHook(()=>useChallenges('x',true,reader));
 await act(async()=>change('background'));await act(async()=>d.resolve('private'));expect(h.result.current.data).toBeNull();expect(reader).toHaveBeenCalledTimes(1);
 await act(async()=>change('active'));await waitFor(()=>expect(h.result.current.data).toBe('current'));await h.unmount();spy.mockRestore();
});
it('does not read for auth loading, mismatched profile or inactive resource',async()=>{
 const reader=jest.fn();setAuth({...A,loading:true});const h=await renderHook(({active}: {active:boolean})=>useChallenges('x',active,reader),{initialProps:{active:true}});expect(reader).not.toHaveBeenCalled();
 setAuth({...A,profile:B.profile});await h.rerender({active:true});expect(reader).not.toHaveBeenCalled();setAuth(A);await h.rerender({active:false});expect(reader).not.toHaveBeenCalled();
});

it('refuses a retained action in the background event before React commits the masked render',async()=>{
 let change!:(s:AppStateStatus)=>void;jest.spyOn(AppState,'addEventListener').mockImplementation((_event,callback)=>{change=callback;return {remove:jest.fn()};});
 const reader=jest.fn().mockResolvedValue('ready');const h=await renderHook(()=>useChallenges('x',true,reader));
 await waitFor(()=>expect(h.result.current.ready).toBe(true));const retained=h.result.current.run;const write=jest.fn().mockResolvedValue('saved');
 await act(async()=>{change('background');await retained(write);});expect(write).not.toHaveBeenCalled();
});
