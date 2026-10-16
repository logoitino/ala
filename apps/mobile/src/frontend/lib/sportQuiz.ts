/**
 * QUIZ-02 bound timed adapter, extended by QUIZ-03 (rounds of up to five with Next, question types, badge shelf,
 * season recap, family groups and the admin group desk). QUIZ-05: shown-order answers (results are read in shown
 * positions), fun-fact fields, the snapshot's refill / fresh blocks and the new audit actions; its own RPCs are in
 * lib/freshQuestions.ts. Server owns time, identity and private learning.
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
  TimedQuizRetentionReceipt, TimedQuizSettingsReceipt, TimedQuizAdminQuestionInput, TimedQuizQuestionType,
} from '@shared/timedSportQuiz';
export type {QuizQuestionAction,QuizQuestionPayload,QuizQuestionReceipt,QuizSettingsInput} from '@shared/sportQuiz';
export type * from '@shared/timedSportQuiz';
export { TIMED_QUIZ_NOTICE_VERSION, TIMED_QUIZ_DURATIONS } from '@shared/timedSportQuiz';
import type {
  TriviaNextInput, TriviaNextReceipt, TriviaGroupStartInput, TriviaGroupPage, TriviaGroupRemoved, TriviaGroupWithCode, TriviaJoinResult,
  TriviaLeaveResult, TriviaCodeReceipt, TriviaReportReceipt, TriviaMyGroups, TriviaBadgeShelf, TriviaBadgeReceipt, TriviaSeasonRecap,
  TriviaPlaySettingsInput, TriviaPlaySettingsReceipt, TriviaGroupCase, TriviaGroupRemoval, TriviaGroupName, TriviaReportReason,
} from '@shared/triviaPlayTogether';
export type * from '@shared/triviaPlayTogether';
export { TRIVIA_GROUP_NAMES, TRIVIA_GROUP_LABELS, TRIVIA_REPORT_REASONS } from '@shared/triviaPlayTogether';

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

const questionTypes = ['choice4','true_false','image_choice'];
/** @purpose Match server option canonicalization per question type; semantic legacy defects stay readable for safe repair. */
export function sportQuizOptionsIssue(options: string[], type: TimedQuizQuestionType = 'choice4'): string | null {
  const normalized = options.map(option => option.trim()); // Same explicit ECMAScript whitespace set as quiz_normalize_options.
  const count = type === 'choice4' ? options.length === 4 : type === 'true_false' ? options.length === 2 && options[0] === 'True' && options[1] === 'False'
    : options.length >= 2 && options.length <= 4;
  return !count || normalized.some(option => Array.from(option).length < 1 || Array.from(option).length > 100)
    || new Set(normalized).size !== options.length ? 'Invalid answer choices. Archive or void this version, or create a corrected draft; do not approve it.' : null;
}
/** @purpose Authoring bounds use the same Unicode counts/ASCII text bounds and canonical option rules as SQL. */
export function sportQuizContentValid(content: { sport: string; prompt: string; options: string[]; explanation: string; question_type?: TimedQuizQuestionType }): boolean {
  return text(content.sport,2,80) && text(content.prompt,10,280) && text(content.explanation,10,500) && !sportQuizOptionsIssue(content.options,content.question_type ?? 'choice4');
}
/** @purpose Image rights rules from design §9.15, mirrored for the desk; the server re-checks every field. */
export function sportQuizMediaIssue(media: { media_path: string; media_licence: string; media_source: string; media_attribution: string; media_alt_text: string; media_size_bytes: number; media_has_person: boolean; media_no_marks?: boolean; media_exif_stripped?: boolean }, correctOption?: string): string | null {
  if (!/^[a-z0-9][a-z0-9_/-]{0,150}\.(jpg|jpeg|png|webp)$/.test(media.media_path)) return 'Use a lowercase quiz_media path ending in .jpg, .png or .webp.';
  if (!['owned','cc0','cc_by','licensed','public_domain'].includes(media.media_licence)) return 'Choose the licence type.';
  if (!text(media.media_source,3,300) || !text(media.media_attribution,2,200)) return 'Record the source and the attribution shown to players.';
  if (!text(media.media_alt_text,10,250)) return 'Alt text is required (10 to 250 characters).';
  if (correctOption && media.media_alt_text.toLowerCase().includes(correctOption.trim().toLowerCase())) return 'Alt text must not reveal the answer.';
  if (!Number.isInteger(media.media_size_bytes) || media.media_size_bytes < 1 || media.media_size_bytes > 307200) return 'Images must be 300 KB or smaller.';
  if (media.media_has_person) return 'No identifiable person may appear anywhere in the image.';
  if (media.media_no_marks !== true) return 'Confirm there are no school or league marks.';
  return media.media_exif_stripped === true ? null : 'Confirm EXIF data was stripped.';
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
  const type = value && typeof value === 'object' ? (value as Record<string,unknown>).question_type ?? 'choice4' : 'choice4';
  return object(value) && questionReceipt(value) && text(value.sport, 2, 80) && text(value.prompt, 10, 280) && questionTypes.includes(String(type))
    && strings(value.options) && (type === 'choice4' ? value.options.length === 4 : value.options.length >= 2 && value.options.length <= 4) && value.options.every(option => text(option, 1, 100))
    && typeof value.correct_option === 'number' && Number.isInteger(value.correct_option) && value.correct_option >= 0 && value.correct_option < value.options.length
    && (type !== 'image_choice' || (text(value.media_path) && text(value.media_alt_text,10,250) && typeof value.media_size_bytes === 'number' && value.media_size_bytes <= 307200 && value.media_has_person === false
      && value.media_no_marks === true && value.media_exif_stripped === true && (value.media_reviewed_by === null || text(value.media_reviewed_by))))
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
/**
 * @purpose Review-queue Edit in one server transaction (QUIZ-04 control tower): the new draft version, the archive of
 *   the draft it replaces and both audit rows commit together or not at all. An older server without the action refuses
 *   it before writing anything; `editReplaceUnsupported` recognises that so the desk can fall back to two steps.
 */
export async function replaceSportQuizDraft(id: string, payload: TimedQuizAdminQuestionInput, expectedActorId: string): Promise<QuizQuestionReceipt> {
  const value = await callRpc<unknown>('quiz_admin_question', { p_id: id, p_action: 'edit_replace', p_payload: payload, p_expected_actor_id: expectedActorId });
  if (!questionReceipt(value) || value.status !== 'draft' || value.replaced_id !== id || value.replaced_status !== 'archived') throw unavailable();
  return projectDto<QuizQuestionReceipt>(value,questionReceiptShape);
}
/** @purpose True when the server predates edit_replace: it refuses the unknown action with quiz_question_action_invalid
 * (the payload keys are the ones `edit` already accepts), before any write. */
export function editReplaceUnsupported(e: unknown): boolean {
  return e instanceof Error && /quiz_question_action_invalid/.test(e.message);
}

// QUIZ-04: question rows may carry topic 'life'; Life is still never a personal Start or fun-slot topic (server enforced).
// QUIZ-05: 'athlete' is a fun fact (Know your athlete), filled for the viewer at read time.
const topics = ['sport','science','geography','general','life','athlete'];
const roundKinds = ['personal','group','life'];
const statuses = ['issued','completed','skipped','void','ended','expired'];
const operations = ['preferences','invitation','start','answer','end','skip','next'];
const timedCounts = [...countKeys,'week_ended','week_expired','preferences_weekly','exposures','week_spent','retained_guards','retained_requests'];
const roundCounts = ['week_rounds_short','week_rounds_group','week_rounds_personal','questions_true_false','questions_image','week_items_issued','week_items_answered','week_items_void',
  'badges_sport','badges_family','badges_season','badges_group_visible','recap_facts_quarter'];
const groupCounts = ['groups_active','groups_closed','members_active','members_removed','groups_played_this_week','codes_active','codes_issued','joins_7d','refusals_7d',
  'wrong_codes_7d','reports_7d','sets_this_week','retained_sets','retained_join_attempts'];
const optionalInt = (v: unknown) => v === undefined || integer(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const nullableTime = (v: unknown) => v === null || timestamp(v);
const opaqueCursor = (v: unknown) => v === null || text(v);
const topic = (v: unknown) => topics.includes(String(v));
type WireShape = { [key:string]:true|WireShape|[WireShape] };
const fields=(...keys:string[]):WireShape=>Object.fromEntries(keys.map(key=>[key,true as const]));
const settingsShape=fields('contract_version','enabled','testing_only','pilot_accounts');
const questionReceiptShape=fields('id','question_key','version','status','replaced_id','replaced_status');
const preferencesShape=fields('invitation_mode','topic_mode','notice_version','notice_accepted_at','version','history_version','last_invited_week');
const attemptShape=fields('id','week_start','mode','status','started_at','expires_at','duration_seconds','closed_at','close_reason','effective_expired','correction_reason',
  'round_state','position','planned_items','round_size','next_by','answered_count','short_round','group_id','round_kind');
const questionShape:WireShape={...fields('id','question_key','version','topic_category','sport','prompt','options','question_type','shuffled'),fun_fact:fields('first_name','prompt_key')};
const resultShape:WireShape={...fields('answered_option','correct_option','was_correct','explanation','completed_at','position','item_status',
  'answered_position','correct_position','shown_order','stored_answered_option','stored_correct_option'),fun_fact:fields('first_name','athlete_player_id')};
const activeItemShape=fields('position','planned_items','expires_at');
const receiptShape:WireShape={...fields('contract_version','profile_id','request_id','operation','outcome','week_start','committed_at','round_kind'),attempt:attemptShape,result:resultShape,preferences:preferencesShape};
const startShape:WireShape={...receiptShape,server_now:true,active_question:questionShape,active_item:activeItemShape};
const snapshotShape:WireShape={...fields('contract_version','profile_id','server_now','week_start','week_end','testing_only','availability','week_spent','scheduled_topic','history_version','history_count','badge_count','correction_count','round_size','groups_available','active_round_kind'),
  week_spent_by_kind:fields('personal','group','life'),preferences:preferencesShape,attempt:attemptShape,pools:[fields('topic_category','sport','unseen_count','allowed')]};
const historyShape:WireShape={...fields('contract_version','profile_id','server_now','history_version','total','next_before'),
  items:[{attempt:attemptShape,question:questionShape,result:resultShape,items:[{...fields('position','status','correction_reason'),question:questionShape,result:resultShape}],
    badge:fields('id','label','visibility','issued_at','voided_at')}]};
const adminShape:WireShape={...fields('contract_version','generated_at','week_start','week_end','question_total','question_cap','next_question_cursor','next_before'),
  ...fields('active_total','life_active_total','life_cap'),
  settings:{...settingsShape,...fields('reason','updated_at','updated_by','round_size','groups_enabled','images_enabled')},
  questions:[{...questionShape,...fields('correct_option','explanation','source_notes','reason','status','created_at','created_by','reviewed_at','reviewed_by',
    'media_path','media_licence','media_source','media_attribution','media_alt_text','media_size_bytes','media_has_person','media_reviewed_by','media_reviewed_at','media_no_marks','media_exif_stripped',
    'chapter','min_age_band','education_only')}],
  audit:[fields('id','action','actor_id','question_id','reason','created_at')],counts:fields(...timedCounts,...roundCounts),pools:[fields('topic_category','sport','approved_count')],
  forecast:[fields('sport','approved_families','players_28d','issued_28d','pace_per_player_week','max_seen','weeks_left')],groups:fields(...groupCounts),
  reports:[fields('id','group_id','reason_code','created_at')],
  refill:[fields('scope','key','approved','pace_per_player_week','pace_source','max_seen','weeks_left','refill_needed')],
  fresh:{...fields('athlete_questions_enabled','athlete_share_pct','reports_paused','needs_look_count','paused_count','facts_admin_review','facts_guardian_review','facts_live','imports_30d','alerts'),
    self_heal:fields('min_responders','too_easy_pct','confusing_choice4_pct','confusing_true_false_pct','too_long_pct'),
    report_rules:fields('ordinary_reporters','fact_reporters','fact_reasons','restored_reporters','daily_pause_cap','min_account_days','per_account_per_day','reporter_clear_days','delete_days')},
  bank_counts:{topics:[fields('topic_category','draft_count','approved_count')],sports:[fields('sport','draft_count','approved_count')],chapters:[fields('chapter','draft_count','approved_count')]}};
// Whole-bank review counts (QUIZ-04 control tower): optional so an older server still reads; when present every row is
// one label and two non-negative counts. Content counts only; no participant field can travel here.
const bankCount=(r:unknown,label:string,ok:(v:unknown)=>boolean)=>object(r)&&ok(r[label])&&integer(r.draft_count)&&integer(r.approved_count);
function bankCounts(v:unknown):boolean{
  if(v===undefined)return true;
  return object(v)&&Array.isArray(v.topics)&&v.topics.every(r=>bankCount(r,'topic_category',topic))
    &&Array.isArray(v.sports)&&v.sports.every(r=>bankCount(r,'sport',x=>text(x,2,80)))
    &&Array.isArray(v.chapters)&&v.chapters.every(r=>bankCount(r,'chapter',x=>typeof x==='string'&&/^[a-z][a-z_]{2,39}$/.test(x)));
}
const eraseShape=fields('contract_version','profile_id','history_version','week_start','week_spent','quota_prune_after','removed_attempts','removed_exposures','removed_badges','removed_requests','removed_audit',
  'removed_group_memberships','retained_join_attempts','removed_group_sets','removed_levels','removed_reports');
const retentionShape=fields('contract_version','removed_guards','removed_requests','preserved_guards','batch_limit','removed_codes','removed_group_sets','removed_join_attempts','removed_groups','cleared_reporters','removed_reports','purged_declined_facts');
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
    if(child===undefined)continue; // QUIZ-03 additions are optional for QUIZ-02-era payloads; validators enforce required fields.
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
const smallInt = (v: unknown) => v === undefined || v === null || (integer(v) && v >= 1 && v <= 5);
function timedAttempt(v: unknown): boolean {
  return object(v) && promptFree(v) && text(v.id) && date(v.week_start) && ['legacy','timed','round'].includes(String(v.mode))
    && statuses.includes(String(v.status)) && nullableTime(v.started_at) && nullableTime(v.expires_at)
    && (v.duration_seconds === null || v.duration_seconds === 30 || v.duration_seconds === 90)
    && nullableTime(v.closed_at) && nullableText(v.close_reason) && typeof v.effective_expired === 'boolean' && nullableText(v.correction_reason)
    && !(v.mode === 'legacy' && v.status === 'issued')
    && (v.round_state === undefined || v.round_state === null || ['item','between'].includes(String(v.round_state)))
    && smallInt(v.position) && smallInt(v.planned_items) && smallInt(v.round_size) && (v.next_by === undefined || nullableTime(v.next_by))
    && optionalInt(v.answered_count) && (v.short_round === undefined || typeof v.short_round === 'boolean') && (v.group_id === undefined || nullableText(v.group_id))
    && (v.round_kind === undefined || roundKinds.includes(String(v.round_kind)))
    && (v.mode !== 'round' || v.status !== 'issued' || ((v.round_state === 'item' || v.round_state === 'between') && integer(v.position) && integer(v.planned_items)));
}
function timedQuestion(v: unknown, immutableHistory = false): boolean {
  const type = object(v) && v.question_type !== undefined ? v.question_type : 'choice4';
  return object(v) && text(v.id) && text(v.question_key) && integer(v.version) && v.version > 0 && topic(v.topic_category) && questionTypes.includes(String(type))
    && text(v.sport,2,80) && text(v.prompt,10,280) && strings(v.options) && v.options.length >= 2 && v.options.length <= 4 && (type !== 'choice4' || v.options.length === 4)
    && v.options.every(o=>text(o,1,100)) && (immutableHistory || !sportQuizOptionsIssue(v.options,type as TimedQuizQuestionType)) && !('correct_option' in v) && !('explanation' in v);
}
function timedResult(v: unknown): boolean {
  return object(v) && (v.answered_option === null || (integer(v.answered_option) && v.answered_option < 4))
    && integer(v.correct_option) && v.correct_option < 4 && (v.was_correct === null || typeof v.was_correct === 'boolean')
    && text(v.explanation,10,500) && nullableTime(v.completed_at) && !('prompt' in v) && !('question' in v)
    && (v.position === undefined || v.position === null || (integer(v.position) && v.position >= 1 && v.position <= 5))
    // QUIZ-05: 'fact_unavailable' = an unanswered fun fact that no longer passes the check (no positions, no card).
    && (v.item_status === undefined || v.item_status === null || ['answered','expired','ended','void','fact_unavailable'].includes(String(v.item_status)))
    // QUIZ-05 shown positions and order (after the reveal only).
    && [v.answered_position,v.correct_position].every(x => x === undefined || x === null || (integer(x) && x < 4))
    && (v.shown_order === undefined || v.shown_order === null || (Array.isArray(v.shown_order) && v.shown_order.length <= 4 && v.shown_order.every(x => integer(x) && x < 4)));
}
/**
 * @purpose QUIZ-05 answer shuffle: the server sends stored indices plus the shown positions. Screens index into the
 *   options as shown, so answered_option / correct_option become shown positions here; the stored indices are kept in
 *   stored_answered_option / stored_correct_option. Results without positions (older items) pass unchanged.
 */
export function displayResult<T extends Record<string,unknown>|null>(r:T):T{
  if(!r||typeof r.correct_position!=='number')return r;
  return {...r,stored_answered_option:r.answered_option??null,stored_correct_option:r.correct_option,
    answered_option:r.answered_option===null||r.answered_option===undefined?null:(typeof r.answered_position==='number'?r.answered_position:r.answered_option),
    correct_option:r.correct_position};
}
function activeItem(v: unknown, serverNow: unknown): boolean {
  return object(v) && integer(v.position) && v.position >= 1 && integer(v.planned_items) && v.planned_items >= v.position && v.planned_items <= 5
    && timestamp(v.expires_at) && timestamp(serverNow) && Date.parse(v.expires_at) > Date.parse(serverNow);
}
function receiptValid(v: unknown, allowStart = false): v is TimedQuizReceipt & Record<string,unknown> {
  return object(v) && v.contract_version === 2 && !hasSecret(v) && text(v.profile_id) && text(v.request_id)
    && operations.includes(String(v.operation)) && text(v.outcome) && date(v.week_start) && timestamp(v.committed_at)
    // A result travels only for a closed attempt or a round waiting for Next, never for an open item.
    && (v.attempt === null || timedAttempt(v.attempt)) && (v.result === null || (timedResult(v.result) && object(v.attempt) && (v.attempt.status !== 'issued' || v.attempt.round_state === 'between')))
    && (v.preferences === null || timedPreferences(v.preferences))
    && !['question','prompt','options','correct_option'].some(k=>k in v) && (allowStart || (!('active_question' in v) && !('active_item' in v)));
}
function checkReceipt(v: unknown, operation?: string, expectedProfile?: string, expectedRequest?: string): TimedQuizReceipt {
  if (!receiptValid(v) || (operation && v.operation !== operation) || (expectedProfile && v.profile_id !== expectedProfile)
    || (expectedRequest && v.request_id !== expectedRequest)) throw unavailable();
  const out = projectDto<TimedQuizReceipt>(v,receiptShape);
  return {...out,result:displayResult(out.result as Record<string,unknown>|null) as TimedQuizReceipt['result']};
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
    && ['history_version','history_count','badge_count','correction_count'].every(k=>integer(v[k]))
    && (v.round_size === undefined || (integer(v.round_size) && v.round_size >= 1 && v.round_size <= 5)) && (v.groups_available === undefined || typeof v.groups_available === 'boolean')
    && (v.active_round_kind === undefined || v.active_round_kind === null || roundKinds.includes(String(v.active_round_kind)))
    && (v.week_spent_by_kind === undefined || (object(v.week_spent_by_kind) && roundKinds.every(k => typeof (v.week_spent_by_kind as Record<string,unknown>)[k] === 'boolean')));
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
  return activeReceipt(v,'start',input.expected_profile_id,input.request_id);
}
/** @purpose Shared Start/Next check: a live prompt only with matching open metadata before the server deadline. */
function activeReceipt(v: unknown, operation: 'start'|'next', expectedProfile: string, expectedRequest: string): TimedQuizStartReceipt {
  if (!receiptValid(v,true) || v.operation !== operation || v.profile_id !== expectedProfile || v.request_id !== expectedRequest || !timestamp(v.server_now)
    || !('active_question' in v) || (v.active_question !== null && (!timedQuestion(v.active_question) || !object(v.attempt)
      || v.attempt.status !== 'issued' || v.attempt.effective_expired || !timestamp(v.attempt.expires_at)
      || (v.attempt.mode === 'timed' ? operation !== 'start' || Date.parse(v.attempt.expires_at) <= Date.parse(v.server_now)
        : v.attempt.mode !== 'round' || v.attempt.round_state !== 'item' || !activeItem(v.active_item,v.server_now)
          || (operation === 'start' && (v.active_item as Record<string,unknown>).position !== 1))))
    || (v.active_question === null && v.active_item != null)) throw unavailable();
  const out = projectDto<TimedQuizStartReceipt>(v,startShape);
  return {...out,result:displayResult(out.result as Record<string,unknown>|null) as TimedQuizStartReceipt['result']};
}
/** @purpose QUIZ-04 Life Start shares the Start check: a live prompt only with matching open metadata before the deadline. */
export function checkStartReceipt(v: unknown, expectedProfile: string, expectedRequest: string): TimedQuizStartReceipt {
  return activeReceipt(v,'start',expectedProfile,expectedRequest);
}
/** @purpose QUIZ-03 group round: the group's weekly opportunity, started only from that group's page. */
export async function startTriviaGroupRound(input: TriviaGroupStartInput): Promise<TimedQuizStartReceipt> {
  const v = await callRpc<unknown>('quiz_group_start',{p_group_id:input.group_id,p_duration_seconds:input.duration_seconds,p_expected_week:input.expected_week,
    p_notice_version:input.notice_version,p_request_id:input.request_id,p_session_secret:input.session_secret,p_expected_profile_id:input.expected_profile_id});
  return activeReceipt(v,'start',input.expected_profile_id,input.request_id);
}
/** @purpose QUIZ-03 Next: exact request/position/secret recovery returns the same item only before its deadline. */
export async function nextTriviaItem(input: TriviaNextInput): Promise<TriviaNextReceipt> {
  const v = await callRpc<unknown>('quiz_next',{p_attempt_id:input.attempt_id,p_expected_position:input.expected_position,p_request_id:input.request_id,
    p_session_secret:input.session_secret,p_expected_profile_id:input.expected_profile_id});
  return activeReceipt(v,'next',input.expected_profile_id,input.request_id);
}
/** @purpose Submit only the caller's exact chosen option/request/capability; no queue or fresh answer retry. */
export async function answerTimedSportQuiz(input: TimedQuizAnswerInput): Promise<TimedQuizReceipt> {
  return checkReceipt(await callRpc('quiz_answer',{p_attempt_id:input.attempt_id,p_option:input.option,p_request_id:input.request_id,p_session_secret:input.session_secret,p_expected_profile_id:input.expected_profile_id}),'answer',input.expected_profile_id,input.request_id);
}
/** @purpose End an owned attempt or cancel its original Start UUID; End needs no prompt capability. */
export async function endTimedSportQuiz(input: TimedQuizEndInput): Promise<TimedQuizReceipt> {
  return checkReceipt(await callRpc('quiz_end',{p_attempt_id:input.attempt_id,p_start_request_id:input.start_request_id,p_expected_week:input.expected_week,p_reason:input.reason,p_request_id:input.request_id,p_expected_profile_id:input.expected_profile_id,p_round_kind:input.round_kind ?? 'personal'}),'end',input.expected_profile_id,input.request_id);
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
      && (i.items === undefined || (Array.isArray(i.items) && i.items.length <= 5 && i.items.every(item=>object(item) && integer(item.position)
        && ['answered','expired','ended','void'].includes(String(item.status)) && timedQuestion(item.question,true) && timedResult(item.result) && nullableText(item.correction_reason))))
      && (i.badge === null || (object(i.badge) && text(i.badge.id) && ['Sport Learner','Trivia Explorer'].includes(String(i.badge.label))
        && ['private','groups'].includes(String(i.badge.visibility)) && timestamp(i.badge.issued_at) && nullableTime(i.badge.voided_at))))) throw unavailable();
  const page = projectDto<TimedQuizHistoryPage>(v,historyShape);
  // History questions are in each item's shown order, so results read in shown positions too (QUIZ-05).
  return {...page,items:page.items.map(i=>({...i,result:displayResult(i.result as Record<string,unknown>|null) as typeof i.result,
    items:i.items?.map(x=>({...x,result:displayResult(x.result as Record<string,unknown>) as typeof x.result}))}))};
}
/** @purpose CAS erasure spends this week and retains the disclosed minimal quota guard. Uncertain success requires a new review. */
export async function eraseTimedSportQuizHistory(expectedHistoryVersion: number, expectedProfileId: string): Promise<TimedQuizEraseReceipt> {
  const v=await callRpc<unknown>('quiz_erase_history',{p_expected_history_version:expectedHistoryVersion,p_expected_profile_id:expectedProfileId});
  if (!object(v) || v.contract_version !== 2 || hasSecret(v) || v.profile_id !== expectedProfileId || !integer(v.history_version)
    || !date(v.week_start) || v.week_spent !== true || !timestamp(v.quota_prune_after)
    || !['removed_attempts','removed_exposures','removed_badges','removed_requests','removed_audit'].every(k=>integer(v[k]))
    || !['removed_group_memberships','retained_join_attempts','removed_group_sets','removed_levels','removed_reports'].every(k=>optionalInt(v[k]))) throw unavailable();
  return projectDto<TimedQuizEraseReceipt>(v,eraseShape);
}
/** @purpose Read one 50-row question page independently of the bigint audit cursor, with authoritative full counts. */
export async function fetchTimedSportQuizAdmin(input: {question_cursor?: string|null; audit_before?: string|null} = {}): Promise<TimedQuizAdminSnapshot> {
  const v=await callRpc<unknown>('quiz_admin_snapshot',{p_question_cursor:input.question_cursor ?? null,p_audit_before:input.audit_before ?? null});
  if (!object(v) || v.contract_version !== 2 || hasSecret(v) || !timestamp(v.generated_at) || !date(v.week_start) || !date(v.week_end)
    || (v.settings !== null && (!settingsReceipt(v.settings) || v.settings.contract_version !== 2 || !text(v.settings.reason,10,500) || !timestamp(v.settings.updated_at) || !nullableText(v.settings.updated_by)))
    || !integer(v.question_total) || (v.question_cap !== 100 && v.question_cap !== 300) || (v.question_cap === 100 && v.question_total > 100)
    || (v.active_total !== undefined && (!integer(v.active_total) || v.active_total > v.question_cap || v.active_total > v.question_total)) || !opaqueCursor(v.next_question_cursor)
    || !optionalInt(v.life_active_total) || (v.life_cap !== undefined && v.life_cap !== 200)
    || !Array.isArray(v.questions) || v.questions.length > 50 || v.questions.length > v.question_total
    || !v.questions.every(q=>object(q) && topic(q.topic_category) && typeof q.source_notes === 'string' && Array.from(q.source_notes.replace(/^ +| +$/g,'')).length <= 1000 && adminQuestion(q))
    || !Array.isArray(v.audit) || v.audit.length > 50 || !v.audit.every(timedAdminAudit)
    || (v.next_before !== null && !cursor(v.next_before)) || !object(v.counts) || !timedCounts.every(k=>integer((v.counts as Record<string,unknown>)[k]))
    || !Array.isArray(v.pools) || !v.pools.every(p=>object(p) && topic(p.topic_category) && text(p.sport,2,80) && integer(p.approved_count)) || !bankCounts(v.bank_counts)
    || !roundCounts.every(k=>optionalInt((v.counts as Record<string,unknown>)[k]))
    || (v.refill !== undefined && (!Array.isArray(v.refill) || !v.refill.every(r=>object(r) && ['topic','sport','chapter'].includes(String(r.scope)) && text(r.key)
      && integer(r.approved) && integer(r.weeks_left) && integer(r.max_seen) && typeof r.refill_needed === 'boolean' && r.refill_needed === (r.weeks_left < 4))))
    || (v.fresh !== undefined && (!object(v.fresh) || typeof v.fresh.athlete_questions_enabled !== 'boolean' || typeof v.fresh.reports_paused !== 'boolean'
      || !integer(v.fresh.athlete_share_pct) || v.fresh.athlete_share_pct > 10 || !['needs_look_count','paused_count','facts_admin_review','facts_guardian_review','facts_live'].every(k=>integer((v.fresh as Record<string,unknown>)[k]))
      || !strings(v.fresh.alerts)))
    || (v.forecast !== undefined && (!Array.isArray(v.forecast) || !v.forecast.every(f=>object(f) && text(f.sport,2,80)
      && ['approved_families','players_28d','issued_28d','max_seen'].every(k=>integer(f[k])) && typeof f.pace_per_player_week === 'number' && f.pace_per_player_week >= 0
      && (f.weeks_left === null || integer(f.weeks_left)))))
    || (v.groups !== undefined && (!object(v.groups) || !groupCounts.every(k=>integer((v.groups as Record<string,unknown>)[k]))))
    || (v.reports !== undefined && (!Array.isArray(v.reports) || v.reports.length > 50 || !v.reports.every(r=>object(r) && cursor(r.id) && text(r.group_id)
      && ['safety','unwanted_contact','name_or_theme','other'].includes(String(r.reason_code)) && timestamp(r.created_at))))
    || (v.settings !== null && object(v.settings) && ((v.settings.round_size !== undefined && !(integer(v.settings.round_size) && v.settings.round_size >= 1 && v.settings.round_size <= 5))
      || (v.settings.groups_enabled !== undefined && typeof v.settings.groups_enabled !== 'boolean') || (v.settings.images_enabled !== undefined && typeof v.settings.images_enabled !== 'boolean')))) throw unavailable();
  return projectDto<TimedQuizAdminSnapshot>(v,adminShape);
}
function timedAdminAudit(a:unknown):boolean{
  if(!object(a)||!cursor(a.id)||!text(a.action)||!nullableText(a.actor_id)||!nullableText(a.question_id)||!nullableText(a.reason)||!timestamp(a.created_at))return false;
  // QUIZ-05 adds pause / restore / dismiss / import and the admin fun-fact decisions (participant fact rows never reach the feed).
  const editorial=['question_create','question_edit','question_approve','question_archive','question_void','question_review_media',
    'question_pause','question_restore','question_dismiss','question_import','fact_approve','fact_decline'].includes(a.action);
  // QUIZ-04 admin Life actions (switch, chapters) are management records; QUIZ-05 fresh settings and report alerts too.
  const management=['settings','retention','life_settings','life_chapter','fresh_settings','report_alert'].includes(a.action);
  const participant=['start','answer','skip','end','preferences','invitation'].includes(a.action);
  // Editorial records retain permitted provenance. Participant graphs and management question links remain redacted.
  return editorial||(management&&a.question_id===null)||(participant&&a.actor_id===null&&a.question_id===null);
}
/** @purpose Reap only bounded expired recovery/guard records, with an actor-bound audit reason and honest preserved count. */
export async function pruneTimedSportQuizHistory(reason: string, expectedActorId: string): Promise<TimedQuizRetentionReceipt> {
  const v=await callRpc<unknown>('quiz_admin_retention',{p_reason:reason,p_expected_actor_id:expectedActorId});
  if (!object(v) || v.contract_version !== 2 || hasSecret(v) || v.batch_limit !== 500 || !['removed_guards','removed_requests','preserved_guards'].every(k=>integer(v[k]))
    || !['removed_codes','removed_group_sets','removed_join_attempts','removed_groups','cleared_reporters','removed_reports','purged_declined_facts'].every(k=>optionalInt(v[k]))) throw unavailable();
  return projectDto<TimedQuizRetentionReceipt>(v,retentionShape);
}

