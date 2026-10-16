/**
 * Trivia "Drafts to review" (2026-10-15): walks the loaded drafts one at a time with the player preview, explanation
 * and source note, and Approve, Edit, Archive and Next. Filters narrow by topic, sport or Life chapter, and a counter
 * shows each Life chapter's progress towards opening ("Money Huddle: 3 of 5 approved to open"). Every Approve and
 * Archive is its own audited write through the existing quiz_admin_question path with the session reason (default
 * "Content review"). Edit saves a new draft version and archives the one it replaces (one server transaction when the
 * server has edit_replace; the desk owns that choice and its two-step fallback).
 * Filter counts and the drafts in each view come from the snapshot's whole-bank `bank_counts`, so unloaded drafts are
 * counted; without it (an older server) they are counted from the loaded pages and labelled "(loaded so far)".
 * @sideEffects None directly; the desk binds writes to its captured canonical admin identity.
 */
import {useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {AdminBtn,AdminField,AdminPills} from '@/components/Admin/AdminChrome';
import {LIFE_CHAPTER_IDS,type LifeAdminSnapshot,type LifeChapterId} from '@/lib/lifePlaybook';
import {sportQuizOptionsIssue,type QuizQuestionAction,type TimedQuizAdminQuestion,type TimedQuizAdminQuestionInput,type TimedQuizBankCounts,type TimedQuizQuestionTopic} from '@/lib/sportQuiz';
import {SportQuizAddQuestion} from './SportQuizAddQuestion';
import {lifeChapterTitle} from './SportQuizLifeQuestion';
import {SportQuizPreview} from './SportQuizPreview';
import {DEFAULT_REVIEW_REASON,LOADED_SO_FAR,TRIVIA_TOPICS,chapterProgress,draftFromQuestion,reviewCounts,topicLabel} from './triviaDesk';

export type SportQuizReviewProps={questions:TimedQuizAdminQuestion[];draftTotal:number;life:LifeAdminSnapshot|null;busy:string|null;imagesEnabled:boolean;
  /** Whole-bank counts from quiz_admin_snapshot; undefined on an older server (loaded-page counts, labelled). */
  bankCounts?:TimedQuizBankCounts;
  full:{trivia:boolean;life:boolean};nextCursor:string|null;onLoadMore:()=>void;
  onWrite:(id:string,action:QuizQuestionAction,payload:TimedQuizAdminQuestionInput)=>void;onRevise:(id:string,payload:TimedQuizAdminQuestionInput)=>void};
type TopicFilter='all'|TimedQuizQuestionTopic;
const sourceOk=(s:string)=>{const n=Array.from(s.replace(/^ +| +$/g,'')).length;return n>=10&&n<=1000;};

/** @purpose Why Approve is unavailable for this draft, in words; null when the server's approval rules can pass. */
function approveIssue(q:TimedQuizAdminQuestion,imagesEnabled:boolean):string|null{
  if(q.question_type==='image_choice')return imagesEnabled?'Image questions need the second-admin rights review under All questions.':'Image questions cannot be approved while images are off.';
  if(sportQuizOptionsIssue(q.options,q.question_type??'choice4'))return 'The answers are not valid. Edit or archive this draft.';
  if(!sourceOk(q.source_notes))return 'The source note is missing. Edit this draft to add one.';
  if(q.topic_category==='life'&&q.education_only!==true)return 'Missing the education-only attestation. Edit this draft to add it.';
  return null;
}

/** @purpose One draft at a time, filtered, with the actions a reviewer needs and the Life chapter counters. */
export function SportQuizReview({questions,draftTotal,life,busy,imagesEnabled,bankCounts,full,nextCursor,onLoadMore,onWrite,onRevise}:SportQuizReviewProps){
  const [reason,setReason]=useState(DEFAULT_REVIEW_REASON);
  const [topic,setTopic]=useState<TopicFilter>('all');
  const [sport,setSport]=useState('all');
  const [chapter,setChapter]=useState<'all'|LifeChapterId>('all');
  const [index,setIndex]=useState(0);
  const [editing,setEditing]=useState<string|null>(null);
  const allDrafts=questions.filter(q=>q.status==='draft');
  const counts=reviewCounts(bankCounts,questions);
  // Sports with drafts anywhere in the bank (or loaded, on an older server), so a sport whose drafts are unloaded still shows.
  const sports=[...new Set([...Object.entries(counts.sports).filter(([,t])=>t.draft>0).map(([id])=>id),...allDrafts.filter(q=>q.topic_category==='sport').map(q=>q.sport)])].sort();
  const n=(t:{draft:number}|undefined)=>` (${t?.draft??0})`;
  const viewTotal=topic==='all'?counts.drafts:topic==='sport'&&sport!=='all'?counts.sports[sport]?.draft??0
    :topic==='life'&&chapter!=='all'?counts.chapters[chapter]?.draft??0:counts.topics[topic]?.draft??0;
  const drafts=allDrafts.filter(q=>(topic==='all'||q.topic_category===topic)&&(topic!=='sport'||sport==='all'||q.sport===sport)
    &&(topic!=='life'||chapter==='all'||q.chapter===chapter));
  const at=drafts.length?Math.min(index,drafts.length-1):0;
  const q=drafts[at]??null;
  const reasonOk=Array.from(reason.trim()).length>=10&&Array.from(reason.trim()).length<=500;
  const issue=q?approveIssue(q,imagesEnabled):null;
  const pick=(next:Partial<{topic:TopicFilter;sport:string;chapter:'all'|LifeChapterId}>)=>{
    if(next.topic!==undefined){setTopic(next.topic);setSport('all');setChapter('all');}
    if(next.sport!==undefined)setSport(next.sport);
    if(next.chapter!==undefined)setChapter(next.chapter);
    setIndex(0);setEditing(null);
  };
  const where=(x:TimedQuizAdminQuestion)=>x.topic_category==='life'?`Life Playbook · ${x.chapter?lifeChapterTitle(x.chapter):x.sport}`:x.topic_category==='sport'?`Sports · ${x.sport}`:topicLabel(x.topic_category);
  return <View style={styles.wrap}>
    <Text accessibilityRole="header" style={styles.head}>Drafts to review</Text>
    <AdminField label="Session reason" value={reason} onChangeText={setReason}/>
    <Text>Every Approve and Archive records this reason with your account, one question at a time.</Text>
    {!reasonOk?<Text accessibilityRole="alert">The session reason needs 10 to 500 characters.</Text>:null}
    <Text>{counts.whole?'Draft counts cover the whole question bank, loaded or not.':`Draft counts ${LOADED_SO_FAR}: this database does not send whole-bank counts yet.`}</Text>
    <AdminPills<TopicFilter> label="Show drafts for" value={topic} items={[{id:'all',label:`All topics${n({draft:counts.drafts})}`},...TRIVIA_TOPICS.map(t=>({id:t.id,label:`${t.label}${n(counts.topics[t.id])}`}))]} onChange={id=>pick({topic:id})}/>
    {topic==='sport'&&sports.length?<AdminPills label="Sport" value={sport} items={[{id:'all',label:`All sports${n(counts.topics.sport)}`},...sports.map(id=>({id,label:`${id}${n(counts.sports[id])}`}))]} onChange={id=>pick({sport:id})}/>:null}
    {topic==='life'?<AdminPills<'all'|LifeChapterId> label="Life chapter" value={chapter} items={[{id:'all',label:`All chapters${n(counts.topics.life)}`},...LIFE_CHAPTER_IDS.map(id=>({id,label:`${lifeChapterTitle(id)}${n(counts.chapters[id])}`}))]} onChange={id=>pick({chapter:id})}/>:null}
    <View accessibilityLabel="Life chapter progress" style={styles.progress}>
      <Text accessibilityRole="header" style={styles.sub}>Life Playbook chapters</Text>
      {life?chapterProgress(life,counts).map(p=><Text key={p.id}>{p.text}</Text>):<Text>Life Playbook is not switched on in this database.</Text>}
    </View>
    <Text>{`${drafts.length?`Draft ${at+1} of ${drafts.length}`:'No drafts'} loaded in this view · ${viewTotal} draft${viewTotal===1?'':'s'} in this view${counts.whole?' in the whole bank':` ${LOADED_SO_FAR}`} · ${allDrafts.length} of ${counts.whole?counts.drafts:draftTotal} drafts loaded.${nextCursor?' Load more questions to see the rest.':''}`}</Text>
    {q&&editing===q.id?<SportQuizAddQuestion key={q.id} busy={busy} full={full} initial={draftFromQuestion(q,reason)} editKey={q.question_key}
      onCancel={()=>setEditing(null)} onSave={payload=>{onRevise(q.id,payload);setEditing(null);}}/>
    :q?<>
      <Text style={styles.meta}>{`${where(q)} · ${q.question_type==='true_false'?'True or false':q.question_type==='image_choice'?'Image':'Four choices'} · version ${q.version}`}</Text>
      <SportQuizPreview topic={where(q)} prompt={q.prompt} type={q.question_type??'choice4'} options={q.options} correct={q.correct_option} explanation={q.explanation}/>
      <Text>{`Source note: ${q.source_notes||'missing'}`}</Text>
      {issue?<Text accessibilityRole="alert">{issue}</Text>:null}
      <View style={styles.row}>
        <AdminBtn label={busy==='approve'?'Approving…':'Approve'} kind="primary" disabled={!!busy||!reasonOk||!!issue} onPress={()=>onWrite(q.id,'approve',{reason:reason.trim()})}/>
        <AdminBtn label="Edit" disabled={!!busy||q.question_type==='image_choice'} onPress={()=>setEditing(q.id)}/>
        <AdminBtn label="Archive" disabled={!!busy||!reasonOk} onPress={()=>onWrite(q.id,'archive',{reason:reason.trim()})}/>
        <AdminBtn label="Next" disabled={!!busy||drafts.length<2} onPress={()=>setIndex((at+1)%drafts.length)}/>
      </View>
      {q.question_type==='image_choice'?<Text>Edit image questions under All questions.</Text>:null}
    </>:<Text>No drafts match this view.</Text>}
    {nextCursor?<AdminBtn label="Load more questions to review" disabled={!!busy} onPress={onLoadMore}/>:null}
  </View>;
}
const styles=StyleSheet.create({wrap:{gap:6},head:{fontSize:18,fontWeight:'800'},sub:{fontSize:15,fontWeight:'700'},progress:{gap:2,marginVertical:6},meta:{fontWeight:'700'},row:{flexDirection:'row',flexWrap:'wrap',gap:8}});
