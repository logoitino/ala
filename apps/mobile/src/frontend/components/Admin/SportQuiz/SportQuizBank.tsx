/**
 * QUIZ-02 reviewed question families and immutable versions inside the main quiz desk.
 * QUIZ-03 adds question types: four choices, true or false (fixed True / False) and image questions, whose rights
 * fields stay read-only with a "switched off" note while trivia.images is off. Image rights need the marks/EXIF
 * attestations and a second admin's review before approval. The 300 cap counts draft + approved.
 * QUIZ-04 adds Life questions (topic 'life'): a chapter, the education-only attestation and a separate 200 cap; one
 * admin approves them like any trivia question (owner simplification 2026-10-15) and the server runs the Life copy rules.
 * @sideEffects None directly; the owning desk binds writes to its captured canonical admin identity.
 */
import {useState} from 'react';
import {Text} from 'react-native';
import {AdminBtn,AdminField,AdminPanel,AdminPills,AdminSectionTitle} from '@/components/Admin/AdminChrome';
import {sportQuizContentValid,sportQuizMediaIssue,sportQuizOptionsIssue,type QuizQuestionAction,type TimedQuizAdminQuestion,type TimedQuizAdminQuestionInput,type TimedQuizMediaLicence,type TimedQuizQuestionType,type TimedQuizQuestionTopic} from '@/lib/sportQuiz';
import {EMPTY_LIFE_DRAFT,SportQuizLifeQuestion,lifeApprovalIssue,lifeChapterTitle,type LifeQuestionDraft} from './SportQuizLifeQuestion';

export type SportQuizBankProps={questions:TimedQuizAdminQuestion[];total:number;activeTotal:number;cap:number;nextCursor:string|null;busy:string|null;reason:string;tab:'operate'|'data';
  imagesEnabled:boolean;actorId?:string|null;lifeActiveTotal?:number;lifeCap?:number;onLoadMore:()=>void;onWrite:(id:string|null,action:QuizQuestionAction,payload:TimedQuizAdminQuestionInput)=>void};
const TRUE_FALSE=['True','False'];
const empty={sport:'',prompt:'',options:['','','',''] as string[],correct:'1',explanation:'',source_notes:''};
const emptyMedia={media_path:'',media_licence:'owned' as TimedQuizMediaLicence,media_source:'',media_attribution:'',media_alt_text:'',media_size_bytes:'',media_no_marks:false,media_exif_stripped:false};
const bounded=(s:string,min:number,max:number)=>Array.from(s.replace(/^ +| +$/g,'')).length>=min&&Array.from(s.replace(/^ +| +$/g,'')).length<=max;
const typeLabel=(t:TimedQuizQuestionType|undefined)=>t==='true_false'?'true or false':t==='image_choice'?'image':'four choices';

