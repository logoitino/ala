/** A partial week's chart must disclose every UTC label; series are joined by label rather
 * than index so a missing day cannot silently acquire another day's value. */
import { reportFigureModel } from '../reportChartModel';

it('does not describe a ranked category as the latest chronological reading', () => {
  const model = reportFigureModel({ id: 'origins', title: 'Where gifts start', caption: 'All time', source: 'origins', error: null, kind: 'bars', points: [{ label: 'Profile', value: 100 }, { label: 'QR link', value: 0 }], keys: [], format: 'cents', accent: 'jade', emptyText: '', keepOrder: true });
  expect(model.summary).not.toContain('latest');
  expect(model.summary).toContain('Profile');
});
it('retains uneven heat-strip dates without relabelling or truncating values', () => {
  const model = reportFigureModel({ id: 'week', kind: 'heat', title: 'Week', caption: 'UTC', source: 'series', error: null,
    rows: [{ title: 'Clips', format: 'count', accent: 'cyan', points: [{ label: 'Mon', value: 2 }] },
      { title: 'Gifts', format: 'cents', accent: 'jade', points: [{ label: 'Tue', value: 300 }] }] });
  expect(model.table.columns).toEqual(['Measure', 'Mon', 'Tue']);
  expect(model.table.rows).toEqual([['Clips', '2', '—'], ['Gifts', '—', '$3.00']]);
});
