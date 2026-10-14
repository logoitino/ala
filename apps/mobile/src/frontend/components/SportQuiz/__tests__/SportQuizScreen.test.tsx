/** QUIZ-01 visible journey with real screen/hook/SDK; synthetic database responses, external context/navigation only. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SportQuizScreen } from '@/components/SportQuiz/SportQuizScreen';
import { SportQuizInvitation } from '@/components/SportQuiz/SportQuizInvitation';
import type { QuizSnapshot } from '@shared/sportQuiz';
import type { UserRole } from '@/types/database';
let mockAuth={ user:{ id:'auth-a' },profile:{ id:'profile-a',user_id:'auth-a',age_blocked_at:null as string|null },role:'parent' as UserRole,isGuest:false,loading:false };
jest.mock('@/context/AuthContext', () => ({ useAuth:() => mockAuth }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime:() => ({ live:{ theme:{ background:'#F3FAF6' } } }) }));
jest.mock('@/services/SupportSignalManager', () => ({ supportSignals:{ capture:jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView:require('react-native').View,useSafeAreaInsets:() => ({ top:0,bottom:0,left:0,right:0 }) }));
const mockRouter={ back:jest.fn(),replace:jest.fn(),canGoBack:jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter:() => mockRouter,usePathname:() => '/sport-quiz' }));
jest.mock('expo-crypto', () => ({ randomUUID:() => '00000000-0000-0000-0000-000000000001' }));
const available: QuizSnapshot={ availability:'ready',testing_only:true,week_start:'2026-10-12',week_end:'2026-10-19',status:'available',sports:['American football','Basketball'],attempt:null,badges:[],corrections:[] };
const issued: QuizSnapshot={ ...available,status:'issued',attempt:{ id:'attempt-a',week_start:'2026-10-12',sport:'American football',status:'issued',result:null,
  question:{ id:'q1',question_key:'key1',version:1,sport:'American football',prompt:'How many points is a touchdown before any conversion?',options:['3','6','7','2'] } } };
function complete(option:number,requestId:string):QuizSnapshot {
  return { ...issued,status:'completed',attempt:{ ...issued.attempt!,status:'completed',result:{ option,correct_option:1,was_correct:option===1,explanation:'A touchdown scores six points. Conversion attempts are separate.',completed_at:'2026-10-14T06:00:00Z',request_id:requestId } },
    badges:[{ id:'badge-a',attempt_id:'attempt-a',week_start:'2026-10-12',label:'Sport Learner',visibility:'private',issued_at:'2026-10-14T06:00:00Z' }] };
}
const mockClient={ current:available,calls:[] as { fn:string;args:Record<string,unknown> }[],handler:null as null|((fn:string,args:Record<string,unknown>)=>Promise<QuizSnapshot>),
  async rpc(fn:string,args:Record<string,unknown>) {
    this.calls.push({ fn,args });
    if (this.handler) return { data:await this.handler(fn,args),error:null };
    if (fn==='quiz_start') this.current=issued;
    if (fn==='quiz_answer') this.current=complete(Number(args.p_option),String(args.p_request_id));
    if (fn==='quiz_skip') this.current={ ...available,status:'skipped',attempt:{ id:'skip-a',week_start:'2026-10-12',sport:null,status:'skipped',question:null,result:null } };
    return { data:this.current,error:null };
  },
};
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; },isSupabaseConfigured:true }));
beforeEach(() => { jest.clearAllMocks();mockAuth={ user:{ id:'auth-a' },profile:{ id:'profile-a',user_id:'auth-a',age_blocked_at:null },role:'parent',isGuest:false,loading:false };mockClient.calls=[];mockClient.current=available;mockClient.handler=null;mockRouter.canGoBack.mockReturnValue(true); });

it.each([0,1])('opens only on demand and shows explanation and the same private completion badge for option %s', async option => {
  await render(<SportQuizScreen />);await screen.findByRole('button',{ name:'Choose American football' });
  expect(mockClient.calls.map(call=>call.fn)).toEqual(['quiz_snapshot']);
  expect(screen.queryByText(/touchdown before/)).toBeNull();
  await fireEvent.press(screen.getByRole('button',{ name:'Choose American football' }));
  expect(await screen.findByText(/touchdown before/)).toBeTruthy();
  expect(screen.queryByText(/A touchdown scores six/)).toBeNull();
  await fireEvent.press(screen.getByRole('button',{ name:`Answer ${option+1}: ${issued.attempt!.question!.options[option]}` }));
  expect(await screen.findByText(/A touchdown scores six points/)).toBeTruthy();
  expect(screen.getByText('Sport Learner')).toBeTruthy();expect(screen.getByText(/Private.*completion/i)).toBeTruthy();
  expect(screen.queryByRole('button',{ name:/Answer 1/ })).toBeNull();
});
it('durably skips only after the server confirms and keeps ordinary navigation usable', async () => {
  await render(<SportQuizScreen />);await screen.findByRole('button',{ name:'Skip this week' });
  await fireEvent.press(screen.getByRole('button',{ name:'Skip this week' }));
  expect(await screen.findByText(/Skipped for this week/)).toBeTruthy();
  expect(screen.queryByRole('button',{ name:'Choose American football' })).toBeNull();
  await fireEvent.press(screen.getByRole('button',{ name:'Account Home' }));expect(mockRouter.replace).toHaveBeenCalledWith('/parent');
});
it('shows missing-source and legacy correction reasons without any fake choices, while Back always works', async () => {
  mockClient.current={ ...issued,availability:'unavailable',attempt:{ ...issued.attempt!,question:null,unavailable_reason:'This question is unavailable while its answer choices are corrected.' } };
  await render(<SportQuizScreen />);
  expect(await screen.findByText(/answer choices are corrected/)).toBeTruthy();
  expect(screen.queryByRole('button',{ name:/Answer 1/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button',{ name:'Back' }));expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
it.each(['paused','not_enrolled'] as const)('shows private badge/correction history while %s without offering participation', async availability => {
  mockClient.current={ ...available,availability,status:'unavailable',attempt:null,
    badges:[{ id:'old-badge',attempt_id:'old-complete',week_start:'2026-10-05',label:'Sport Learner',visibility:'private',issued_at:'2026-10-08T06:00:00Z' }],
    corrections:[{ attempt_id:'old-void',week_start:'2026-09-28',reason:'The question wording was corrected; that badge is unavailable.',voided_at:'2026-10-14T06:00:00Z' }] };
  await render(<SportQuizScreen />);expect(await screen.findByText('Sport Learner')).toBeTruthy();
  expect(screen.getByText(/question wording was corrected/)).toBeTruthy();expect(screen.queryByRole('button',{ name:/Answer/ })).toBeNull();
});
it('a failed Skip never claims dismissal was saved and leaves Back usable', async () => {
  mockClient.handler=async fn => { if (fn==='quiz_skip') throw new Error('reply lost');return available; };
  await render(<SportQuizScreen />);await screen.findByRole('button',{ name:'Skip this week' });
  await fireEvent.press(screen.getByRole('button',{ name:'Skip this week' }));
  expect(await screen.findByText(/Quiz is unavailable/)).toBeTruthy();expect(screen.queryByText(/Skipped for this week/)).toBeNull();
  await fireEvent.press(screen.getByRole('button',{ name:'Back' }));expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
it('ignores a delayed prior account question in the visible screen', async () => {
  let resolve!:(value:QuizSnapshot)=>void;const prior=new Promise<QuizSnapshot>(done=>{resolve=done;});
  mockClient.handler=async()=>prior;const view=await render(<SportQuizScreen />);
  mockAuth={ ...mockAuth,user:{ id:'auth-b' },profile:{ id:'profile-b',user_id:'auth-b',age_blocked_at:null } };
  mockClient.handler=async()=>available;await view.rerender(<SportQuizScreen />);await screen.findByRole('button',{ name:'Choose American football' });
  await act(async()=>{resolve(issued);await prior;});
  expect(screen.queryByText(/touchdown before/)).toBeNull();expect(screen.queryByText('Sport Learner')).toBeNull();
});
it('one answer stays in flight on duplicate presses while Back remains enabled', async () => {
  mockClient.current=issued;let resolve!:(value:QuizSnapshot)=>void;const reply=new Promise<QuizSnapshot>(done=>{resolve=done;});
  mockClient.handler=async fn=>fn==='quiz_answer'?reply:mockClient.current;
  await render(<SportQuizScreen />);await screen.findByText(/touchdown before/);
  await fireEvent.press(screen.getByRole('button',{ name:'Answer 1: 3' }));
  expect(screen.getByRole('button',{ name:'Answer 1: 3' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button',{ name:'Answer 1: 3' }));
  expect(mockClient.calls.filter(call=>call.fn==='quiz_answer')).toHaveLength(1);
  expect(screen.getByRole('button',{ name:'Back' })).not.toBeDisabled();
  mockClient.current=complete(0,'00000000-0000-0000-0000-000000000001');
  await act(async()=>{resolve(mockClient.current);await reply;});await screen.findByText('Sport Learner');
});
it('never displays a stale question or badge when profile ownership no longer matches auth', async () => {
  mockClient.current=issued;const view=await render(<SportQuizScreen />);await screen.findByText(/touchdown before/);
  mockAuth={ ...mockAuth,user:{ id:'auth-b' } };await view.rerender(<SportQuizScreen />);
  expect(screen.queryByText(/touchdown before/)).toBeNull();expect(screen.queryByText('Sport Learner')).toBeNull();
  expect(mockClient.calls).toHaveLength(1);
});
it('uses the role Home when Back has no prior route, including while transport is unavailable', async () => {
  mockRouter.canGoBack.mockReturnValue(false);mockAuth.role='sponsor';mockClient.handler=async () => { throw new Error('transport unavailable'); };
  await render(<SportQuizScreen />);await screen.findByText(/Quiz is unavailable/);
  await fireEvent.press(screen.getByRole('button',{ name:'Back' }));expect(mockRouter.replace).toHaveBeenCalledWith('/sponsor');
  expect(screen.queryByRole('button',{ name:'Skip this week' })).toBeNull();
});
it('keeps an uncertain choice visible and retries only that choice despite duplicate presses', async () => {
  mockClient.current=issued;let writes=0;
  mockClient.handler=async (fn,args) => {
    if (fn!=='quiz_answer') return mockClient.current;
    if (++writes===1) throw new Error('reply lost');
    return mockClient.current=complete(Number(args.p_option),String(args.p_request_id));
  };
  await render(<SportQuizScreen />);await screen.findByText(/touchdown before/);
  await fireEvent.press(screen.getByRole('button',{ name:'Answer 1: 3' }));
  expect(await screen.findByRole('button',{ name:'Retry this answer' })).toBeTruthy();
  expect(screen.getByRole('button',{ name:'Answer 2: 6' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button',{ name:'Retry this answer' }));
  expect(await screen.findByText('Sport Learner')).toBeTruthy();
  const calls=mockClient.calls.filter(call=>call.fn==='quiz_answer');expect(calls[1].args).toEqual(calls[0].args);
});
it('invitation opens without assignment, and Not now is local presentation rather than persisted Skip', async () => {
  const open=jest.fn(),skip=jest.fn(async()=>null),dismiss=jest.fn();
  await render(<SportQuizInvitation snapshot={available} loading={false} error={null} busy={null} onOpen={open} onSkip={skip} onDismiss={dismiss} />);
  await fireEvent.press(screen.getByRole('button',{ name:'Open quiz' }));expect(open).toHaveBeenCalledTimes(1);expect(mockClient.calls).toEqual([]);
  await fireEvent.press(screen.getByRole('button',{ name:'Not now' }));expect(dismiss).toHaveBeenCalledTimes(1);expect(skip).not.toHaveBeenCalled();
});
it('has no participation invitation when paused or a backend read failed', async () => {
  const view=await render(<SportQuizInvitation snapshot={{ ...available,availability:'paused' }} loading={false} error={null} busy={null} onOpen={()=>{}} onSkip={async()=>null} />);
  expect(screen.queryByRole('button',{ name:'Open quiz' })).toBeNull();
  await view.rerender(<SportQuizInvitation snapshot={available} loading={false} error="unavailable" busy={null} onOpen={()=>{}} onSkip={async()=>null} />);
  expect(screen.queryByRole('button',{ name:'Open quiz' })).toBeNull();
});