// QUIZ-03 groups, badges, recap and admin group desk ---------------------------------------------------------------
const groupNames = ['family','friends','team_fans','cousins','game_day_crew','home_team'];
const memberKeys = ['member_ref','display_name','is_owner','is_me','played_this_week','badges'];
const groupCode = (v: unknown): v is string => typeof v === 'string' && /^[A-HJ-NP-Z2-9]{8}$/.test(v);
const memberShape = fields(...memberKeys);
const pageShape: WireShape = {...fields('contract_version','group_id','name_key','theme_sport','status','is_owner','week_start','everyone_played','code_active','code_expires_at','can_invite','outcome'),
  members:[memberShape],totals:fields('members','played_this_week','facts_this_week','facts_this_season')};
const badgeShape = fields('id','label','kind','sport','period','visibility','issued_at');
/** @purpose The page carries a played mark per member and group totals only; any extra member field is refused. */
function groupPage(v: unknown): v is TriviaGroupPage & Record<string,unknown> {
  return object(v) && v.contract_version === 3 && text(v.group_id) && groupNames.includes(String(v.name_key)) && (v.theme_sport === null || text(v.theme_sport,2,80))
    && ['active','closed'].includes(String(v.status)) && typeof v.is_owner === 'boolean' && date(v.week_start) && typeof v.everyone_played === 'boolean'
    && typeof v.code_active === 'boolean' && (v.code_expires_at === null || timestamp(v.code_expires_at)) && typeof v.can_invite === 'boolean'
    && (v.is_owner === true || v.code_expires_at === null)
    && Array.isArray(v.members) && v.members.length <= 12 && v.members.every(m => object(m) && Object.keys(m).every(k => memberKeys.includes(k))
      && (m.member_ref === null || (v.is_owner === true && typeof m.member_ref === 'string' && /^[0-9a-f]{32}$/.test(m.member_ref))) && text(m.display_name,1,200) && typeof m.is_owner === 'boolean'
      && typeof m.is_me === 'boolean' && typeof m.played_this_week === 'boolean' && strings(m.badges))
    && object(v.totals) && Object.keys(v.totals).length === 4 && ['members','played_this_week'].every(k => integer((v.totals as Record<string,unknown>)[k]))
    // Fact totals are null below 3 players and multiples of 5 otherwise, so polling cannot isolate one member.
    && ['facts_this_week','facts_this_season'].every(k => { const f = (v.totals as Record<string,unknown>)[k]; return f === null || (integer(f) && f % 5 === 0); })
    && (v.status === 'active' || v.members.length === 0);
}
function checkPage(v: unknown): TriviaGroupPage {
  if (hasSecret(v) || !groupPage(v)) throw unavailable();
  return projectDto<TriviaGroupPage>(v,pageShape);
}
function triviaBadge(v: unknown): boolean {
  return object(v) && text(v.id) && text(v.label,1,120) && ['weekly','sport','family','season','life'].includes(String(v.kind)) && (v.sport === null || text(v.sport))
    && (v.kind !== 'life' || v.visibility === 'private')
    && text(v.period) && ['private','groups'].includes(String(v.visibility)) && timestamp(v.issued_at);
}
/** @purpose Create a preset-named group; the code is returned once (null on an exact retry, which can renew it). */
export async function createTriviaGroup(name: TriviaGroupName, themeSport: string | null, requestId: string, expectedProfileId: string): Promise<TriviaGroupWithCode> {
  const v = await callRpc<unknown>('quiz_group_create',{p_name_key:name,p_theme_sport:themeSport,p_request_id:requestId,p_expected_profile_id:expectedProfileId});
  if (!object(v) || !(v.code === null || groupCode(v.code)) || typeof v.code_shown !== 'boolean') throw unavailable();
  return {...checkPage(v),code:v.code as string | null,code_shown:v.code_shown};
}
/** @purpose Join by code. Every refusal (wrong, expired, full, removed, blocked or teen rule) is the same "refused". */
export async function joinTriviaGroup(code: string, expectedProfileId: string): Promise<TriviaJoinResult> {
  const v = await callRpc<unknown>('quiz_group_join',{p_code:code,p_expected_profile_id:expectedProfileId});
  if (!object(v) || v.contract_version !== 3 || !['joined','refused'].includes(String(v.outcome)) || (v.outcome === 'refused') !== (v.group === null)) throw unavailable();
  return {contract_version:3,outcome:v.outcome as TriviaJoinResult['outcome'],group:v.group === null ? null : checkPage(v.group)};
}
/** @purpose Leave any time; a creator's group passes to the oldest member or dissolves. */
export async function leaveTriviaGroup(groupId: string, expectedProfileId: string): Promise<TriviaLeaveResult> {
  const v = await callRpc<unknown>('quiz_group_leave',{p_group_id:groupId,p_expected_profile_id:expectedProfileId});
  if (!object(v) || v.contract_version !== 3 || !['left','not_member'].includes(String(v.outcome))) throw unavailable();
  return {contract_version:3,outcome:v.outcome as TriviaLeaveResult['outcome']};
}
/** @purpose Creator removes a member by the page's opaque member_ref: they cannot rejoin, and the code rotates (new code returned once). */
export async function removeTriviaGroupMember(groupId: string, memberRef: string, expectedProfileId: string): Promise<TriviaGroupWithCode> {
  const v = await callRpc<unknown>('quiz_group_remove_member',{p_group_id:groupId,p_member_ref:memberRef,p_expected_profile_id:expectedProfileId});
  if (!object(v) || !(v.code === null || groupCode(v.code))) throw unavailable();
  return {...checkPage(v),code:v.code as string | null};
}
/** @purpose Creator renews the 7-day code (refused while the group is full or groups are paused). */
export async function renewTriviaGroupCode(groupId: string, expectedProfileId: string): Promise<TriviaCodeReceipt> {
  const v = await callRpc<unknown>('quiz_group_renew_code',{p_group_id:groupId,p_expected_profile_id:expectedProfileId});
  if (!object(v) || v.contract_version !== 3 || v.group_id !== groupId || !groupCode(v.code) || !timestamp(v.expires_at)) throw unavailable();
  return {contract_version:3,group_id:groupId,code:v.code,expires_at:v.expires_at};
}
/** @purpose Creator picks the weekly theme (a sport filter; null = all sports). A set already drawn this week stays. */
export async function setTriviaGroupTheme(groupId: string, themeSport: string | null, expectedProfileId: string): Promise<TriviaGroupPage> {
  return checkPage(await callRpc<unknown>('quiz_group_set_theme',{p_group_id:groupId,p_theme_sport:themeSport,p_expected_profile_id:expectedProfileId}));
}
/** @purpose Read one group page as a member; a removed member gets only the removal notice. */
export async function fetchTriviaGroup(groupId: string): Promise<TriviaGroupPage | TriviaGroupRemoved> {
  const v = await callRpc<unknown>('quiz_group_page',{p_group_id:groupId});
  if (object(v) && v.outcome === 'removed') {
    if (v.contract_version !== 3 || v.group_id !== groupId || !groupNames.includes(String(v.name_key)) || Object.keys(v).length !== 4) throw unavailable();
    return {contract_version:3,group_id:groupId,name_key:v.name_key as TriviaGroupName,outcome:'removed'};
  }
  if (!object(v) || !['member','closed'].includes(String(v.outcome))) throw unavailable();
  return checkPage(v);
}
/** @purpose The caller's own groups, removal notices and limits. */
export async function fetchMyTriviaGroups(): Promise<TriviaMyGroups> {
  const v = await callRpc<unknown>('quiz_groups_mine');
  const l = object(v) && object(v.limits) ? v.limits : null;
  if (!object(v) || v.contract_version !== 3 || hasSecret(v) || !text(v.profile_id) || !date(v.week_start) || typeof v.groups_enabled !== 'boolean'
    || !Array.isArray(v.groups) || !v.groups.every(g => object(g) && text(g.group_id) && groupNames.includes(String(g.name_key)) && (g.theme_sport === null || text(g.theme_sport))
      && typeof g.is_owner === 'boolean' && integer(g.members) && typeof g.played_this_week === 'boolean' && typeof g.everyone_played === 'boolean')
    || !Array.isArray(v.removed) || !v.removed.every(g => object(g) && text(g.group_id) && groupNames.includes(String(g.name_key)))
    || !l || !integer(l.created) || !integer(l.belong) || l.create_limit !== 3 || l.belong_limit !== 5 || l.max_members !== 12) throw unavailable();
  return projectDto<TriviaMyGroups>(v,{...fields('contract_version','profile_id','week_start','groups_enabled'),
    groups:[fields('group_id','name_key','theme_sport','is_owner','members','played_this_week','everyone_played')],removed:[fields('group_id','name_key')],
    limits:fields('created','create_limit','belong','belong_limit','max_members')});
}
/** @purpose Report a group with a fixed reason; the report carries the group id for Support/Admin. */
export async function reportTriviaGroup(groupId: string, reason: TriviaReportReason, expectedProfileId: string): Promise<TriviaReportReceipt> {
  const v = await callRpc<unknown>('quiz_group_report',{p_group_id:groupId,p_reason_code:reason,p_expected_profile_id:expectedProfileId});
  if (!object(v) || v.contract_version !== 3 || v.outcome !== 'reported' || v.group_id !== groupId) throw unavailable();
  return {contract_version:3,outcome:'reported',group_id:groupId};
}
/** @purpose Own badge shelf (private by default). */
export async function fetchTriviaBadgeShelf(): Promise<TriviaBadgeShelf> {
  const v = await callRpc<unknown>('quiz_badge_shelf');
  if (!object(v) || v.contract_version !== 3 || !text(v.profile_id) || !Array.isArray(v.badges) || !v.badges.every(triviaBadge)) throw unavailable();
  return projectDto<TriviaBadgeShelf>(v,{...fields('contract_version','profile_id'),badges:[badgeShape]});
}
/** @purpose Opt one badge in or out of the caller's group pages. */
export async function setTriviaBadgeVisibility(badgeId: string, visibility: 'private' | 'groups', expectedProfileId: string): Promise<TriviaBadgeReceipt> {
  const v = await callRpc<unknown>('quiz_badge_visibility',{p_badge_id:badgeId,p_visibility:visibility,p_expected_profile_id:expectedProfileId});
  if (!object(v) || v.contract_version !== 3 || v.id !== badgeId || v.visibility !== visibility || !triviaBadge(v)) throw unavailable();
  return projectDto<TriviaBadgeReceipt>(v,{...badgeShape,...fields('contract_version')});
}
/** @purpose Own season recap (calendar quarter, e.g. 2026-Q4; default the current one). */
export async function fetchTriviaSeasonRecap(quarter: string | null = null): Promise<TriviaSeasonRecap> {
  const v = await callRpc<unknown>('quiz_season_recap',{p_quarter:quarter});
  if (!object(v) || v.contract_version !== 3 || hasSecret(v) || !text(v.profile_id) || typeof v.quarter !== 'string' || !/^\d{4}-Q[1-4]$/.test(v.quarter)
    || !date(v.starts_on) || !date(v.ends_before) || !['facts','sports','rounds','badges'].every(k => integer(v[k]))
    || !Array.isArray(v.per_sport) || !v.per_sport.every(x => object(x) && text(x.sport) && integer(x.facts))
    || !Array.isArray(v.per_topic) || !v.per_topic.every(x => object(x) && topic(x.topic_category) && integer(x.facts))) throw unavailable();
  return projectDto<TriviaSeasonRecap>(v,{...fields('contract_version','profile_id','quarter','starts_on','ends_before','facts','sports','rounds','badges'),
    per_sport:[fields('sport','facts')],per_topic:[fields('topic_category','facts')]});
}
/** @purpose Admin: round size (1–5) and the trivia.groups / trivia.images switches, with an audited reason. */
export async function saveTriviaPlaySettings(input: TriviaPlaySettingsInput, reason: string, expectedActorId: string): Promise<TriviaPlaySettingsReceipt> {
  const v = await callRpc<unknown>('quiz_admin_play_settings',{p_payload:input,p_reason:reason,p_expected_actor_id:expectedActorId});
  if (!object(v) || v.contract_version !== 3 || !integer(v.round_size) || v.round_size < 1 || v.round_size > 5 || typeof v.groups_enabled !== 'boolean' || typeof v.images_enabled !== 'boolean') throw unavailable();
  return {contract_version:3,round_size:v.round_size,groups_enabled:v.groups_enabled,images_enabled:v.images_enabled};
}
/** @purpose Admin audited case view for one group id from a report: member ids, age bands, refusal reasons; never names. */
export async function fetchTriviaGroupCase(groupId: string, reason: string, expectedActorId: string): Promise<TriviaGroupCase> {
  const v = await callRpc<unknown>('quiz_admin_group_case',{p_group_id:groupId,p_reason:reason,p_expected_actor_id:expectedActorId});
  if (!object(v) || v.contract_version !== 3 || v.group_id !== groupId || !timestamp(v.generated_at) || JSON.stringify(v).match(/"(full_name|username|display_name)"/)
    || !(v.group === null || (object(v.group) && groupNames.includes(String(v.group.name_key)) && ['active','closed'].includes(String(v.group.status)) && integer(v.group.codes_issued)))
    || !Array.isArray(v.members) || !v.members.every(m => object(m) && text(m.profile_id) && text(m.age_band) && ['active','removed'].includes(String(m.status)) && timestamp(m.joined_at))
    || !Array.isArray(v.refusals) || !v.refusals.every(r => object(r) && text(r.profile_id) && text(r.age_band) && ['teen_rule','blocked','full','removed','closed'].includes(String(r.refusal_reason)))
    || !Array.isArray(v.cases) || !v.cases.every(c => object(c) && cursor(c.id) && text(c.kind) && timestamp(c.created_at))) throw unavailable();
  return projectDto<TriviaGroupCase>(v,{...fields('contract_version','generated_at','group_id'),
    group:fields('name_key','theme_sport','status','created_at','closed_at','close_reason','owner_id','codes_issued','code_active'),
    members:[fields('profile_id','age_band','status','joined_at','removed_at','removed_reason','is_owner')],
    refusals:[fields('profile_id','age_band','refusal_reason','created_at')],cases:[fields('id','kind','actor_id','subject_id','reason_code','reason','created_at')]});
}
/** @purpose Admin removal with a reason: one member (barred from rejoining, code rotates) or, with null, the whole group. */
export async function removeFromTriviaGroup(groupId: string, profileId: string | null, reason: string, expectedActorId: string): Promise<TriviaGroupRemoval> {
  const v = await callRpc<unknown>('quiz_admin_group_remove',{p_group_id:groupId,p_profile_id:profileId,p_reason:reason,p_expected_actor_id:expectedActorId});
  if (!object(v) || v.contract_version !== 3 || v.group_id !== groupId || !['removed','closed','already_closed'].includes(String(v.outcome)) || v.profile_id !== profileId) throw unavailable();
  return {contract_version:3,outcome:v.outcome as TriviaGroupRemoval['outcome'],group_id:groupId,profile_id:profileId};
}
