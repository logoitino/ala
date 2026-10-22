/** Exercise installed SVG web forwarding through React DOM, so native-only accessibility props
 * cannot silently pass under the native Jest renderer and then raise Expo LogBox in the browser. */
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminReportFigure } from '../AdminReportFigure';
import { AdminReportTabs } from '../AdminReportTabs.web';
import { AdminReportSpark } from '../AdminReportSpark';
import { AdminReportKpi } from '../AdminReportSection';
import { AdminReportHomeHero } from '../AdminReportHome';
import { emptyAdminReportData } from '@/lib/adminReports';
import type { AnalyticsChart } from '@tapuai/shared-types/admin';

jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('react-native-svg', () => jest.requireActual('react-native-svg/src/elements.web'));
// Expo's native Jest bootstrap installs a lazy native fetch. This DOM-only test performs no reads.
jest.mock('expo/src/winter/fetch/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-router', () => ({ Link: ({ children }: { children: React.ReactElement }) => children }));
// Figure meaning remains tested in native UI tests; only the installed web SVG prop boundary is under test here.
jest.mock('../AdminReportData', () => ({ AdminReportData: () => null }));

const base = { id: 'chart', title: 'Report', caption: 'Recorded', source: 'source', keys: [], error: null, format: 'count' as const, accent: 'jade' as const };
it('keeps decorative figure and spark SVGs hidden without passing accessible=false to DOM', () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const chart: AnalyticsChart = { ...base, kind: 'columns', points: [{ label: 'Mon', value: 1 }], windowLabel: 'Last 7 days' };
    const markup = renderToStaticMarkup(<><AdminReportFigure chart={chart} /><AdminReportSpark item={{ label: 'Gifts', value: '1', spark: { points: [{ label: 'Mon', value: 1 }], format: 'count', accent: 'jade' } }} /></>);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('<svg');
    expect(markup).not.toContain(' accessible=');
    expect(errors.mock.calls.filter(call => call.some(value => String(value).includes('accessible')))).toEqual([]);
  } finally { errors.mockRestore(); }
});

function valueTag(markup: string, label: string) {
  const tag = markup.match(/<(?:div|span)\b[^>]*>/g)?.find(part => part.includes(`aria-label="${label}"`));
  expect(tag).toBeDefined(); return tag!;
}
function appliedCss(tag: string): string {
  const classes = tag.match(/class="([^"]+)"/)?.[1].split(' ') ?? [];
  const css = jest.requireActual('react-native-web').StyleSheet.getSheet().textContent as string;
  return classes.map(name => css.match(new RegExp(`\\.${name}\\{[^}]*\\}`, 'g'))?.join('') ?? '').join('');
}
it('keeps full large numeric values in wrapping web text instead of ellipsis or hidden overflow', () => {
  const data = emptyAdminReportData(); data.reports.configured = true;
  data.reports.money = { malo_cents_7d: 318200, avg_tip_cents_7d: 123456789 };
  data.reports.engagement = { clips_7d: 123456789 }; data.reports.usage = { sessions_24h: 123456789 };
  const markup = renderToStaticMarkup(<><AdminReportHomeHero data={data} /><AdminReportKpi item={{ label: 'Gross volume', value: '$9,999,999.99' }} /></>);
  for (const label of ['Gifts this week: $3,182.00', 'Average gift · 7d: $1,234,567.89', 'Clips uploaded · 7d: 123,456,789', 'Tab opens · 24h: 123,456,789', 'Gross volume: $9,999,999.99']) {
    const tag = valueTag(markup, label);
    const styles = appliedCss(tag) + tag;
    expect(styles).not.toContain('text-overflow:ellipsis'); expect(styles).not.toContain('overflow:hidden'); expect(styles).not.toContain('-webkit-line-clamp');
  }
});


it('renders the Revenue ring without invalid DOM property warnings', () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const chart: AnalyticsChart = { ...base, kind: 'ring', totalLabel: 'Recorded gross', centerValue: '$100.00', centerLabel: 'Recorded gross',
      parts: [{ key: 'payee', label: 'Payee share', value: 9000, color: 'jade' }, { key: 'company', label: "Tapua'i share", value: 1000, color: 'gold' }] };
    const markup = renderToStaticMarkup(<AdminReportFigure chart={chart} />);
    expect(markup).toContain('$100.00');
    expect(markup).toContain('Payee share');
    expect(markup).toContain('<circle');
    expect(errors.mock.calls.filter(call => call.some(value => String(value).includes('transform-origin')))).toEqual([]);
  } finally { errors.mockRestore(); }
});

// A control-map filter must announce its own purpose, even when its labels also occur in Analytics.
it('names Control map surfaces and connects the selected filter to its panel', () => {
  const markup = renderToStaticMarkup(<AdminReportTabs scope="coverage" tabs={[{ id: 'all', label: 'All controls' }, { id: 'profile', label: 'Profile' }]} selected="profile" onSelect={() => undefined} />);
  expect(markup).toContain('aria-label="Control map surfaces"');
  expect(markup).toContain('id="coverage-tab-profile"');
  expect(markup).toContain('aria-controls="coverage-panel"');
  expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
});
