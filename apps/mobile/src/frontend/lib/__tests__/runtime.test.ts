/** MONEY-TIPS-01: optional monetary authority defaults OFF and draft saves cannot publish it.
 * Synthetic local config/transport fixtures preserve legacy chrome defaults; no hosted writes run. */
import { APP_RUNTIME_FLAG_GROUPS } from '@tapuai/shared-types';
import {
  cloneAppRuntime, DEFAULT_APP_RUNTIME, diffRuntimeFlags, getRuntimeFlag,
  parseAppRuntimeConfig, saveAppRuntimeDraft, setRuntimeFlag, type AppRuntimeConfig,
} from '../runtime';

let mockConfigured = false;
const mockRpc = jest.fn();
const mockUpdate = jest.fn();
const mockSingle = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() { return mockConfigured; },
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args), from: (...args: unknown[]) => mockFrom(...args) },
}));
const FLAG = 'buttons.MONETIZATION_TIPS_ENABLED' as const;

beforeEach(() => {
  jest.clearAllMocks();
  mockConfigured = false;
  mockFrom.mockReturnValue({ update: mockUpdate });
  mockUpdate.mockReturnValue({ eq: () => ({ select: () => ({ single: mockSingle }) }) });
});

it('registers exactly one OFF catalog default while preserving legacy ON defaults', () => {
  const flags = APP_RUNTIME_FLAG_GROUPS.flatMap(group => group.flags);
  expect(flags.filter(flag => flag.path === FLAG)).toEqual([expect.objectContaining({ defaultValue: false })]);
  expect(flags.filter(flag => flag.path !== FLAG).every(flag => flag.defaultValue == null)).toBe(true);
  expect(getRuntimeFlag(DEFAULT_APP_RUNTIME, FLAG)).toBe(false);
  expect(getRuntimeFlag(parseAppRuntimeConfig({}), 'buttons.malo')).toBe(true);
});

it.each([undefined, null, {}, [], 'true', true, { MONETIZATION_TIPS_ENABLED: 'true' }, { MONETIZATION_TIPS_ENABLED: 1 }, { MONETIZATION_TIPS_ENABLED: null }])(
  'keeps absent or malformed published buttons OFF (%p)', buttons => {
    expect(getRuntimeFlag(parseAppRuntimeConfig({ buttons }), FLAG)).toBe(false);
  },
);

it('requires boolean true even for an unparsed older/raw config', () => {
  const missing = { ...DEFAULT_APP_RUNTIME, buttons: undefined } as unknown as AppRuntimeConfig;
  expect(getRuntimeFlag(missing, FLAG)).toBe(false);
  const malformed = { ...DEFAULT_APP_RUNTIME, buttons: { ...DEFAULT_APP_RUNTIME.buttons, MONETIZATION_TIPS_ENABLED: 'true' } } as unknown as AppRuntimeConfig;
  expect(getRuntimeFlag(malformed, FLAG)).toBe(false);
  expect(getRuntimeFlag(parseAppRuntimeConfig({ buttons: { MONETIZATION_TIPS_ENABLED: true } }), FLAG)).toBe(true);
});

it('keeps an ON draft independent from published OFF through clone and flag diff', () => {
  const published = cloneAppRuntime(DEFAULT_APP_RUNTIME);
  const draft = setRuntimeFlag(published, FLAG, true);
  expect(draft.buttons.MONETIZATION_TIPS_ENABLED).toBe(true);
  expect(published.buttons.MONETIZATION_TIPS_ENABLED).toBe(false);
  expect(cloneAppRuntime(draft).buttons.MONETIZATION_TIPS_ENABLED).toBe(true);
  expect(diffRuntimeFlags(draft, published)).toEqual([expect.objectContaining({ path: FLAG, from: false, to: true })]);
});

it('keeps offline draft ON/live OFF without changing unrelated preview flags', async () => {
  const draft = setRuntimeFlag(setRuntimeFlag(DEFAULT_APP_RUNTIME, 'buttons.malo', false), FLAG, true);
  const result = await saveAppRuntimeDraft(draft);
  expect(result.draft.buttons.MONETIZATION_TIPS_ENABLED).toBe(true);
  expect(result.published.buttons.MONETIZATION_TIPS_ENABLED).toBe(false);
  expect(result.published.buttons.malo).toBe(false);
  expect(result.publishedAt).toBeNull();
  expect(mockRpc).not.toHaveBeenCalled();
});

it('keeps the configured direct-table fallback draft-only', async () => {
  mockConfigured = true;
  const draft = setRuntimeFlag(DEFAULT_APP_RUNTIME, FLAG, true);
  mockRpc.mockResolvedValue({ data: null, error: { message: 'missing draft RPC' } });
  mockSingle.mockResolvedValue({ data: { draft, published: DEFAULT_APP_RUNTIME, published_at: null }, error: null });
  const result = await saveAppRuntimeDraft(draft);
  expect(mockUpdate).toHaveBeenCalledWith({ draft, updated_at: expect.any(String) });
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('published');
  expect(result.draft.buttons.MONETIZATION_TIPS_ENABLED).toBe(true);
  expect(result.published.buttons.MONETIZATION_TIPS_ENABLED).toBe(false);
});
