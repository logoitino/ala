/** Terms acknowledgment and its async reads/writes belong to the signed-in profile that started them. */
import { act, renderHook } from '@testing-library/react-native';
import { useLegalAck } from '../useLegalAck';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function authFor(id = 'user-A') {
  return { session: { access_token: 'test-token', user: { id } }, user: { id },
    profile: { id: `profile-${id}`, user_id: id, legal_terms_accepted_at: null as string | null, legal_terms_version: null as string | null },
    refreshProfile: () => mockRefreshProfile(), isSessionCurrent: () => true };
}
const mockHas = jest.fn();
const mockRecord = jest.fn();
const mockRefreshProfile = jest.fn();
const mockTelemetry = jest.fn();
let mockAuth = authFor();
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/legal', () => ({ hasLegalAck: (...args: unknown[]) => mockHas(...args), recordLegalAck: (...args: unknown[]) => mockRecord(...args) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: (...args: unknown[]) => mockTelemetry(...args) } }));
beforeEach(() => {
  jest.resetAllMocks(); mockAuth = authFor();
  mockHas.mockResolvedValue(false);
  mockRecord.mockResolvedValue('2026-10-20T00:00:00Z');
  mockRefreshProfile.mockImplementation(() => Promise.resolve(mockAuth.profile));
});

it('masks an old acceptance while the incoming account acknowledgment is pending', async () => {
  mockHas.mockResolvedValueOnce(true);
  const hook = await renderHook(() => useLegalAck());
  expect(hook.result.current.accepted).toBe(true);
  const read = deferred<boolean>(); mockHas.mockReturnValueOnce(read.promise);
  mockAuth = authFor('user-B'); await hook.rerender({});
  expect(hook.result.current.accepted).toBe(false);
  expect(hook.result.current.ready).toBe(false);
  await act(async () => read.resolve(false));
  expect(hook.result.current.ready).toBe(true);
});

it('ignores an old acknowledgment read after account turnover', async () => {
  const read = deferred<boolean>(); mockHas.mockReturnValueOnce(read.promise);
  const hook = await renderHook(() => useLegalAck());
  mockAuth = authFor('user-B'); await hook.rerender({});
  await act(async () => read.resolve(true));
  expect(hook.result.current.accepted).toBe(false);
  expect(hook.result.current.userId).toBe('user-B');
});

it('only uses the newest acknowledgment refresh result', async () => {
  const hook = await renderHook(() => useLegalAck());
  const read = deferred<boolean>(); mockHas.mockReturnValueOnce(read.promise);
  let task!: Promise<boolean>;
  await act(async () => { task = hook.result.current.refresh(); });
  mockHas.mockResolvedValueOnce(false);
  await act(async () => { await hook.result.current.refresh(); });
  await act(async () => { read.resolve(true); await task; });
  expect(hook.result.current.accepted).toBe(false);
});

it('catches acknowledgment read failure and exposes safe retry state', async () => {
  const hook = await renderHook(() => useLegalAck());
  mockHas.mockRejectedValueOnce(new Error('private account diagnostic'));
  await act(async () => { await expect(hook.result.current.refresh()).resolves.toBe(false); });
  expect(hook.result.current.accepted).toBe(false);
  expect(hook.result.current.ready).toBe(true);
  expect(hook.result.current.error).toBe('Could not check Terms acknowledgment. Please try again.');
});

it('rejects acceptance without a matching own profile', async () => {
  mockAuth.profile.user_id = 'another-owner';
  const hook = await renderHook(() => useLegalAck());
  expect(hook.result.current.accepted).toBe(false);
  await act(async () => { await expect(hook.result.current.accept()).rejects.toThrow(); });
  expect(mockRecord).not.toHaveBeenCalled();
  expect(mockHas).not.toHaveBeenCalled();
});

it('blocks duplicate acceptance before the next render and confirms the stored result', async () => {
  const hook = await renderHook(() => useLegalAck());
  const write = deferred<string>(); mockRecord.mockReturnValue(write.promise);
  let first!: Promise<void>; let second!: Promise<unknown>;
  await act(async () => { first = hook.result.current.accept(); second = hook.result.current.accept().catch((error) => error); });
  mockHas.mockResolvedValue(true);
  await act(async () => { write.resolve('2026-10-20T00:00:00Z'); await first; });
  expect(await second).toBeInstanceOf(Error);
  expect(mockRecord).toHaveBeenCalledTimes(1);
  expect(hook.result.current.busy).toBe(false);
  expect(hook.result.current.accepted).toBe(true);
});

it('does not publish acceptance or telemetry after the initiating account changes', async () => {
  let current = true; mockAuth.isSessionCurrent = () => current;
  const hook = await renderHook(() => useLegalAck());
  const write = deferred<string>(); mockRecord.mockReturnValue(write.promise);
  let task!: Promise<unknown>;
  await act(async () => { task = hook.result.current.accept().catch((error) => error); });
  current = false; mockAuth = authFor('user-B'); await hook.rerender({});
  await act(async () => write.resolve('2026-10-20T00:00:00Z'));
  expect(await task).toBeInstanceOf(Error);
  expect(hook.result.current.accepted).toBe(false);
  expect(mockTelemetry).not.toHaveBeenCalled();
  expect(mockRefreshProfile).not.toHaveBeenCalled();
});

it('rejects a retained acceptance callback before rendering an auth turnover', async () => {
  let current = true; mockAuth.isSessionCurrent = () => current;
  const hook = await renderHook(() => useLegalAck());
  current = false;
  await act(async () => { await expect(hook.result.current.accept()).rejects.toThrow('changed'); });
  expect(mockRecord).not.toHaveBeenCalled();
});

it('does not claim acknowledgment succeeded when the stored record cannot be confirmed', async () => {
  const hook = await renderHook(() => useLegalAck());
  await act(async () => { await expect(hook.result.current.accept()).rejects.toThrow('confirm'); });
  expect(hook.result.current.accepted).toBe(false);
  expect(mockTelemetry).not.toHaveBeenCalled();
});

it('hides a failed acceptance diagnostic and permits a later retry', async () => {
  const hook = await renderHook(() => useLegalAck());
  mockRecord.mockRejectedValueOnce(new Error('private write diagnostic'));
  await act(async () => { await expect(hook.result.current.accept()).rejects.toThrow('Could not save Terms acknowledgment. Please try again.'); });
  expect(hook.result.current.busy).toBe(false);
  expect(hook.result.current.error).toBe('Could not save Terms acknowledgment. Please try again.');
  mockHas.mockResolvedValue(true);
  await act(async () => { await hook.result.current.accept(); });
  expect(hook.result.current.accepted).toBe(true);
});

it('rejects an acceptance readback superseded by a newer negative read', async () => {
  const hook = await renderHook(() => useLegalAck());
  const confirm = deferred<boolean>(); mockHas.mockReturnValueOnce(confirm.promise);
  let task!: Promise<unknown>;
  await act(async () => { task = hook.result.current.accept().catch((error) => error); });
  await act(async () => { await hook.result.current.refresh(); });
  await act(async () => confirm.resolve(true));
  expect(await task).toBeInstanceOf(Error);
  expect(hook.result.current.accepted).toBe(false);
  expect(mockTelemetry).not.toHaveBeenCalled();
});
