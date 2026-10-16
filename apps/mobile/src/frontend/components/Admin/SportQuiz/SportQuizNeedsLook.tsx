/**
 * QUIZ-05 "Needs a look": auto-paused, queued (daily cap), flagged and reported questions with their reasons, and the
 * admin's Restore, Edit, Dismiss and Archive. Aggregates only: responders and percentages appear from the minimum
 * responder count, report counts by reason since the last review, never a reporter. Edit reuses the "Add a question"
 * form and saves through the atomic edit_replace (fun facts cannot be edited: the athlete's words are theirs).
 * @sideEffects None directly; the desk binds Restore / Dismiss / Archive / Edit to its captured admin identity.
 */
import {useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {AdminBtn,AdminField,AdminPanel} from '@/components/Admin/AdminChrome';
import type {NeedsLook,NeedsLookAction,NeedsLookRow} from '@/lib/freshQuestions';
import type {TimedQuizAdminQuestion,TimedQuizAdminQuestionInput} from '@/lib/sportQuiz';
import {SportQuizAddQuestion} from './SportQuizAddQuestion';
import {draftFromQuestion,topicLabel} from './triviaDesk';

export type SportQuizNeedsLookProps={data:NeedsLook|null;missing:boolean;error:string|null;busy:string|null;full:{trivia:boolean;life:boolean};
  onAction:(questionId:string,action:NeedsLookAction,reason:string)=>void;onEdit:(questionId:string,payload:TimedQuizAdminQuestionInput)=>void};
const FLAG_WORDS:Record<string,string>={too_easy:'too easy (almost everyone gets it)',confusing:'confusing (very few get it right)',too_long:'too long (many run out of time)'};
const REASON_WORDS:[keyof NeedsLookRow['reports'],string][]=[['wrong_answer','Wrong answer'],['confusing','Confusing'],['not_okay','Not okay'],['private','Shares something private']];

/** @purpose Reasons in words for one row: pause, queue, flags, difficulty and report counts. */
export function lookReasons(q:NeedsLookRow):string[]{
  const out:string[]=[];
  if(q.paused_at)out.push(q.pause_reason==='fact_report'?'Paused: a fun fact was reported as not okay or private.':'Paused: reported by enough accounts.');
  if(q.queued_at)out.push('Waiting for an admin: today\'s auto-pause limit for this topic was reached.');
  for(const f of q.flags)out.push(`Flag: ${FLAG_WORDS[f]??f}.`);
  if(q.responders!==null)out.push(`${q.responders} players · ${q.right_pct}% right · ${q.timeout_pct}% ran out of time · ${q.difficulty??'no'} difficulty.`);
  const counts=REASON_WORDS.filter(([k])=>q.reports[k]>0).map(([k,label])=>`${label} ${q.reports[k]}`);
  if(q.reports.open)out.push(`Reports since the last review: ${counts.join(', ')} (${q.reports.counted} counted, ${q.reports.not_counted} not counted).`);
  return out;
}
function asAdminQuestion(q:NeedsLookRow):TimedQuizAdminQuestion{
  return {id:q.question_id,question_key:q.question_key,version:q.version,topic_category:q.topic_category as TimedQuizAdminQuestion['topic_category'],sport:q.sport,prompt:q.prompt,options:q.options,
    question_type:q.question_type as TimedQuizAdminQuestion['question_type'],correct_option:q.correct_option,explanation:q.explanation,source_notes:q.source_notes,reason:'Needs a look',
    status:q.status,created_at:'',created_by:null,reviewed_at:null,reviewed_by:null,chapter:q.chapter as TimedQuizAdminQuestion['chapter'],min_age_band:q.chapter?'13':null,education_only:q.education_only};
}

/** @purpose The Needs a look list with one reason field for every action. */
export function SportQuizNeedsLook({data,missing,error,busy,full,onAction,onEdit}:SportQuizNeedsLookProps){
  const [reason,setReason]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const ok=Array.from(reason.trim()).length>=10&&Array.from(reason.trim()).length<=500;
  return <AdminPanel title="Needs a look">
    <Text>Spotting and pausing are automatic; publishing never is. Restore puts a paused question back (three new reports pause it again), Dismiss keeps it as it is, Archive takes it out, and Edit saves a new draft for review.</Text>
    {missing?<Text>Needs a look is not switched on in this database.</Text>:error?<Text accessibilityRole="alert">{`Needs a look could not be read: ${error}`}</Text>:!data?<Text>Reading Needs a look…</Text>:<>
      {data.alerts.length?<Text accessibilityRole="alert">{`Today's auto-pause limit was reached for: ${data.alerts.map(topicLabel).join(', ')}. New reports wait here for you.`}</Text>:null}
      <AdminField label="Reason for these actions" value={reason} onChangeText={setReason}/>
      {!ok?<Text>The reason needs 10 to 500 characters.</Text>:null}
      {data.questions.length?data.questions.map(q=><View key={q.question_id} style={styles.row} accessibilityLabel={`Needs a look: ${q.prompt}`}>
        <Text style={styles.title}>{`${q.is_fact?'Fun fact':topicLabel(q.topic_category)} · ${q.sport} · ${q.status}`}</Text>
        <Text>{q.prompt}</Text>
        <Text>{q.options.map((o,i)=>`${i===q.correct_option?'✓ ':''}${o}`).join(' · ')}</Text>
        {lookReasons(q).map(r=><Text key={r}>{r}</Text>)}
        {editing===q.question_id?<SportQuizAddQuestion busy={busy} full={full} initial={draftFromQuestion(asAdminQuestion(q),reason.trim()||'Needs a look edit')} editKey={q.question_key}
          onCancel={()=>setEditing(null)} onSave={payload=>{onEdit(q.question_id,payload);setEditing(null);}}/>
        :<View style={styles.buttons}>
          {q.paused_at?<AdminBtn label="Restore" kind="primary" disabled={!!busy||!ok} onPress={()=>onAction(q.question_id,'restore',reason.trim())}/>
            :<AdminBtn label="Dismiss" disabled={!!busy||!ok} onPress={()=>onAction(q.question_id,'dismiss',reason.trim())}/>}
          {!q.is_fact&&q.question_type!=='image_choice'?<AdminBtn label="Edit" disabled={!!busy} onPress={()=>setEditing(q.question_id)}/>:null}
          <AdminBtn label={q.is_fact?'Archive (decline this fun fact)':'Archive'} kind="danger" disabled={!!busy||!ok} onPress={()=>onAction(q.question_id,'archive',reason.trim())}/>
        </View>}
      </View>):<Text>Nothing needs a look right now.</Text>}
    </>}
  </AdminPanel>;
}
const styles=StyleSheet.create({row:{gap:4,paddingVertical:8,borderTopWidth:StyleSheet.hairlineWidth,borderColor:'#c9c9c9'},title:{fontWeight:'700'},buttons:{flexDirection:'row',flexWrap:'wrap',gap:8}});
