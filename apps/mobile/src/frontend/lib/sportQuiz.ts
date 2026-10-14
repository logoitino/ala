/**
 * QUIZ-02 bound timed adapter. Server owns time, identity and private learning.
 * Missing/malformed sources throw; this module never supplies a fallback question or invented counts.
 * @sideEffects Authenticated database RPCs via the shared callRpc binding; no telemetry, storage or payment calls.
 */
import { callRpc } from '@/lib/rpc';
import type {
  QuizAdminQuestion, QuizQuestionAction, QuizQuestionPayload, QuizQuestionReceipt,
  QuizSettingsInput, QuizSettingsReceipt,
} from '@shared/sportQuiz';
import type {
  TimedQuizSnapshot, TimedQuizPreferencesInput, TimedQuizStartInput, TimedQuizAnswerInput, TimedQuizEndInput,
  TimedQuizReceipt, TimedQuizStartReceipt, TimedQuizHistoryPage, TimedQuizEraseReceipt, TimedQuizAdminSnapshot,
  TimedQuizRetentionReceipt, TimedQuizSettingsReceipt, TimedQuizAdminQuestionInput,
} from '@shared/timedSportQuiz';
export type {QuizQuestionAction,QuizQuestionPayload,QuizQuestionReceipt,QuizSettingsInput} from '@shared/sportQuiz';
export type * from '@shared/timedSportQuiz';
export { TIMED_QUIZ_NOTICE_VERSION, TIMED_QUIZ_DURATIONS } from '@shared/timedSportQuiz';

const unavailable = () => new Error('Sport Pop Quiz data is unavailable. Refresh or contact Support.');
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(x => typeof x === 'string');
const countKeys = ['questions_draft','questions_approved','questions_archived','questions_void','week_issued','week_completed','week_skipped','week_void','badges_issued','badges_void'];
// Stored non-option SQL text uses ASCII-space btrim and Unicode character counts, including legacy rows.
const text = (value: unknown, min = 1, max = Infinity): value is string => typeof value === 'string'
  && Array.from(value.replace(/^ +| +$/g, '')).length >= min && Array.from(value.replace(/^ +| +$/g, '')).length <= max;
const nullableText = (value: unknown): value is string | null => value === null || text(value);
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && timestamp(value);
const cursor = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d*$/.test(value);

/** @purpose Match server option canonicalization; semantic legacy defects stay readable for safe repair. */
export function sportQuizOptionsIssue(options: string[]): string | null {
  const normalized = options.map(option => option.trim()); // Same explicit ECMAScript whitespace set as quiz_normalize_options.
  return options.length !== 4 || normalized.some(option => Array.from(option).length < 1 || Array.from(option).length > 100)
    || new Set(normalized).size !== 4 ? 'Invalid answer choices. Archive or void this version, or create a corrected draft; do not approve it.' : null;
}
/** @purpose Authoring bounds use the same Unicode counts/ASCII text bounds and canonical option rules as SQL. */
export function sportQuizContentValid(content: { sport: string; prompt: string; options: string[]; explanation: string }): boolean {
  return text(content.sport,2,80) && text(content.prompt,10,280) && text(content.explanation,10,500) && !sportQuizOptionsIssue(content.options);
}

