/** QUIZ-01 operational desk: gated mounting, unavailable source, human approval, private corrections and single-flight. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SportQuizTool } from '@/components/Admin/SportQuiz/SportQuizTool';
import * as quiz from '@/lib/sportQuiz';

let mockAuth = { isAdmin: true, loading: false };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/context/AdminLensContext', () => ({ AdminLensProvider: ({ children }: { children: React.ReactNode }) => children, useAdminLens: () => ({ lens: 'all', setLens: jest.fn() }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ dirty: false, live: { theme: {} } }) }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('expo-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => children, usePathname: () => '/admin/sport-quiz', useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/sportQuiz', () => ({ fetchSportQuizAdmin: jest.fn(), saveSportQuizSettings: jest.fn(), saveSportQuizQuestion: jest.fn() }));
const api = jest.mocked(quiz);
const bank = {
  generated_at: '2026-10-14T05:00:00Z', week_start: '2026-10-12', week_end: '2026-10-19',
  settings: { enabled: false, testing_only: true, pilot_accounts: [], reason: 'Paused for local testing.', updated_at: '2026-10-14', updated_by: null },
  questions: [{ id: 'q1', question_key: 'key1', version: 1, sport: 'American football', prompt: 'How many points is a touchdown before conversion?', options: ['3','6','7','2'], correct_option: 1,
    explanation: 'A touchdown scores six points.', status: 'draft', reason: 'Draft; human fact approval required.', created_at: '2026-10-14', created_by: null, reviewed_at: null, reviewed_by: null }],
  counts: { questions_draft: 1, questions_approved: 0, questions_archived: 0, questions_void: 0, week_issued: 0, week_completed: 0, week_skipped: 0, week_void: 0, badges_issued: 0, badges_void: 0 },
  audit: [{ id: '2', action: 'question_void', actor_id: 'admin-1', question_id: 'q0', reason: 'Ambiguous wording; badge corrected.', created_at: '2026-10-14' }], next_before: null,
} as quiz.QuizAdminSnapshot;
beforeEach(() => {
  jest.clearAllMocks(); mockAuth = { isAdmin: true, loading: false };
  api.fetchSportQuizAdmin.mockResolvedValue(bank);
  api.saveSportQuizSettings.mockResolvedValue({ enabled: false, testing_only: true, pilot_accounts: [] });
  api.saveSportQuizQuestion.mockResolvedValue({ id: 'q1', question_key: 'key1', version: 1, status: 'approved' });
});
it('does not mount or fetch private bank for a non-admin', async () => {
  mockAuth = { isAdmin: false, loading: false }; await render(<SportQuizTool />);
  expect(screen.queryByText('Question bank')).toBeNull(); expect(api.fetchSportQuizAdmin).not.toHaveBeenCalled();
});
it('shows unavailable instead of counts or approval controls when the backend is missing', async () => {
  api.fetchSportQuizAdmin.mockRejectedValue(new Error('This control is not switched on yet.'));
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
  api.fetchSportQuizAdmin.mockResolvedValueOnce({ ...bank,settings:{ ...bank.settings,enabled:true,pilot_accounts:staleTesters } });
  await render(<SportQuizTool />); await screen.findByText('Question bank');
  await fireEvent.changeText(screen.getByLabelText('Review or correction reason'), 'Pause after tester safety closure.');
  expect(screen.getByLabelText('Pause quiz')).not.toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Pause quiz'));
  expect(api.saveSportQuizSettings).toHaveBeenCalledWith({ enabled:false,pilot_accounts:staleTesters },'Pause after tester safety closure.');
  expect(await screen.findByText('Paused for local testing.')).toBeTruthy();
  expect(screen.getByText(/Paused.*testing only/i)).toBeTruthy();
});
