/** MONEY-TIPS-01: optional monetary authority defaults OFF and draft saves cannot publish it.
 * Synthetic local config/transport fixtures preserve legacy chrome defaults; no hosted writes run. */
import { APP_RUNTIME_FLAG_GROUPS } from '@tapuai/shared-types';
import {
  subscribeAppRuntime, fetchAppRuntimeBundle, cloneAppRuntime, DEFAULT_APP_RUNTIME, diffRuntimeFlags, getRuntimeFlag,
  parseAppRuntimeConfig, saveAppRuntimeDraft, setRuntimeFlag, type AppRuntimeConfig,
} from '../runtime';

let mockConfigured = false;
const mockRpc = jest.fn();
const mockUpdate = jest.fn();
const mockSingle = jest.fn();
let mockRuntimeUpdate: (payload: {new: Record<string,unknown>}) => void;
const mockPublicChannel: {on:jest.Mock;subscribe:jest.Mock}={on:jest.fn((_event:unknown,_filter:unknown,callback:typeof mockRuntimeUpdate)=>{mockRuntimeUpdate=callback;return mockPublicChannel;}),subscribe:jest.fn(()=>mockPublicChannel)};
const mockPublicRemove=jest.fn(),mockMemberRemove=jest.fn();
const mockPublicFrom = jest.fn();
const mockPublicSelect = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() { return mockConfigured; },
  getGuestPreviewClient: () => ({from:mockPublicFrom,channel:()=>mockPublicChannel,removeChannel:mockPublicRemove}),
  nextRealtimeTopic: () => 'runtime-test',
  supabase: { removeChannel:mockMemberRemove, rpc: (...args: unknown[]) => mockRpc(...args), from: (...args: unknown[]) => mockFrom(...args) },
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
  mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing draft RPC' } });
  mockSingle.mockResolvedValue({ data: { draft, published: DEFAULT_APP_RUNTIME, published_at: null }, error: null });
  const result = await saveAppRuntimeDraft(draft);
  expect(mockUpdate).toHaveBeenCalledWith({ draft, updated_at: expect.any(String) });
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('published');
  expect(result.draft.buttons.MONETIZATION_TIPS_ENABLED).toBe(true);
  expect(result.published.buttons.MONETIZATION_TIPS_ENABLED).toBe(false);
});

it('guest runtime reads only published chrome with the isolated public client', async () => {
  mockConfigured=true;
  const published=setRuntimeFlag(DEFAULT_APP_RUNTIME,'buttons.malo',false);
  mockPublicFrom.mockReturnValue({select:mockPublicSelect});
  mockPublicSelect.mockReturnValue({eq:()=>({maybeSingle:async()=>({data:{published,published_at:null},error:null})})});
  const result=await fetchAppRuntimeBundle(undefined,true);
  expect(result.published.buttons.malo).toBe(false);
  expect(result.draft).toEqual(result.published);
  expect(mockPublicSelect).toHaveBeenCalledWith('published, published_at');
  expect(mockFrom).not.toHaveBeenCalled();
});

it('public runtime subscription strips drafts and removes its own channel',()=>{
 mockConfigured=true;const observe=jest.fn();const stop=subscribeAppRuntime(observe,true);
 mockRuntimeUpdate({new:{draft:{privateEditor:'discard'},published:{copy:{homeLede:'Published'}},published_at:null}});
 expect(observe).toHaveBeenCalledWith({published:{copy:{homeLede:'Published'}},published_at:null});
 stop();mockRuntimeUpdate({new:{published:{copy:{homeLede:'Late'}}}});expect(observe).toHaveBeenCalledTimes(1);expect(mockPublicRemove).toHaveBeenCalledWith(mockPublicChannel);expect(mockMemberRemove).not.toHaveBeenCalled();
});
