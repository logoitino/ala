/** Report charts must distinguish missing, empty and zero, and disclose every plotted value without
 * leaking stale numbers after a read fails. These are UI contracts, independent of the SVG geometry. */
import { fireEvent, render, screen } from '@testing-library/react-native';

function figure() {
  return require('../AdminReportFigure').AdminReportFigure;
}
const chart = { id: 'donations', title: 'Gifts per day', kind: 'columns', caption: 'Last 7 days, UTC',
  windowLabel: 'Last 7 days, UTC', source: 'get_admin_reports.series.malo', keys: ['series.malo'],
  format: 'cents', accent: 'jade', error: null, points: [{ label: 'Mon', value: 0 }, { label: 'Tue', value: 12300 }] };

it('discloses the source and every value, including a recorded zero, through a labelled control', async () => {
  const Figure = figure();
  await render(<Figure chart={chart} />);
  expect(screen.queryByText('get_admin_reports.series.malo')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Data for Gifts per day' }));
  expect(screen.getByText('get_admin_reports.series.malo')).toBeTruthy();
  expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
  expect(screen.getAllByText('$123.00').length).toBeGreaterThan(0);
});

it('shows missing data without manufacturing a zero', async () => {
  const Figure = figure();
  await render(<Figure chart={{ ...chart, points: null }} />);
  expect(screen.getByText('Not in this read')).toBeTruthy();
  expect(screen.queryByText('$0.00')).toBeNull();
});

it('replaces both the plot and old values after a failed read', async () => {
  const Figure = figure();
  await render(<Figure chart={{ ...chart, error: 'Report read failed' }} />);
  expect(screen.getByText('Report read failed')).toBeTruthy();
  expect(screen.queryByText('$123.00')).toBeNull();
  expect(screen.queryByText(/Highest on Tue/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Data for Gifts per day' })).toBeNull();
});

it('shows an empty window separately from missing data', async () => {
  const Figure = figure();
  await render(<Figure chart={{ ...chart, points: [] }} />);
  expect(screen.getByText('Nothing to show in this window')).toBeTruthy();
  expect(screen.queryByText('Not in this read')).toBeNull();
});
