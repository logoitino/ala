/**
 * Optional shared discovery for the admin-ready QUIZ-02 and FUN-01 journeys.
 * @sideEffects Read on focus/return/UTC week; explicit quiz Skip, local dismissal and root navigation only. Fan discovery never writes.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { SportQuizInvitation } from '@/components/SportQuiz/SportQuizInvitation';
import { QuizButton } from '@/components/SportQuiz/QuizButton';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSportQuiz } from '@/hooks/useSportQuiz';
import { useFanZone } from '@/hooks/useFanZone';

/** @purpose Independent sources, errors and local dismissals share existing measured Home/HQ space. */
export function FamilyFunDiscovery() {
  return <View style={styles.group}><FanDiscovery /><QuizDiscovery /></View>;
}

/** @purpose Offer only current server-authorized selected-campaign context, including private guardian recovery. */
function FanDiscovery() {
  const auth = useAuth();
  const fan = useFanZone(null);
  const focused = useIsFocused();
  const router = useRouter();
  const identity = !auth.loading && !auth.isGuest && auth.user?.id && auth.profile?.id
    && auth.profile.user_id === auth.user.id ? fan.identityKey : null;
  const snapshot = fan.snapshot;
  const campaign = snapshot?.campaign;
  const privateCount = snapshot?.guardian_queue.length ?? 0;
  // A new server campaign/period or changed private revision renews presentation. No global queue or invented server week.
  const key = identity ? JSON.stringify([identity, campaign?.id ?? null, campaign?.entry_opens_at ?? null,
    campaign?.status ?? null, snapshot?.guardian_queue.map(entry => [entry.id, entry.revision, entry.digest, entry.consent_scope]) ?? null,
    snapshot?.entry ? [snapshot.entry.id, snapshot.entry.revision, snapshot.entry.status] : null]) : null;
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => { setDismissed(null); }, [identity]);
  useEffect(() => {
    if (!identity || !focused) return;
    void fan.refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void fan.refresh(); });
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      next.setUTCDate(next.getUTCDate() + (((8 - now.getUTCDay()) % 7) || 7));
      timer = setTimeout(() => { void fan.refresh(); schedule(); }, Math.max(1, next.getTime() - now.getTime()) + 50);
    };
    schedule();
    return () => { subscription.remove(); clearTimeout(timer); };
  }, [focused, identity, fan.refresh]);
  // Participation dismissal cannot suppress server-authorized private guardian recovery.
  if (!identity || !key || (dismissed === key && !privateCount)) return null;
  const dismiss = () => setDismissed(key);
  const open = (permissions = false) => router.push((campaign
    ? `/fan-zone?campaign=${encodeURIComponent(campaign.id)}${permissions ? '&section=permissions' : ''}` : '/fan-zone') as Href);
  if (fan.error) return <View style={styles.card}>
    <Text style={styles.title}>Fan Zone is unavailable.</Text>
    <Text style={styles.copy}>Refresh to check availability. You can leave or try later.</Text>
    <QuizButton label="Refresh Fan Zone discovery" disabled={fan.loading || !!fan.busy} onPress={() => { void fan.refresh(); }} />
    <QuizButton label="Open Fan Zone page" quiet onPress={() => open()} />
    <QuizButton label="Not now for Fan Zone" quiet onPress={dismiss} />
  </View>;
  if (fan.loading || !snapshot || !campaign) return null;
  const recap = campaign.status === 'finalized' && !campaign.recount_required && snapshot.results.length > 0;
  const label = privateCount ? 'Review fan permissions' : snapshot.entry ? 'My fan entry'
    : snapshot.can_participate && campaign.status === 'open' ? 'Open Fan Zone' : recap ? 'View fan recap' : null;
  if (!label) return null;
  return <View style={styles.card}>
    <Text style={styles.title}>Fan Zone</Text>
    <Text style={styles.copy}>Selected campaign: {campaign.title}</Text>
    <Text style={styles.copy}>Campaign {campaign.status}.</Text>
    {privateCount ? <Text style={styles.copy}>{privateCount} private {privateCount === 1 ? 'entry' : 'entries'} for this campaign.</Text>
      : <Text style={styles.copy}>{snapshot.entry ? 'Open your entry to review its current status and recovery options.' : recap ? 'View the authorized campaign recap.' : 'Joining is optional. Opening this page does not enter or vote.'}</Text>}
    <QuizButton label={label} onPress={() => open(privateCount > 0)} />
    {!privateCount ? <QuizButton label="Not now for Fan Zone" quiet onPress={dismiss} /> : null}
  </View>;
}