function questionReceipt(value: unknown): value is QuizQuestionReceipt & Record<string, unknown> {
  return object(value) && text(value.id) && text(value.question_key)
    && typeof value.version === 'number' && Number.isSafeInteger(value.version) && value.version >= 1
    && typeof value.status === 'string' && ['draft','approved','archived','void'].includes(value.status);
}
function settingsReceipt(value: unknown): value is QuizSettingsReceipt & Record<string, unknown> {
  return object(value) && value.testing_only === true && typeof value.enabled === 'boolean'
    && strings(value.pilot_accounts) && value.pilot_accounts.length <= 100 && value.pilot_accounts.every(id => text(id))
    && new Set(value.pilot_accounts).size === value.pilot_accounts.length && (!value.enabled || value.pilot_accounts.length > 0);
}
/** @purpose Validate every Data field before the desk receives a typed question row. */
function adminQuestion(value: unknown): value is QuizAdminQuestion {
  return object(value) && questionReceipt(value) && text(value.sport, 2, 80) && text(value.prompt, 10, 280)
    && strings(value.options) && value.options.length === 4 && value.options.every(option => text(option, 1, 100))
    && typeof value.correct_option === 'number' && Number.isInteger(value.correct_option) && value.correct_option >= 0 && value.correct_option <= 3
    && text(value.explanation, 10, 500) && text(value.reason, 10, 500) && timestamp(value.created_at) && nullableText(value.created_by)
    && (value.reviewed_at === null || timestamp(value.reviewed_at)) && nullableText(value.reviewed_by);
}
/** @purpose Restrict local testing to explicit canonical profile IDs; server refuses production mode and empty enable. */
export async function saveSportQuizSettings(payload: QuizSettingsInput, reason: string, expectedActorId: string): Promise<TimedQuizSettingsReceipt> {
  const value = await callRpc<unknown>('quiz_admin_settings', { p_payload: payload, p_reason: reason, p_expected_actor_id: expectedActorId });
  if (!settingsReceipt(value) || value.contract_version !== 2) throw unavailable();
  return projectDto<TimedQuizSettingsReceipt>(value,settingsShape);
}
/** @purpose Draft/create new version, fact approval, archive or irreversible correction/void with authoritative audit. */
export async function saveSportQuizQuestion(id: string | null, action: QuizQuestionAction, payload: QuizQuestionPayload | TimedQuizAdminQuestionInput, expectedActorId: string): Promise<QuizQuestionReceipt> {
  const value = await callRpc<unknown>('quiz_admin_question', { p_id: id, p_action: action, p_payload: payload, p_expected_actor_id: expectedActorId });
  if (!questionReceipt(value)) throw unavailable();
  return projectDto<QuizQuestionReceipt>(value,questionReceiptShape);
}

const topics = ['sport','science','geography','general'];
const statuses = ['issued','completed','skipped','void','ended','expired'];
const operations = ['preferences','invitation','start','answer','end','skip'];
const timedCounts = [...countKeys,'week_ended','week_expired','preferences_weekly','exposures','week_spent','retained_guards','retained_requests'];
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const nullableTime = (v: unknown) => v === null || timestamp(v);
const opaqueCursor = (v: unknown) => v === null || text(v);
const topic = (v: unknown) => topics.includes(String(v));
type WireShape = { [key:string]:true|WireShape|[WireShape] };
const fields=(...keys:string[]):WireShape=>Object.fromEntries(keys.map(key=>[key,true as const]));
const settingsShape=fields('contract_version','enabled','testing_only','pilot_accounts');
const questionReceiptShape=fields('id','question_key','version','status');
const preferencesShape=fields('invitation_mode','topic_mode','notice_version','notice_accepted_at','version','history_version','last_invited_week');
const attemptShape=fields('id','week_start','mode','status','started_at','expires_at','duration_seconds','closed_at','close_reason','effective_expired','correction_reason');
const questionShape=fields('id','question_key','version','topic_category','sport','prompt','options');
const resultShape=fields('answered_option','correct_option','was_correct','explanation','completed_at');
const receiptShape:WireShape={...fields('contract_version','profile_id','request_id','operation','outcome','week_start','committed_at'),attempt:attemptShape,result:resultShape,preferences:preferencesShape};
const startShape:WireShape={...receiptShape,server_now:true,active_question:questionShape};
const snapshotShape:WireShape={...fields('contract_version','profile_id','server_now','week_start','week_end','testing_only','availability','week_spent','scheduled_topic','history_version','history_count','badge_count','correction_count'),
  preferences:preferencesShape,attempt:attemptShape,pools:[fields('topic_category','sport','unseen_count','allowed')]};
const historyShape:WireShape={...fields('contract_version','profile_id','server_now','history_version','total','next_before'),
  items:[{attempt:attemptShape,question:questionShape,result:resultShape,badge:fields('id','label','visibility','issued_at','voided_at')}]};
