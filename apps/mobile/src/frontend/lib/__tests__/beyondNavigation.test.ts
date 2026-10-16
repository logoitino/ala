/** Beyond navigation keeps Highlights first, preserves published disable choices and never falls back to hidden Drip. */
import { cloneAppRuntime, DEFAULT_APP_RUNTIME, firstEnabledFanHref, parseAppRuntimeConfig } from '@/lib/runtime';

jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

test('old published config gains the new destination while preserving Highlights and disabled Drip', () => {
  const config = parseAppRuntimeConfig({ tabs: { home: true, drip: false } });
  expect((config.tabs as unknown as Record<string, boolean>).beyond).toBe(true);
  expect(firstEnabledFanHref(config)).toBe('/');
  expect(config.tabs.drip).toBe(false);
});

test('published disable is preserved, including through a config clone', () => {
  const config = cloneAppRuntime(parseAppRuntimeConfig({ tabs: { beyond: false } }));
  expect((config.tabs as unknown as Record<string, boolean>).beyond).toBe(false);
});

test('when Highlights is paused the next visible destination is Beyond, not hidden shop', () => {
  const config = cloneAppRuntime(DEFAULT_APP_RUNTIME);
  config.tabs.home = false;
  config.tabs.activity = false;
  config.tabs.spotlight = false;
  config.tabs.drip = true;
  (config.tabs as unknown as Record<string, boolean>).beyond = true;
  expect(firstEnabledFanHref(config)).toBe('/beyond');
  (config.tabs as unknown as Record<string, boolean>).beyond = false;
  expect(firstEnabledFanHref(config)).toBe('/profile');
});

test('the posting switch stays separate from discovery and preserves accepted server state', () => {
  const old = parseAppRuntimeConfig({});
  expect((old.highlights as unknown as Record<string, unknown>).beyondGameEnabled).toBe(false);
  const enabled = cloneAppRuntime(parseAppRuntimeConfig({ highlights: { beyondGameEnabled: true } }));
  expect((enabled.highlights as unknown as Record<string, unknown>).beyondGameEnabled).toBe(true);
  expect(firstEnabledFanHref(enabled)).toBe('/');
});
