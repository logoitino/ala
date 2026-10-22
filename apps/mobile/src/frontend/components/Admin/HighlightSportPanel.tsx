/** Recorded sport corrections reuse the Highlights desk; null means intentionally unassigned, never unavailable.
 * Original-value compare-and-save and keyed editors preserve history and isolate delayed reel/account responses. */
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { AdminBtn, AdminNotice } from '@/components/Admin/AdminChrome';
import { useAuth } from '@/context/AuthContext';
import { useStoredSportChoices } from '@/hooks/useStoredSportChoices';
import { useAdminAction } from '@/hooks/useAdminAction';
import { fetchAdminHighlightSport, saveAdminHighlightSport } from '@/lib/athleteSports';
import { colors } from '@/constants/theme';
export function HighlightSportPanel({reelId}:{reelId:string}) {
  const {user,isAdmin}=useAuth();
  return user&&isAdmin?<RecordedSportEditor key={`${user.id}:${reelId}`} reelId={reelId}/>:null;
}
function RecordedSportEditor({reelId}:{reelId:string}) {
  const [recorded,setRecorded]=useState<string|null>(null);
  const [draft,setDraft]=useState<string|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const {sportNames,status:catalogStatus,reload:reloadCatalog}=useStoredSportChoices();
  // Explicit clearing is valid without a catalog; a requested tag requires an authoritative active choice.
  const tagBlocked=draft!==null&&(catalogStatus!=='ready'||!sportNames.includes(draft));
  const action=useAdminAction();
  const mounted=useRef(true);
  const generation=useRef(0);
  const load=async()=>{
    const mine=++generation.current;setLoaded(false);setError(null);
    try {const value=await fetchAdminHighlightSport(reelId);if(mounted.current&&mine===generation.current){setRecorded(value.sport);setDraft(value.sport);setLoaded(true);}}
    catch(caught){if(mounted.current&&mine===generation.current)setError(caught instanceof Error?caught.message:'Could not read recorded sport.');}
  };
  useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false;generation.current++;};},[]);
  const save=()=>{if(!loaded||tagBlocked)return;void action.run('sport',async()=>{
    try {const value=await saveAdminHighlightSport(reelId,draft,recorded);if(!mounted.current)return '';setRecorded(value.sport);setDraft(value.sport);return 'Recorded sport saved.';}
    catch(caught){if(!mounted.current)return '';throw caught;}
  });};
  return <View style={{gap:6}}>
    <Text accessibilityRole="header" style={{color:colors.text,fontSize:14,fontWeight:'700'}}>Recorded sport</Text>
    <Text style={{color:colors.textMuted,fontSize:12}}>Correct a video or photo tag here. An unassigned Highlight stays in All; changing an athlete’s primary never relabels it.</Text>
    <AdminNotice text={catalogStatus==='unavailable'?'Published sports could not load. Your draft is kept; you can leave the sport unassigned.':catalogStatus==='loading'?'Loading published sports…':sportNames.length===0?'No active sports are published. You can leave the sport unassigned.':tagBlocked?'The draft sport is no longer published. Choose a current sport or leave it unassigned.':null} tone="warn"/>
    <AdminBtn label="Reload published sports" disabled={Boolean(action.busy)} onPress={reloadCatalog}/>
    <AdminNotice text={error} tone="danger"/>
    {loaded?<><Text style={{color:colors.text,fontSize:13}}>Recorded: {recorded??'Unassigned'}</Text><Text style={{color:colors.text,fontSize:13}}>Draft: {draft??'Unassigned'}</Text></>:null}
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{sportNames.map(sport=><AdminBtn key={sport} label={`Set recorded sport ${sport}`} disabled={Boolean(action.busy)||!loaded} kind={draft===sport?'primary':'ghost'} onPress={()=>setDraft(sport)}/>)}</View>
    <AdminBtn label="Leave sport unassigned" disabled={Boolean(action.busy)||!loaded} onPress={()=>setDraft(null)}/>
    <AdminBtn label="Save recorded sport" kind="primary" disabled={Boolean(action.busy)||!loaded||tagBlocked} onPress={save}/>
    <AdminBtn label="Reload recorded sport" disabled={Boolean(action.busy)} onPress={()=>{action.setMessage(null);void load();}}/>
    <AdminNotice text={action.message?.text??null} tone={action.message?.tone}/>
  </View>;
}
