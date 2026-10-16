/**
 * QUIZ-04 Life Playbook admin desk inside Trivia: the trivia.life switch and level thresholds, chapters with
 * their open state and the plain reasons one cannot open ("needs N more approved questions"), and aggregate-only Life
 * statistics (small cells arrive hidden). Owner simplification 2026-10-15: the CPA sign-off, reviewer and re-review
 * panels are archived; one admin approves Life questions in the question bank like any trivia question.
 * Control tower (2026-10-15): the switch and levels (`SportQuizLifeSettings`) live in the desk's one Settings panel;
 * chapters show progress towards opening ("3 of 5 approved to open").
 * @sideEffects None directly; the owning desk saves through the Life admin RPCs bound to its captured admin identity.
 */
import {useEffect,useState} from 'react';
import {Text} from 'react-native';
import {AdminBtn,AdminField,AdminPanel,AdminPills} from '@/components/Admin/AdminChrome';
import {LIFE_LEVELS,LIFE_LEVEL_LABELS,lifeThresholdsValid,type LifeAdminSnapshot,type LifeChapterId,type LifeLevelThresholds} from '@/lib/lifePlaybook';
import {chapterProgress} from './triviaDesk';

export type SportQuizLifeSettingsProps={data:LifeAdminSnapshot|null;error:string|null;busy:string|null;hasReason:boolean;
  onSaveSettings:(lifeEnabled:boolean,thresholds:LifeLevelThresholds)=>void};
export type SportQuizLifeProps={data:LifeAdminSnapshot|null;error:string|null;busy:string|null;hasReason:boolean;onChapter:(chapter:LifeChapterId,open:boolean)=>void};
const shown=(players:number|null)=>players===null?'hidden (fewer than 10)':String(players);

/** @purpose The trivia.life switch and level thresholds, reason-gated; the server re-checks each one. */
export function SportQuizLifeSettings({data,error,busy,hasReason,onSaveSettings}:SportQuizLifeSettingsProps){
  const saved=data?.settings;
  const [enabled,setEnabled]=useState(false);
  const [thresholds,setThresholds]=useState<Record<string,string>>({});
  const savedKey=saved?JSON.stringify([saved.life_enabled,saved.level_thresholds]):null;
  // Reset the drafts only when the saved values change.
  useEffect(()=>{if(!saved)return;setEnabled(saved.life_enabled);setThresholds(Object.fromEntries(LIFE_LEVELS.map(k=>[k,String(saved.level_thresholds[k])])));
  },[savedKey]);
  if(error)return <AdminPanel title="Life Playbook switch and levels"><Text accessibilityRole="alert">{`Life Playbook source unavailable: ${error}`}</Text></AdminPanel>;
  if(!data||!saved)return <AdminPanel title="Life Playbook switch and levels"><Text>Life Playbook is not switched on in this database (migration not applied) or is still loading.</Text></AdminPanel>;
  const draft=Object.fromEntries(LIFE_LEVELS.map(k=>[k,/^\d{1,5}$/.test(thresholds[k]??'')?Number(thresholds[k]):NaN]));
  const validThresholds=lifeThresholdsValid(draft);
  const changed=enabled!==saved.life_enabled||LIFE_LEVELS.some(k=>draft[k]!==saved.level_thresholds[k]);
  return <>
    <AdminPanel title="Life Playbook switch and levels">
      <Text>{`Now: trivia.life ${saved.life_enabled?'on':'off'} · ${data.life_active_total} of ${data.life_cap} Life versions in play (separate from the trivia cap).`}</Text>
      <AdminPills label="Life Playbook (trivia.life)" value={enabled?'on':'off'} items={[{id:'on',label:'Life on'},{id:'off',label:'Life off'}]} onChange={id=>setEnabled(id==='on')}/>
      <Text>Off stops new Life rounds and ends open ones. Players also need the Life notice and their own opt-in; chapters still need to be open.</Text>
      {LIFE_LEVELS.map(k=><AdminField key={k} label={`${LIFE_LEVEL_LABELS[k]} at facts learned`} value={thresholds[k]??''} keyboardType="number-pad" editable={k!=='rookie'}
        onChangeText={v=>setThresholds(old=>({...old,[k]:v}))}/>)}
      <Text>Levels count facts learned (answered, uncorrected questions) across every round kind, never correctness or speed. A reached level never goes down; only clearing history removes it.</Text>
      {!validThresholds?<Text accessibilityRole="alert">Thresholds must be whole numbers that rise from Rookie 0.</Text>:null}
      <AdminBtn label={busy==='life_settings'?'Saving…':'Save Life switch and levels'} kind="primary" disabled={!!busy||!hasReason||!validThresholds||!changed}
        onPress={()=>onSaveSettings(enabled,draft as LifeLevelThresholds)}/>
    </AdminPanel>
  </>;
}

