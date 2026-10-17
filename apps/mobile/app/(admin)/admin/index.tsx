/**
 * Main admin Home combines the selected Community Impact report with editing desks.
 * Data and interactions stay in the report UI behind the existing admin shell gate.
 */
import { AdminReportScreen } from '@/components/Admin/Reports/AdminReportScreen';

/**
 * The control tower adds desk status cards (Trivia, and database updates still waiting), supplied here so only Home reads them.
 */
import { AdminHomeCardsContext } from '@/components/Admin/AdminHomeCards';
import { UnappliedControlsCard } from '@/components/Admin/UnappliedControlsCard';
import { TriviaStatusCard } from '@/components/Admin/SportQuiz/TriviaStatusCard';

export default function AdminHomeScreen() {
  return <AdminHomeCardsContext.Provider value={<><TriviaStatusCard /><UnappliedControlsCard /></>}><AdminReportScreen page="home" /></AdminHomeCardsContext.Provider>;
}
