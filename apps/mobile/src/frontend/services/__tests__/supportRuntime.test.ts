/** Runtime observation preserves the platform error handler and routes money/access as protected features. */
import { observeSupportRuntime, supportFeatureForPath } from '../supportRuntime';
it('maps known routes without leaking path identifiers into signals', () => {
 expect(supportFeatureForPath('/admin/support')).toBe('support'); expect(supportFeatureForPath('/gift/private-handle')).toBe('donation'); expect(supportFeatureForPath('/auth/callback?token=private')).toBe('auth'); expect(supportFeatureForPath('/local/game/private')).toBe('local'); expect(supportFeatureForPath('/unknown/private')).toBe('app');
});
it('preserves native fatal behavior and restores only the handler it installed', () => {
 const original = jest.fn(); let handler: (error: unknown, fatal?: boolean) => void = original; const capture = jest.fn();
 const runtime = { ErrorUtils: { getGlobalHandler: () => handler, setGlobalHandler: (fn: (error: unknown, fatal?: boolean) => void) => { handler = fn; } } };
 const dispose = observeSupportRuntime(capture, runtime); const privateError = new Error('private detail'); handler(privateError, true);
 expect(original).toHaveBeenCalledWith(privateError, true); expect(capture).toHaveBeenCalledWith({ feature: 'app', code: 'runtime_failure' }); expect(JSON.stringify(capture.mock.calls)).not.toContain('private detail');
 dispose(); expect(handler).toBe(original);
});
it('web observers neither suppress errors nor retain event content', () => {
 const listeners = new Map<string,(event: unknown) => void>(); const capture = jest.fn(); const addEventListener = jest.fn((name, fn) => listeners.set(name,fn)); const removeEventListener = jest.fn((name) => listeners.delete(name));
 const dispose = observeSupportRuntime(capture, { addEventListener, removeEventListener }); listeners.get('error')?.({message:'private'}); listeners.get('unhandledrejection')?.({reason:'private'});
 expect(capture.mock.calls).toEqual([[{feature:'app',code:'runtime_failure'}],[{feature:'app',code:'unhandled_rejection'}]]); dispose(); expect(listeners.size).toBe(0);
});
