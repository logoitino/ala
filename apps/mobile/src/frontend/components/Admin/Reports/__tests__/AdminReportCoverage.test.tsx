/** Control mapping remains complete through consolidation; bounded telemetry omissions stay unknown. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { emptyAdminReportData } from '@/lib/adminReports';
import { COVERAGE_CONTROLS } from '@/lib/adminCoverage';
import { AdminReportCoverage } from '../AdminReportCoverage';
jest.mock('expo-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => children }));

it('keeps every control with its owner, source and admin/app actions', async () => {
  const data = emptyAdminReportData();
  await render(<AdminReportCoverage data={data} />);
  expect(screen.getAllByRole('link', { name: /^Manage / })).toHaveLength(COVERAGE_CONTROLS.length);
  expect(screen.getAllByRole('link', { name: /^Open / })).toHaveLength(COVERAGE_CONTROLS.length);
  await fireEvent.press(screen.getByRole('button', { name: 'Data for Returned control telemetry' }));
  expect(screen.getAllByText(/Not in this read/).length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
  expect(screen.getAllByRole('link', { name: /^Manage / })).toHaveLength(COVERAGE_CONTROLS.filter(c => c.surface === 'profile').length);
});

it('distinguishes returned zero from an omitted control and missing published switches', async () => {
  const data = emptyAdminReportData(); data.reports.configured = data.runtime.configured = true;
  const item = COVERAGE_CONTROLS.find(c => c.telemetry)!;
  data.reports.features = [{ label: item.telemetry!, value: 0 }];
  await render(<AdminReportCoverage data={data} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Data for Returned control telemetry' }));
  expect(screen.getAllByText(/0 taps/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Published: —/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Not in this read/).length).toBeGreaterThan(0);
});

it('shows each shared telemetry count once without implying separate surface attribution', async () => {
  const data = emptyAdminReportData(); data.reports.configured = true;
  const key = COVERAGE_CONTROLS.find(c => c.telemetry && COVERAGE_CONTROLS.filter(other => other.telemetry === c.telemetry).length > 1)!.telemetry!;
  data.reports.features = [{ label: key, value: 99 }];
  await render(<AdminReportCoverage data={data} />);
  const disclosure = screen.queryByRole('button', { name: 'Data for Returned control telemetry' });
  if (disclosure) await fireEvent.press(disclosure);
  expect(screen.getAllByText(/99 taps/)).toHaveLength(1);
});

// Shared telemetry can only be interpreted if its consumers remain distinguishable.
it('identifies the surfaces sharing a telemetry key', async () => {
  const data = emptyAdminReportData();
  const key = COVERAGE_CONTROLS.find(c => c.telemetry && new Set(COVERAGE_CONTROLS.filter(other => other.telemetry === c.telemetry).map(other => other.surface)).size > 1)!.telemetry!;
  await render(<AdminReportCoverage data={data} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Data for Returned control telemetry' }));
  const consumers = COVERAGE_CONTROLS.filter(c => c.telemetry === key).map(row => `${row.label} (${row.surface})`).join(', ');
  expect(screen.getByText(consumers)).toBeTruthy();
});
