// ARCHIVED 2026-10-15 · QUIZ-04 owner simplification · owner approved · excerpt from apps/mobile/src/frontend/components/Admin/SportQuiz/__tests__/SportQuizLife.test.tsx (SportQuizLife sign-off / reviewer / source tests).
// Not built, tested or imported. Restore: restore with the archived panels and fixtures (signoffs, reviewers, rereview).
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

it('records a CPA sign-off and grants / revokes reviewers',async()=>{
  await render(<SportQuizLife data={data} error={null} busy={null} hasReason {...handlers}/>);
  expect(screen.getByLabelText('Record CPA sign-off')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Signed by (name and credential)'),'Pat Example, CPA');
  await fireEvent.changeText(screen.getByLabelText('Signed on (YYYY-MM-DD)'),'2026-10-01');
  await fireEvent.press(screen.getByLabelText('Record CPA sign-off'));
  expect(handlers.onSignoff).toHaveBeenCalledWith({chapter:'credit_clock',signed_by_name:'Pat Example, CPA',signed_on:'2026-10-01',note:null});
  await fireEvent.changeText(screen.getByLabelText('Reviewer profile ID'),'00000000-0000-0000-0000-000000000008');
  await fireEvent.press(screen.getByLabelText('Tax'));
  await fireEvent.changeText(screen.getByLabelText('Qualification'),'Acting for TAX');
  await fireEvent.press(screen.getByLabelText('Grant reviewer'));
  expect(handlers.onGrant).toHaveBeenCalledWith({profile_id:'00000000-0000-0000-0000-000000000008',domain:'tax',qualification:'Acting for TAX',expires_at:null});
  await fireEvent.press(screen.getByLabelText('Revoke Rae (finance)'));
  expect(handlers.onRevoke).toHaveBeenCalledWith('g1');
});
it('second-admin confirmations: a waiting grant and a waiting sign-off offer Confirm; an old or future sign-off date is refused',async()=>{
  await render(<SportQuizLife data={data} error={null} busy={null} hasReason {...handlers}/>);
  expect(screen.getByText('Tai · tax · waiting for a second admin')).toBeTruthy();
  expect(screen.queryByLabelText('Confirm Rae (finance) as second admin')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Confirm Tai (tax) as second admin'));
  expect(handlers.onConfirmGrant).toHaveBeenCalledWith('g2');
  expect(screen.getByText(/credit_clock · Pat Example, CPA · waiting for a second admin/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Confirm sign-off 5 (second admin)'));
  expect(handlers.onConfirmSignoff).toHaveBeenCalledWith('5');
  await fireEvent.changeText(screen.getByLabelText('Signed by (name and credential)'),'Pat Example, CPA');
  await fireEvent.changeText(screen.getByLabelText('Signed on (YYYY-MM-DD)'),'2025-01-01');
  expect(screen.getByLabelText('Record CPA sign-off')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Signed on (YYYY-MM-DD)'),'2026-12-01');
  expect(screen.getByLabelText('Record CPA sign-off')).toBeDisabled();
});
it('Life question field checks mirror the server draft and approval rules',()=>{
  expect(lifeQuestionIssue({...EMPTY_LIFE_DRAFT,chapter:'credit_clock'})).toMatch(/16\+/);
  expect(lifeQuestionIssue({...EMPTY_LIFE_DRAFT,url:'https://www.example.com/x'})).toMatch(/\.gov/);
  expect(lifeQuestionIssue({...EMPTY_LIFE_DRAFT,url:'http://www.irs.gov/x'})).toMatch(/https/);
  expect(lifeQuestionIssue({...EMPTY_LIFE_DRAFT,url:'https://content.naic.org/x'})).toBeNull();
  expect(lifeQuestionIssue({...EMPTY_LIFE_DRAFT,asOf:'2025'})).toMatch(/adult-only/);
  expect(lifeApprovalIssue(EMPTY_LIFE_DRAFT)).toMatch(/attestation/);
  expect(lifeApprovalIssue({...EMPTY_LIFE_DRAFT,attest:true,url:'https://www.irs.gov/x'})).toMatch(/retrieval date/);
  expect(lifeApprovalIssue({...EMPTY_LIFE_DRAFT,attest:true,url:'https://www.irs.gov/x',retrieved:'2026-10-01'})).toBeNull();
});
