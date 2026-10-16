/** QUIZ-02 bank authoring: explicit family/source review and immutable correction paths; QUIZ-03 question types and the active cap. Synthetic rows. */
import {fireEvent,render,screen} from '@testing-library/react-native';
import {SportQuizBank} from '../SportQuizBank';
import type {TimedQuizAdminQuestion} from '@/lib/sportQuiz';
const question:TimedQuizAdminQuestion={id:'q1',question_key:'family1',version:1,topic_category:'sport',sport:'American football',prompt:'How many points does a touchdown score before conversion?',
  options:['3','6','7','2'],correct_option:1,explanation:'A touchdown scores six points.',source_notes:'Official rule book confirms six points.',status:'draft',reason:'Human fact review required.',created_at:'2026-10-14',created_by:null,reviewed_at:null,reviewed_by:null};
const write=jest.fn();
const props={questions:[question],total:1,activeTotal:1,imagesEnabled:false,cap:300,nextCursor:null,busy:null,reason:'Content owner checked the published rule.',tab:'operate' as const,onLoadMore:jest.fn(),onWrite:write};
beforeEach(()=>jest.clearAllMocks());
it('requires an explicit family choice and sources before creating a draft',async()=>{
  await render(<SportQuizBank {...props}/>);
  await fireEvent.changeText(screen.getByLabelText('Sport and rule context'),question.sport);
  await fireEvent.changeText(screen.getByLabelText('Question'),question.prompt);
  for(let i=0;i<4;i++)await fireEvent.changeText(screen.getByLabelText(`Answer option ${i+1}`),question.options[i]);
  await fireEvent.changeText(screen.getByLabelText('Correct option (1 to 4)'),'2');
  await fireEvent.changeText(screen.getByLabelText('Explanation'),question.explanation);
  expect(screen.getByLabelText('Create draft')).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('New family'));
  expect(screen.getByLabelText('Create draft')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Fact sources and editorial review'),question.source_notes);
  await fireEvent.press(screen.getByLabelText('Create draft'));
  expect(write).toHaveBeenCalledWith(null,'create',expect.objectContaining({family_action:'new',source_notes:question.source_notes,topic_category:'sport'}));
});
it('attaches a corrected draft to the selected immutable family rather than replacing issued wording',async()=>{
  await render(<SportQuizBank {...props}/>);
  await fireEvent.press(screen.getByLabelText('Select American football question version 1'));
  await fireEvent.changeText(screen.getByLabelText('Question'),'How many points does an American football touchdown score?');
  await fireEvent.press(screen.getByLabelText('Create new draft version'));
  expect(write).toHaveBeenCalledWith('q1','edit',expect.objectContaining({family_action:'existing',question_key:'family1'}));
});
it('blocks approval without stored sources while keeping archive and void available',async()=>{
  await render(<SportQuizBank {...props} questions={[{...question,source_notes:''}]}/>);
  await fireEvent.press(screen.getByLabelText('Select American football question version 1'));
  expect(screen.getByLabelText('Approve question')).toBeDisabled();
  expect(screen.getByLabelText('Archive question')).not.toBeDisabled();
  expect(screen.getByLabelText('Void erroneous question and badges')).not.toBeDisabled();
  expect(screen.getByText(/Missing fact sources/)).toBeTruthy();
});
it('shows private Data fields and full inventory count without declaring unloaded pages complete',async()=>{
  await render(<SportQuizBank {...props} total={51} nextCursor="second-page" tab="data"/>);
  expect(screen.getByText(/1 of 51 stored versions/)).toBeTruthy();
  expect(screen.getByText(question.source_notes)).toBeTruthy();
  expect(screen.getByLabelText('Load more questions')).not.toBeDisabled();
});
it('QUIZ-03 true or false: fixed True/False choices and a two-way correct answer',async()=>{
  await render(<SportQuizBank {...props}/>);
  await fireEvent.press(screen.getByLabelText('True or false'));
  expect(screen.queryByLabelText('Answer option 1')).toBeNull();
  expect(screen.getByText(/fixed: 1. True · 2. False/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Sport and rule context'),'Volleyball');
  await fireEvent.changeText(screen.getByLabelText('Question'),'A volleyball team may touch the ball three times before returning it.');
  await fireEvent.press(screen.getByLabelText('False'));
  await fireEvent.changeText(screen.getByLabelText('Explanation'),'Three contacts are allowed, so the statement is true; this draft marks it wrong on purpose.');
  await fireEvent.changeText(screen.getByLabelText('Fact sources and editorial review'),'FIVB rules 9.1 reviewed by Content.');
  await fireEvent.press(screen.getByLabelText('New family'));
  await fireEvent.press(screen.getByLabelText('Create draft'));
  expect(write).toHaveBeenCalledWith(null,'create',expect.objectContaining({question_type:'true_false',options:['True','False'],correct_option:1}));
});
it('QUIZ-03 image fields stay read-only with a switched-off note, and no image draft can be made while off',async()=>{
  await render(<SportQuizBank {...props}/>);
  await fireEvent.press(screen.getByLabelText('Image (switched off)'));
  expect(screen.getByText(/Image questions are switched off \(trivia.images\)/)).toBeTruthy();
  for(const label of ['Image path in quiz_media','Source','Attribution shown to players','Alt text (must not reveal the answer)','File size in bytes (300 KB maximum)'])
    expect(screen.getByLabelText(label).props.editable).toBe(false);
  await fireEvent.press(screen.getByLabelText('New family'));
  expect(screen.getByLabelText('Create draft')).toBeDisabled();
});
it('QUIZ-03 image approval is refused in the desk while trivia.images is off',async()=>{
  const image={...question,id:'img1',question_type:'image_choice' as const,media_path:'equipment/ball.webp',media_licence:'owned',media_source:'Staff photo',media_attribution:'Staff',
    media_alt_text:'A ball on a wooden floor',media_size_bytes:1200,media_has_person:false,media_no_marks:true,media_exif_stripped:true,media_reviewed_by:null,created_by:'author-admin'};
  await render(<SportQuizBank {...props} questions={[image]}/>);
  await fireEvent.press(screen.getByLabelText('Select American football question version 1'));
  expect(screen.getByLabelText('Approve question')).toBeDisabled();
  expect(screen.getByText(/Approval is refused while trivia.images is off/)).toBeTruthy();
});
it('QUIZ-03 image rights: the author cannot review; a second admin records the review and only then can approve',async()=>{
  const image={...question,id:'img1',question_type:'image_choice' as const,media_path:'equipment/ball.webp',media_licence:'owned',media_source:'Staff photo',media_attribution:'Staff',
    media_alt_text:'A ball on a wooden floor',media_size_bytes:1200,media_has_person:false,media_no_marks:true,media_exif_stripped:true,media_reviewed_by:null,created_by:'author-admin'};
  const view=await render(<SportQuizBank {...props} imagesEnabled actorId="author-admin" questions={[image]}/>);
  await fireEvent.press(screen.getByLabelText('Select American football question version 1'));
  expect(screen.getByText(/a different admin must record the rights review/)).toBeTruthy();
  expect(screen.getByLabelText('Record rights review (second admin)')).toBeDisabled();
  expect(screen.getByLabelText('Approve question')).toBeDisabled();
  await view.rerender(<SportQuizBank {...props} imagesEnabled actorId="second-admin" questions={[image]}/>);
  await fireEvent.press(screen.getByLabelText('Record rights review (second admin)'));
  expect(write).toHaveBeenCalledWith('img1','review_media',{reason:props.reason});
  await view.rerender(<SportQuizBank {...props} imagesEnabled actorId="second-admin" questions={[{...image,media_reviewed_by:'second-admin',media_reviewed_at:'2026-10-14'}]}/>);
  expect(screen.getByLabelText('Approve question')).not.toBeDisabled();
});
it('QUIZ-03 cap counts active versions only and blocks new drafts at 300',async()=>{
  await render(<SportQuizBank {...props} total={420} activeTotal={300} nextCursor="more"/>);
  expect(screen.getByText(/300 of 300 active trivia versions \(draft and approved count; archived and void history does not\)/)).toBeTruthy();
  expect(screen.getByText(/at its active cap/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('New family'));
  expect(screen.getByLabelText('Create draft')).toBeDisabled();
});
// QUIZ-04 Life questions (owner simplification 2026-10-15): chapter + attestation replace the sport field; one admin approves.
const lifeQ:TimedQuizAdminQuestion={...question,id:'l1',question_key:'lfam',topic_category:'life',sport:'Money Huddle',prompt:'A budget plans where money goes before it is spent.',
  options:['True','False'],question_type:'true_false',correct_option:0,explanation:'True. A budget is a game plan for money.',source_notes:'Everyday fact; no expert check needed.',
  chapter:'money_huddle',min_age_band:'13',education_only:false};
it('creates a Life draft sending only chapter, band 13 and the attestation; approval waits for the attestation only',async()=>{
  await render(<SportQuizBank {...props} questions={[lifeQ]} lifeActiveTotal={40} lifeCap={200}/>);
  expect(screen.getByText('Life Playbook: 40 of 200 active Life versions (a separate cap).')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Select Money Huddle question version 1'));
  expect(screen.queryByLabelText('Sport and rule context')).toBeNull();
  for(const label of ['Source retrieved on (YYYY-MM-DD)','Tax year of a dated figure (adults only, optional)','16+'])expect(screen.queryByLabelText(label)).toBeNull();
  expect(screen.getByText('Missing the education-only attestation.')).toBeTruthy();
  expect(screen.getByLabelText('Approve question')).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Savings Season'));
  await fireEvent.press(screen.getByLabelText('A simple everyday fact; no advice, products or brands'));
  expect(screen.getByText(/One admin approves a Life question like any trivia question/)).toBeTruthy();
  expect(screen.getByLabelText('Approve question')).toBeEnabled();
  await fireEvent.press(screen.getByLabelText('Create new draft version'));
  const payload=write.mock.calls[0][2];
  expect(payload).toEqual(expect.objectContaining({topic_category:'life',chapter:'savings_season',min_age_band:'13',education_only:true}));
  for(const key of ['sport','source_url','source_retrieved_on','as_of_tax_year','domain'])expect(payload).not.toHaveProperty(key);
});
it('shows no re-review control on an approved Life version',async()=>{
  await render(<SportQuizBank {...props} questions={[{...lifeQ,status:'approved',education_only:true}]} lifeActiveTotal={1} lifeCap={200}/>);
  await fireEvent.press(screen.getByLabelText('Select Money Huddle question version 1'));
  expect(screen.queryByLabelText(/re-review/i)).toBeNull();
});
