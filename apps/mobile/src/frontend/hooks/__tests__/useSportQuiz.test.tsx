/** QUIZ-01 real hook/SDK with only external auth, random UUID and database transport doubled. Synthetic actors. */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSportQuiz } from '@/hooks/useSportQuiz';
import type { QuizSnapshot } from '@shared/sportQuiz';

let mockAuth = { user:{ id:'auth-a' },profile:{ id:'profile-a',user_id:'auth-a',age_blocked_at:null as string|null },isGuest:false,loading:false };
jest.mock('@/context/AuthContext', () => ({ useAuth:() => mockAuth }));
let mockNonce = 0;
jest.mock('expo-crypto', () => ({ randomUUID:() => `00000000-0000-0000-0000-${String(++mockNonce).padStart(12,'0')}` }));
const available: QuizSnapshot = { availability:'ready',testing_only:true,week_start:'2026-10-12',week_end:'2026-10-19',status:'available',sports:['American football'],attempt:null,badges:[],corrections:[] };
const issued: QuizSnapshot = { ...available,status:'issued',attempt:{ id:'attempt-a',week_start:'2026-10-12',sport:'American football',status:'issued',result:null,
  question:{ id:'q1',question_key:'key1',version:1,sport:'American football',prompt:'How many points is a touchdown before conversion?',options:['3','6','7','2'] } } };
function completion(option:number,requestId:string): QuizSnapshot {
  return { ...issued,status:'completed',attempt:{ ...issued.attempt!,status:'completed',result:{ option,correct_option:1,was_correct:option===1,explanation:'A touchdown scores six points before any conversion.',completed_at:'2026-10-14T06:00:00Z',request_id:requestId } },
    badges:[{ id:'badge-a',attempt_id:'attempt-a',week_start:'2026-10-12',label:'Sport Learner',visibility:'private',issued_at:'2026-10-14T06:00:00Z' }] };
}
const mockClient = {
  current:available, calls:[] as { fn:string;args:Record<string,unknown> }[],
  handler:null as null|((fn:string,args:Record<string,unknown>) => Promise<QuizSnapshot>),
  async rpc(fn:string,args:Record<string,unknown>) {
    this.calls.push({ fn,args });
    const data = this.handler ? await this.handler(fn,args) : this.current;
    return { data,error:null };
  },
};
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; },isSupabaseConfigured:true }));
function deferred<T>() { let resolve!:(value:T)=>void; const promise = new Promise<T>(done => { resolve=done; }); return { promise,resolve }; }
beforeEach(() => { mockAuth={ user:{ id:'auth-a' },profile:{ id:'profile-a',user_id:'auth-a',age_blocked_at:null },isGuest:false,loading:false }; mockNonce=0;mockClient.calls=[];mockClient.handler=null;mockClient.current=available; });

