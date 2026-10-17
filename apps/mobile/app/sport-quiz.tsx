/** QUIZ-01 all-role optional learning route; the screen owns scoped reads and explicit Back/account Home.
 * QUIZ-03: `?sport=` (from "Learn your athlete's sport") only preselects a sport; it never starts a round.
 * QUIZ-05: `?athlete=` (the Learn card's player id, UUID-shaped only) is a hint for that personal round's Start; the
 * server validates it, and nothing about the athlete is shown unless the server returns a fun fact.
 * `?play=1` comes from the Highlight trivia tab. It starts this week's round only after the saved trivia notice.
 */
import { useLocalSearchParams } from 'expo-router';
import { SportQuizScreen } from '@/components/SportQuiz/SportQuizScreen';

/** @purpose Mount optional quiz learning outside the fan tab navigation. */
export default function SportQuizRoute() {
    const params = useLocalSearchParams<{ sport?: string | string[]; athlete?: string | string[]; play?: string | string[] }>();
    const sport = typeof params.sport === 'string' && params.sport.trim().length >= 2 && params.sport.length <= 80 ? params.sport.trim() : null;
    const athlete = sport && typeof params.athlete === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.athlete) ? params.athlete : null;
    const autoPlay = params.play === '1';
    return <SportQuizScreen initialSport={sport} learnAthlete={athlete} autoPlay={autoPlay}/>;
}
