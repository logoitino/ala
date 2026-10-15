/**
 * Trivia "Add a question" (2026-10-15): the default way to add a fun fact. Pick a topic (Sports with a sport, Science,
 * Geography, Fun, or Life Playbook with a chapter), a type (True or false / Four choices), then the question, answers,
 * correct answer and a short explanation. Live checks show the server's limits and, for Life Playbook, the shared word
 * rules before saving; a player preview shows how it will look. Family, source note and reason sit under More options
 * with safe defaults ("new", "Everyday fact", "Added in admin"). The same form edits a draft from the review queue.
 * @sideEffects None directly; `onSave` hands the payload to the desk's bound quiz_admin_question writer.
 */
import {useEffect,useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {AdminBtn,AdminField,AdminPills} from '@/components/Admin/AdminChrome';
import {LIFE_CHAPTER_IDS,type LifeChapterId} from '@/lib/lifePlaybook';
import type {TimedQuizAdminQuestionInput,TimedQuizQuestionTopic} from '@/lib/sportQuiz';
import {SportQuizPreview} from './SportQuizPreview';
import {lifeChapterTitle} from './SportQuizLifeQuestion';
import {EMPTY_SIMPLE,LIFE_RULE_WORDS,TRIVIA_SPORTS,TRIVIA_TOPICS,simpleChecks,simplePayload,topicLabel,type SimpleDraft,type SimpleType} from './triviaDesk';

export type SportQuizAddQuestionProps={busy:string|null;full:{trivia:boolean;life:boolean};onSave:(payload:TimedQuizAdminQuestionInput)=>void;
  /** Edit mode: the stored draft's values and its family key; the topic stays fixed. */
  initial?:SimpleDraft;editKey?:string|null;onCancel?:()=>void;
  /** Changes after a successful save; clears the wording but keeps the topic, sport and type for the next question. */
  resetSignal?:number};

/** @purpose One plain form for new drafts and edits, with live checks and a player preview before saving. */
export function SportQuizAddQuestion({busy,full,onSave,initial,editKey=null,onCancel,resetSignal=0}:SportQuizAddQuestionProps){
  const [d,setD]=useState<SimpleDraft>(initial??EMPTY_SIMPLE);
  const [more,setMore]=useState(false);
  const editing=!!editKey;
  useEffect(()=>{if(resetSignal)setD(old=>({...old,prompt:'',options:['','','',''],correct:null,explanation:'',attest:false}));},[resetSignal]);
  const set=(patch:Partial<SimpleDraft>)=>setD(old=>({...old,...patch}));
  const life=d.topic==='life';
  const {checks,valid,options,lifeRules}=simpleChecks(d,{full:life?full.life:full.trivia,editing});
  const topicName=life?`Life Playbook · ${lifeChapterTitle(d.chapter)}`:d.topic==='sport'?(d.sport?`Sports · ${d.sport}`:'Sports'):topicLabel(d.topic);
  return <View style={styles.wrap}>
    <Text accessibilityRole="header" style={styles.head}>{editing?'Edit this draft':'Add a question'}</Text>
    {editing?<Text>{`Topic: ${topicLabel(d.topic)} (fixed for an edit). Saving makes a new draft version for review.`}</Text>
      :<AdminPills<TimedQuizQuestionTopic> label="Topic" value={d.topic} items={TRIVIA_TOPICS.map(t=>({id:t.id,label:t.label}))} onChange={topic=>set({topic})}/>}
    {d.topic==='sport'?<AdminPills label="Sport" value={d.sport} items={TRIVIA_SPORTS.map(id=>({id,label:id}))} onChange={sport=>set({sport})}/>:null}
    {life?<AdminPills<LifeChapterId> label="Life chapter" value={d.chapter} items={LIFE_CHAPTER_IDS.map(id=>({id,label:lifeChapterTitle(id)}))} onChange={chapter=>set({chapter})}/>:null}
    <AdminPills<SimpleType> label="Type" value={d.type} items={[{id:'true_false',label:'True or false'},{id:'choice4',label:'Four choices'}]}
      onChange={type=>set({type,correct:null})}/>
    <AdminField label="Question" value={d.prompt} multiline onChangeText={prompt=>set({prompt})} placeholder={life?'A simple everyday fact, 120 characters at most':'A fun fact to ask about'}/>
    {d.type==='choice4'?d.options.map((value,i)=><AdminField key={i} label={`Answer ${i+1}`} value={value} onChangeText={next=>set({options:d.options.map((o,j)=>j===i?next:o)})}/>):null}
    <AdminPills label="Correct answer" value={d.correct===null?'':String(d.correct)}
      items={options.map((o,i)=>({id:String(i),label:d.type==='true_false'?o:`${i+1}. ${o.trim()||'(empty)'}`}))} onChange={id=>set({correct:Number(id)})}/>
    <AdminField label="Short explanation" value={d.explanation} multiline onChangeText={explanation=>set({explanation})} placeholder="What the player learns after answering"/>
    {life?<AdminPills label="Education-only attestation" value={d.attest?'yes':'no'} items={[{id:'yes',label:'A simple everyday fact; no advice, products or brands'},{id:'no',label:'Not attested'}]}
      onChange={id=>set({attest:id==='yes'})}/>:null}
    <AdminBtn label={more?'Fewer options':'More options'} onPress={()=>setMore(m=>!m)}/>
    {more?<View style={styles.more}>
      {editing?<Text>This edit joins the draft's question family, so players never see both versions.</Text>
        :<AdminPills label="Question family" value={d.family} items={[{id:'new',label:'New family'},{id:'existing',label:'Existing family'}]} onChange={family=>set({family})}/>}
      {!editing&&d.family==='existing'?<AdminField label="Existing family key" value={d.familyKey} onChangeText={familyKey=>set({familyKey})}/>:null}
      <AdminField label="Source note" value={d.source} multiline onChangeText={source=>set({source})}/>
      <AdminField label="Reason for the record" value={d.reason} onChangeText={reason=>set({reason})}/>
      <Text>Image questions, rights review and voiding stay under All questions.</Text>
    </View>:null}
    <View accessibilityLabel="Checks before saving" style={styles.checks}>
      <Text accessibilityRole="header" style={styles.sub}>Checks before saving</Text>
      {checks.map((c,i)=><Text key={i} accessibilityRole={c.ok?undefined:'alert'}>{`${c.ok?'OK':'Fix'}: ${c.text}`}</Text>)}
      {lifeRules.map(r=><Text key={r}>{`• ${LIFE_RULE_WORDS[r]}`}</Text>)}
    </View>
    <SportQuizPreview topic={topicName} prompt={d.prompt} type={d.type} options={options} correct={d.correct} explanation={d.explanation}/>
    <AdminBtn label={busy==='create'||busy==='edit'||busy==='revise'?'Saving…':editing?'Save new version':'Save draft for review'} kind="primary" disabled={!!busy||!valid}
      onPress={()=>onSave(simplePayload(d,editKey))}/>
    {onCancel?<AdminBtn label="Cancel edit" disabled={!!busy} onPress={onCancel}/>:null}
    {!editing?<Text>A saved question is a draft. One admin approves it in Drafts to review before players see it.</Text>:null}
  </View>;
}
const styles=StyleSheet.create({wrap:{gap:6},head:{fontSize:18,fontWeight:'800'},sub:{fontSize:15,fontWeight:'700'},checks:{gap:4,marginTop:8},more:{gap:6}});
