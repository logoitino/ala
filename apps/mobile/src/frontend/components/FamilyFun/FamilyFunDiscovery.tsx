/**
 * Optional shared discovery for the admin-ready QUIZ-02 and FUN-01 journeys.
 * Home keeps trivia as a side notice and names the subject the server already scheduled. Play and Not now clear that notice until the next week.
 * Beyond keeps Fan Zone. Role homes keep both cards.
 * @sideEffects Read on focus/return/UTC week; explicit quiz Skip, local dismissal and root navigation only. Fan discovery never writes.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { SportQuizInvitation } from '@/components/SportQuiz/SportQuizInvitation';
import { QuizButton } from '@/components/SportQuiz/QuizButton';
import { colors, radii } from '@/constants/theme';
import { TriviaSideNotice } from './TriviaSideNotice';
import { thisWeekSubject } from '@/lib/quizWeek';
import { useAuth } from '@/context/AuthContext';
import { useSportQuiz } from '@/hooks/useSportQuiz';
import { useFanZone } from '@/hooks/useFanZone';

type DiscoverySurface = 'home' | 'hq' | 'beyond';
/** One Highlight invite per account-week. Play and Not now both write this, so the card stays gone until the next week. */
const TRIVIA_NOTICE_WEEK = 'tapuai.trivia.noticeWeek';

/** @purpose Independent sources, errors and local dismissals. Home shows only the trivia tab; Beyond shows Fan Zone. */
export function FamilyFunDiscovery({ overVideo = false, surface = 'hq' }: { overVideo?: boolean; surface?: DiscoverySurface }) {
  const video = overVideo || surface === 'home';
  return <View style={surface === 'home' ? styles.home : styles.group} pointerEvents="box-none">
    {surface === 'home' ? null : <FanDiscovery overVideo={video} />}
    {surface === 'beyond' ? null : <QuizDiscovery overVideo={video} surface={surface} />}
  </View>;
}

/** @purpose Offer only current server-authorized selected-campaign context, including private guardian recovery. */
function FanDiscovery({ overVideo }: { overVideo: boolean }) {
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
  if (fan.error) return <DiscoveryCard overVideo={overVideo}>
    <Text style={[styles.title, overVideo && styles.titleVideo]}>Fan Zone is unavailable.</Text>
    <Text style={[styles.copy, overVideo && styles.copyVideo]}>Refresh to check availability. You can leave or try later.</Text>
    <QuizButton label="Refresh Fan Zone discovery" disabled={fan.loading || !!fan.busy} onPress={() => { void fan.refresh(); }} />
    <View style={styles.row}>
      <QuizButton fill label="Open Fan Zone page" quiet onVideo={overVideo} onPress={() => open()} />
      <QuizButton fill label="Not now for Fan Zone" quiet onVideo={overVideo} onPress={dismiss} />
    </View>
  </DiscoveryCard>;
  if (fan.loading || !snapshot || !campaign) return null;
  const recap = campaign.status === 'finalized' && !campaign.recount_required && snapshot.results.length > 0;
  const label = privateCount ? 'Review fan permissions' : snapshot.entry ? 'My fan entry'
    : snapshot.can_participate && campaign.status === 'open' ? 'Open Fan Zone' : recap ? 'View fan recap' : null;
  if (!label) return null;
  return <DiscoveryCard overVideo={overVideo}>
    <Text style={[styles.title, overVideo && styles.titleVideo]}>Fan Zone</Text>
    <Text style={[styles.copy, overVideo && styles.copyVideo]}>Selected campaign: {campaign.title}</Text>
    <Text style={[styles.copy, overVideo && styles.copyVideo]}>Campaign {campaign.status}.</Text>
    {privateCount ? <Text style={[styles.copy, overVideo && styles.copyVideo]}>{privateCount} private {privateCount === 1 ? 'entry' : 'entries'} for this campaign.</Text>
      : <Text style={[styles.copy, overVideo && styles.copyVideo]}>{snapshot.entry ? 'Open your entry to review its current status and recovery options.' : recap ? 'View the authorized campaign recap.' : 'Joining is optional. Opening this page does not enter or vote.'}</Text>}
    <View style={styles.row}>
      <QuizButton fill label={label} onPress={() => open(privateCount > 0)} />
      {!privateCount ? <QuizButton fill label="Not now for Fan Zone" quiet onVideo={overVideo} onPress={dismiss} /> : null}
    </View>
  </DiscoveryCard>;
}

