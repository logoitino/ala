/** QUIZ-02 bank authoring: explicit family/source review and immutable correction paths. Synthetic draft rows. */
import {fireEvent,render,screen} from '@testing-library/react-native';
import {SportQuizBank} from '../SportQuizBank';
import type {TimedQuizAdminQuestion} from '@/lib/sportQuiz';
const question:TimedQuizAdminQuestion={id:'q1',question_key:'family1',version:1,topic_category:'sport',sport:'American football',prompt:'How many points does a touchdown score before conversion?',
  options:['3','6','7','2'],correct_option:1,explanation:'A touchdown scores six points.',source_notes:'Official rule book confirms six points.',status:'draft',reason:'Human fact review required.',created_at:'2026-10-14',created_by:null,reviewed_at:null,reviewed_by:null};
const write=jest.fn();
const props={questions:[question],total:1,cap:100,nextCursor:null,busy:null,reason:'Content owner checked the published rule.',tab:'operate' as const,onLoadMore:jest.fn(),onWrite:write};
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
