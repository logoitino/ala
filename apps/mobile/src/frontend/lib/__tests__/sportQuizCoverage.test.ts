/** Quiz controls map to their actual operational desk without inventing runtime flags or collection. */
import { COVERAGE_CONTROLS, COVERAGE_SURFACES } from '../adminCoverage';
it('maps shared discovery, private history and participant controls to Sport Quiz settings authority', () => {
  expect(COVERAGE_SURFACES).toContainEqual({ id: 'sport-quiz', label: 'Sport Quiz' });
  const rows = COVERAGE_CONTROLS.filter(row => row.id.startsWith('quiz.'));
  expect(rows.some(row => row.id === 'quiz.profile.history' && row.fanHref === '/profile')).toBe(true);
  for (const surface of ['home', 'parent', 'operator', 'booster', 'sponsor']) {
    for (const action of ['open', 'dismiss', 'skip', 'refresh', 'history']) expect(rows.some(row => row.id === `quiz.${surface}.${action}`)).toBe(true);
  }
  for (const action of ['back', 'home', 'refresh', 'sport', 'answer', 'retry', 'skip']) expect(rows.some(row => row.id === `quiz.page.${action}` && row.surface === 'sport-quiz')).toBe(true);
  for (const row of rows) {
    expect(row.adminHref).toBe('/admin/sport-quiz');
    expect(row.flag).toBeUndefined(); expect(row.telemetry).toBeUndefined();
    expect(row.hint).toMatch(/quiz_settings/);
  }
  expect(rows.length).toBeGreaterThan(0);
});
