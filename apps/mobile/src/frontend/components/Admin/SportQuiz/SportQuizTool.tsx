/**
 * QUIZ-02 admin-first timed learning: actor-bound testing/stop, full paged inventory, effective expiry and retention.
 * @sideEffects Admin quiz RPCs and existing Analytics/Health/Support navigation. No participant prompts or public rewards.
 */
import {useCallback,useEffect,useRef,useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {useRouter,type Href} from 'expo-router';
import {AdminBtn,AdminField,AdminMetrics,AdminNotice,AdminPage,AdminPanel,AdminPills,AdminSectionTitle} from '@/components/Admin/AdminChrome';
import {AdminShell} from '@/components/Admin/AdminShell';
import {useAdminAction} from '@/hooks/useAdminAction';
import {useAuth} from '@/context/AuthContext';
import {fetchTimedSportQuizAdmin,pruneTimedSportQuizHistory,saveSportQuizQuestion,saveSportQuizSettings,type QuizQuestionAction,type TimedQuizAdminQuestionInput,type TimedQuizAdminSnapshot} from '@/lib/sportQuiz';
import {SportQuizBank} from './SportQuizBank';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Source={epoch:number;data:TimedQuizAdminSnapshot|null;loading:boolean;error:string|null};

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
    }catch(caught){if(current()&&sequence===scope.current.read)setSource({epoch,data:null,loading:false,error:caught instanceof Error?caught.message:'Timed quiz source unavailable.'});}
  },[current,epoch]);
  useEffect(()=>{scope.current.active=true;setReason('');setTesters('');if(actor)void load();else setSource({epoch,data:null,loading:false,error:null});
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
    setReason('');await load();return kind==='void'?'Question voided. Affected badges are hidden with a private correction.':kind==='edit'?'New draft version created. Issued questions stay unchanged.':kind==='create'?'Draft created; verify facts and family before approval.':`Question ${kind==='approve'?'approved':'archived'}.`;
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
    setReason('');await load();return `Removed ${receipt.removed_guards} expired guards and ${receipt.removed_requests} recovery records; preserved ${receipt.preserved_guards} unexpired guards. Batch limit ${receipt.batch_limit}.`;
  });
  return <AdminPage title="Sport Pop Quiz" lede="Optional timed learning. Private noncash completion badges after right or wrong answers; no money, Aura or vote effects." refreshing={loading} onRefresh={()=>{if(!busy)void load();}} error={error}>
    <View style={styles.links}>{(['analytics','health','support'] as const).map(path=><AdminBtn key={path} label={path==='analytics'?'Analytics':path==='health'?'Health':'Support'} onPress={()=>router.push(`/admin/${path}` as Href)}/>)}</View>
    <AdminNotice text={actionEpoch.current===epoch?message?.text??null:null} tone={message?.tone}/>
    {loading&&!data&&!error?<Text>Reading timed quiz source…</Text>:null}
    {!key&&!auth.loading?<Text>Current canonical admin account is unavailable.</Text>:null}
    {data?<>
      <AdminPanel title="Testing audience">
        {data.settings?<>
          <Text>{`${data.settings.enabled?'Enabled for listed testers':'Paused'} · testing only · ${data.settings.pilot_accounts.length}/100 tester accounts`}</Text>
          <Text>{`UTC week: ${data.week_start} to ${data.week_end} (end excluded). Source read ${data.generated_at}.`}</Text>
          <AdminField label="Review or correction reason" value={reason} onChangeText={setReason} multiline/>
          <AdminField label="Tester profile IDs" value={testers} onChangeText={setTesters} multiline placeholder="Canonical profile UUIDs separated by commas or new lines"/>
          <Text>No Stripe, athlete or school verification requirement. The server checks accepted age and enrolled account capability.</Text>
          <Text>Invitations default off. Manual play remains optional. 30 or 90 seconds before Start; the server owns expiry. Pause permanently ends active rounds.</Text>
          <AdminBtn label="Enable for listed testers" kind="primary" disabled={!!busy||!hasReason||!validTesters||!pilotIds.length} onPress={()=>configure(true,pilotIds)}/>
          <AdminBtn label="Save tester list while paused" disabled={!!busy||!hasReason||!validTesters} onPress={()=>configure(false,pilotIds)}/>
          <AdminBtn label="Pause quiz" kind="danger" disabled={!!busy||!hasReason} onPress={()=>configure(false,data.settings?.pilot_accounts??[])}/>
        </>:<Text>Settings unavailable. No enable, pause or mutation controls are available; repair the singleton source.</Text>}
      </AdminPanel>
      <AdminMetrics items={[
        {label:'Draft questions',value:data.counts.questions_draft},{label:'Approved questions',value:data.counts.questions_approved},{label:'Archived questions',value:data.counts.questions_archived},{label:'Void questions',value:data.counts.questions_void},
        {label:'Issued this UTC week',value:data.counts.week_issued},{label:'Completed this UTC week',value:data.counts.week_completed},{label:'Skipped this UTC week',value:data.counts.week_skipped},{label:'Voided this UTC week',value:data.counts.week_void},
        {label:'Ended this UTC week',value:data.counts.week_ended},{label:'Expired this UTC week (effective)',value:data.counts.week_expired},
        {label:'Private badges issued',value:data.counts.badges_issued},{label:'Badges void',value:data.counts.badges_void},{label:'Weekly invitation preferences',value:data.counts.preferences_weekly},
        {label:'Issued families',value:data.counts.exposures},{label:'Spent weekly opportunities',value:data.counts.week_spent},{label:'Retained quota guards',value:data.counts.retained_guards},{label:'Retained recovery records',value:data.counts.retained_requests},
      ]}/>
      <Text>Effective expiry uses server time at this source read; it does not claim a saved closure receipt. Participant identities, answers and capability values are withheld.</Text>
      <AdminPanel title="Reviewed topic pools">
        <Text>Approved inventory by topic; these totals are not an account's unseen availability.</Text>
        {data.pools.length?data.pools.map(p=><Text key={`${p.topic_category}:${p.sport}`}>{`${p.topic_category} · ${p.sport} · ${p.approved_count} approved versions`}</Text>):<Text>No approved topic pools at this source read.</Text>}
      </AdminPanel>
      <AdminPills label="Quiz desk" items={[{id:'operate',label:'Operate'},{id:'data',label:'Data'}]} value={tab} onChange={setTab}/>
      <SportQuizBank key={key} questions={data.questions} total={data.question_total} cap={data.question_cap} nextCursor={data.next_question_cursor} busy={busy||(!data.settings?'unavailable':null)} reason={reason} tab={tab} onLoadMore={moreQuestions} onWrite={writeQuestion}/>
      {tab==='data'?<>
        <AdminSectionTitle>Audit and corrections</AdminSectionTitle>
        <Text>Server actor/time; participant answers and identities are withheld. Voiding hides invalid badges and gives the account a private correction.</Text>
        {data.audit.length?data.audit.map(a=><Text key={a.id} style={styles.audit}>{`${a.created_at} · ${a.action} · actor ${a.actor_id??'withheld'} · question ${a.question_id??'none'}${a.reason?` · ${a.reason}`:''}`}</Text>):<Text>No recorded quiz actions at this source read.</Text>}
        <AdminBtn label="Load earlier audit" disabled={!!busy||!data.next_before} onPress={moreAudit}/>
      </>:null}
      <AdminPanel title="Retention and recovery">
        <Text>Clear history removes learning records, issued-family history, badges and recovery receipts, and ends this week's opportunity. Preferences, notice and monotonic revisions remain. Minimal profile/week/spent/prune quota fields remain for 35 days; account deletion cascades them. Future questions can repeat after erasure.</Text>
        <Text>Pruning removes only expired recovery records and quota guards in bounded batches. Unexpired guards are preserved. A lost erasure response requires Refresh and review before a new confirmation; never automatically erase a newer revision.</Text>
        <AdminBtn label="Prune expired recovery records" disabled={!!busy||!hasReason||!data.settings} onPress={prune}/>
      </AdminPanel>
    </>:null}
  </AdminPage>;
}
const styles=StyleSheet.create({links:{flexDirection:'row',flexWrap:'wrap',gap:8},audit:{fontSize:13,marginVertical:5}});
