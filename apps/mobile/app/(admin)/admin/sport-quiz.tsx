/** QUIZ-01 Expo-only operational route; the existing admin shell gates all quiz bank/settings reads and writes. */
import { SportQuizTool } from '@/components/Admin/SportQuiz/SportQuizTool';

/** @purpose Admin Sport Pop Quiz desk; no fan view is enrolled by this route. */
export default function AdminSportQuizScreen() { return <SportQuizTool />; }
