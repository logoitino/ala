/**
 * Build profiles must tell the app which environment it is (ENVIRONMENTS_AND_HOSTING E0). `eas.json` set only
 * `APP_ENV`, which nothing reads, while `lib/auth.ts` reads `EXPO_PUBLIC_APP_ENV`, so a production store build
 * would have shown the demo sign-in to real users. Every profile now sets both, and production says production.
 */
import fs from 'node:fs';
import path from 'node:path';

const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../../eas.json'), 'utf8')) as {
  build: Record<string, { env?: Record<string, string> }>;
};

it('every build profile sets EXPO_PUBLIC_APP_ENV to the same value as APP_ENV', () => {
  for (const [name, profile] of Object.entries(eas.build)) {
    expect({ name, value: profile.env?.EXPO_PUBLIC_APP_ENV }).toEqual({ name, value: profile.env?.APP_ENV });
    expect(profile.env?.EXPO_PUBLIC_APP_ENV).toBeTruthy();
  }
});

it('the production profile hides the demo sign-in', () => {
  expect(eas.build.production.env?.EXPO_PUBLIC_APP_ENV).toBe('production');
  const before = process.env.EXPO_PUBLIC_APP_ENV;
  process.env.EXPO_PUBLIC_APP_ENV = eas.build.production.env?.EXPO_PUBLIC_APP_ENV;
  jest.isolateModules(() => {
    jest.doMock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
    const { demoFanSignInAvailable } = require('@/lib/auth') as typeof import('@/lib/auth');
    expect(demoFanSignInAvailable()).toBe(false);
  });
  process.env.EXPO_PUBLIC_APP_ENV = before;
});
