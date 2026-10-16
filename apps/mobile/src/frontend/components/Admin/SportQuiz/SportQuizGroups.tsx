/**
 * QUIZ-03 family-challenge overview (counts only), reports by group id, the audited case view and removal with a reason.
 * @sideEffects None directly; the owning desk opens cases and removes through actor-bound admin RPCs.
 */
import {useState} from 'react';
import {StyleSheet,Text} from 'react-native';
import {AdminBtn,AdminField,AdminMetrics,AdminPanel} from '@/components/Admin/AdminChrome';
import type {TimedQuizGroupCounts,TimedQuizGroupReport,TriviaGroupCase} from '@/lib/sportQuiz';

export type SportQuizGroupsProps={counts:TimedQuizGroupCounts|null;reports:TimedQuizGroupReport[];caseFile:TriviaGroupCase|null;busy:string|null;hasReason:boolean;
  onOpenCase:(groupId:string)=>void;onRemove:(groupId:string,profileId:string|null)=>void};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reasonLabel:Record<string,string>={safety:'safety',unwanted_contact:'unwanted contact',name_or_theme:'name or theme',other:'other'};
const refusalLabel:Record<string,string>={teen_rule:'teen friend-request rule',blocked:'block between accounts',full:'group full',removed:'removed earlier',closed:'group closed'};

/** @purpose Safety handling without a member directory: ids and age bands appear only inside an audited case read. */
export function SportQuizGroups({counts,reports,caseFile,busy,hasReason,onOpenCase,onRemove}:SportQuizGroupsProps){
  const [groupId,setGroupId]=useState('');
  const validId=uuid.test(groupId.trim());
  const open=caseFile&&caseFile.group_id===groupId.trim()?caseFile:null;
  return <>
    <AdminPanel title="Family challenge groups">
      <Text>Counts only: never member names, answers or who played. Groups have preset names, codes are stored hashed, and every join follows the teen friend-request rules both ways plus blocks.</Text>
      {counts?<AdminMetrics items={[
        {label:'Active groups',value:counts.groups_active},{label:'Members in active groups',value:counts.members_active},{label:'Groups that played this week',value:counts.groups_played_this_week},
        {label:'Codes active now',value:counts.codes_active},{label:'Codes made (all time)',value:counts.codes_issued},{label:'Joins (7 days)',value:counts.joins_7d},
        {label:'Refused joins (7 days)',value:counts.refusals_7d},{label:'Wrong codes (7 days)',value:counts.wrong_codes_7d},{label:'Reports (7 days)',value:counts.reports_7d},
        {label:'Removed members',value:counts.members_removed},{label:'Closed groups awaiting purge',value:counts.groups_closed},{label:'Shared sets this week',value:counts.sets_this_week},
      ]}/>:<Text>Group counts unavailable at this source read.</Text>}
    </AdminPanel>
    <AdminPanel title="Group reports">
      <Text>Members use Report group, which carries only the group id and a fixed reason. Choose a report to open its case.</Text>
      {reports.length?reports.map(r=><AdminBtn key={r.id} label={`${r.created_at} · ${reasonLabel[r.reason_code]??r.reason_code} · group ${r.group_id}`} disabled={!!busy} onPress={()=>setGroupId(r.group_id)}/>)
        :<Text>No group reports at this source read.</Text>}
    </AdminPanel>
    <AdminPanel title="Group case">
      <AdminField label="Group id from a report or Support" value={groupId} onChangeText={setGroupId} placeholder="Group UUID"/>
      <Text>Opening a case is recorded in the group's audit log with your reason. Use the reason field at the top of the desk.</Text>
      <AdminBtn label={busy==='case'?'Opening…':'Open audited case'} disabled={!!busy||!hasReason||!validId} onPress={()=>onOpenCase(groupId.trim())}/>
      {open?<>
        <Text>{open.group?`${open.group.name_key} · ${open.group.status}${open.group.close_reason?` (${open.group.close_reason})`:''} · theme ${open.group.theme_sport??'all sports'} · ${open.group.codes_issued} codes made · code ${open.group.code_active?'active':'inactive'}`:'Group already purged; only its audit log remains.'}</Text>
        <Text style={styles.head}>Members (ids and age bands only)</Text>
        {open.members.length?open.members.map(m=><Text key={m.profile_id}>{`${m.profile_id} · ${m.age_band} · ${m.status}${m.removed_reason?` (${m.removed_reason})`:''}${m.is_owner?' · creator':''}`}</Text>):<Text>No member rows.</Text>}
        {open.members.filter(m=>m.status==='active').map(m=><AdminBtn key={`rm-${m.profile_id}`} label={`Remove ${m.profile_id}`} kind="danger" disabled={!!busy||!hasReason} onPress={()=>onRemove(open.group_id,m.profile_id)}/>)}
        <Text style={styles.head}>Refused joins</Text>
        {open.refusals.length?open.refusals.map((r,i)=><Text key={`${r.profile_id}-${i}`}>{`${r.created_at} · ${r.profile_id} · ${r.age_band} · ${refusalLabel[r.refusal_reason]??r.refusal_reason}`}</Text>):<Text>No refused joins.</Text>}
        <Text style={styles.head}>Audit log</Text>
        {open.cases.map(c=><Text key={c.id}>{`${c.created_at} · ${c.kind}${c.reason_code?` · ${c.reason_code}`:''}${c.actor_id?` · by ${c.actor_id}`:''}${c.subject_id?` · subject ${c.subject_id}`:''}${c.reason?` · ${c.reason}`:''}`}</Text>)}
        {open.group?.status==='active'?<AdminBtn label="Close the whole group" kind="danger" disabled={!!busy||!hasReason} onPress={()=>onRemove(open.group_id,null)}/>:null}
        <Text>A removed member cannot rejoin and sees the ordinary removal message; the code rotates. Closing keeps the audit log; retention purges closed groups after 35 days.</Text>
      </>:null}
    </AdminPanel>
  </>;
}
const styles=StyleSheet.create({head:{fontWeight:'700',marginTop:8}});
