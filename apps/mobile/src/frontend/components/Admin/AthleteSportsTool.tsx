/** Admin-first sport participation repair lives beside existing playbooks, with revision-confirmed writes.
 * Account-keyed editors and request generations prevent stale private rows from reappearing after a switch. */
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { AdminBtn, AdminEmpty, AdminField, AdminNotice, AdminPanel, AdminRow } from '@/components/Admin/AdminChrome';
import { useAuth } from '@/context/AuthContext';
import { useAdminAction } from '@/hooks/useAdminAction';
import { useStoredSportChoices } from '@/hooks/useStoredSportChoices';
import { useTeamSearch } from '@/hooks/useTeamSearch';
import { fetchAdminAthleteSports, saveAthleteSports, type AdminAthleteSportsProfile, type AthleteSportEntry } from '@/lib/athleteSports';
import { colors } from '@/constants/theme';

type Draft = { row: AdminAthleteSportsProfile; sports: AthleteSportEntry[]; primary: string; expanded: string };
export function AthleteSportsTool() {
  const { user, isAdmin } = useAuth();
  // Remount across account changes, including A → B → A, rather than retaining privileged drafts.
  return user && isAdmin ? <AthleteSportsEditor key={user.id} /> : null;
}
function AthleteSportsEditor() {
  const [query,setQuery] = useState('');
  const [rows,setRows] = useState<AdminAthleteSportsProfile[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [draft,setDraft] = useState<Draft|null>(null);
  const [teamQuery,setTeamQuery] = useState('');
  const { sportNames, status: catalogStatus, reload: reloadCatalog } = useStoredSportChoices();
  const { teams,loading:teamsLoading } = useTeamSearch(teamQuery);
  const action = useAdminAction();
  const request = useRef(0);
  const mounted = useRef(true);
  const locked = Boolean(action.busy);
  const load = async (needle:string) => {
    const generation=++request.current; setLoading(true); setError(null);
    try { const found=await fetchAdminAthleteSports(needle); if(mounted.current && generation===request.current) setRows(found); }
    catch(caught) { if(mounted.current && generation===request.current) { setRows([]); setError(caught instanceof Error?caught.message:'Could not load athlete sports.'); } }
    finally { if(mounted.current && generation===request.current) setLoading(false); }
  };
  useEffect(()=>{ mounted.current=true; void load(''); return()=>{mounted.current=false; request.current++;}; },[]);
  const patchEntry = (sport:string,patch:Partial<AthleteSportEntry>) => {
    if(locked) return;
    setDraft(current=>current?{...current,sports:current.sports.map(entry=>entry.sport===sport?{...entry,...patch}:entry)}:current);
  };
  const save = () => {
    if(!draft || !draft.primary || !draft.sports.length || catalogStatus!=='ready' || draft.sports.some(entry=>!draft.row.sports.some(saved=>saved.sport===entry.sport)&&!sportNames.includes(entry.sport))) return;
    const submitted=draft;
    // A search begun before this write must not replace its confirmed revision.
    request.current++; setLoading(false);
    void action.run('Save athlete sports',async()=>{
      try {
        const confirmed=await saveAthleteSports(submitted.row.profileId,submitted.primary,submitted.sports,submitted.row.revision);
        if(!mounted.current) return '';
        const row={...submitted.row,...confirmed};
        setRows(current=>current.map(entry=>entry.profileId===row.profileId?row:entry));
        setDraft({...submitted,row,sports:confirmed.sports.map(entry=>({...entry})),primary:confirmed.primarySport??''});
        return 'Athlete sports saved.';
      } catch(caught) { if(!mounted.current) return ''; throw caught; }
    });
  };
  const selected=draft?.sports.find(entry=>entry.sport===draft.expanded);
  return <AdminPanel title="Athlete sports">
    <Text style={{color:colors.textMuted,fontSize:13}}>One manually chosen primary sets the field artwork. Sport teams are participation details; they do not confirm school identity. Removing participation keeps recorded history.</Text>
    <AdminNotice text={catalogStatus==='unavailable'?'Published sports could not load. Your draft is kept.':catalogStatus==='loading'?'Loading published sports…':sportNames.length===0?'No active sports are published. Existing participation can still be corrected.':null} tone="warn"/>
    <AdminBtn label="Reload published sports" disabled={locked} onPress={reloadCatalog}/>
    <AdminNotice text={error} tone="danger"/>
    <AdminNotice text={action.message?.text??null} tone={action.message?.tone}/>
    <AdminField label="Search athletes" value={query} editable={!locked} onChangeText={setQuery}/>
    <AdminBtn label="Find athletes" disabled={locked} onPress={()=>void load(query)}/>
    {loading?<AdminEmpty text="Loading athlete sports…"/>:!error&&rows.length===0?<AdminEmpty text="No matching athletes."/>:null}
    {rows.map(row=><AdminRow key={row.profileId} title={row.fullName} meta={`${row.username?'@'+row.username+' · ':''}${row.primarySport??'No primary'} · ${row.sports.map(entry=>entry.sport).join(', ')||'No sports'} · revision ${row.revision}`}>
      <AdminBtn label={`Edit sports for ${row.fullName}`} disabled={locked} onPress={()=>{setDraft({row,sports:row.sports.map(entry=>({...entry})),primary:row.primarySport??'',expanded:row.primarySport??''});setTeamQuery('');action.setMessage(null);}}/>
    </AdminRow>)}
    {draft?<View style={{gap:8}}>
      <Text accessibilityRole="header" style={{color:colors.text,fontSize:16,fontWeight:'700'}}>{draft.row.fullName} · Sports draft</Text>
      {draft.sports.some(entry=>!draft.row.sports.some(saved=>saved.sport===entry.sport)&&!sportNames.includes(entry.sport))?<AdminNotice text="A new draft sport is no longer published. Remove it or reload the catalog before saving." tone="warn"/>:null}
      {!draft.primary?<AdminNotice text="Choose a replacement primary before saving." tone="warn"/>:null}
      {draft.sports.map(entry=><AdminRow key={entry.sport} title={`${entry.sport}${draft.primary===entry.sport?' · Primary':''}`} meta={[entry.teamName,entry.position,entry.jersey?'#'+entry.jersey:''].filter(Boolean).join(' · ')}>
        {draft.primary!==entry.sport?<AdminBtn label={`Make ${entry.sport} primary`} disabled={locked} onPress={()=>setDraft({...draft,primary:entry.sport})}/>:null}
        <AdminBtn label={`Edit ${entry.sport} details`} disabled={locked} onPress={()=>{setDraft({...draft,expanded:entry.sport});setTeamQuery('');}}/>
        <AdminBtn label={`Remove ${entry.sport}`} disabled={locked} onPress={()=>{setDraft({...draft,sports:draft.sports.filter(item=>item.sport!==entry.sport),primary:draft.primary===entry.sport?'':draft.primary,expanded:''});setTeamQuery('');}}/>
      </AdminRow>)}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{sportNames.filter(sport=>!draft.sports.some(entry=>entry.sport===sport)).map(sport=><AdminBtn key={sport} label={`Add ${sport}`} disabled={locked||draft.sports.length>=16} onPress={()=>{setDraft({...draft,sports:[...draft.sports,{sport,schoolId:null,teamName:null,position:'',jersey:''}],primary:draft.sports.length===0?sport:draft.primary,expanded:sport});setTeamQuery('');}}/>)}</View>
      {selected?<View style={{gap:6}}>
        <AdminField label={`${selected.sport} position`} value={selected.position} editable={!locked} onChangeText={position=>patchEntry(selected.sport,{position})}/>
        <AdminField label={`${selected.sport} jersey`} value={selected.jersey} editable={!locked} onChangeText={jersey=>patchEntry(selected.sport,{jersey})}/>
        <AdminField label={`Find ${selected.sport} school or team`} value={teamQuery} editable={!locked} onChangeText={setTeamQuery}/>
        {teamsLoading?<AdminEmpty text="Finding teams…"/>:teams.map(team=><AdminBtn key={team.id} label={`Use ${team.name} for ${selected.sport}`} disabled={locked} onPress={()=>{patchEntry(selected.sport,{schoolId:team.id,teamName:team.name});setTeamQuery('');}}/>)}
        <AdminBtn label={`Clear ${selected.sport} team`} disabled={locked} onPress={()=>patchEntry(selected.sport,{schoolId:null,teamName:null})}/>
      </View>:null}
      <AdminBtn label="Save athlete sports" kind="primary" disabled={locked||!draft.primary||!draft.sports.length||catalogStatus!=='ready'||draft.sports.some(entry=>!draft.row.sports.some(saved=>saved.sport===entry.sport)&&!sportNames.includes(entry.sport))} onPress={save}/>
      <AdminBtn label="Reload athlete sports" disabled={locked} onPress={()=>{setDraft(null);setTeamQuery('');action.setMessage(null);void load(query);}}/>
      <AdminBtn label="Close sports draft" disabled={locked} onPress={()=>{setDraft(null);setTeamQuery('');}}/>
    </View>:null}
  </AdminPanel>;
}