/** @purpose Require explicit family/source decisions and preserve correction access for malformed legacy content. */
export function SportQuizBank({questions,total,activeTotal,cap,nextCursor,busy,reason,tab,imagesEnabled,actorId=null,lifeActiveTotal,lifeCap,onLoadMore,onWrite}:SportQuizBankProps){
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [form,setForm]=useState(empty);
  const [media,setMedia]=useState(emptyMedia);
  const [type,setType]=useState<TimedQuizQuestionType>('choice4');
  const [category,setCategory]=useState<TimedQuizQuestionTopic>('sport');
  const [life,setLife]=useState<LifeQuestionDraft>(EMPTY_LIFE_DRAFT);
  const isLife=category==='life';
  const [family,setFamily]=useState<''|'new'|'existing'>('');
  const [familyKey,setFamilyKey]=useState('');
  const selected=questions.find(q=>q.id===selectedId)??null;
  const selectedType=selected?.question_type??'choice4';
  const issue=selected?sportQuizOptionsIssue(selected.options,selectedType):null;
  const hasReason=bounded(reason.trim(),10,500);
  const options=type==='true_false'?TRUE_FALSE:type==='image_choice'?form.options.filter(o=>o.trim()!==''):form.options;
  const correctMax=type==='true_false'?2:options.length;
  const mediaIssue=type==='image_choice'?sportQuizMediaIssue({...media,media_size_bytes:Number(media.media_size_bytes),media_has_person:false},options[Number(form.correct)-1]):null;
  const reviewed=!!selected?.media_reviewed_by&&selected.media_reviewed_by!==selected.created_by;
  const canReview=!!selected&&selectedType==='image_choice'&&selected.status==='draft'&&!reviewed&&!!actorId&&selected.created_by!==actorId;
  const validForm=sportQuizContentValid({...form,sport:isLife?lifeChapterTitle(life.chapter):form.sport,options,question_type:type})&&/^[1-4]$/.test(form.correct)&&Number(form.correct)<=correctMax
    &&bounded(form.source_notes,10,1000)&&(type!=='image_choice'||(imagesEnabled&&!mediaIssue))&&(!isLife||type!=='image_choice');
  const full=isLife?lifeActiveTotal!==undefined&&lifeCap!==undefined&&lifeActiveTotal>=lifeCap:activeTotal>=cap;
  const selectedLife=selected?.topic_category==='life';
  const lifeIssue=selectedLife?lifeApprovalIssue(life):null;
  const choose=(q:TimedQuizAdminQuestion)=>{
    const qt=q.question_type??'choice4';
    setSelectedId(q.id);setType(qt);
    setForm({sport:q.sport,prompt:q.prompt,options:qt==='true_false'?['','','','']:[...q.options,'','',''].slice(0,4),correct:String(q.correct_option+1),explanation:q.explanation,source_notes:q.source_notes});
    setMedia(qt==='image_choice'?{media_path:q.media_path??'',media_licence:(q.media_licence??'owned') as TimedQuizMediaLicence,media_source:q.media_source??'',media_attribution:q.media_attribution??'',media_alt_text:q.media_alt_text??'',media_size_bytes:String(q.media_size_bytes??''),media_no_marks:q.media_no_marks===true,media_exif_stripped:q.media_exif_stripped===true}:emptyMedia);
    setCategory(q.topic_category);setFamily('existing');setFamilyKey(q.question_key);
    setLife(q.topic_category==='life'&&q.chapter?{chapter:q.chapter,attest:q.education_only===true}:EMPTY_LIFE_DRAFT);
  };
  const clear=()=>{setSelectedId(null);setForm(empty);setMedia(emptyMedia);setType('choice4');setCategory('sport');setLife(EMPTY_LIFE_DRAFT);setFamily('');setFamilyKey('');};
  const write=(action:QuizQuestionAction)=>{
    const payload:TimedQuizAdminQuestionInput=action==='create'||action==='edit'
      ?{reason:reason.trim(),...(isLife?{chapter:life.chapter,min_age_band:'13' as const,education_only:life.attest}:{sport:form.sport}),prompt:form.prompt,options,correct_option:Number(form.correct)-1,explanation:form.explanation,
        topic_category:category,source_notes:form.source_notes,family_action:action==='edit'?'existing':family||undefined,question_type:type,
        ...(type==='image_choice'?{media_path:media.media_path.trim(),media_licence:media.media_licence,media_source:media.media_source,media_attribution:media.media_attribution,
          media_alt_text:media.media_alt_text,media_size_bytes:Number(media.media_size_bytes),media_has_person:false as const,media_no_marks:true as const,media_exif_stripped:true as const}:{}),
        ...(action==='edit'?{question_key:selected?.question_key}:family==='existing'?{question_key:familyKey}: {})}
      :{reason:reason.trim()};
    onWrite(action==='create'?null:selected?.id??null,action,payload);
  };
  return <>
    <AdminSectionTitle>Question bank</AdminSectionTitle>
    {lifeActiveTotal!==undefined&&lifeCap!==undefined?<Text>{`Life Playbook: ${lifeActiveTotal} of ${lifeCap} active Life versions (a separate cap).`}</Text>:null}
    <Text>{`${activeTotal} of ${cap} active trivia versions (draft and approved count; archived and void history does not). ${questions.length} of ${total} stored versions loaded. ${questions.length===total&&!nextCursor?'Complete inventory.':'More inventory remains; unloaded versions are not shown.'}`}</Text>
    <Text>Families prevent repeats across edited versions. Issued wording, type and image rights are immutable; corrections create drafts or void erroneous versions (a void affects only that question in each round).</Text>
    {tab==='operate'?<>
      <AdminPanel title={selected?`Selected ${selected.sport} · version ${selected.version} · ${selected.status} · ${typeLabel(selected.question_type)}`:'New draft question'}>
        <AdminBtn label="Clear selection" disabled={!!busy} onPress={clear}/>
        <AdminPills label="Question type" value={type} items={[{id:'choice4',label:'Four choices'},{id:'true_false',label:'True or false'},{id:'image_choice',label:imagesEnabled?'Image':'Image (switched off)'}]}
          onChange={t=>{setType(t);if(t==='true_false'&&Number(form.correct)>2)setForm(old=>({...old,correct:'1'}));}}/>
        <AdminPills label="Question topic" value={category} items={[{id:'sport',label:'Sports'},{id:'science',label:'Science'},{id:'geography',label:'Geography'},{id:'general',label:'General knowledge'},{id:'life',label:'Life Playbook'}]} onChange={setCategory}/>
        {isLife?<SportQuizLifeQuestion draft={life} onChange={setLife}/>:null}
        <AdminPills label="Question family" value={family} items={[{id:'new',label:'New family'},{id:'existing',label:'Existing family'}]} onChange={setFamily}/>
        {family==='existing'?<AdminField label="Existing family key" value={familyKey} onChangeText={setFamilyKey}/>:null}
        {isLife?null:<AdminField label="Sport and rule context" value={form.sport} onChangeText={sport=>setForm(old=>({...old,sport}))}/>}
        <AdminField label="Question" value={form.prompt} multiline onChangeText={prompt=>setForm(old=>({...old,prompt}))}/>
        {type==='true_false'?<>
          <Text>Answer choices are fixed: 1. True · 2. False.</Text>
          <AdminPills label="Correct answer" value={form.correct} items={[{id:'1',label:'True'},{id:'2',label:'False'}]} onChange={correct=>setForm(old=>({...old,correct}))}/>
        </>:<>
          {form.options.map((value,i)=><AdminField key={i} label={`Answer option ${i+1}${type==='image_choice'&&i>=2?' (optional)':''}`} value={value} onChangeText={next=>setForm(old=>({...old,options:old.options.map((option,j)=>i===j?next:option)}))}/>)}
          <AdminField label={`Correct option (1 to ${type==='image_choice'?Math.max(options.length,2):4})`} value={form.correct} keyboardType="number-pad" onChangeText={correct=>setForm(old=>({...old,correct}))}/>
        </>}
        {type==='image_choice'?<>
          {!imagesEnabled?<Text accessibilityRole="alert">Image questions are switched off (trivia.images). Rights fields are read-only until Content Rights and Minor Safety approve images; nothing is uploaded or shown to players in this build.</Text>:null}
          <AdminField label="Image path in quiz_media" value={media.media_path} editable={imagesEnabled} onChangeText={media_path=>setMedia(old=>({...old,media_path}))} placeholder="equipment/ball-01.webp"/>
          <AdminPills label="Licence type" value={media.media_licence} items={[{id:'owned',label:'Owned'},{id:'cc0',label:'CC0'},{id:'cc_by',label:'CC BY'},{id:'licensed',label:'Licensed'},{id:'public_domain',label:'Public domain'}]}
            onChange={media_licence=>{if(imagesEnabled)setMedia(old=>({...old,media_licence}));}}/>
          <AdminField label="Source" value={media.media_source} editable={imagesEnabled} onChangeText={media_source=>setMedia(old=>({...old,media_source}))}/>
          <AdminField label="Attribution shown to players" value={media.media_attribution} editable={imagesEnabled} onChangeText={media_attribution=>setMedia(old=>({...old,media_attribution}))}/>
          <AdminField label="Alt text (must not reveal the answer)" value={media.media_alt_text} editable={imagesEnabled} multiline onChangeText={media_alt_text=>setMedia(old=>({...old,media_alt_text}))}/>
          <AdminField label="File size in bytes (300 KB maximum)" value={media.media_size_bytes} editable={imagesEnabled} keyboardType="number-pad" onChangeText={media_size_bytes=>setMedia(old=>({...old,media_size_bytes}))}/>
          <AdminPills label="No school or league marks" value={media.media_no_marks?'yes':'no'} items={[{id:'yes',label:'Confirmed: no marks'},{id:'no',label:'Not confirmed'}]}
            onChange={id=>{if(imagesEnabled)setMedia(old=>({...old,media_no_marks:id==='yes'}));}}/>
          <AdminPills label="EXIF stripped" value={media.media_exif_stripped?'yes':'no'} items={[{id:'yes',label:'Confirmed: EXIF stripped'},{id:'no',label:'EXIF not confirmed'}]}
            onChange={id=>{if(imagesEnabled)setMedia(old=>({...old,media_exif_stripped:id==='yes'}));}}/>
          <Text>No identifiable person anywhere in the frame. A second admin (not the author) records the rights review before approval.</Text>
          {imagesEnabled&&mediaIssue?<Text>{mediaIssue}</Text>:null}
        </>:null}
        <AdminField label="Explanation" value={form.explanation} multiline onChangeText={explanation=>setForm(old=>({...old,explanation}))}/>
        <AdminField label="Fact sources and editorial review" value={form.source_notes} multiline onChangeText={source_notes=>setForm(old=>({...old,source_notes}))}/>
        <Text>Check factual sources, age suitability and duplicate families. No generated draft goes directly to participants.</Text>
        {issue?<Text>{issue}</Text>:null}
        {selected&&!bounded(selected.source_notes,10,1000)?<Text>Missing fact sources. Create a reviewed draft version before approval.</Text>:null}
        {full?<Text>The bank is at its active cap. Archive drafts or retired versions before adding more.</Text>:null}
        <AdminBtn label="Create draft" disabled={!!busy||!hasReason||!validForm||full||!!selected||!family||(family==='existing'&&!familyKey.trim())} onPress={()=>write('create')}/>
        <AdminBtn label="Create new draft version" disabled={!!busy||!hasReason||!validForm||!selected||full} onPress={()=>write('edit')}/>
        <AdminBtn label={busy==='approve'?'Working…':'Approve question'} kind="primary" disabled={!!busy||!hasReason||selected?.status!=='draft'||!!issue||!bounded(selected?.source_notes??'',10,1000)||(selectedType==='image_choice'&&(!imagesEnabled||!reviewed))||!!lifeIssue} onPress={()=>write('approve')}/>
        {selectedType==='image_choice'&&!imagesEnabled&&selected?.status==='draft'?<Text>Approval is refused while trivia.images is off.</Text>:null}
        {selectedLife&&selected?.status==='draft'?<Text>{lifeIssue??'One admin approves a Life question like any trivia question. The server runs the Life copy rules at approval.'}</Text>:null}
        {selectedType==='image_choice'&&selected?.status==='draft'?<>
          <Text>{reviewed?`Rights reviewed by ${selected.media_reviewed_by} at ${selected.media_reviewed_at??'unknown time'}.`:selected.created_by===actorId?'You wrote this image question; a different admin must record the rights review.':'Rights review not recorded yet.'}</Text>
          <AdminBtn label="Record rights review (second admin)" disabled={!!busy||!hasReason||!canReview} onPress={()=>write('review_media')}/>
        </>:null}
        <AdminBtn label="Archive question" disabled={!!busy||!hasReason||!selected||!['draft','approved'].includes(selected.status)} onPress={()=>write('archive')}/>
        <AdminBtn label="Void erroneous question and badges" kind="danger" disabled={!!busy||!hasReason||!selected||selected.status==='void'} onPress={()=>write('void')}/>
      </AdminPanel>
      {questions.map(q=><AdminBtn key={q.id} label={`Select ${q.sport} question version ${q.version}`} disabled={!!busy} onPress={()=>choose(q)}/>)}
    </>:questions.map(q=><AdminPanel key={q.id} title={`${q.sport} · version ${q.version} · ${q.status} · ${typeLabel(q.question_type)}`}>
      <Text>{q.prompt}</Text>{sportQuizOptionsIssue(q.options,q.question_type??'choice4')?<Text>{sportQuizOptionsIssue(q.options,q.question_type??'choice4')}</Text>:null}
      {q.options.map((option,i)=><Text key={i}>{`${i+1}. ${option}${q.correct_option===i?' · correct':''}`}</Text>)}
      <Text>{q.explanation}</Text><Text>{q.source_notes||'Missing fact sources; correction review required.'}</Text>
      {q.question_type==='image_choice'?<Text>{`Image ${q.media_path} · ${q.media_licence} · ${q.media_size_bytes} bytes · source ${q.media_source} · attribution ${q.media_attribution} · alt "${q.media_alt_text}" · no marks ${q.media_no_marks?'confirmed':'missing'} · EXIF ${q.media_exif_stripped?'stripped':'missing'} · reviewer ${q.media_reviewed_by??'not reviewed'}`}</Text>:null}
      {q.topic_category==='life'?<Text>{`Life · ${q.chapter} · ${q.min_age_band}+ · attested ${q.education_only?'yes':'no'}`}</Text>:null}
      <Text>{`Topic ${q.topic_category} · version ${q.id} · family ${q.question_key}`}</Text><Text>{`Reason: ${q.reason}`}</Text>
      <Text>{`Created ${q.created_at} · by ${q.created_by??'draft seed'} · reviewed ${q.reviewed_at??'not reviewed'} · by ${q.reviewed_by??'none'}`}</Text>
    </AdminPanel>)}
    <AdminBtn label="Load more questions" disabled={!!busy||!nextCursor} onPress={onLoadMore}/>
  </>;
}
