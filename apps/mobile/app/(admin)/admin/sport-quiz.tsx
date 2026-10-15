/** QUIZ-01 Expo-only operational route; the existing admin shell gates all quiz bank/settings reads and writes.
 * Labelled "Trivia" in the admin menu since 2026-10-15; the address stays /admin/sport-quiz so saved links keep working. */
import { SportQuizTool } from '@/components/Admin/SportQuiz/SportQuizTool';

/** @purpose Admin Trivia desk; no fan view is enrolled by this route. */
export default function AdminSportQuizScreen() { return <SportQuizTool />; }
