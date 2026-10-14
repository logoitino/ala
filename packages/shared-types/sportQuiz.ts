/** QUIZ-01 JSON RPC contracts. Private completion badges have no Aura, money, public ranking or vote effects. */
export type QuizAvailability = 'ready' | 'paused' | 'not_enrolled' | 'ineligible' | 'unavailable';
export type QuizAttemptStatus = 'issued' | 'completed' | 'skipped' | 'void';
export type QuizQuestionStatus = 'draft' | 'approved' | 'archived' | 'void';
export type QuizQuestionAction = 'create' | 'edit' | 'approve' | 'archive' | 'void';

export type QuizQuestion = {
  id: string; question_key: string; version: number; sport: string; prompt: string; options: string[];
};
export type QuizResult = {
  option: number; correct_option: number; was_correct: boolean; explanation: string; completed_at: string; request_id: string;
};
export type QuizAttempt = {
  id: string; week_start: string; sport: string | null; status: QuizAttemptStatus; question: QuizQuestion | null; result: QuizResult | null;
  /** Issued legacy content can be unavailable pending audited correction; no invented void status/time. */
  unavailable_reason?: string | null;
};
export type SportLearnerBadge = {
  id: string; attempt_id: string; week_start: string; label: 'Sport Learner'; visibility: 'private'; issued_at: string;
};
export type QuizCorrection = { attempt_id: string; week_start: string; reason: string; voided_at: string };
export type QuizSnapshot = {
  availability: QuizAvailability; testing_only: true; week_start: string; week_end: string;
  status: QuizAttemptStatus | 'available' | 'unavailable'; sports: string[]; attempt: QuizAttempt | null;
  badges: SportLearnerBadge[]; corrections: QuizCorrection[];
};
export type QuizSettingsInput = { enabled: boolean; pilot_accounts: string[] };
export type QuizSettingsReceipt = QuizSettingsInput & { testing_only: true };
export type QuizSettings = QuizSettingsReceipt & { reason: string; updated_at: string; updated_by: string | null };
export type QuizQuestionPayload = {
  reason: string; sport?: string; prompt?: string; options?: string[]; correct_option?: number; explanation?: string;
};
export type QuizQuestionReceipt = { id: string; question_key: string; version: number; status: QuizQuestionStatus };
export type QuizAdminQuestion = QuizQuestion & {
  correct_option: number; explanation: string; status: QuizQuestionStatus; reason: string;
  created_at: string; created_by: string | null; reviewed_at: string | null; reviewed_by: string | null;
};
export type QuizAudit = {
  id: string; action: 'settings' | 'question_create' | 'question_edit' | 'question_approve' | 'question_archive' | 'question_void' | 'start' | 'answer' | 'skip';
  actor_id: string | null; question_id: string | null; reason: string | null; created_at: string;
};
export type QuizCounts = {
  questions_draft: number; questions_approved: number; questions_archived: number; questions_void: number;
  week_issued: number; week_completed: number; week_skipped: number; week_void: number; badges_issued: number; badges_void: number;
};
export type QuizAdminSnapshot = {
  generated_at: string; week_start: string; week_end: string; settings: QuizSettings;
  questions: QuizAdminQuestion[]; counts: QuizCounts; audit: QuizAudit[]; next_before: string | null;
};