it.each(['auth','profile'])('ignores a delayed prior %s identity read and clears the visible snapshot immediately', async kind => {
  const old=deferred<QuizSnapshot>(); mockClient.handler=async () => old.promise;
  const view=await renderHook(() => useSportQuiz());
  const next={ ...issued,attempt:{ ...issued.attempt!,id:'attempt-b',question:{ ...issued.attempt!.question!,prompt:'New account question' } } };
  if (kind==='auth') mockAuth={ ...mockAuth,user:{ id:'auth-b' },profile:{ id:'profile-b',user_id:'auth-b',age_blocked_at:null } };
  else mockAuth={ ...mockAuth,profile:{ ...mockAuth.profile,id:'profile-b' } };
  mockClient.handler=async () => next; await view.rerender({});
  await waitFor(() => expect(view.result.current.snapshot?.attempt?.id).toBe('attempt-b'));
  await act(async () => { old.resolve(issued); await old.promise; });
  expect(view.result.current.snapshot?.attempt?.question?.prompt).toBe('New account question');
  expect(view.result.current.pendingAnswer).toBeNull();
});
it('does not read an authenticated user through a profile belonging to a different user', async () => {
  mockAuth.profile.user_id='auth-old';
  const view=await renderHook(() => useSportQuiz());
  expect(view.result.current.snapshot).toBeNull();expect(mockClient.calls).toEqual([]);
});
it('does not overwrite a newer refresh with an older read', async () => {
  const old=deferred<QuizSnapshot>(); mockClient.handler=async () => old.promise;
  const view=await renderHook(() => useSportQuiz());
  mockClient.handler=async () => issued;
  await act(async () => { await view.result.current.refresh(); });
  await act(async () => { old.resolve(available); await old.promise; });
  expect(view.result.current.snapshot?.status).toBe('issued');
});
it('submits one answer on duplicate presses and exposes only its committed result and private badge', async () => {
  mockClient.current=issued; const write=deferred<QuizSnapshot>();
  mockClient.handler=async fn => fn==='quiz_answer' ? write.promise : mockClient.current;
  const view=await renderHook(() => useSportQuiz()); await waitFor(() => expect(view.result.current.loading).toBe(false));
  let first!:Promise<QuizSnapshot|null>;let duplicate!:Promise<QuizSnapshot|null>;
  await act(async () => { first=view.result.current.answer(0);duplicate=view.result.current.answer(0); });
  expect(mockClient.calls.filter(call => call.fn==='quiz_answer')).toHaveLength(1);
  expect(view.result.current.busy).toBe('answer');
  mockClient.current=completion(0,'00000000-0000-0000-0000-000000000001');
  await act(async () => { write.resolve(mockClient.current); await first;await duplicate; });
  expect(view.result.current.snapshot?.attempt?.result?.was_correct).toBe(false);
  expect(view.result.current.snapshot?.badges[0].visibility).toBe('private');
});
it('preserves uncertain answer choice/request for exact retry and refuses a different choice', async () => {
  mockClient.current=issued; let writes=0;
  mockClient.handler=async (fn,args) => {
    if (fn!=='quiz_answer') return mockClient.current;
    if (++writes===1) throw new Error('Transport reply lost');
    return mockClient.current=completion(Number(args.p_option),String(args.p_request_id));
  };
  const view=await renderHook(() => useSportQuiz()); await waitFor(() => expect(view.result.current.loading).toBe(false));
  await act(async () => { await view.result.current.answer(0); });
  expect(view.result.current.pendingAnswer).toEqual({ option:0,uncertain:true });
  await act(async () => { await view.result.current.refresh();await view.result.current.answer(1); });
  expect(mockClient.calls.filter(call => call.fn==='quiz_answer')).toHaveLength(1);
  await act(async () => { await view.result.current.answer(0); });
  const calls=mockClient.calls.filter(call => call.fn==='quiz_answer');
  expect(calls[0].args).toEqual({ p_attempt_id:'attempt-a',p_option:0,p_request_id:'00000000-0000-0000-0000-000000000001' });
  expect(calls[1].args).toEqual(calls[0].args);expect(view.result.current.pendingAnswer).toBeNull();
});
it('ignores a prior-account answer and never starts its follow-up refresh after an account switch', async () => {
  mockClient.current=issued;const old=deferred<QuizSnapshot>();
  mockClient.handler=async fn => fn==='quiz_answer' ? old.promise : mockClient.current;
  const view=await renderHook(() => useSportQuiz());await waitFor(() => expect(view.result.current.loading).toBe(false));
  let answer!:Promise<QuizSnapshot|null>;await act(async () => { answer=view.result.current.answer(0); });
  mockAuth={ ...mockAuth,user:{ id:'auth-b' },profile:{ id:'profile-b',user_id:'auth-b',age_blocked_at:null } };mockClient.current=available;
  await view.rerender({});await waitFor(() => expect(view.result.current.loading).toBe(false));
  const before=mockClient.calls.length;
  await act(async () => { old.resolve(completion(0,'old-request'));await answer; });
  expect(mockClient.calls).toHaveLength(before);expect(view.result.current.snapshot?.status).toBe('available');
  expect(view.result.current.pendingAnswer).toBeNull();expect(view.result.current.error).toBeNull();
});
it('ignores a delayed write-follow-up read after canonical profile identity switches', async () => {
  mockClient.current=issued;const delayed=deferred<QuizSnapshot>();let reads=0;
  mockClient.handler=async (fn,args) => {
    if (fn==='quiz_answer') return completion(Number(args.p_option),String(args.p_request_id));
    return ++reads===1 ? issued : delayed.promise;
  };
  const view=await renderHook(() => useSportQuiz());await waitFor(() => expect(view.result.current.loading).toBe(false));
  let write!:Promise<QuizSnapshot|null>;await act(async () => { write=view.result.current.answer(0); });
  await waitFor(() => expect(reads).toBe(2));
  mockAuth={ ...mockAuth,profile:{ ...mockAuth.profile,id:'profile-b' } };mockClient.handler=async()=>available;
  await view.rerender({});await waitFor(() => expect(view.result.current.snapshot?.status).toBe('available'));
  await act(async () => { delayed.resolve(completion(0,'prior-account-request'));await write; });
  expect(view.result.current.snapshot?.badges).toEqual([]);expect(view.result.current.busy).toBeNull();
});
it('keeps missing transport unavailable and never fabricates a question or skipped state', async () => {
  mockClient.handler=async () => { throw new Error('Missing quiz RPC'); };
  const view=await renderHook(() => useSportQuiz());await waitFor(() => expect(view.result.current.loading).toBe(false));
  expect(view.result.current.snapshot).toBeNull();expect(view.result.current.error).toMatch(/unavailable/i);
  await act(async () => { await view.result.current.skip(); });
  expect(mockClient.calls.every(call => call.fn==='quiz_snapshot')).toBe(true);
});
