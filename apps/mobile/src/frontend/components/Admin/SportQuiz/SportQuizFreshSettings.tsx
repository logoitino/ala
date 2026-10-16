/**
 * QUIZ-05 fresh-question settings inside the Trivia Settings panel: the trivia.athlete_questions switch (off by default),
 * the fun-fact share (0–10%, default 0), report intake (pause), the editable self-heal thresholds within the server's
 * bounds, and the report rules shown read-only (fixed by the design review). All four save together with the desk reason.
 * @sideEffects None directly; the desk saves through quiz_admin_fresh_settings bound to its captured admin identity.
 */
import {useEffect,useState} from 'react';
import {Text} from 'react-native';
import {AdminBtn,AdminField,AdminPanel,AdminPills} from '@/components/Admin/AdminChrome';
import {FRESH_SELF_HEAL_BOUNDS,selfHealValid,type FreshSelfHeal,type FreshSettingsInput,type FreshStatus} from '@/lib/freshQuestions';

export type SportQuizFreshSettingsProps={current:FreshStatus|null;busy:string|null;hasReason:boolean;onSave:(next:FreshSettingsInput)=>void};
const LABELS:Record<keyof FreshSelfHeal,string>={min_responders:'Players needed before flags (distinct accounts)',too_easy_pct:'"Too easy" at this % right or more',
  confusing_choice4_pct:'"Confusing" (four choices) at this % right or fewer',confusing_true_false_pct:'"Confusing" (true or false) at this % right or fewer',too_long_pct:'"Too long" at this % of time-outs or more'};
const SHARES=['0','1','2','3','4','5','6','7','8','9','10'] as const;

/** @purpose One draft of the four settings; Save is enabled only for a valid change with a reason. */
export function SportQuizFreshSettings({current,busy,hasReason,onSave}:SportQuizFreshSettingsProps){
  const pick=(c:FreshStatus):FreshSettingsInput=>({athlete_questions_enabled:c.athlete_questions_enabled,athlete_share_pct:c.athlete_share_pct,reports_paused:c.reports_paused,self_heal:{...c.self_heal}});
  const [draft,setDraft]=useState<FreshSettingsInput|null>(current?pick(current):null);
  const key=current?JSON.stringify(pick(current)):null;
  useEffect(()=>{setDraft(current?pick(current):null);},[key]); // eslint-disable-line react-hooks/exhaustive-deps
  if(!current||!draft)return <AdminPanel title="Fun facts, reports and self-heal"><Text>Fresh-question settings are not switched on in this database.</Text></AdminPanel>;
  const valid=selfHealValid(draft.self_heal);
  const changed=JSON.stringify(draft)!==key;
  const setHeal=(k:keyof FreshSelfHeal,v:string)=>setDraft(d=>d&&{...d,self_heal:{...d.self_heal,[k]:/^\d{1,3}$/.test(v)?Number(v):Number.NaN}});
  const r=current.report_rules;
  return <AdminPanel title="Fun facts, reports and self-heal">
    <AdminPills<'on'|'off'> label="Fun facts (trivia.athlete_questions)" value={draft.athlete_questions_enabled?'on':'off'} items={[{id:'on',label:'On'},{id:'off',label:'Off'}]}
      onChange={v=>setDraft(d=>d&&{...d,athlete_questions_enabled:v==='on'})}/>
    <Text>Off stops new submissions and drawing at once; a fun fact already on screen is checked again when answered.</Text>
    <AdminPills label="Fun-fact share of questions (%)" value={String(draft.athlete_share_pct)} items={SHARES.map(id=>({id,label:id}))} onChange={v=>setDraft(d=>d&&{...d,athlete_share_pct:Number(v)})}/>
    <Text>At most one fun fact per round, in about 1 of 3 rounds at most, and one per athlete per player per month. 0 draws none.</Text>
    <AdminPills<'open'|'paused'> label="Report intake" value={draft.reports_paused?'paused':'open'} items={[{id:'open',label:'Open'},{id:'paused',label:'Paused'}]}
      onChange={v=>setDraft(d=>d&&{...d,reports_paused:v==='paused'})}/>
    {(Object.keys(LABELS) as (keyof FreshSelfHeal)[]).map(k=><AdminField key={k} label={`${LABELS[k]} (${FRESH_SELF_HEAL_BOUNDS[k][0]}–${FRESH_SELF_HEAL_BOUNDS[k][1]})`}
      value={Number.isNaN(draft.self_heal[k])?'':String(draft.self_heal[k])} onChangeText={v=>setHeal(k,v)} keyboardType="number-pad"/>)}
    {!valid?<Text accessibilityRole="alert">Every threshold must be a whole number inside its range.</Text>:null}
    <Text>{`Report rules (fixed): pause after ${r.ordinary_reporters} counted accounts, or ${r.fact_reporters} "Not okay" / "Shares something private" on a fun fact; ${r.restored_reporters} new reporters after a restore; at most ${r.daily_pause_cap} auto-pauses per topic per day; counted only from accounts ${r.min_account_days}+ days old with a completed round and never across a block; ${r.per_account_per_day} reports per account per day; reporter ids cleared after ${r.reporter_clear_days} days, reports deleted after ${r.delete_days}.`}</Text>
    <AdminBtn label={busy==='fresh'?'Saving…':'Save fun facts, reports and self-heal'} kind="primary" disabled={!!busy||!hasReason||!valid||!changed} onPress={()=>onSave(draft)}/>
  </AdminPanel>;
}
