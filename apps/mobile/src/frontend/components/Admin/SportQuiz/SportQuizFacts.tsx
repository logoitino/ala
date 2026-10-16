/**
 * QUIZ-05 athlete fun-fact queue: every fact with its guardian status (under 16), the admin checklist (no sponsor or
 * business, no place, no schedule), Approve or Decline with a reason code, and withdrawn / removed facts shown without
 * text. Admins never write, edit or withdraw an athlete's words; a 13–15 fact needs the guardian's approval first.
 * @sideEffects None directly; the desk saves through quiz_admin_fact_decide bound to its captured admin identity.
 */
import {useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {AdminBtn,AdminField,AdminMetrics,AdminPanel,AdminPills} from '@/components/Admin/AdminChrome';
import {FUN_FACT_ADMIN_DECLINE_REASONS,type FactDecisionInput,type FactQueue,type FactQueueRow,type FunFactAdminDeclineReason} from '@/lib/freshQuestions';

export type SportQuizFactsProps={data:FactQueue|null;missing:boolean;error:string|null;busy:string|null;onDecide:(factId:string,input:FactDecisionInput)=>void};
export const GUARDIAN_WORDS:Record<FactQueueRow['guardian_status'],string>={not_needed:'no guardian step (16 or older)',no_guardian_yet:'under 16, no guardian linked yet (draft)',
  pending:'waiting for the guardian',lapsed:'guardian request lapsed',approved:'guardian approved',declined:'guardian declined'};
const STATUS_WORDS:Record<string,string>={waiting_guardian:'Waiting for a guardian',guardian_review:'With the guardian',admin_review:'Ready for an admin',approved:'Approved',
  declined:'Declined',withdrawn:'Removed by the athlete',removed:'Removed (account change)'};
const DECLINE_WORDS:Record<FunFactAdminDeclineReason,string>={not_okay:'Not okay',private:'Shares something private',sponsor_or_business:'Sponsor or business',place:'Names a place',schedule:'Schedule or time',other:'Other'};
const LOOK_WORDS:Record<string,string>={capitalised_pair:'Two capitalised words: check it is not a person to avoid, a place or a business.',
  schedule_or_place_words:'Schedule or place words (daily, after school, near…): check it gives away no routine or location.',
  hidden_word:'A word may be hidden by spacing or swapped letters: read it carefully.'};

/** @purpose Decide one athlete fact at a time; withdrawn facts stay listed so the record is complete. */
export function SportQuizFacts({data,missing,error,busy,onDecide}:SportQuizFactsProps){
  const [reason,setReason]=useState('');
  const [check,setCheck]=useState({sponsor:false,place:false,schedule:false});
  const [decline,setDecline]=useState<FunFactAdminDeclineReason>('not_okay');
  const [show,setShow]=useState<'review'|'all'>('review');
  const ok=Array.from(reason.trim()).length>=10&&Array.from(reason.trim()).length<=500;
  const checklist=check.sponsor&&check.place&&check.schedule;
  const rows=data?data.facts.filter(f=>show==='all'||f.status==='admin_review'):[];
  // Each decision starts fresh: the checklist and reason never carry over to the next fact (security review 2026-10-15).
  const decideAndReset=(factId:string,input:FactDecisionInput)=>{onDecide(factId,input);setReason('');setCheck({sponsor:false,place:false,schedule:false});setDecline('not_okay');};
  return <AdminPanel title="Athlete fun facts">
    <Text>Athletes share up to three short facts. A parent or guardian approves first when the athlete is under 16; then one admin checks it. Only people the athlete's privacy settings allow ever see it, and the athlete can remove it at any time.</Text>
    {missing?<Text>Fun facts are not switched on in this database.</Text>:error?<Text accessibilityRole="alert">{`Fun facts could not be read: ${error}`}</Text>:!data?<Text>Reading fun facts…</Text>:<>
      <AdminMetrics items={[{label:'Ready for an admin',value:data.counts.admin_review},{label:'With a guardian',value:data.counts.guardian_review},{label:'Waiting for a guardian',value:data.counts.waiting_guardian},
        {label:'Live',value:data.counts.approved},{label:'Declined',value:data.counts.declined},{label:'Removed by the athlete',value:data.counts.withdrawn}]}/>
      <AdminPills<'review'|'all'> label="Show" value={show} items={[{id:'review',label:'Ready for an admin'},{id:'all',label:'All (newest 200)'}]} onChange={setShow}/>
      <AdminField label="Decision reason" value={reason} onChangeText={setReason}/>
      <AdminPills<'yes'|'no'> label="Checked: no sponsor or business" value={check.sponsor?'yes':'no'} items={[{id:'yes',label:'Yes'},{id:'no',label:'Not yet'}]} onChange={v=>setCheck(c=>({...c,sponsor:v==='yes'}))}/>
      <AdminPills<'yes'|'no'> label="Checked: no place" value={check.place?'yes':'no'} items={[{id:'yes',label:'Yes'},{id:'no',label:'Not yet'}]} onChange={v=>setCheck(c=>({...c,place:v==='yes'}))}/>
      <AdminPills<'yes'|'no'> label="Checked: no schedule" value={check.schedule?'yes':'no'} items={[{id:'yes',label:'Yes'},{id:'no',label:'Not yet'}]} onChange={v=>setCheck(c=>({...c,schedule:v==='yes'}))}/>
      <AdminPills<FunFactAdminDeclineReason> label="Decline reason" value={decline} items={FUN_FACT_ADMIN_DECLINE_REASONS.map(id=>({id,label:DECLINE_WORDS[id]}))} onChange={setDecline}/>
      {rows.length?rows.map(f=><View key={f.id} style={styles.row} accessibilityLabel={`Fun fact from ${f.first_name}`}>
        <Text style={styles.title}>{`${f.first_name} · ${f.label} · ${STATUS_WORDS[f.status]??f.status}${f.paused?' · paused for a check':''}`}</Text>
        <Text>{f.answer_text??'Text removed.'}</Text>
        <Text>{`${f.age_band==='teen_13_15'?'Under 16':f.age_band==='teen_16_17'?'16–17':'Adult'} · ${GUARDIAN_WORDS[f.guardian_status]} · ${f.verified?'verified athlete':'not verified yet (never drawn until verified)'}`}</Text>
        {f.look_reasons.map(r=><Text key={r}>{LOOK_WORDS[r]??r}</Text>)}
        {f.decline_reason?<Text>{`Declined: ${f.decline_reason==='guardian'?'by the guardian':DECLINE_WORDS[f.decline_reason as FunFactAdminDeclineReason]}`}</Text>:null}
        {f.status==='admin_review'?<View style={styles.buttons}>
          <AdminBtn label="Approve" kind="primary" disabled={!!busy||!ok||!checklist} onPress={()=>decideAndReset(f.id,{action:'approve',reason:reason.trim(),checklist:{no_sponsor_or_business:true,no_place:true,no_schedule:true}})}/>
          <AdminBtn label="Decline" kind="danger" disabled={!!busy||!ok} onPress={()=>decideAndReset(f.id,{action:'decline',reason:reason.trim(),decline_reason:decline})}/>
        </View>:null}
      </View>):<Text>{show==='review'?'No fun facts are ready for an admin.':'No fun facts yet.'}</Text>}
      {!checklist?<Text>Approve stays off until all three checks are Yes.</Text>:null}
    </>}
  </AdminPanel>;
}
const styles=StyleSheet.create({row:{gap:4,paddingVertical:8,borderTopWidth:StyleSheet.hairlineWidth,borderColor:'#c9c9c9'},title:{fontWeight:'700'},buttons:{flexDirection:'row',flexWrap:'wrap',gap:8}});