/** @purpose Renew optional discovery through reads; only returned server weeks scope a known weekly dismissal. */
function QuizDiscovery() {
  const quiz=useSportQuiz();const focused=useIsFocused();const router=useRouter();const identity=quiz.identityKey;
  const key=identity?JSON.stringify([identity,quiz.snapshot?.week_start??null]):null;const currentKey=useRef(key);currentKey.current=key;
  const [dismissed,setDismissed]=useState<string|null>(null);const[claimed,setClaimed]=useState<string|null>(null);const[failedSkip,setFailedSkip]=useState<string|null>(null);
  const claimInFlight=useRef<string|null>(null);
  useEffect(()=>{setDismissed(null);setClaimed(null);setFailedSkip(null);claimInFlight.current=null;},[identity]);
  useEffect(()=>{
    if(!identity||!focused)return;void quiz.refresh();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')void quiz.refresh();});
    let timer:ReturnType<typeof setTimeout>;
    const schedule=()=>{const now=new Date();const next=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));next.setUTCDate(next.getUTCDate()+(((8-now.getUTCDay())%7)||7));timer=setTimeout(()=>{void quiz.refresh();schedule();},Math.max(1,next.getTime()-now.getTime())+50);};schedule();
    return()=>{subscription.remove();clearTimeout(timer);};
  },[focused,identity,quiz.refresh]);
  const snapshot=quiz.snapshot;
  useEffect(()=>{
    if(!key||!focused||dismissed===key||claimed===key||claimInFlight.current===key||quiz.loading||quiz.busy||quiz.error||quiz.invitationsSuppressed||snapshot?.availability!=='ready'||snapshot.week_spent||snapshot.preferences.invitation_mode!=='weekly'||snapshot.preferences.last_invited_week===snapshot.week_start)return;
    claimInFlight.current=key;const captured=key;
    void quiz.claimInvitation().then(receipt=>{if(currentKey.current===captured&&receipt?.outcome==='claimed')setClaimed(captured);else if(claimInFlight.current===captured)claimInFlight.current=null;});
  },[key,focused,dismissed,claimed,quiz.loading,quiz.busy,quiz.error,quiz.invitationsSuppressed,snapshot,quiz.claimInvitation]);
  if(!identity||!key||dismissed===key)return null;
  const open=()=>router.push('/sport-quiz');const dismiss=()=>setDismissed(key);
  const skip=async()=>{const captured=key;const receipt=await quiz.skip();if(currentKey.current===captured)setFailedSkip(receipt?.outcome==='skipped'?null:captured);};
  const hasHistory=!!snapshot&&(snapshot.history_count>0||snapshot.badge_count>0||snapshot.correction_count>0);
  if(quiz.error||snapshot?.availability==='unavailable')return <View style={styles.card}><Text style={styles.title}>Sport Pop Quiz is unavailable.</Text><Text style={styles.copy}>{failedSkip===key?'Skip was not confirmed. Refresh to check this week.':'Refresh to check availability. You can leave or try later.'}</Text><QuizButton label="Refresh quiz" disabled={quiz.loading||!!quiz.busy} onPress={()=>{claimInFlight.current=null;void quiz.refresh();}}/><QuizButton label={hasHistory?'Private quiz history':'Open quiz page'} quiet onPress={open}/><QuizButton label="Not now" quiet onPress={dismiss}/></View>;
  if(quiz.loading||!snapshot)return null;
  if(claimed===key&&!quiz.invitationsSuppressed&&!snapshot.week_spent)return <SportQuizInvitation {...quiz} onOpen={open} onSkip={skip} onDismiss={dismiss}/>;
  if(!hasHistory&&snapshot.attempt?.status!=='skipped')return null;
  return <View style={styles.card}><Text style={styles.title}>{snapshot.attempt?.status==='skipped'?'Skipped for this week.':'Private quiz history'}</Text><Text style={styles.copy}>Your quiz history and corrections stay private. Participation is optional.</Text><QuizButton label="Private quiz history" onPress={open}/><QuizButton label="Not now" quiet onPress={dismiss}/></View>;
}
const styles = StyleSheet.create({ group: { gap: 10 }, card: { gap: 10, padding: 16, borderRadius: radii.lg, backgroundColor: colors.accentSoft },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' }, copy: { color: colors.textMuted, fontSize: 15, lineHeight: 21 } });