/** @purpose Renew optional discovery through reads; only returned server weeks scope a known weekly dismissal. */
function QuizDiscovery({ overVideo, surface }: { overVideo: boolean; surface: DiscoverySurface }) {
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
  useEffect(() => {
    if (!key) return;
    let live = true;
    AsyncStorage.getItem(TRIVIA_NOTICE_WEEK).then(saved => { if (live && saved === key) setDismissed(key); }).catch(() => {});
    return () => { live = false; };
  }, [key]);
  const homeStopped = snapshot?.attempt?.status === 'skipped' || !!snapshot?.week_spent
    || snapshot?.availability === 'paused' || snapshot?.availability === 'not_enrolled';
  const homeChecking = surface === 'home' && !!identity && !dismissed && !homeStopped && (!snapshot || !!quiz.error || snapshot.availability === 'unavailable');
  // The Highlight invite never asks the player to refresh. A quiet retry covers a failed read.
  useEffect(() => {
    if (!homeChecking || !focused) return;
    const retry = setTimeout(() => { claimInFlight.current = null; void quiz.refresh(); }, 2500);
    return () => clearTimeout(retry);
  }, [homeChecking, focused, quiz.refresh]);
  if(!identity||!key||dismissed===key)return null;
  const open=()=>router.push('/sport-quiz');
  const dismiss=()=>{ setDismissed(key); if (key) AsyncStorage.setItem(TRIVIA_NOTICE_WEEK, key).catch(() => {}); };
  if (surface === 'home') {
    // A failed read retries quietly. The invite appears only when a round can actually start.
    if (homeStopped || !snapshot || snapshot.availability !== 'ready' || !!quiz.error) return null;
    const kind = snapshot.scheduled_topic === 'fun' || snapshot.scheduled_topic === 'sport' ? snapshot.scheduled_topic : null;
    return <TriviaSideNotice busy={!!quiz.busy} subject={thisWeekSubject(kind)} onPlay={() => { dismiss(); router.push('/sport-quiz?play=1' as Href); }} onDismiss={dismiss} />;
  }
  const skip=async()=>{const captured=key;const receipt=await quiz.skip();if(currentKey.current===captured)setFailedSkip(receipt?.outcome==='skipped'?null:captured);};
  const hasHistory=!!snapshot&&(snapshot.history_count>0||snapshot.badge_count>0||snapshot.correction_count>0);
  if (quiz.error || snapshot?.availability === 'unavailable') return <DiscoveryCard overVideo={overVideo}>
    <Text style={[styles.title, overVideo && styles.titleVideo]}>Sport Pop Quiz is unavailable.</Text>
    <Text style={[styles.copy, overVideo && styles.copyVideo]}>{failedSkip === key ? 'Skip was not confirmed. Refresh to check this week.' : 'Refresh to check availability. You can leave or try later.'}</Text>
    <QuizButton label="Refresh quiz" disabled={quiz.loading || !!quiz.busy} onPress={() => { claimInFlight.current = null; void quiz.refresh(); }} />
    <View style={styles.row}>
      <QuizButton fill label={hasHistory ? 'Private quiz history' : 'Open quiz page'} quiet onVideo={overVideo} onPress={open} />
      <QuizButton fill label="Not now" quiet onVideo={overVideo} onPress={dismiss} />
    </View>
  </DiscoveryCard>;
  if(quiz.loading||!snapshot)return null;
  if(claimed===key&&!quiz.invitationsSuppressed&&!snapshot.week_spent)return <SportQuizInvitation {...quiz} overVideo={overVideo} onOpen={open} onSkip={skip} onDismiss={dismiss}/>;
  if(!hasHistory&&snapshot.attempt?.status!=='skipped')return null;
  return <DiscoveryCard overVideo={overVideo}>
    <Text style={[styles.title, overVideo && styles.titleVideo]}>{snapshot.attempt?.status==='skipped'?'Skipped for this week.':'Private quiz history'}</Text>
    <Text style={[styles.copy, overVideo && styles.copyVideo]}>Your quiz history and corrections stay private. Participation is optional.</Text>
    <View style={styles.row}>
      <QuizButton fill label="Private quiz history" onPress={open}/>
      <QuizButton fill label="Not now" quiet onVideo={overVideo} onPress={dismiss}/>
    </View>
  </DiscoveryCard>;
}

/** @purpose One short card. Secondary actions share a row so the Highlight stays visible underneath. */
function DiscoveryCard({ overVideo, children }: { overVideo: boolean; children: ReactNode }) {
  return <View style={[styles.card, overVideo && styles.cardVideo]}>{children}</View>;
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  home: { position: 'absolute', left: 0, top: '42%', zIndex: 30 },
  card: { gap: 8, padding: 12, borderRadius: radii.lg, backgroundColor: colors.accentSoft },
  cardVideo: {
    backgroundColor: 'rgba(14,19,21,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(46,229,157,0.4)',
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  titleVideo: { color: colors.onVideo },
  copy: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  copyVideo: { color: colors.onVideoMuted },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
});
