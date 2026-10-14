/**
 * QUIZ-02 reviewed question families and immutable versions inside the main quiz desk.
 * @sideEffects None directly; the owning desk binds writes to its captured canonical admin identity.
 */
import {useState} from 'react';
import {Text} from 'react-native';
import {AdminBtn,AdminField,AdminPanel,AdminPills,AdminSectionTitle} from '@/components/Admin/AdminChrome';
import {sportQuizContentValid,sportQuizOptionsIssue,type QuizQuestionAction,type TimedQuizAdminQuestion,type TimedQuizAdminQuestionInput,type TimedQuizTopic} from '@/lib/sportQuiz';

export type SportQuizBankProps={questions:TimedQuizAdminQuestion[];total:number;cap:number;nextCursor:string|null;busy:string|null;reason:string;tab:'operate'|'data';
  onLoadMore:()=>void;onWrite:(id:string|null,action:QuizQuestionAction,payload:TimedQuizAdminQuestionInput)=>void};
const empty={sport:'',prompt:'',options:['','','',''] as [string,string,string,string],correct:'1',explanation:'',source_notes:''};
const bounded=(s:string,min:number,max:number)=>Array.from(s.replace(/^ +| +$/g,'')).length>=min&&Array.from(s.replace(/^ +| +$/g,'')).length<=max;

