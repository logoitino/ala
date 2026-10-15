/** QUIZ-01 all-role optional learning route; the screen owns scoped reads and explicit Back/account Home.
 * QUIZ-03: `?sport=` (from "Learn your athlete's sport") only preselects a sport; it never starts a round.
 */
import { useLocalSearchParams } from 'expo-router';
import { SportQuizScreen } from '@/components/SportQuiz/SportQuizScreen';

/** @purpose Mount optional quiz learning outside the fan tab navigation. */
export default function SportQuizRoute() {
    const params = useLocalSearchParams<{ sport?: string | string[] }>();
    const sport = typeof params.sport === 'string' && params.sport.trim().length >= 2 && params.sport.length <= 80 ? params.sport.trim() : null;
    return <SportQuizScreen initialSport={sport}/>;
}
