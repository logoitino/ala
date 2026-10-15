// ARCHIVED 2026-10-15 · QUIZ-04 owner simplification · owner approved · excerpt from apps/mobile/src/frontend/components/Admin/SportQuiz/SportQuizTool.tsx (SportQuizTool sign-off and reviewer handlers).
// Not built, tested or imported. Restore: paste back into SportQuizTool with the archived lib wrappers and SportQuizLife panels.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

  const signoff=(input:LifeSignoffInput)=>lifeAction('life_signoff',async()=>{
    if(!current()||!actor)return '';await recordLifeSignoff(input,reason.trim(),actor);
    if(!current())return '';setReason('');await load();return 'CPA sign-off recorded; a second admin must confirm it.';});
  const confirmSignoff=(id:string)=>lifeAction('life_signoff',async()=>{
    if(!current()||!actor)return '';await confirmLifeSignoff(id,reason.trim(),actor);
    if(!current())return '';setReason('');await load();return 'CPA sign-off confirmed.';});
  const confirmGrant=(id:string)=>lifeAction('reviewer',async()=>{
    if(!current()||!actor)return '';await confirmLifeReviewer(id,reason.trim(),actor);
    if(!current())return '';setReason('');await load();return 'Reviewer grant confirmed by a second admin.';});
  const grant=(input:LifeReviewerGrantInput)=>lifeAction('reviewer',async()=>{
    if(!current()||!actor)return '';await grantLifeReviewer(input,reason.trim(),actor);
    if(!current())return '';setReason('');await load();return 'Reviewer granted; a second admin must confirm before it counts.';});
  const revoke=(grantId:string)=>lifeAction('reviewer',async()=>{
    if(!current()||!actor)return '';await revokeLifeReviewer(grantId,reason.trim(),actor);
    if(!current())return '';setReason('');await load();return 'Reviewer revoked and recorded in the audit.';});
