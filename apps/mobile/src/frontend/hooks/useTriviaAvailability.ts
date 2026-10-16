/** QUIZ-03 read-only trivia availability for one viewer (the "Learn your athlete's sport" card). Reads only the
 * viewer's own sanitized snapshot; it never draws a question, spends a week or tells anyone about the viewer.
 * @sideEffects One quiz_snapshot read per signed-in identity through lib/sportQuiz.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchTimedSportQuiz, type TimedQuizSnapshot } from '@/lib/sportQuiz';

/** @purpose The viewer's own snapshot, or null for guests, unconfirmed identities and failed reads. */
export function useTriviaAvailability(): TimedQuizSnapshot | null {
    const auth = useAuth();
    const profileId = !auth.loading && !auth.isGuest && auth.user?.id && auth.profile?.id && auth.profile.user_id === auth.user.id && !auth.profile.age_blocked_at ? auth.profile.id : null;
    const [state, setState] = useState<{ profile: string; snapshot: TimedQuizSnapshot } | null>(null);
    useEffect(() => {
        if (!profileId) return;
        let alive = true;
        fetchTimedSportQuiz().then(snapshot => { if (alive && snapshot.profile_id === profileId) setState({ profile: profileId, snapshot }); }).catch(() => { });
        return () => { alive = false; };
    }, [profileId]);
    return state && state.profile === profileId ? state.snapshot : null;
}
/** @purpose The approved sport pool matching an athlete's sport, only when this viewer could start a round in it now. */
export function learnableSport(snapshot: TimedQuizSnapshot | null, sport: string | null | undefined): string | null {
    const wanted = sport?.trim().toLowerCase();
    if (!snapshot || !wanted || snapshot.availability !== 'ready' || snapshot.testing_only !== true || snapshot.week_spent) return null;
    const pool = snapshot.pools.find(p => p.topic_category === 'sport' && p.allowed && p.unseen_count > 0 && p.sport.trim().toLowerCase() === wanted);
    return pool ? pool.sport : null;
}
