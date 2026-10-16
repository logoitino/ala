/**
 * QUIZ-02 admin-first timed learning: actor-bound testing/stop, full paged inventory, effective expiry and retention.
 * QUIZ-03 adds round size and the trivia.groups / trivia.images switches, question types, the bank forecast, group
 * counts, the audited group case view with removal, and group retention.
 * QUIZ-04 adds the Life Playbook desk (switch, levels, chapters and aggregate statistics) and Life question fields; it
 * is read separately so a missing migration never blanks the desk. One admin approves Life questions (owner 2026-10-15).
 * Control tower (2026-10-15): the desk is "Trivia". It opens with the status summary, then the question bank whose
 * default path is the simple "Add a question" form, a "Drafts to review" queue and All questions (the advanced editor);
 * the Life chapters, groups, and one Settings panel (trivia state and testers, rounds and switches, Life switch and levels).
 * The review queue counts the whole bank (quiz_admin_snapshot.bank_counts) and its Edit is one atomic edit_replace, with
 * the loaded-page counts and the two-step edit kept as fallbacks for a server without them.
 * QUIZ-05 adds Needs a look (Restore / Edit / Dismiss / Archive), the athlete fun-fact queue, Bulk import (paste, dry-run
 * preview, Import as drafts) and the fun-fact / report / self-heal settings; each reads separately ("not switched on").
 * @sideEffects Admin quiz RPCs and existing Analytics/Health/Support navigation. No participant prompts or public rewards.
 */
