/**
 * Trivia status for the control tower (2026-10-15). `TriviaStatusCard` is the compact card on the admin Home: the
 * trivia state (paused / testing / on), the groups / Life / images switches, drafts waiting for approval, Life chapters
 * open, the topics or chapters running low, and a link to the Trivia desk. It reads only the existing admin reads
 * (quiz_admin_snapshot and the Life admin read); a read that is not applied says "not switched on", never zero.
 * `TriviaStatusLines` renders the same summary at the top of the desk.
 * @sideEffects Two read-only admin RPCs when the Home card mounts; no writes.
 */
import {useEffect,useState} from 'react';
import {Text,View,type TextStyle} from 'react-native';
import {fetchTimedSportQuizAdmin,type TimedQuizAdminSnapshot} from '@/lib/sportQuiz';
import {fetchLifeAdmin,type LifeAdminSnapshot} from '@/lib/lifePlaybook';
import {AdminReportLink} from '@/components/Admin/Reports/AdminReportSection';
import {REPORT_INK as c,reportStyles as s} from '@/components/Admin/Reports/reportStyles';
import {readFailure,triviaStatus,type TriviaRead,type TriviaStatus} from './triviaDesk';

const SHOWN_LOW=4;

/** @purpose The status in words (state, switches, drafts, chapters, running low); never colour alone. */
export function TriviaStatusLines({status,text,strong,limit}:{status:TriviaStatus;text?:TextStyle;strong?:TextStyle;limit?:number}){
  const low=limit?status.low.slice(0,limit):status.low;
  return <View style={{gap:4}}>
    <Text style={strong}>{`Trivia: ${status.stateText}`}</Text>
    <Text style={text}>{status.switches.join(' · ')}</Text>
    <Text style={text}>{status.drafts}</Text>
    <Text style={text}>{status.chapters}</Text>
    {status.state==='not_on'||status.state==='unavailable'?null:status.low.length
      ?<Text style={text}>{`Running low: ${low.join('; ')}${status.low.length>low.length?`; and ${status.low.length-low.length} more`:''}.`}</Text>
      :<Text style={text}>No topic or chapter is running low.</Text>}
  </View>;
}

/** @purpose Compact Home card; it reads once on mount and links to the desk for every change. */
export function TriviaStatusCard(){
  const [reads,setReads]=useState<{quiz:TriviaRead<TimedQuizAdminSnapshot>;life:TriviaRead<LifeAdminSnapshot>}|null>(null);
  useEffect(()=>{
    let live=true;
    void Promise.allSettled([fetchTimedSportQuizAdmin(),fetchLifeAdmin()]).then(([quiz,life])=>{
      if(!live)return;
      const read=<T,>(r:PromiseSettledResult<T>):TriviaRead<T>=>r.status==='fulfilled'?{data:r.value,missing:false,error:null}:{data:null,...readFailure(r.reason)};
      setReads({quiz:read(quiz),life:read(life)});
    });
    return()=>{live=false;};
  },[]);
  const status=reads?triviaStatus(reads.quiz,reads.life):null;
  return <View style={[s.section,{gap:10}]} accessibilityLabel="Trivia status">
    <Text accessibilityRole="header" aria-level={2} style={s.h2}>Trivia</Text>
    {status?<TriviaStatusLines status={status} text={s.sentence} strong={{...s.strong,color:status.state==='unavailable'?c.bad:c.ink}} limit={SHOWN_LOW}/>
      :<Text style={s.small}>Reading trivia status…</Text>}
    <View style={s.row}><AdminReportLink label="Open the Trivia desk" href="/admin/sport-quiz"/></View>
  </View>;
}
