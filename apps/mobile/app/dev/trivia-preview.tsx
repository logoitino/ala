/** Dev-only trivia preview (QUIZ-04 fun presentation demo, 2026-10-15): shows the trivia effects with a scripted demo
 * round and sample questions; nothing is saved and nothing is fetched. Not linked from any menu. A production build
 * (`EXPO_PUBLIC_APP_ENV=production`) redirects to Home and renders nothing.
 */
import { Redirect } from 'expo-router';
import { TriviaPreview, triviaPreviewAvailable } from '@/components/SportQuiz/TriviaPreview';

/** @purpose Gate the demo page to local and test builds. */
export default function TriviaPreviewRoute() {
    if (!triviaPreviewAvailable()) return <Redirect href="/"/>;
    return <TriviaPreview/>;
}
