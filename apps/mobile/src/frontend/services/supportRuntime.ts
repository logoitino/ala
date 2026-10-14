/** Fixed feature routing and passive runtime observation; native fatal handlers and web defaults remain intact. */
import type { ClientSupportCapture } from './SupportSignalManager';
import type { SupportFeature } from '@tapuai/shared-types/admin/engineeringSupport';
export function supportFeatureForPath(path: string): SupportFeature {
 const route = path.split('?')[0];
 if (route.startsWith('/admin/support')) return 'support';
 if (route.startsWith('/admin')) return 'admin';
 if (/^\/(auth|school-confirm)(\/|$)/.test(route)) return 'auth';
 if (/^\/(stripe-connect|receipts|parent|booster|sponsor)(\/|$)/.test(route)) return 'payouts';
 if (route.startsWith('/gift/')) return 'donation';
 if (route === '/') return 'highlights';
 const known: SupportFeature[] = ['activity','local','spotlight','drip','profile','operator','upload'];
 return known.find(feature => route === `/${feature}` || route.startsWith(`/${feature}/`)) ?? 'app';
}
type GlobalHandler = (error: unknown, fatal?: boolean) => void;
type Runtime = { ErrorUtils?: { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (handler: GlobalHandler) => void }; addEventListener?: (name: string, listener: () => void) => void; removeEventListener?: (name: string, listener: () => void) => void };
export function observeSupportRuntime(capture: (event: ClientSupportCapture) => void, runtime: Runtime = globalThis as Runtime): () => void {
 const safeCapture = (code: 'runtime_failure' | 'unhandled_rejection') => { try { capture({feature:'app',code}); } catch { /* Detection cannot replace native error behavior. */ } };
 const error = () => safeCapture('runtime_failure'); const rejection = () => safeCapture('unhandled_rejection');
 runtime.addEventListener?.('error',error);runtime.addEventListener?.('unhandledrejection',rejection);
 const original = runtime.ErrorUtils?.getGlobalHandler();
 const handler: GlobalHandler = (caught,fatal) => { safeCapture('runtime_failure'); original?.(caught,fatal); };
 if (original) runtime.ErrorUtils?.setGlobalHandler(handler);
 return () => {
  runtime.removeEventListener?.('error',error);runtime.removeEventListener?.('unhandledrejection',rejection);
  if (original && runtime.ErrorUtils?.getGlobalHandler() === handler) runtime.ErrorUtils.setGlobalHandler(original);
 };
}