const adminShape:WireShape={...fields('contract_version','generated_at','week_start','week_end','question_total','question_cap','next_question_cursor','next_before'),
  settings:{...settingsShape,...fields('reason','updated_at','updated_by')},
  questions:[{...questionShape,...fields('correct_option','explanation','source_notes','reason','status','created_at','created_by','reviewed_at','reviewed_by')}],
  audit:[fields('id','action','actor_id','question_id','reason','created_at')],counts:fields(...timedCounts),pools:[fields('topic_category','sport','approved_count')]};
const eraseShape=fields('contract_version','profile_id','history_version','week_start','week_spent','quota_prune_after','removed_attempts','removed_exposures','removed_badges','removed_requests','removed_audit');
const retentionShape=fields('contract_version','removed_guards','removed_requests','preserved_guards','batch_limit');
// Prompt capabilities and SQL hashes are never legal DTO fields, including nested recovery/audit data.
function hasSecret(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(hasSecret);
  return object(v) && Object.entries(v).some(([key,value]) => /^(hash|.*_hash|.*(?:secret|token|capability)(?:_digest)?)$/i.test(key) || hasSecret(value));
}
const protectedExtra=(key:string)=>['question','active_question','prompt','options','question_id','question_key','correct_option','answer_key','result','explanation',
  'answered_option','was_correct','attempt','attempt_id','start_request_id','request_id','actor_id','profile_id'].includes(key);