import {useCallback,useEffect,useRef,useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {useRouter,type Href} from 'expo-router';
import {AdminBtn,AdminField,AdminMetrics,AdminNotice,AdminPage,AdminPanel,AdminPills,AdminSectionTitle} from '@/components/Admin/AdminChrome';
import {AdminShell} from '@/components/Admin/AdminShell';
import {useAdminAction} from '@/hooks/useAdminAction';
import {useAuth} from '@/context/AuthContext';
import {editReplaceUnsupported,fetchTimedSportQuizAdmin,fetchTriviaGroupCase,pruneTimedSportQuizHistory,removeFromTriviaGroup,replaceSportQuizDraft,saveSportQuizQuestion,saveSportQuizSettings,saveTriviaPlaySettings,
  type QuizQuestionAction,type TimedQuizAdminQuestionInput,type TimedQuizAdminSnapshot,type TriviaGroupCase,type TriviaPlaySettingsInput} from '@/lib/sportQuiz';
import {fetchLifeAdmin,saveLifeSettings,setLifeChapterOpen,lifeCopyRules,type LifeAdminSnapshot,type LifeChapterId,type LifeLevelThresholds} from '@/lib/lifePlaybook';
import {SportQuizBank} from './SportQuizBank';
import {SportQuizLife} from './SportQuizLife';
import {SportQuizGroups} from './SportQuizGroups';
import {SportQuizForecast} from './SportQuizPlay';
import {SportQuizAddQuestion} from './SportQuizAddQuestion';
import {SportQuizReview} from './SportQuizReview';
import {SportQuizSettings} from './SportQuizSettings';
import {TriviaStatusLines} from './TriviaStatusCard';
import {readFailure,triviaStatus} from './triviaDesk';
import {actOnNeedsLook,decideFact,fetchFactQueue,fetchNeedsLook,importTriviaQuestions,saveFreshSettings,
  type FactDecisionInput,type FactQueue,type FreshSettingsInput,type ImportResult,type ImportRow,type NeedsLook,type NeedsLookAction} from '@/lib/freshQuestions';
import {SportQuizNeedsLook} from './SportQuizNeedsLook';
import {SportQuizFacts} from './SportQuizFacts';
import {SportQuizImport} from './SportQuizImport';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Source={epoch:number;data:TimedQuizAdminSnapshot|null;loading:boolean;error:string|null};
type SideRead<T>={epoch:number;data:T|null;missing:boolean;error:string|null};

/** @purpose Gate mounting of the private operations desk using the existing canonical admin shell. */
export function SportQuizTool(){return <AdminShell><SportQuizDesk/></AdminShell>;}

/** @purpose Keep all actions/read completions bound to the captured current canonical admin identity. */
function SportQuizDesk(){
  const router=useRouter();const auth=useAuth();
  const actor=!auth.loading&&auth.isAdmin&&auth.user?.id&&auth.profile?.id&&auth.profile.user_id===auth.user.id?auth.profile.id:null;
  const key=actor?JSON.stringify([auth.user?.id,actor]):null;
  const scope=useRef({key,epoch:0,active:false,read:0});
  if(scope.current.key!==key)scope.current={key,epoch:scope.current.epoch+1,active:false,read:0};
  const epoch=scope.current.epoch;
  const current=useCallback(()=>!!actor&&scope.current.epoch===epoch&&scope.current.key===key&&scope.current.active,[actor,epoch,key]);
  const [source,setSource]=useState<Source>({epoch:-1,data:null,loading:true,error:null});
  const [tab,setTab]=useState<'operate'|'data'>('operate');const [reason,setReason]=useState('');const [testers,setTesters]=useState('');
  const actionEpoch=useRef<number|null>(null);
  const [caseFile,setCaseFile]=useState<TriviaGroupCase|null>(null);
  const [life,setLife]=useState<{epoch:number;data:LifeAdminSnapshot|null;error:string|null;missing?:boolean}>({epoch:-1,data:null,error:null});
  const [view,setView]=useState<'add'|'review'|'all'|'import'>('add');const [added,setAdded]=useState(0);
  // QUIZ-05 reads are separate so an unapplied migration shows "not switched on" instead of failing the desk.
  const [facts,setFacts]=useState<SideRead<FactQueue>>({epoch:-1,data:null,missing:false,error:null});
  const [look,setLook]=useState<SideRead<NeedsLook>>({epoch:-1,data:null,missing:false,error:null});
  const [importResult,setImportResult]=useState<ImportResult|null>(null);
  const {busy,message,run}=useAdminAction();
  const data=source.epoch===epoch&&key?source.data:null;
  const loading=source.epoch!==epoch||source.loading;
  const error=source.epoch===epoch?source.error:null;
  const load=useCallback(async()=>{
    if(!current())return;
    const sequence=++scope.current.read;
    setSource(old=>({...old,epoch,loading:true,error:null}));
    try{
      const next=await fetchTimedSportQuizAdmin();
      if(current()&&sequence===scope.current.read){setSource({epoch,data:next,loading:false,error:null});setTesters(next.settings?.pilot_accounts.join('\n')??'');}
      // Life is read on its own: before QUIZ-04 is applied it shows "not switched on" instead of failing the desk.
      try{const lifeData=await fetchLifeAdmin();if(current()&&sequence===scope.current.read)setLife({epoch,data:lifeData,error:null});}
      catch(lifeError){if(current()&&sequence===scope.current.read)setLife({epoch,data:null,...readFailure(lifeError)});}
      const [f,l]=await Promise.allSettled([fetchFactQueue(),fetchNeedsLook()]);
      if(current()&&sequence===scope.current.read){
        setFacts(f.status==='fulfilled'?{epoch,data:f.value,missing:false,error:null}:{epoch,data:null,...readFailure(f.reason)});
        setLook(l.status==='fulfilled'?{epoch,data:l.value,missing:false,error:null}:{epoch,data:null,...readFailure(l.reason)});
      }
    }catch(caught){if(current()&&sequence===scope.current.read)setSource({epoch,data:null,loading:false,error:caught instanceof Error?caught.message:'Timed quiz source unavailable.'});}
  },[current,epoch]);
  useEffect(()=>{scope.current.active=true;setReason('');setTesters('');setCaseFile(null);if(actor)void load();else setSource({epoch,data:null,loading:false,error:null});
    return()=>{if(scope.current.epoch===epoch)scope.current.active=false;};},[actor,epoch,load]);
  const hasReason=Array.from(reason.trim()).length>=10&&Array.from(reason.trim()).length<=500;
  const pilotIds=testers.split(/[\s,]+/).filter(Boolean);
  const validTesters=pilotIds.length<=100&&pilotIds.every(id=>uuid.test(id))&&new Set(pilotIds).size===pilotIds.length;
  const action=(label:string,work:()=>Promise<string>)=>{if(!current()||busy)return;actionEpoch.current=epoch;void run(label,work);};
  const configure=(enabled:boolean,ids:string[])=>action('settings',async()=>{
    if(!current()||!actor)return '';
    await saveSportQuizSettings({enabled,pilot_accounts:ids},reason.trim(),actor);
    if(!current())return '';
    setReason('');await load();return enabled?'Enabled for listed local testers only.':'Paused for local testing.';
  });
  const writeQuestion=(id:string|null,kind:QuizQuestionAction,payload:TimedQuizAdminQuestionInput)=>action(kind,async()=>{
    if(!current()||!actor)return '';
    await saveSportQuizQuestion(id,kind,payload,actor);
    if(!current())return '';
    setReason('');if(kind==='create')setAdded(n=>n+1);await load();return kind==='void'?'Question voided. Affected badges are hidden with a private correction.':kind==='review_media'?'Image rights review recorded.':kind==='edit'?'New draft version created. Issued questions stay unchanged.':kind==='create'?'Draft created; verify facts and family before approval.':`Question ${kind==='approve'?'approved':'archived'}.`;
  });
  // Review-queue Edit: one server transaction (edit_replace) saves the new version, archives the draft it replaces and
  // writes both audit rows; any refusal leaves both unchanged. An older server refuses the action before writing, so
  // the desk falls back to the two audited steps below and keeps their partial-failure warning.
  const reviseDraft=(id:string,payload:TimedQuizAdminQuestionInput)=>lifeAction('revise',async()=>{
    if(!current()||!actor)return '';
    try{
      await replaceSportQuizDraft(id,payload,actor);
      if(!current())return '';await load();return 'New version saved for review; the earlier draft was archived in the same step.';
    }catch(e){
      if(e instanceof Error&&/quiz_replace_draft_only/.test(e.message)){if(current())await load();throw new Error('Nothing was saved: this question is no longer a draft (someone approved, archived or voided it). The list is refreshed.');}
      if(!editReplaceUnsupported(e))throw e;
    }
    if(!current())return '';
    await saveSportQuizQuestion(id,'edit',payload,actor);
    if(!current())return '';
    try{await saveSportQuizQuestion(id,'archive',{reason:payload.reason},actor);}
    catch(e){if(current())await load();throw new Error(`New version saved, but the earlier draft was not archived: ${e instanceof Error?e.message:'unknown error'}. Archive it in Drafts to review.`);}
    if(!current())return '';await load();return 'New version saved for review; the earlier draft was archived.';
  });
  const moreQuestions=()=>{
    if(!data?.next_question_cursor)return;const cursor=data.next_question_cursor;
    action('questions',async()=>{
      const next=await fetchTimedSportQuizAdmin({question_cursor:cursor,audit_before:null});
      if(!current())return '';
      setSource(old=>old.epoch===epoch&&old.data?{...old,data:{...old.data,questions:[...old.data.questions,...next.questions.filter(q=>!old.data?.questions.some(oldQ=>oldQ.id===q.id))],question_total:next.question_total,next_question_cursor:next.next_question_cursor}}:old);
      return 'Question page loaded. Full totals and loaded rows are shown separately.';
    });
  };
  const moreAudit=()=>{
    if(!data?.next_before)return;const cursor=data.next_before;
    action('audit',async()=>{
      const next=await fetchTimedSportQuizAdmin({question_cursor:null,audit_before:cursor});
      if(!current())return '';
      setSource(old=>old.epoch===epoch&&old.data?{...old,data:{...old.data,audit:[...old.data.audit,...next.audit.filter(a=>!old.data?.audit.some(oldA=>oldA.id===a.id))],next_before:next.next_before}}:old);
      return 'Earlier audit loaded; question paging is unchanged.';
    });
  };
  const prune=()=>action('retention',async()=>{
    if(!current()||!actor)return '';
    const receipt=await pruneTimedSportQuizHistory(reason.trim(),actor);
    if(!current())return '';
    setReason('');await load();
    return `Removed ${receipt.removed_guards} expired guards and ${receipt.removed_requests} recovery records; preserved ${receipt.preserved_guards} unexpired guards. `
      +`Groups: ${receipt.removed_codes??0} expired codes, ${receipt.removed_group_sets??0} past shared sets, ${receipt.removed_join_attempts??0} old join attempts, ${receipt.removed_groups??0} closed groups. `
      +`Reports: ${receipt.cleared_reporters??0} reporter ids cleared (90 days), ${receipt.removed_reports??0} reports deleted (180 days). Batch limit ${receipt.batch_limit}.`;
  });
  const savePlay=(next:TriviaPlaySettingsInput)=>action('play',async()=>{
    if(!current()||!actor)return '';
    const receipt=await saveTriviaPlaySettings(next,reason.trim(),actor);
    if(!current())return '';
    setReason('');await load();return `Saved: ${receipt.round_size} per round · groups ${receipt.groups_enabled?'on':'off'} · images ${receipt.images_enabled?'on':'off'}.`;
  });
  const openCase=(groupId:string)=>action('case',async()=>{
    if(!current()||!actor)return '';
    const file=await fetchTriviaGroupCase(groupId,reason.trim(),actor);
    if(!current())return '';
    setCaseFile(file);return 'Case opened and recorded in the group audit log.';
  });
  const removeGroupMember=(groupId:string,profileId:string|null)=>action('remove',async()=>{
    if(!current()||!actor)return '';
    const why=reason.trim();
    const receipt=await removeFromTriviaGroup(groupId,profileId,why,actor);
    if(!current())return '';
    const file=await fetchTriviaGroupCase(groupId,why,actor);
    if(!current())return '';
    setCaseFile(file);setReason('');await load();
    return receipt.outcome==='closed'?'Group closed; its code stopped working.':receipt.outcome==='already_closed'?'Group was already closed.':'Member removed; they cannot rejoin and the code rotated.';
  });
  // Life copy refusals name the broken rules; show them in words.
  const lifeAction=(label:string,work:()=>Promise<string>)=>action(label,async()=>{try{return await work();}catch(e){const rules=e instanceof Error?lifeCopyRules(e.message):[];
    if(rules.length)throw new Error(`Refused by the Life copy rules: ${rules.join(', ')}.`);throw e;}});
  const saveLife=(lifeEnabled:boolean,thresholds:LifeLevelThresholds)=>lifeAction('life_settings',async()=>{
    if(!current()||!actor)return '';const r=await saveLifeSettings({life_enabled:lifeEnabled,level_thresholds:thresholds},reason.trim(),actor);
    if(!current())return '';setReason('');await load();return `Saved: trivia.life ${r.life_enabled?'on':'off'}; level thresholds updated.`;});
  const chapter=(id:LifeChapterId,open:boolean)=>lifeAction('life_chapter',async()=>{
    if(!current()||!actor)return '';await setLifeChapterOpen(id,open,reason.trim(),actor);
    if(!current())return '';setReason('');await load();return open?'Chapter opened.':'Chapter closed.';});
  // QUIZ-05 actions: fun-fact decisions, Needs a look, fresh settings and bulk import.
  const decide=(factId:string,input:FactDecisionInput)=>action(input.action==='approve'?'fact_approve':'fact_decline',async()=>{
    if(!current()||!actor)return '';const r=await decideFact(factId,input,actor);if(!current())return '';await load();
    return r.status==='approved'?'Fun fact approved; it can now be drawn where the athlete\'s settings allow.':'Fun fact declined with your reason.';});
  const lookAction=(questionId:string,kind:NeedsLookAction,why:string)=>action(`look_${kind}`,async()=>{
    if(!current()||!actor)return '';await actOnNeedsLook(questionId,kind,why,actor);if(!current())return '';await load();
    return kind==='restore'?'Restored: it can be drawn again; three new reports would pause it again.':kind==='dismiss'?'Kept as it is; current flags and reports are cleared from the list.':'Archived.';});
  const lookEdit=(questionId:string,payload:TimedQuizAdminQuestionInput)=>lifeAction('look_edit',async()=>{
    if(!current()||!actor)return '';await replaceSportQuizDraft(questionId,payload,actor);if(!current())return '';await load();
    return 'New draft saved for review; the question that needed a look was archived in the same step.';});
  const saveFresh=(next:FreshSettingsInput)=>action('fresh',async()=>{
    if(!current()||!actor)return '';const r=await saveFreshSettings(next,reason.trim(),actor);if(!current())return '';setReason('');await load();
    return `Saved: fun facts ${r.athlete_questions_enabled?'on':'off'} at ${r.athlete_share_pct}% · report intake ${r.reports_paused?'paused':'open'} · thresholds updated.`;});
  const runImport=(rows:ImportRow[],dryRun:boolean)=>action(dryRun?'import_preview':'import',async()=>{
    if(!current()||!actor)return '';const r=await importTriviaQuestions(rows,dryRun,reason.trim(),actor);if(!current())return '';setImportResult(r);
    if(!dryRun){setReason('');await load();}
    return dryRun?`Preview: ${r.rows_ready} ready, ${r.rows_refused} refused, ${r.rows_warned} with warnings. Nothing was saved.`:`Imported ${r.rows_ready} drafts; ${r.rows_refused} refused. Review them in Drafts to review.`;});
  const lifeData=life.epoch===epoch?life.data:null;
  const lifeError=life.epoch===epoch?life.error:null;
  const playSettings=data?.settings&&typeof data.settings.round_size==='number'?{round_size:data.settings.round_size,groups_enabled:!!data.settings.groups_enabled,images_enabled:!!data.settings.images_enabled}:null;
  // Every question write goes through quiz_admin_question; Life refusals are explained with the Life copy rule names.
  const questionWrite=(id:string|null,kind:QuizQuestionAction,payload:TimedQuizAdminQuestionInput)=>{
    if(payload.topic_category==='life'||data?.questions.find(q=>q.id===id)?.topic_category==='life')lifeAction(kind,async()=>{
      if(!current()||!actor)return '';await saveSportQuizQuestion(id,kind,payload,actor);if(!current())return '';setReason('');if(kind==='create')setAdded(n=>n+1);await load();
      return `Life question ${kind==='approve'?'approved':kind==='create'||kind==='edit'?'draft saved':kind==='void'?'voided':'archived'}.`;});
    else writeQuestion(id,kind,payload);
  };
  const blocked=busy||(!data?.settings?'unavailable':null);
  const full={trivia:!!data&&(data.active_total??data.question_total)>=data.question_cap,life:!!data&&data.life_active_total!==undefined&&data.life_cap!==undefined&&data.life_active_total>=data.life_cap};
  return <AdminPage title="Trivia" lede="Fun facts players learn in short optional rounds. Add and review questions, run Life Playbook chapters and groups, and change switches in Settings. Private noncash badges after right or wrong answers; no money, Aura or vote effects." refreshing={loading} onRefresh={()=>{if(!busy)void load();}} error={error}>
    <View style={styles.links}>{(['analytics','health','support'] as const).map(path=><AdminBtn key={path} label={path==='analytics'?'Analytics':path==='health'?'Health':'Support'} onPress={()=>router.push(`/admin/${path}` as Href)}/>)}</View>
    <AdminNotice text={actionEpoch.current===epoch?message?.text??null:null} tone={message?.tone}/>
    {loading&&!data&&!error?<Text>Reading timed quiz source…</Text>:null}
    {!key&&!auth.loading?<Text>Current canonical admin account is unavailable.</Text>:null}
    {data?<>
      <AdminPanel title="Trivia status">
        <TriviaStatusLines status={triviaStatus({data,missing:false,error:null},{data:lifeData,missing:!!life.missing,error:lifeError})}/>
      </AdminPanel>
      <SportQuizNeedsLook data={look.epoch===epoch?look.data:null} missing={look.epoch===epoch&&look.missing} error={look.epoch===epoch?look.error:null} busy={blocked}
        full={full} onAction={lookAction} onEdit={lookEdit}/>
      <AdminField label="Review or correction reason" value={reason} onChangeText={setReason} multiline/>
      <Text>Settings, All questions actions, group cases and retention record this reason. Add a question and Drafts to review keep their own reason.</Text>
      <AdminPills label="Quiz desk" items={[{id:'operate',label:'Operate'},{id:'data',label:'Data'}]} value={tab} onChange={setTab}/>
      <AdminSectionTitle>Question bank</AdminSectionTitle>
      {tab==='operate'?<AdminPills label="Questions" value={view} items={[{id:'add',label:'Add a question'},{id:'review',label:'Drafts to review'},{id:'all',label:'All questions'},{id:'import',label:'Bulk import'}]} onChange={setView}/>:null}
      {tab==='operate'&&view==='import'?<SportQuizImport busy={blocked} hasReason={hasReason} result={importResult} onPreview={rows=>runImport(rows,true)} onImport={rows=>runImport(rows,false)}/>
        :tab==='operate'&&view==='add'?<SportQuizAddQuestion busy={blocked} full={full} resetSignal={added} onSave={payload=>questionWrite(null,'create',payload)}/>
        :tab==='operate'&&view==='review'?<SportQuizReview questions={data.questions} draftTotal={data.counts.questions_draft} bankCounts={data.bank_counts} life={lifeData} busy={blocked} imagesEnabled={!!data.settings?.images_enabled}
          full={full} nextCursor={data.next_question_cursor} onLoadMore={moreQuestions} onWrite={(id,kind,payload)=>questionWrite(id,kind,payload)} onRevise={reviseDraft}/>
        :<SportQuizBank key={key} questions={data.questions} total={data.question_total} activeTotal={data.active_total??data.question_total} cap={data.question_cap} nextCursor={data.next_question_cursor} busy={blocked} reason={reason} tab={tab}
          imagesEnabled={!!data.settings?.images_enabled} actorId={actor} lifeActiveTotal={data.life_active_total} lifeCap={data.life_cap} onLoadMore={moreQuestions} onWrite={questionWrite}/>}
      <SportQuizFacts data={facts.epoch===epoch?facts.data:null} missing={facts.epoch===epoch&&facts.missing} error={facts.epoch===epoch?facts.error:null} busy={blocked} onDecide={decide}/>
      <SportQuizLife data={lifeData} error={lifeError} busy={blocked} hasReason={hasReason} onChapter={chapter}/>
      <SportQuizGroups counts={data.groups??null} reports={data.reports??[]} caseFile={caseFile} busy={busy} hasReason={hasReason} onOpenCase={openCase} onRemove={removeGroupMember}/>
      <SportQuizSettings settings={data.settings} weekStart={data.week_start} weekEnd={data.week_end} generatedAt={data.generated_at} testers={testers} onTesters={setTesters}
        pilotIds={pilotIds} validTesters={validTesters} hasReason={hasReason} busy={busy} onConfigure={configure} play={playSettings} onSavePlay={savePlay}
        life={lifeData} lifeError={lifeError} onSaveLife={saveLife} fresh={data.fresh??null} onSaveFresh={saveFresh}/>
      <AdminSectionTitle>Numbers</AdminSectionTitle>
      <AdminMetrics items={[
        {label:'Draft questions',value:data.counts.questions_draft},{label:'Approved questions',value:data.counts.questions_approved},{label:'Archived questions',value:data.counts.questions_archived},{label:'Void questions',value:data.counts.questions_void},
        {label:'Issued this UTC week',value:data.counts.week_issued},{label:'Completed this UTC week',value:data.counts.week_completed},{label:'Skipped this UTC week',value:data.counts.week_skipped},{label:'Voided this UTC week',value:data.counts.week_void},
        {label:'Ended this UTC week',value:data.counts.week_ended},{label:'Expired this UTC week (effective)',value:data.counts.week_expired},
        {label:'Private badges issued',value:data.counts.badges_issued},{label:'Badges void',value:data.counts.badges_void},{label:'Weekly invitation preferences',value:data.counts.preferences_weekly},
        {label:'Issued families',value:data.counts.exposures},{label:'Spent weekly opportunities',value:data.counts.week_spent},{label:'Retained quota guards',value:data.counts.retained_guards},{label:'Retained recovery records',value:data.counts.retained_requests},
        {label:'Questions issued in rounds this week',value:data.counts.week_items_issued??0},{label:'Answers this week (facts learned)',value:data.counts.week_items_answered??0},
        {label:'Short rounds this week',value:data.counts.week_rounds_short??0},{label:'Personal rounds this week',value:data.counts.week_rounds_personal??0},{label:'Group rounds this week',value:data.counts.week_rounds_group??0},{label:'Voided round questions this week',value:data.counts.week_items_void??0},
        {label:'Sport explorer badges',value:data.counts.badges_sport??0},{label:'Family Challenger badges',value:data.counts.badges_family??0},{label:'Season Learner badges',value:data.counts.badges_season??0},
        {label:'Badges visible to groups',value:data.counts.badges_group_visible??0},{label:'Facts learned this quarter (all recaps)',value:data.counts.recap_facts_quarter??0},
      ]}/>
      <Text>Effective expiry uses server time at this source read; it does not claim a saved closure receipt. Participant identities, answers and capability values are withheld.</Text>
      <AdminPanel title="Reviewed topic pools">
        <Text>Approved inventory by topic; these totals are not an account's unseen availability.</Text>
        {data.pools.length?data.pools.map(p=><Text key={`${p.topic_category}:${p.sport}`}>{`${p.topic_category} · ${p.sport} · ${p.approved_count} approved versions`}</Text>):<Text>No approved topic pools at this source read.</Text>}
      </AdminPanel>
      <SportQuizForecast forecast={data.forecast??[]}/>
      {tab==='data'?<>
        <AdminSectionTitle>Audit and corrections</AdminSectionTitle>
        <Text>Server actor/time; participant answers and identities are withheld. Voiding hides invalid badges and gives the account a private correction.</Text>
        {data.audit.length?data.audit.map(a=><Text key={a.id} style={styles.audit}>{`${a.created_at} · ${a.action} · actor ${a.actor_id??'withheld'} · question ${a.question_id??'none'}${a.reason?` · ${a.reason}`:''}`}</Text>):<Text>No recorded quiz actions at this source read.</Text>}
        <AdminBtn label="Load earlier audit" disabled={!!busy||!data.next_before} onPress={moreAudit}/>
      </>:null}
      <AdminPanel title="Retention and recovery">
        <Text>Clear history removes learning records, issued-family history, badges and recovery receipts, and ends this week's opportunity. Preferences, notice and monotonic revisions remain. Minimal profile/week/spent/prune quota fields remain for 35 days; account deletion cascades them. Future questions can repeat after erasure.</Text>
        <Text>Clear history also leaves every trivia group (the oldest member becomes creator, or the group dissolves), removes own join attempts, the shared sets of groups that dissolve and every badge, including group-visible ones. A removal record stays so a removed member still cannot rejoin.</Text>
        <Text>Pruning removes only expired recovery records and quota guards in bounded batches. Unexpired guards are preserved. It also removes expired group codes, shared sets 35 days after their week, join attempts after 35 days and groups closed for 35 days; the group audit log stays. A lost erasure response requires Refresh and review before a new confirmation; never automatically erase a newer revision.</Text>
        <AdminBtn label="Prune expired recovery records" disabled={!!busy||!hasReason||!data.settings} onPress={prune}/>
      </AdminPanel>
    </>:null}
  </AdminPage>;
}
const styles=StyleSheet.create({links:{flexDirection:'row',flexWrap:'wrap',gap:8},audit:{fontSize:13,marginVertical:5}});