/** @purpose Chapters with progress to opening and aggregate statistics; Open needs a reason and a ready chapter. */
export function SportQuizLife({data,error,busy,hasReason,onChapter}:SportQuizLifeProps){
  if(error)return <AdminPanel title="Life Playbook"><Text accessibilityRole="alert">{`Life Playbook source unavailable: ${error}`}</Text></AdminPanel>;
  if(!data||!data.settings)return <AdminPanel title="Life Playbook"><Text>Life Playbook is not switched on in this database (migration not applied) or is still loading.</Text></AdminPanel>;
  const s=data.stats;
  const progress=Object.fromEntries(chapterProgress(data).map(p=>[p.id,p.text]));
  return <>
    <AdminPanel title="Chapters">
      <Text>{`Every chapter is for everyone 13+. A chapter opens with ${data.open_at} approved questions (one round); one admin approves each question in the question bank.`}</Text>
      {data.chapters.map(c=><AdminPanel key={c.id} title={`${c.title} · ${c.open?'open':'closed'}`}>
        <Text>{progress[c.id]}</Text>
        <Text>{`${c.approved_count} approved · ${c.draft_count} drafts${c.framing?` · ${c.framing}`:''}`}</Text>
        {c.reasons.length?<Text>{`Cannot open yet: ${c.reasons.join('; ')}.`}</Text>:null}
        {c.switched_open&&!c.open?<Text accessibilityRole="alert">Switched open but not drawn: it no longer meets the rules above.</Text>:null}
        {c.switched_open?<AdminBtn label={`Close ${c.title}`} disabled={!!busy||!hasReason} onPress={()=>onChapter(c.id,false)}/>
          :<AdminBtn label={`Open ${c.title}`} disabled={!!busy||!hasReason||!c.ready} onPress={()=>onChapter(c.id,true)}/>}
      </AdminPanel>)}
    </AdminPanel>
    <AdminPanel title="Life statistics (aggregate only)">
      <Text>No per-person rows. Per-question numbers appear only with 20 or more players; any cell with fewer than 10 players is hidden.</Text>
      <Text>{`Opted in: ${shown(s.opted_in)} · Life rounds this week: ${shown(s.week_life_rounds)} · questions below the 20-player threshold: ${s.questions_hidden}`}</Text>
      {s.questions.map(q=><Text key={q.question_id}>{`${q.chapter} · question ${q.question_id} · ${q.responders} players · ${Math.round(q.correct_share*100)}% chose the reviewed answer`}</Text>)}
      {s.levels.map(l=><Text key={l.level}>{`${l.label}: ${shown(l.players)}`}</Text>)}
      {s.cells.filter(c=>!c.hidden).map(c=><Text key={`${c.age_band}:${c.chapter}`}>{`${c.age_band} · ${c.chapter}: ${c.players}`}</Text>)}
      <Text>{`${s.cells.filter(c=>c.hidden).length} age band × chapter cells hidden.`}</Text>
    </AdminPanel>
  </>;
}
