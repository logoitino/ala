/**
 * QUIZ-03 round settings, switches and the bank exhaustion forecast inside the Trivia desk.
 * Control tower (2026-10-15): the round size and the trivia.groups switch sit in the desk's one Settings panel with plain
 * labels; trivia.images is shown locked off (image delivery is not built and Content Rights / Minor Safety have not
 * approved images), so every save sends it off. The forecast is its own panel (`SportQuizForecast`).
 * @sideEffects None directly; the owning desk saves through quiz_admin_play_settings bound to its captured admin identity.
 */
import {useEffect,useState} from 'react';
import {Text} from 'react-native';
import {AdminBtn,AdminPanel,AdminPills} from '@/components/Admin/AdminChrome';
import type {TimedQuizForecast,TriviaPlaySettingsInput} from '@/lib/sportQuiz';

export type SportQuizPlayProps={current:TriviaPlaySettingsInput|null;busy:string|null;hasReason:boolean;onSave:(next:TriviaPlaySettingsInput)=>void};
const sizes=['1','2','3','4','5'] as const;

/** @purpose Change questions per round (1–5) and the groups switch together, with a reason; images stay locked off. */
export function SportQuizPlay({current,busy,hasReason,onSave}:SportQuizPlayProps){
  const [draft,setDraft]=useState<TriviaPlaySettingsInput|null>(current);
  const r=current?.round_size,g=current?.groups_enabled,i=current?.images_enabled;
  // Reset the draft only when the saved values change, not when the parent rebuilds an equal object.
  useEffect(()=>{setDraft(r===undefined||g===undefined||i===undefined?null:{round_size:r,groups_enabled:g,images_enabled:false});},[r,g,i]);
  const changed=!!draft&&!!current&&(draft.round_size!==current.round_size||draft.groups_enabled!==current.groups_enabled||current.images_enabled);
  return <AdminPanel title="Rounds and switches">
    {draft&&current?<>
      <Text>{`Now: ${current.round_size} question${current.round_size===1?'':'s'} per round · trivia.groups ${current.groups_enabled?'on':'off'} · trivia.images ${current.images_enabled?'on':'off'}`}</Text>
      <AdminPills label="Questions per round" value={String(draft.round_size)} items={sizes.map(id=>({id,label:id}))} onChange={id=>setDraft(old=>old&&{...old,round_size:Number(id)})}/>
      <Text>A new size applies to rounds started after saving. Each question keeps the 30 or 90 seconds chosen before Start; Next is open for 2 minutes after each question closes. A round never repeats a question and is shorter when the pool is.</Text>
      <AdminPills label="Groups (trivia.groups): family challenge" value={draft.groups_enabled?'on':'off'} items={[{id:'on',label:'On'},{id:'off',label:'Off'}]} onChange={id=>setDraft(old=>old&&{...old,groups_enabled:id==='on'})}/>
      <Text>{`Groups are ${draft.groups_enabled?'on':'off'} in this draft. Off pauses new groups, joins and group rounds. Existing groups, members and pages stay; members can still leave and report.`}</Text>
      <Text>{`Images (trivia.images): ${current.images_enabled?'on now; saving turns it off':'off'}, locked. It stays off until Content Rights and Minor Safety approve images. While off, image questions cannot be approved. Image delivery (private bucket, signed links) is not built, so approved image questions are never drawn.`}</Text>
      <AdminBtn label={busy==='play'?'Saving…':'Save round settings and switches'} kind="primary" disabled={!!busy||!hasReason||!changed} onPress={()=>draft&&onSave({...draft,images_enabled:false})}/>
    </>:<Text>Settings unavailable. Repair the singleton source before changing rounds or switches.</Text>}
  </AdminPanel>;
}

/** @purpose Weeks until the most-exposed recent player has seen every approved question in a sport. */
export function SportQuizForecast({forecast}:{forecast:TimedQuizForecast[]}){
  return <AdminPanel title="Bank forecast by sport">
    <Text>Weeks until the most-exposed recent player has seen every approved question in a sport, at the last 28 days' pace. No recent play shows as no forecast. Text rows are tiny; review effort is the real cost.</Text>
    {forecast.length?forecast.map(f=><Text key={f.sport}>{`${f.sport} · ${f.approved_families} approved · ${f.players_28d} players and ${f.issued_28d} questions in 28 days · ${f.pace_per_player_week} per player-week · ${f.weeks_left===null?'no forecast yet':`about ${f.weeks_left} week${f.weeks_left===1?'':'s'} left`}`}</Text>)
      :<Text>No approved sport questions at this source read.</Text>}
  </AdminPanel>;
}
