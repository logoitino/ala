// ARCHIVED 2026-10-15 · QUIZ-04 owner simplification · owner approved · excerpt from apps/mobile/src/frontend/components/Admin/SportQuiz/SportQuizLifeQuestion.tsx (lifeQuestionIssue source / band / tax-year checks, lifeApprovalIssue source checks, SportQuizLifeQuestion source / band / tax-year fields).
// Not built, tested or imported. Restore: restore the band, source link, retrieval date and tax-year fields with the archived question columns (domain, source_url, source_retrieved_on, as_of_tax_year).
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

const SIXTEEN:LifeChapterId[]=['credit_clock','tax_timeout','life_needs'];
const NONPROFIT=['councilforeconed.org','jumpstart.org','ngpf.org','naic.org','nefe.org','smartaboutmoney.org'];

/** @purpose Chapter display title; the server stores it as the question's sport label. */
export function lifeChapterTitle(id:LifeChapterId):string{return TITLES[id];}
/** @purpose Mirror the server's draft checks (age band at or above the chapter's, allow-listed https source, dated figures adult-only). */
export function lifeQuestionIssue(d:LifeQuestionDraft):string|null{
  if(SIXTEEN.includes(d.chapter)&&d.band==='13')return 'This chapter is 16+; choose 16 or 18.';
  if(d.url){
    let host='';
    try{const u=new URL(d.url);if(u.protocol!=='https:')return 'The source must be an https link.';host=u.hostname.toLowerCase();}catch{return 'The source is not a link.';}
    if(!host.endsWith('.gov')&&!NONPROFIT.some(h=>host===h||host.endsWith(`.${h}`)))return 'Use a .gov source or an allow-listed nonprofit education source.';
  }
  if(d.retrieved&&!/^\d{4}-\d{2}-\d{2}$/.test(d.retrieved))return 'Write the retrieval date as YYYY-MM-DD.';
  const year=new Date().getUTCFullYear();
  if(d.asOf&&(!/^20\d{2}$/.test(d.asOf)||d.band!=='18'))return 'A tax year is only for adult-only (18) items with a dated figure.';
  if(d.asOf&&Math.abs(Number(d.asOf)-year)>1)return 'The tax year must be the previous, current or next tax year.';
  return null;
}
/** @purpose Approval needs the attestation, a source link and its retrieval date; the copy and reviewer rules are checked by the server. */
export function lifeApprovalIssue(d:LifeQuestionDraft):string|null{
  if(!d.attest)return 'Missing the education-only attestation.';
  if(!d.url||!d.retrieved)return 'Missing the checked source link or its retrieval date.';
  return lifeQuestionIssue(d);
}

export function SportQuizLifeQuestion({draft,onChange}:{draft:LifeQuestionDraft;onChange:(next:LifeQuestionDraft)=>void}){
  const issue=lifeQuestionIssue(draft);
  return <>
    <AdminPills label="Life chapter" value={draft.chapter} items={LIFE_CHAPTER_IDS.map(id=>({id,label:TITLES[id]}))}
      onChange={chapter=>onChange({...draft,chapter,band:SIXTEEN.includes(chapter)&&draft.band==='13'?'16':draft.band})}/>
    <AdminPills label="Minimum age band" value={draft.band} items={[{id:'13',label:'13+'},{id:'16',label:'16+'},{id:'18',label:'Adults only'}]} onChange={band=>onChange({...draft,band})}/>
    <AdminPills label="Education-only attestation" value={draft.attest?'yes':'no'} items={[{id:'yes',label:'Teaches a general concept; no advice, products or brands'},{id:'no',label:'Not attested'}]}
      onChange={id=>onChange({...draft,attest:id==='yes'})}/>
    <AdminField label="Source link (.gov or allow-listed nonprofit)" value={draft.url} onChangeText={url=>onChange({...draft,url})} placeholder="https://www.consumerfinance.gov/…"/>
    <AdminField label="Source retrieved on (YYYY-MM-DD)" value={draft.retrieved} onChangeText={retrieved=>onChange({...draft,retrieved})}/>
    <AdminField label="Tax year of a dated figure (adults only, optional)" value={draft.asOf} keyboardType="number-pad" onChangeText={asOf=>onChange({...draft,asOf})}/>
    <Text>The server runs the Life copy rules at approval and re-review: no "you should / must / need to", no Tapua'i money words (Tapua'i, donation, donor, Rally, family account, payout, Aura, gift, Mālo), no brand names, no "stranger", no eligibility rules (NIL only with the compliance-office line), Scam Defense ends "Tell a trusted adult and use Report.", Credit Clock and Tax Timeout end with the disclaimer, Life Needs has no health topics, and no amount or percentage (even spelled out) unless the text says "{LIFE_ILLUSTRATIVE_MARKER}" or it is an adult-only item dated by tax year. A dated item is withdrawn every 31 January (UTC).</Text>
    {issue?<Text accessibilityRole="alert">{issue}</Text>:null}
  </>;
}
