/**
 * Main admin Home combines the selected Community Impact report with editing desks.
 * Data and interactions stay in the report UI behind the existing admin shell gate.
 * The control tower adds desk status cards (2026-10-15: Trivia), supplied here so only Home reads them.
 */
import { AdminHomeCardsContext } from '@/components/Admin/AdminHomeCards';
import { AdminReportScreen } from '@/components/Admin/Reports/AdminReportScreen';
import { TriviaStatusCard } from '@/components/Admin/SportQuiz/TriviaStatusCard';

export default function AdminHomeScreen() {
  return <AdminHomeCardsContext.Provider value={<TriviaStatusCard />}><AdminReportScreen page="home" /></AdminHomeCardsContext.Provider>;
}
