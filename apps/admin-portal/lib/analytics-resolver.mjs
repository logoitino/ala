/**
 * Lets `node --test` load the analytics module. Maps `@/` to this app and adds `.ts`
 * on relative imports. Not used by Next.
 */

import { register } from 'node:module';

const root = new URL('../', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.(ts|mjs|js|json)$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}

if (!process.env.ANALYTICS_TEST_RESOLVER) {
  process.env.ANALYTICS_TEST_RESOLVER = '1';
  register('./analytics-resolver.mjs', import.meta.url);
}
