/**
 * QUIZ-04 Life question fields inside the question bank: the chapter and the education-only attestation. Owner
 * simplification 2026-10-15: every Life question is 13+ (min_age_band '13' is sent for the server), one admin approves
 * it like any trivia question, and there are no source links, tax years or named reviewers (those fields are archived).
 * @sideEffects None; the bank owns the draft and sends it through the desk's bound writer.
 */
import {Text} from 'react-native';
import {AdminPills} from '@/components/Admin/AdminChrome';
import {LIFE_CHAPTER_IDS,type LifeChapterId} from '@/lib/lifePlaybook';

export type LifeQuestionDraft={chapter:LifeChapterId;attest:boolean};
export const EMPTY_LIFE_DRAFT:LifeQuestionDraft={chapter:'money_huddle',attest:false};
// Desk labels only; participants read chapter titles from the server.
const TITLES:Record<LifeChapterId,string>={money_huddle:'Money Huddle',savings_season:'Savings Season',scam_defense:'Scam Defense',smart_plays:'Smart Plays'};

/** @purpose Chapter display title; the server stores it as the question's sport label. */
export function lifeChapterTitle(id:LifeChapterId):string{return TITLES[id];}
/** @purpose Approval needs the education-only attestation; the server also runs the Life copy rules. */
export function lifeApprovalIssue(d:LifeQuestionDraft):string|null{
  return d.attest?null:'Missing the education-only attestation.';
}

export function SportQuizLifeQuestion({draft,onChange}:{draft:LifeQuestionDraft;onChange:(next:LifeQuestionDraft)=>void}){
  return <>
    <AdminPills label="Life chapter" value={draft.chapter} items={LIFE_CHAPTER_IDS.map(id=>({id,label:TITLES[id]}))} onChange={chapter=>onChange({...draft,chapter})}/>
    <AdminPills label="Education-only attestation" value={draft.attest?'yes':'no'} items={[{id:'yes',label:'A simple everyday fact; no advice, products or brands'},{id:'no',label:'Not attested'}]}
      onChange={id=>onChange({...draft,attest:id==='yes'})}/>
    <Text>Every Life question is for everyone 13+. Keep it a simple fact anyone can check. At approval the server refuses: "you should / must / need to" advice, brand names, Tapua'i money words (Tapua'i, donation, donor, Rally, family account, payout, Aura, gift and the thank-you word), NIL or eligibility, tax, loans, credit scores or APR, any money amount, price, percentage, rate or "k / grand / million" figure, and years. Scam Defense explanations end "Tell a trusted adult and use Report." Prompts stay within 120 characters and explanations within 200.</Text>
  </>;
}
