/** Shared admin write runner: one write per tap, success then reload, and errors shown in red. */
import { act, renderHook } from '@testing-library/react-native';

import { useAdminAction } from '@/hooks/useAdminAction';

it('runs one write at a time, reports success and reloads', async () => {
  const reload = jest.fn();
  let finish: (text: string) => void = () => {};
  const work = jest.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
  const { result } = await renderHook(() => useAdminAction(reload));
  let first: Promise<void> = Promise.resolve();
  await act(async () => { first = result.current.run('save', work); void result.current.run('save', work); });
  expect(work).toHaveBeenCalledTimes(1);
  expect(result.current.busy).toBe('save');
  await act(async () => { finish('Saved.'); await first; });
  expect(result.current.message).toEqual({ text: 'Saved.', tone: 'ok' });
  expect(result.current.busy).toBeNull();
  expect(reload).toHaveBeenCalledTimes(1);
});

it('shows the error in red and does not reload', async () => {
  const reload = jest.fn();
  const { result } = await renderHook(() => useAdminAction(reload));
  await act(async () => { await result.current.run('save', async () => { throw new Error('Admin access required'); }); });
  expect(result.current.message).toEqual({ text: 'Admin access required', tone: 'danger' });
  expect(reload).not.toHaveBeenCalled();
  await act(async () => { await result.current.run('save', async () => { throw 'odd'; }, 'Could not save.'); });
  expect(result.current.message?.text).toBe('Could not save.');
});
