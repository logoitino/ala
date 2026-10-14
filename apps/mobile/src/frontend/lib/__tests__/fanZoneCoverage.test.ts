/** Fan controls expose the real campaign/permission/case/removal desk without invented flags or collection. */
import { COVERAGE_CONTROLS, COVERAGE_SURFACES } from '../adminCoverage';
it('maps discovery, private guardian review and actual participant controls to Fan Zone authority', () => {
  expect(COVERAGE_SURFACES).toContainEqual({ id: 'fan-zone', label: 'Fan Zone' });
  const rows = COVERAGE_CONTROLS.filter(row => row.id.startsWith('fun.'));
  for (const surface of ['home', 'parent', 'operator', 'booster', 'sponsor']) {
    for (const action of ['open', 'dismiss', 'refresh', 'permissions', 'entry', 'recap']) expect(rows.some(row => row.id === `fun.${surface}.${action}`)).toBe(true);
  }
  expect(rows.some(row => row.id === 'fun.profile.open' && row.fanHref === '/profile')).toBe(true);
  for (const action of ['back', 'home', 'refresh', 'signin', 'paths', 'picker', 'draft', 'upload', 'retryUpload', 'replaceUpload', 'video', 'vote', 'retryVote', 'scope', 'permission', 'revoke', 'submit', 'withdraw', 'story', 'profile', 'serve', 'deleteReflection', 'concern', 'appeal', 'removal', 'continueRemoval', 'receipt', 'safety']) expect(rows.some(row => row.id === `fun.page.${action}` && row.surface === 'fan-zone')).toBe(true);
  for (const row of rows) {
    expect(row.adminHref).toBe('/admin/fan-zone');
    expect(row.flag).toBeUndefined(); expect(row.telemetry).toBeUndefined();
    expect(row.hint).toMatch(/fan_zone_campaigns/);
  }
  expect(rows.find(row => row.id === 'fun.parent.dismiss')?.hint).toMatch(/never hides nonempty private guardian queue/);
  expect(rows.find(row => row.id === 'fun.parent.permissions')?.hint).toMatch(/selected campaign.*not.*global/i);
  expect(rows.find(row => row.id === 'fun.page.removal')?.hint).toMatch(/all.revision/i);
});
