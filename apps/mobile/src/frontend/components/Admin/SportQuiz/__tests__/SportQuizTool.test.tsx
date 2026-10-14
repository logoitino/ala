/** QUIZ-02 operational desk: gated mounting, unavailable source, human approval, private corrections and single-flight. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SportQuizTool } from '@/components/Admin/SportQuiz/SportQuizTool';
import * as quiz from '@/lib/sportQuiz';

const actor = '00000000-0000-0000-0000-000000000010';
const baseAuth = { isAdmin:true,loading:false,user:{id:'auth-admin'},profile:{id:actor,user_id:'auth-admin'} };
let mockAuth = {...baseAuth};
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/context/AdminLensContext', () => ({ AdminLensProvider: ({ children }: { children: React.ReactNode }) => children, useAdminLens: () => ({ lens: 'all', setLens: jest.fn() }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ dirty: false, live: { theme: {} } }) }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('expo-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => children, usePathname: () => '/admin/sport-quiz', useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/sportQuiz', () => ({ ...jest.requireActual('@/lib/sportQuiz'),fetchTimedSportQuizAdmin: jest.fn(), saveSportQuizSettings: jest.fn(), saveSportQuizQuestion: jest.fn(), pruneTimedSportQuizHistory: jest.fn() }));
const api = jest.mocked(quiz);
const bank = {
  contract_version:2, generated_at: '2026-10-14T05:00:00Z', week_start: '2026-10-12', week_end: '2026-10-19',
  settings: { contract_version:2, enabled: false, testing_only: true, pilot_accounts: [], reason: 'Paused for local testing.', updated_at: '2026-10-14', updated_by: null },
  questions: [{ id: 'q1', question_key: 'key1', version: 1, topic_category:'sport',source_notes:'Rule book verifies six points.', sport: 'American football', prompt: 'How many points is a touchdown before conversion?', options: ['3','6','7','2'], correct_option: 1,
    explanation: 'A touchdown scores six points.', status: 'draft', reason: 'Draft; human fact approval required.', created_at: '2026-10-14', created_by: null, reviewed_at: null, reviewed_by: null }],
  counts: { questions_draft: 1, questions_approved: 0, questions_archived: 0, questions_void: 0, week_issued: 0, week_completed: 0, week_skipped: 0, week_void: 0, badges_issued: 0, badges_void: 0,week_ended:0,week_expired:0,preferences_weekly:0,exposures:0,week_spent:0,retained_guards:0,retained_requests:0 },
  audit: [{ id: '2', action: 'question_void', actor_id: 'admin-1', question_id: 'q0', reason: 'Ambiguous wording; badge corrected.', created_at: '2026-10-14' }], next_before: null,
question_total:1,question_cap:100,next_question_cursor:null,pools:[],
} as quiz.TimedQuizAdminSnapshot;
beforeEach(() => {
  jest.clearAllMocks(); mockAuth = {...baseAuth};
  api.fetchTimedSportQuizAdmin.mockResolvedValue(bank);
  api.saveSportQuizSettings.mockResolvedValue({ contract_version:2,enabled: false, testing_only: true, pilot_accounts: [] });
  api.pruneTimedSportQuizHistory.mockResolvedValue({contract_version:2,removed_guards:1,removed_requests:2,preserved_guards:3,batch_limit:500});
  api.saveSportQuizQuestion.mockResolvedValue({ id: 'q1', question_key: 'key1', version: 1, status: 'approved' });
});
it('does not mount or fetch private bank for a non-admin', async () => {
  mockAuth = {...baseAuth,isAdmin:false}; await render(<SportQuizTool />);
  expect(screen.queryByText('Question bank')).toBeNull(); expect(api.fetchTimedSportQuizAdmin).not.toHaveBeenCalled();
});
it('shows unavailable instead of counts or approval controls when the backend is missing', async () => {
  api.fetchTimedSportQuizAdmin.mockRejectedValue(new Error('This control is not switched on yet.'));
  await render(<SportQuizTool />);
  expect(await screen.findByText(/not switched on yet/)).toBeTruthy();
  expect(screen.queryByLabelText('Approve question')).toBeNull();
  expect(screen.queryByText('Draft questions')).toBeNull();
});
it('shows complete Data bank, paused testing scope and human-approval rationale', async () => {
  await render(<SportQuizTool />); expect(await screen.findByText('Question bank')).toBeTruthy();
  expect(screen.getByText(/Paused.*testing only/i)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Data'));
  expect(screen.getByText(/A touchdown scores six points/)).toBeTruthy();
  expect(screen.getByText(/Ambiguous wording; badge corrected/)).toBeTruthy();
  expect(screen.getByText(/private.*noncash/i)).toBeTruthy();
});
it('requires selection and rationale, then approves once while a write is in flight', async () => {
  let resolve: (value: quiz.QuizQuestionReceipt) => void = () => {};
  api.saveSportQuizQuestion.mockImplementation(() => new Promise(done => { resolve = done; }));
  await render(<SportQuizTool />); await screen.findByText('Question bank');
  expect(screen.getByLabelText('Approve question')).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Select American football question version 1'));
  await fireEvent.changeText(screen.getByLabelText('Review or correction reason'), 'Content owner verified six-point rule.');
  await fireEvent.press(screen.getByLabelText('Approve question'));
  expect(api.saveSportQuizQuestion).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Working…')).toBeDisabled();
  resolve({ id: 'q1', question_key: 'key1', version: 1, status: 'approved' });
  await waitFor(() => expect(screen.getByText(/Question approved/)).toBeTruthy());
});
it('blocks empty tester enable and preserves authoritative errors', async () => {
  await render(<SportQuizTool />); await screen.findByText('Question bank');
  await fireEvent.changeText(screen.getByLabelText('Review or correction reason'), 'Small approved local test cohort.');
  expect(screen.getByLabelText('Enable for listed testers')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Tester profile IDs'), '00000000-0000-0000-0000-000000000001');
  api.saveSportQuizSettings.mockRejectedValue(new Error('quiz_testers_ineligible'));
  await fireEvent.press(screen.getByLabelText('Enable for listed testers'));
  expect(await screen.findByText('quiz_testers_ineligible')).toBeTruthy();
});
it('pauses with the authoritative list even after a tester has closed, without requiring list edits', async () => {
  const staleTesters = ['00000000-0000-0000-0000-000000000001'];
  api.fetchTimedSportQuizAdmin.mockResolvedValueOnce({ ...bank,settings:{ ...bank.settings!,enabled:true,pilot_accounts:staleTesters } });
  await render(<SportQuizTool />); await screen.findByText('Question bank');
  await fireEvent.changeText(screen.getByLabelText('Review or correction reason'), 'Pause after tester safety closure.');
  expect(screen.getByLabelText('Pause quiz')).not.toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Pause quiz'));
  expect(api.saveSportQuizSettings).toHaveBeenCalledWith({ enabled:false,pilot_accounts:staleTesters },'Pause after tester safety closure.',actor);
  expect(await screen.findByText('Paused for local testing.')).toBeTruthy();
  expect(screen.getByText(/Paused.*testing only/i)).toBeTruthy();
});
it('shows malformed legacy options and keeps Pause/archive/void available while approval is blocked', async () => {
  api.fetchTimedSportQuizAdmin.mockResolvedValue({ ...bank,questions:[{ ...bank.questions[0],options:['3','3\t','7','2'] }] });
  await render(<SportQuizTool />); await screen.findByText('Question bank');
  await fireEvent.press(screen.getByLabelText('Select American football question version 1'));
  await fireEvent.changeText(screen.getByLabelText('Review or correction reason'),'Void duplicate pilot choices; preserve original bytes.');
  expect(screen.getByText(/Invalid answer choices/)).toBeTruthy();
  expect(screen.getByLabelText('Approve question')).toBeDisabled();
  expect(screen.getByLabelText('Pause quiz')).not.toBeDisabled();
  expect(screen.getByLabelText('Archive question')).not.toBeDisabled();
  expect(screen.getByLabelText('Void erroneous question and badges')).not.toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Void erroneous question and badges'));
  expect(api.saveSportQuizQuestion).toHaveBeenCalledWith('q1','void',{ reason:'Void duplicate pilot choices; preserve original bytes.' },actor);
});
it('loads the second question page without advancing audit and shows loaded/full totals', async () => {
  const q=bank.questions[0];
  api.fetchTimedSportQuizAdmin.mockResolvedValueOnce({...bank,questions:[q],question_total:2,next_question_cursor:'page-2',next_before:'9007199254740993'});
  api.fetchTimedSportQuizAdmin.mockResolvedValueOnce({...bank,questions:[{...q,id:'q2',question_key:'key2',sport:'Basketball'}],question_total:2});
  await render(<SportQuizTool />); await screen.findByText(/1 of 2 stored versions/);
  await fireEvent.press(screen.getByLabelText('Load more questions'));
  expect(api.fetchTimedSportQuizAdmin).toHaveBeenLastCalledWith({question_cursor:'page-2',audit_before:null});
  expect(await screen.findByText(/2 of 2 stored versions/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Data'));
  expect(screen.getByLabelText('Load earlier audit')).not.toBeDisabled();
});
it('can Pause with authoritative testers even when local cohort edits are malformed',async()=>{
  await render(<SportQuizTool/>);await screen.findByText('Question bank');
  await fireEvent.changeText(screen.getByLabelText('Review or correction reason'),'Pause with malformed local cohort edits.');
  await fireEvent.changeText(screen.getByLabelText('Tester profile IDs'),'not-a-profile');
  expect(screen.getByLabelText('Enable for listed testers')).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Pause quiz'));
  expect(api.saveSportQuizSettings).toHaveBeenCalledWith({enabled:false,pilot_accounts:[]},'Pause with malformed local cohort edits.',actor);
});
it('loads audit independently without replacing loaded question pages or their cursor',async()=>{
  api.fetchTimedSportQuizAdmin.mockResolvedValueOnce({...bank,next_before:'9007199254740993',next_question_cursor:'question-2',question_total:2});
  api.fetchTimedSportQuizAdmin.mockResolvedValueOnce({...bank,audit:[{...bank.audit[0],id:'1',reason:'Earlier reviewed correction.'}],next_before:null});
  await render(<SportQuizTool/>);await screen.findByText('Question bank');
  await fireEvent.press(screen.getByLabelText('Data'));
  await fireEvent.press(screen.getByLabelText('Load earlier audit'));
  expect(api.fetchTimedSportQuizAdmin).toHaveBeenLastCalledWith({question_cursor:null,audit_before:'9007199254740993'});
  expect(await screen.findByText(/Earlier reviewed correction/)).toBeTruthy();
  expect(screen.getByLabelText('Load more questions')).not.toBeDisabled();
  expect(screen.getByText(/1 of 2 stored versions/)).toBeTruthy();
});
it('does not publish an old actor write receipt or launch its reload after account switch',async()=>{
  let resolve:(value:quiz.QuizQuestionReceipt)=>void=()=>{};
  api.saveSportQuizQuestion.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  await render(<SportQuizTool/>);await screen.findByText('Question bank');
  await fireEvent.press(screen.getByLabelText('Select American football question version 1'));
  await fireEvent.changeText(screen.getByLabelText('Review or correction reason'),'Facts checked before actor switch.');
  await fireEvent.press(screen.getByLabelText('Approve question'));
  mockAuth={...baseAuth,user:{id:'auth-new'},profile:{id:'00000000-0000-0000-0000-000000000011',user_id:'auth-new'}};
  api.fetchTimedSportQuizAdmin.mockRejectedValueOnce(new Error('New actor source unavailable.'));
  await screen.rerender(<SportQuizTool/>);
  resolve({id:'q1',question_key:'key1',version:1,status:'approved'});
  expect(await screen.findByText('New actor source unavailable.')).toBeTruthy();
  expect(api.fetchTimedSportQuizAdmin).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('Question approved.')).toBeNull();
  expect(api.saveSportQuizQuestion).toHaveBeenCalledWith('q1','approve',{reason:'Facts checked before actor switch.'},actor);
});
it('marks a failed next question page incomplete without inventing rows or disabling Pause', async () => {
  api.fetchTimedSportQuizAdmin.mockResolvedValueOnce({...bank,question_total:2,next_question_cursor:'page-2'});
  api.fetchTimedSportQuizAdmin.mockRejectedValueOnce(new Error('Question page unavailable.'));
  await render(<SportQuizTool />); await screen.findByText('Question bank');
  await fireEvent.changeText(screen.getByLabelText('Review or correction reason'),'Pause while inventory is incomplete.');
  await fireEvent.press(screen.getByLabelText('Load more questions'));
  expect(await screen.findByText(/Question page unavailable/)).toBeTruthy();
  expect(screen.getByText(/1 of 2 stored versions/)).toBeTruthy();
  expect(screen.getByLabelText('Pause quiz')).not.toBeDisabled();
});
it('reports retention removal and preservation from the authoritative actor-bound receipt', async () => {
  await render(<SportQuizTool />); await screen.findByText('Question bank');
  await fireEvent.changeText(screen.getByLabelText('Review or correction reason'),'Prune expired recovery records.');
  await fireEvent.press(screen.getByLabelText('Prune expired recovery records'));
  expect(api.pruneTimedSportQuizHistory).toHaveBeenCalledWith('Prune expired recovery records.',actor);
  expect(await screen.findByText(/Removed 1 expired guards and 2 recovery records; preserved 3 unexpired guards/)).toBeTruthy();
});
it('clears private source and ignores a delayed prior admin result after identity switches', async () => {
  let resolve:(value:quiz.TimedQuizAdminSnapshot)=>void=()=>{};
  api.fetchTimedSportQuizAdmin.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  await render(<SportQuizTool />);
  mockAuth={...baseAuth,user:{id:'auth-new'},profile:{id:'00000000-0000-0000-0000-000000000011',user_id:'auth-new'}};
  api.fetchTimedSportQuizAdmin.mockRejectedValueOnce(new Error('New admin source unavailable.'));
  await screen.rerender(<SportQuizTool />);
  resolve(bank);
  expect(await screen.findByText('New admin source unavailable.')).toBeTruthy();
  expect(screen.queryByText('Question bank')).toBeNull();
});