/** @purpose Require explicit family/source decisions and preserve correction access for malformed legacy content. */
export function SportQuizBank({questions,total,cap,nextCursor,busy,reason,tab,onLoadMore,onWrite}:SportQuizBankProps){
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [form,setForm]=useState(empty);
  const [category,setCategory]=useState<TimedQuizTopic>('sport');
  const [family,setFamily]=useState<''|'new'|'existing'>('');
  const [familyKey,setFamilyKey]=useState('');
  const selected=questions.find(q=>q.id===selectedId)??null;
  const issue=selected?sportQuizOptionsIssue(selected.options):null;
  const hasReason=bounded(reason.trim(),10,500);
  const validForm=sportQuizContentValid(form)&&/^[1-4]$/.test(form.correct)&&bounded(form.source_notes,10,1000);
  const choose=(q:TimedQuizAdminQuestion)=>{setSelectedId(q.id);setForm({sport:q.sport,prompt:q.prompt,options:[...q.options],correct:String(q.correct_option+1),explanation:q.explanation,source_notes:q.source_notes});setCategory(q.topic_category);setFamily('existing');setFamilyKey(q.question_key);};
  const clear=()=>{setSelectedId(null);setForm(empty);setCategory('sport');setFamily('');setFamilyKey('');};
  const write=(action:QuizQuestionAction)=>{
    const payload:TimedQuizAdminQuestionInput=action==='create'||action==='edit'
      ?{reason:reason.trim(),sport:form.sport,prompt:form.prompt,options:form.options,correct_option:Number(form.correct)-1,explanation:form.explanation,
        topic_category:category,source_notes:form.source_notes,family_action:action==='edit'?'existing':family||undefined,
        ...(action==='edit'?{question_key:selected?.question_key}:family==='existing'?{question_key:familyKey}: {})}
      :{reason:reason.trim()};
    onWrite(action==='create'?null:selected?.id??null,action,payload);
  };
  return <>
    <AdminSectionTitle>Question bank</AdminSectionTitle>
    <Text>{`${questions.length} of ${total} stored versions loaded · ${cap} version cap. ${questions.length===total&&!nextCursor?'Complete inventory.':'More inventory remains; unloaded versions are not shown.'}`}</Text>
    <Text>Families prevent repeats across edited versions. Issued wording remains immutable; corrections create drafts or void erroneous versions.</Text>
    {tab==='operate'?<>
      <AdminPanel title={selected?`Selected ${selected.sport} · version ${selected.version} · ${selected.status}`:'New draft question'}>
        <AdminBtn label="Clear selection" disabled={!!busy} onPress={clear}/>
        <AdminPills label="Question topic" value={category} items={[{id:'sport',label:'Sports'},{id:'science',label:'Science'},{id:'geography',label:'Geography'},{id:'general',label:'General knowledge'}]} onChange={setCategory}/>
        <AdminPills label="Question family" value={family} items={[{id:'new',label:'New family'},{id:'existing',label:'Existing family'}]} onChange={setFamily}/>
        {family==='existing'?<AdminField label="Existing family key" value={familyKey} onChangeText={setFamilyKey}/>:null}
        <AdminField label="Sport and rule context" value={form.sport} onChangeText={sport=>setForm(old=>({...old,sport}))}/>
        <AdminField label="Question" value={form.prompt} multiline onChangeText={prompt=>setForm(old=>({...old,prompt}))}/>
        {form.options.map((value,i)=><AdminField key={i} label={`Answer option ${i+1}`} value={value} onChangeText={text=>setForm(old=>({...old,options:old.options.map((option,j)=>i===j?text:option) as [string,string,string,string]}))}/>)}
        <AdminField label="Correct option (1 to 4)" value={form.correct} keyboardType="number-pad" onChangeText={correct=>setForm(old=>({...old,correct}))}/>
        <AdminField label="Explanation" value={form.explanation} multiline onChangeText={explanation=>setForm(old=>({...old,explanation}))}/>
        <AdminField label="Fact sources and editorial review" value={form.source_notes} multiline onChangeText={source_notes=>setForm(old=>({...old,source_notes}))}/>
        <Text>Check factual sources, age suitability and duplicate families. No generated draft goes directly to participants.</Text>
        {issue?<Text>{issue}</Text>:null}
        {selected&&!bounded(selected.source_notes,10,1000)?<Text>Missing fact sources. Create a reviewed draft version before approval.</Text>:null}
        <AdminBtn label="Create draft" disabled={!!busy||!hasReason||!validForm||total>=cap||!!selected||!family||(family==='existing'&&!familyKey.trim())} onPress={()=>write('create')}/>
        <AdminBtn label="Create new draft version" disabled={!!busy||!hasReason||!validForm||!selected||total>=cap} onPress={()=>write('edit')}/>
        <AdminBtn label={busy==='approve'?'Working…':'Approve question'} kind="primary" disabled={!!busy||!hasReason||selected?.status!=='draft'||!!issue||!bounded(selected?.source_notes??'',10,1000)} onPress={()=>write('approve')}/>
        <AdminBtn label="Archive question" disabled={!!busy||!hasReason||!selected||!['draft','approved'].includes(selected.status)} onPress={()=>write('archive')}/>
        <AdminBtn label="Void erroneous question and badges" kind="danger" disabled={!!busy||!hasReason||!selected||selected.status==='void'} onPress={()=>write('void')}/>
      </AdminPanel>
      {questions.map(q=><AdminBtn key={q.id} label={`Select ${q.sport} question version ${q.version}`} disabled={!!busy} onPress={()=>choose(q)}/>)}
    </>:questions.map(q=><AdminPanel key={q.id} title={`${q.sport} · version ${q.version} · ${q.status}`}>
      <Text>{q.prompt}</Text>{sportQuizOptionsIssue(q.options)?<Text>{sportQuizOptionsIssue(q.options)}</Text>:null}
      {q.options.map((option,i)=><Text key={i}>{`${i+1}. ${option}${q.correct_option===i?' · correct':''}`}</Text>)}
      <Text>{q.explanation}</Text><Text>{q.source_notes||'Missing fact sources; correction review required.'}</Text>
      <Text>{`Topic ${q.topic_category} · version ${q.id} · family ${q.question_key}`}</Text><Text>{`Reason: ${q.reason}`}</Text>
      <Text>{`Created ${q.created_at} · by ${q.created_by??'draft seed'} · reviewed ${q.reviewed_at??'not reviewed'} · by ${q.reviewed_by??'none'}`}</Text>
    </AdminPanel>)}
    <AdminBtn label="Load more questions" disabled={!!busy||!nextCursor} onPress={onLoadMore}/>
  </>;
}
