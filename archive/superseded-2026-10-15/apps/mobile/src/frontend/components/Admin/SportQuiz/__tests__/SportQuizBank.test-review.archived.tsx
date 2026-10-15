// ARCHIVED 2026-10-15 · QUIZ-04 owner simplification · owner approved · excerpt from apps/mobile/src/frontend/components/Admin/SportQuiz/__tests__/SportQuizBank.test.tsx (SportQuizBank source / re-review tests).
// Not built, tested or imported. Restore: with the archived Life question columns, the 'rereview' action and the SportQuizBank excerpt.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

// QUIZ-04 Life questions: chapter fields replace the sport field; approval waits for the attestation, source and date.
const lifeQ:TimedQuizAdminQuestion={...question,id:'l1',question_key:'lfam',topic_category:'life',sport:'Money Huddle',prompt:'A budget plans where money goes before it is spent.',
  options:['True','False'],question_type:'true_false',correct_option:0,explanation:'True. A budget is a game plan for money.',source_notes:'CFPB budgeting page checked by Content.',
  chapter:'money_huddle',min_age_band:'13',education_only:true,domain:'finance',source_url:'https://www.consumerfinance.gov/x',source_retrieved_on:null,as_of_tax_year:null,
  review_due_on:null,approved_at:null,life_reviewer_id:null,life_reviewer_grant_id:null,life_reviewed_at:null};
it('creates a Life draft with its chapter fields and keeps approval closed until the source date is recorded',async()=>{
  await render(<SportQuizBank {...props} questions={[lifeQ]} lifeActiveTotal={56} lifeCap={200}/>);
  expect(screen.getByText('Life Playbook: 56 of 200 active Life versions (a separate cap).')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Select Money Huddle question version 1'));
  expect(screen.queryByLabelText('Sport and rule context')).toBeNull();
  expect(screen.getByText('Missing the checked source link or its retrieval date.')).toBeTruthy();
  expect(screen.getByLabelText('Approve question')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Source retrieved on (YYYY-MM-DD)'),'2026-10-01');
  await fireEvent.press(screen.getByLabelText('Create new draft version'));
  expect(write).toHaveBeenCalledWith('l1','edit',expect.objectContaining({topic_category:'life',chapter:'money_huddle',min_age_band:'13',education_only:true,
    source_url:'https://www.consumerfinance.gov/x',source_retrieved_on:'2026-10-01',as_of_tax_year:null}));
  expect(write.mock.calls[0][2]).not.toHaveProperty('sport');
});
it('offers the yearly re-review on an approved Life version',async()=>{
  await render(<SportQuizBank {...props} questions={[{...lifeQ,status:'approved',source_retrieved_on:'2026-10-01',review_due_on:'2027-10-01',life_reviewer_id:'rev'}]} lifeActiveTotal={1} lifeCap={200}/>);
  await fireEvent.press(screen.getByLabelText('Select Money Huddle question version 1'));
  expect(screen.getByText(/Review due 2027-10-01 · reviewer rev/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Record yearly re-review (domain reviewer)'));
  expect(write).toHaveBeenCalledWith('l1','rereview',{reason:props.reason});
});
