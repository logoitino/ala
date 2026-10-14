/**
 * Optional shared discovery for the admin-ready QUIZ-01 journey; Fan Zone participation is not integrated here.
 * @sideEffects Read quiz state on focus/return/UTC week; explicit Skip RPC, local presentation dismissal and root navigation only.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { SportQuizInvitation } from '@/components/SportQuiz/SportQuizInvitation';
import { QuizButton } from '@/components/SportQuiz/QuizButton';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSportQuiz } from '@/hooks/useSportQuiz';

/** @purpose Renew optional discovery through reads; only returned server weeks scope a known weekly dismissal. */
export function FamilyFunDiscovery() {
  const auth = useAuth();
  const quiz = useSportQuiz();
  const focused = useIsFocused();
  const router = useRouter();
  const identity = !auth.loading && !auth.isGuest && auth.user?.id && auth.profile?.id
    && auth.profile.user_id === auth.user.id && !auth.profile.age_blocked_at
    ? JSON.stringify([auth.user.id, auth.profile.id]) : null;
  // Missing-source dismissal has no invented week; any later returned week creates a new presentation scope.
  const key = identity ? JSON.stringify([identity, quiz.snapshot?.week_start ?? null]) : null;
  const currentKey = useRef(key); currentKey.current = key;
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [failedSkip, setFailedSkip] = useState<string | null>(null);
  useEffect(() => { setDismissed(null); setFailedSkip(null); }, [identity]);
  useEffect(() => {
    if (!identity || !focused) return;
    void quiz.refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void quiz.refresh(); });
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      next.setUTCDate(next.getUTCDate() + (((8 - now.getUTCDay()) % 7) || 7));
      // The timer triggers a read, never a new assignment or a locally fabricated server week.
      timer = setTimeout(() => { void quiz.refresh(); schedule(); }, Math.max(1, next.getTime() - now.getTime()) + 50);
    };
    schedule();
    return () => { subscription.remove(); clearTimeout(timer); };
  }, [focused, identity, quiz.refresh]);
  if (!identity || !key || dismissed === key) return null;
  const open = () => router.push('/sport-quiz');
  const dismiss = () => setDismissed(key);
  const skip = async () => {
    const captured = key;
    const result = await quiz.skip();
    if (currentKey.current === captured) setFailedSkip(result?.status === 'skipped' ? null : captured);
  };
  const snapshot = quiz.snapshot;
  const hasHistory = !!snapshot && (snapshot.badges.length > 0 || snapshot.corrections.length > 0);
  if (quiz.error || (snapshot?.availability === 'unavailable')) return <View style={styles.card}>
    <Text style={styles.title}>Sport Pop Quiz is unavailable.</Text>
    <Text style={styles.copy}>{failedSkip === key ? 'Skip was not confirmed. Refresh to check this week.' : snapshot?.attempt?.unavailable_reason || 'Refresh to check availability. You can leave or try later.'}</Text>
    <QuizButton label="Refresh quiz" disabled={quiz.loading || !!quiz.busy} onPress={() => { void quiz.refresh(); }} />
    <QuizButton label={hasHistory ? 'Private quiz history' : 'Open quiz page'} quiet onPress={open} />
    <QuizButton label="Not now" quiet onPress={dismiss} />
  </View>;
  if (quiz.loading || !snapshot) return null;
  if (snapshot.availability === 'ready' && ['available', 'issued'].includes(snapshot.status)) return <SportQuizInvitation {...quiz} onOpen={open} onSkip={skip} onDismiss={dismiss} />;
  if (!hasHistory && snapshot.status !== 'skipped') return null;
  return <View style={styles.card}>
    <Text style={styles.title}>{snapshot.status === 'skipped' ? 'Skipped for this week.' : 'Private quiz history'}</Text>
    <Text style={styles.copy}>Your quiz history and any corrections stay private. Participation is optional.</Text>
    <QuizButton label="Private quiz history" onPress={open} />
    <QuizButton label="Not now" quiet onPress={dismiss} />
  </View>;
}
const styles = StyleSheet.create({ card: { gap: 10, padding: 16, borderRadius: radii.lg, backgroundColor: colors.accentSoft },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' }, copy: { color: colors.textMuted, fontSize: 15, lineHeight: 21 } });