function protectedTree(v:unknown):boolean{
  if(Array.isArray(v))return v.some(protectedTree);
  return object(v)&&Object.entries(v).some(([key,value])=>protectedExtra(key)||protectedTree(value));
}
/** @purpose Project only the approved context, rejecting hidden learning/association fields before discarding harmless extras. */
function projectNode(value:unknown,shape:WireShape):unknown{
  if(value===null)return null;
  if(!object(value))throw unavailable();
  for(const [key,child] of Object.entries(value)){
    if(!Object.prototype.hasOwnProperty.call(shape,key)&&(protectedExtra(key)||protectedTree(child)))throw unavailable();
  }
  const output:Record<string,unknown>={};
  for(const [key,childShape] of Object.entries(shape)){
    const child=value[key];
    if(childShape===true){
      if(object(child)||(Array.isArray(child)&&child.some(item=>object(item)||Array.isArray(item))))throw unavailable();
      output[key]=Array.isArray(child)?[...child]:child;
    }else if(Array.isArray(childShape)){
      if(!Array.isArray(child))throw unavailable();
      output[key]=child.map(item=>projectNode(item,childShape[0]));
    }else output[key]=projectNode(child,childShape);
  }
  return output;
}
function projectDto<T>(value:unknown,shape:WireShape):T{
  if(hasSecret(value))throw unavailable();
  return projectNode(value,shape) as T;
}
function promptFree(v: Record<string,unknown>) {
  return !['question','active_question','prompt','options','question_id','question_key','correct_option','answer_key','result'].some(key => key in v);
}
function hasLearningFields(v:unknown):boolean {
  if(Array.isArray(v))return v.some(hasLearningFields);
  return object(v)&&(!promptFree(v)||Object.values(v).some(hasLearningFields));
}
function timedPreferences(v: unknown): boolean {
  return object(v) && ['off','weekly'].includes(String(v.invitation_mode)) && ['sports','mix'].includes(String(v.topic_mode))
    && nullableText(v.notice_version) && nullableTime(v.notice_accepted_at) && integer(v.version) && integer(v.history_version)
    && (v.last_invited_week === null || date(v.last_invited_week));
}
function timedAttempt(v: unknown): boolean {
  return object(v) && promptFree(v) && text(v.id) && date(v.week_start) && ['legacy','timed'].includes(String(v.mode))
    && statuses.includes(String(v.status)) && nullableTime(v.started_at) && nullableTime(v.expires_at)
    && (v.duration_seconds === null || v.duration_seconds === 30 || v.duration_seconds === 90)
    && nullableTime(v.closed_at) && nullableText(v.close_reason) && typeof v.effective_expired === 'boolean' && nullableText(v.correction_reason)
    && !(v.mode === 'legacy' && v.status === 'issued');
}
function timedQuestion(v: unknown, immutableHistory = false): boolean {
  return object(v) && text(v.id) && text(v.question_key) && integer(v.version) && v.version > 0 && topic(v.topic_category)
    && text(v.sport,2,80) && text(v.prompt,10,280) && strings(v.options) && v.options.length === 4
    && v.options.every(o=>text(o,1,100)) && (immutableHistory || !sportQuizOptionsIssue(v.options)) && !('correct_option' in v) && !('explanation' in v);
}
function timedResult(v: unknown): boolean {
  return object(v) && (v.answered_option === null || (integer(v.answered_option) && v.answered_option < 4))
    && integer(v.correct_option) && v.correct_option < 4 && (v.was_correct === null || typeof v.was_correct === 'boolean')
    && text(v.explanation,10,500) && nullableTime(v.completed_at) && !('prompt' in v) && !('question' in v);
}
function receiptValid(v: unknown, allowStart = false): v is TimedQuizReceipt & Record<string,unknown> {
  return object(v) && v.contract_version === 2 && !hasSecret(v) && text(v.profile_id) && text(v.request_id)
    && operations.includes(String(v.operation)) && text(v.outcome) && date(v.week_start) && timestamp(v.committed_at)
    && (v.attempt === null || timedAttempt(v.attempt)) && (v.result === null || (timedResult(v.result) && object(v.attempt) && v.attempt.status !== 'issued'))
    && (v.preferences === null || timedPreferences(v.preferences))
    && !['question','prompt','options','correct_option'].some(k=>k in v) && (allowStart || !('active_question' in v));
}
function checkReceipt(v: unknown, operation?: string, expectedProfile?: string, expectedRequest?: string): TimedQuizReceipt {
  if (!receiptValid(v) || (operation && v.operation !== operation) || (expectedProfile && v.profile_id !== expectedProfile)
    || (expectedRequest && v.request_id !== expectedRequest)) throw unavailable();
  return projectDto<TimedQuizReceipt>(v,receiptShape);
}
/** @purpose Read sanitized account opportunity/preferences/counts; an active prompt can never come from this read. */
export async function fetchTimedSportQuiz(): Promise<TimedQuizSnapshot> {
  const v = await callRpc<unknown>('quiz_snapshot');
  if (!object(v) || v.contract_version !== 2 || !hasSecretFreeSnapshot(v)) throw unavailable();
  return projectDto<TimedQuizSnapshot>(v,snapshotShape);
}
function hasSecretFreeSnapshot(v: Record<string,unknown>) {
  return !hasSecret(v) && !hasLearningFields(v) && (v.profile_id === null || text(v.profile_id)) && timestamp(v.server_now)
    && date(v.week_start) && date(v.week_end) && v.testing_only === true
    && ['ready','paused','not_enrolled','ineligible','unavailable'].includes(String(v.availability)) && timedPreferences(v.preferences)
    && (v.attempt === null || timedAttempt(v.attempt)) && typeof v.week_spent === 'boolean'
    && ['sport','fun'].includes(String(v.scheduled_topic)) && Array.isArray(v.pools) && v.pools.every(p=>object(p) && topic(p.topic_category)
      && text(p.sport,2,80) && integer(p.unseen_count) && typeof p.allowed === 'boolean')
    && ['history_version','history_count','badge_count','correction_count'].every(k=>integer(v[k]));
}
/** @purpose Save an explicit account preference with CAS and exact request identity; Off never ends a round. */
export async function saveTimedSportQuizPreferences(payload: TimedQuizPreferencesInput, expectedVersion: number, requestId: string, expectedProfileId: string): Promise<TimedQuizReceipt> {
  return checkReceipt(await callRpc('quiz_preferences',{p_payload:payload,p_expected_version:expectedVersion,p_request_id:requestId,p_expected_profile_id:expectedProfileId}),'preferences',expectedProfileId,requestId);
}
/** @purpose Claim the once-weekly optional inline invitation without drawing or exposing a question. */
export async function claimTimedSportQuizInvitation(expectedWeek: string, requestId: string, expectedProfileId: string): Promise<TimedQuizReceipt> {
  return checkReceipt(await callRpc('quiz_invitation',{p_expected_week:expectedWeek,p_request_id:requestId,p_expected_profile_id:expectedProfileId}),'invitation',expectedProfileId,requestId);
}
/** @purpose Only this original Start capability can return a live prompt before its unchanged server deadline. */
export async function startTimedSportQuiz(input: TimedQuizStartInput): Promise<TimedQuizStartReceipt> {
  const v = await callRpc<unknown>('quiz_start',{p_topic_category:input.topic_category,p_sport:input.sport,p_duration_seconds:input.duration_seconds,
    p_expected_week:input.expected_week,p_notice_version:input.notice_version,p_request_id:input.request_id,p_session_secret:input.session_secret,p_expected_profile_id:input.expected_profile_id});
  if (!receiptValid(v,true) || v.operation !== 'start' || v.profile_id !== input.expected_profile_id || v.request_id !== input.request_id || !timestamp(v.server_now)
    || !('active_question' in v) || (v.active_question !== null && (!timedQuestion(v.active_question) || !object(v.attempt)
      || v.attempt.status !== 'issued' || v.attempt.mode !== 'timed' || v.attempt.effective_expired || !timestamp(v.attempt.expires_at)
      || Date.parse(v.attempt.expires_at) <= Date.parse(v.server_now)))) throw unavailable();
  return projectDto<TimedQuizStartReceipt>(v,startShape);
}
/** @purpose Submit only the caller's exact chosen option/request/capability; no queue or fresh answer retry. */
export async function answerTimedSportQuiz(input: TimedQuizAnswerInput): Promise<TimedQuizReceipt> {
  return checkReceipt(await callRpc('quiz_answer',{p_attempt_id:input.attempt_id,p_option:input.option,p_request_id:input.request_id,p_session_secret:input.session_secret,p_expected_profile_id:input.expected_profile_id}),'answer',input.expected_profile_id,input.request_id);
}
/** @purpose End an owned attempt or cancel its original Start UUID; End needs no prompt capability. */
export async function endTimedSportQuiz(input: TimedQuizEndInput): Promise<TimedQuizReceipt> {
  return checkReceipt(await callRpc('quiz_end',{p_attempt_id:input.attempt_id,p_start_request_id:input.start_request_id,p_expected_week:input.expected_week,p_reason:input.reason,p_request_id:input.request_id,p_expected_profile_id:input.expected_profile_id}),'end',input.expected_profile_id,input.request_id);
}
/** @purpose Spend this UTC week's opportunity without revealing any question. */
export async function skipTimedSportQuiz(expectedWeek: string, requestId: string, expectedProfileId: string): Promise<TimedQuizReceipt> {
  return checkReceipt(await callRpc('quiz_skip',{p_expected_week:expectedWeek,p_request_id:requestId,p_expected_profile_id:expectedProfileId}),'skip',expectedProfileId,requestId);
}
/** @purpose Recover only owned prompt-free mutation metadata; never reconstruct a live round from a receipt. */
export async function fetchTimedSportQuizReceipt(requestId: string): Promise<TimedQuizReceipt | null> {
  const v=await callRpc<unknown>('quiz_receipt',{p_request_id:requestId});
  return v === null ? null : checkReceipt(v,undefined,undefined,requestId);
}
/** @purpose Page only terminal own learning records; private labels/corrections survive pause, never active prompts. */
export async function fetchTimedSportQuizHistory(before: string | null = null): Promise<TimedQuizHistoryPage> {
  const v=await callRpc<unknown>('quiz_history',{p_before:before});
  if (!object(v) || v.contract_version !== 2 || hasSecret(v) || 'active_question' in v || !text(v.profile_id) || !timestamp(v.server_now) || !integer(v.history_version)
    || !integer(v.total) || !opaqueCursor(v.next_before) || !Array.isArray(v.items) || v.items.length > 50 || v.total < v.items.length
    || !v.items.every(i=>object(i) && timedAttempt(i.attempt) && object(i.attempt) && i.attempt.status !== 'issued'
      && (i.question === null || timedQuestion(i.question,true)) && (i.result === null || timedResult(i.result))
      && (i.badge === null || (object(i.badge) && text(i.badge.id) && ['Sport Learner','Trivia Explorer'].includes(String(i.badge.label))
        && i.badge.visibility === 'private' && timestamp(i.badge.issued_at) && nullableTime(i.badge.voided_at))))) throw unavailable();
  return projectDto<TimedQuizHistoryPage>(v,historyShape);
}
/** @purpose CAS erasure spends this week and retains the disclosed minimal quota guard. Uncertain success requires a new review. */
export async function eraseTimedSportQuizHistory(expectedHistoryVersion: number, expectedProfileId: string): Promise<TimedQuizEraseReceipt> {
  const v=await callRpc<unknown>('quiz_erase_history',{p_expected_history_version:expectedHistoryVersion,p_expected_profile_id:expectedProfileId});
  if (!object(v) || v.contract_version !== 2 || hasSecret(v) || v.profile_id !== expectedProfileId || !integer(v.history_version)
    || !date(v.week_start) || v.week_spent !== true || !timestamp(v.quota_prune_after)
    || !['removed_attempts','removed_exposures','removed_badges','removed_requests','removed_audit'].every(k=>integer(v[k]))) throw unavailable();
  return projectDto<TimedQuizEraseReceipt>(v,eraseShape);
}
/** @purpose Read one 50-row question page independently of the bigint audit cursor, with authoritative full counts. */
export async function fetchTimedSportQuizAdmin(input: {question_cursor?: string|null; audit_before?: string|null} = {}): Promise<TimedQuizAdminSnapshot> {
  const v=await callRpc<unknown>('quiz_admin_snapshot',{p_question_cursor:input.question_cursor ?? null,p_audit_before:input.audit_before ?? null});
  if (!object(v) || v.contract_version !== 2 || hasSecret(v) || !timestamp(v.generated_at) || !date(v.week_start) || !date(v.week_end)
    || (v.settings !== null && (!settingsReceipt(v.settings) || v.settings.contract_version !== 2 || !text(v.settings.reason,10,500) || !timestamp(v.settings.updated_at) || !nullableText(v.settings.updated_by)))
    || !integer(v.question_total) || v.question_total > 100 || v.question_cap !== 100 || !opaqueCursor(v.next_question_cursor)
    || !Array.isArray(v.questions) || v.questions.length > 50 || v.questions.length > v.question_total
    || !v.questions.every(q=>object(q) && topic(q.topic_category) && typeof q.source_notes === 'string' && Array.from(q.source_notes.replace(/^ +| +$/g,'')).length <= 1000 && adminQuestion(q))
    || !Array.isArray(v.audit) || v.audit.length > 50 || !v.audit.every(timedAdminAudit)
    || (v.next_before !== null && !cursor(v.next_before)) || !object(v.counts) || !timedCounts.every(k=>integer((v.counts as Record<string,unknown>)[k]))
    || !Array.isArray(v.pools) || !v.pools.every(p=>object(p) && topic(p.topic_category) && text(p.sport,2,80) && integer(p.approved_count))) throw unavailable();
  return projectDto<TimedQuizAdminSnapshot>(v,adminShape);
}
function timedAdminAudit(a:unknown):boolean{
  if(!object(a)||!cursor(a.id)||!text(a.action)||!nullableText(a.actor_id)||!nullableText(a.question_id)||!nullableText(a.reason)||!timestamp(a.created_at))return false;
  const editorial=['question_create','question_edit','question_approve','question_archive','question_void'].includes(a.action);
  const management=['settings','retention'].includes(a.action);
  const participant=['start','answer','skip','end','preferences','invitation'].includes(a.action);
  // Editorial records retain permitted provenance. Participant graphs and management question links remain redacted.
  return editorial||(management&&a.question_id===null)||(participant&&a.actor_id===null&&a.question_id===null);
}
/** @purpose Reap only bounded expired recovery/guard records, with an actor-bound audit reason and honest preserved count. */
export async function pruneTimedSportQuizHistory(reason: string, expectedActorId: string): Promise<TimedQuizRetentionReceipt> {
  const v=await callRpc<unknown>('quiz_admin_retention',{p_reason:reason,p_expected_actor_id:expectedActorId});
  if (!object(v) || v.contract_version !== 2 || hasSecret(v) || v.batch_limit !== 500 || !['removed_guards','removed_requests','preserved_guards'].every(k=>integer(v[k]))) throw unavailable();
  return projectDto<TimedQuizRetentionReceipt>(v,retentionShape);
}
