/**
 * DETECT-02 feature containment: a render crash shows a safe fallback, a single explicit
 * retry reports actual recovery, and finance/security features never remount automatically.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
jest.mock('@/services/SupportSignalManager', () => ({ supportSignals: { capture: jest.fn(() => true) } }));
import { FeatureBoundary } from '@/components/Common/FeatureBoundary';

let errorConsole: jest.SpyInstance;
beforeEach(() => { errorConsole = jest.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(() => errorConsole.mockRestore());
function Failing({ fail = true }: { fail?: boolean }) {
  if (fail) throw new Error('PRIVATE token and stack must not reach the fallback or sensor');
  return <Text>Working feature</Text>;
}

it('keeps healthy children and normal sibling navigation available', async () => {
  await render(<><FeatureBoundary feature="highlights"><Failing fail={false} /></FeatureBoundary><Text>Navigation remains available</Text></>);
  expect(screen.getByText('Working feature')).toBeTruthy();
  expect(screen.getByText('Navigation remains available')).toBeTruthy();
});
it('captures only the safe fixed code and contains the failure without private details', async () => {
  const captured: unknown[] = [];
  await render(<><FeatureBoundary feature="highlights" onCapture={(event) => { captured.push(event); }}><Failing /></FeatureBoundary><Text>Navigation remains available</Text></>);
  expect(screen.getByText('This part of the app is unavailable.')).toBeTruthy();
  expect(screen.queryByText(/PRIVATE/)).toBeNull();
  expect(screen.getByText('Navigation remains available')).toBeTruthy();
  expect(captured).toEqual([{ feature: 'highlights', code: 'render_failure' }]);
});
it('offers one user-requested render retry and reports recovery only after a successful child commit', async () => {
  let fail = true; let recovered = 0;
  function Child() { return <Failing fail={fail} />; }
  await render(<FeatureBoundary feature="highlights" onRecovered={() => { recovered++; }}><Child /></FeatureBoundary>);
  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByText('Working feature')).toBeTruthy(); expect(recovered).toBe(1);
});
it('stops offering retries after another render failure and never reports it as recovered', async () => {
  let recovered = 0;
  await render(<FeatureBoundary feature="highlights" onRecovered={() => { recovered++; }}><Failing /></FeatureBoundary>);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByText('This part of the app is unavailable.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull(); expect(recovered).toBe(0);
});
it('resets a general feature on an explicit reset key and reports verified recovery', async () => {
  let recovered = 0;
  const view = await render(<FeatureBoundary feature="profile" resetKey="first" onRecovered={() => { recovered++; }}><Failing /></FeatureBoundary>);
  await view.rerender(<FeatureBoundary feature="profile" resetKey="next" onRecovered={() => { recovered++; }}><Failing fail={false} /></FeatureBoundary>);
  expect(screen.getByText('Working feature')).toBeTruthy(); expect(recovered).toBe(1);
});
it.each(['donation', 'payouts', 'auth', 'admin', 'support'] as const)('does not offer or trigger render recovery for protected %s even when a reset key changes', async (feature) => {
  let recovered = 0;
  const view = await render(<FeatureBoundary feature={feature} resetKey="first" onRecovered={() => { recovered++; }}><Failing /></FeatureBoundary>);
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  await view.rerender(<FeatureBoundary feature={feature} resetKey="next" onRecovered={() => { recovered++; }}><Failing fail={false} /></FeatureBoundary>);
  expect(screen.getByText('This part of the app is unavailable.')).toBeTruthy(); expect(recovered).toBe(0);
});
it('keeps the safe fallback when the optional capture callback itself fails', async () => {
  await render(<FeatureBoundary feature="highlights" onCapture={() => { throw new Error('sensor unavailable'); }}><Failing /></FeatureBoundary>);
  expect(screen.getByText('This part of the app is unavailable.')).toBeTruthy();
});
