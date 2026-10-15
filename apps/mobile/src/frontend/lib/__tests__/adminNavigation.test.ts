/** Admin navigation must preserve production editors while reporting the most specific desk for deep links. */
import {
  ADMIN_DESK_DIRECTORY,
  ADMIN_REPORT_NAV,
  adminTrailForPath,
  isAdminNavActive,
  navGroupsForLens,
  adminWorkspaceForPath,
} from '@/lib/admin';

jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('@/lib/spotlight', () => ({ parseSpotlightAward: jest.fn(), utcWeekStart: jest.fn() }));

const tools = ['athletes', 'boosters', 'books', 'catalog', 'coverage', 'drip', 'features', 'feedback', 'games',
  'highlights', 'lab', 'look', 'moderation', 'money', 'people', 'polls', 'publish', 'qa', 'reports',
  'schools', 'sports', 'spotlight', 'studio', 'wishlist'];

it('keeps every existing production desk in the complete directory, including utilities', () => {
  expect(ADMIN_DESK_DIRECTORY).toBeDefined();
  const paths = ADMIN_DESK_DIRECTORY.map((item) => item.href);
  for (const tool of tools) expect(paths).toContain(`/admin/${tool}`);
  expect(new Set(paths).size).toBe(paths.length);
});

it('offers the main reports without replacing Money, Features, People or the existing Reports desk', () => {
  expect(ADMIN_REPORT_NAV).toBeDefined();
  expect(ADMIN_REPORT_NAV.map((item) => item.href)).toEqual([
    '/admin', '/admin/trends', '/admin/audience', '/admin/revenue', '/admin/health', '/admin/product',
  ]);
  for (const path of ['/admin/money', '/admin/features', '/admin/people', '/admin/reports']) {
    expect(adminTrailForPath(path).desk.href).toBe(path);
  }
});

it.each([
  ['/admin/qa/', 'QA', '/'],
  ['/admin/lab', 'Lab', '/'],
  ['/admin/product/profile', 'Profile', '/profile'],
  ['/admin/product/sign-in', 'Sign-in', '/'],
  ['/admin/product/people', 'People', '/profile'],
  ['/admin/product/features', 'Features', '/'],
] as const)('gives %s its own trail instead of its parent or Home', (path, label, fanHref) => {
  const trail = adminTrailForPath(path);
  expect(trail.desk.href).toBe(path.replace(/\/$/, ''));
  expect(trail.desk.label).toBe(label);
  expect(trail.fanHref).toBe(fanHref);
  expect(trail.isHome).toBe(false);
});

it('preserves lenses as editor filters without changing deep-link access or prefix boundaries', () => {
  const marketing = navGroupsForLens('marketing').flatMap((group) => group.items.map((item) => item.href));
  expect(navGroupsForLens('marketing').flatMap(group => group.items).find(item => item.label === 'App setup')?.members?.map(item => item.href)).toContain('/admin/look');
  expect(marketing).not.toContain('/admin/games');
  expect(adminTrailForPath('/admin/games').desk.href).toBe('/admin/games');
  expect(isAdminNavActive('/admin/games', '/admin/games/score')).toBe(true);
  expect(isAdminNavActive('/admin/games', '/admin/games-extra')).toBe(false);
  expect(isAdminNavActive('/admin', '/admin/games')).toBe(false);
});


it('keeps the legacy reports address resolvable while removing its duplicate dashboard from every editing lens', () => {
  expect(ADMIN_DESK_DIRECTORY.map(item => item.href)).toContain('/admin/reports');
  for (const lens of ['all', 'owner', 'marketing', 'engineer'] as const) {
    expect(navGroupsForLens(lens).flatMap(group => group.items.map(item => item.href))).not.toContain('/admin/reports');
  }
});

it('merges App setup and content review while preserving member routes in every trail', () => {
  const groups = navGroupsForLens('all');
  const desks = groups.flatMap(g => g.items);
  expect(desks.filter(d => d.label === 'App setup')).toHaveLength(1);
  expect(desks.some(d => d.href === '/admin/look')).toBe(false);
  expect(desks.some(d => d.href === '/admin/catalog')).toBe(false);
  expect(desks.some(d => d.href === '/admin/moderation')).toBe(false);
  expect(desks.some(d => d.href === '/admin/coverage')).toBe(false);
  expect(adminWorkspaceForPath('/admin/lab')?.items.map(d => d.href)).toEqual(['/admin/features', '/admin/look', '/admin/catalog', '/admin/lab']);
  expect(adminWorkspaceForPath('/admin/moderation')?.items.map(d => d.href)).toEqual(['/admin/highlights', '/admin/moderation']);
});

it('keeps the Owner setup entry at its allowed Catalogs editor', () => {
  const setup = navGroupsForLens('owner').flatMap(g => g.items).find(d => d.label === 'App setup');
  expect(setup?.href).toBe('/admin/catalog');
  expect(adminTrailForPath('/admin/catalog').desk.label).toBe('Catalogs');
});

it('gives the finance team a lens with only the money desks, and links editors to Finance & Books', () => {
  const { adminAnalysisForPath } = require('@/lib/admin');
  const finance = navGroupsForLens('finance').flatMap((group) => group.items.flatMap((item) => (item.members ?? [item]).map((member) => member.href)));
  expect(finance).toEqual(expect.arrayContaining(['/admin/books', '/admin/money']));
  expect(finance).not.toContain('/admin/look');
  expect(finance).not.toContain('/admin/moderation');
  expect(adminTrailForPath('/admin/books').desk.label).toBe('Finance & Books');
  expect(adminAnalysisForPath('/admin/money').map((item: { href: string }) => item.href)).toEqual(['/admin/revenue', '/admin/books']);
});


it('makes the weekly Sport Quiz desk discoverable with its account route and analytics trail', () => {
  const { adminAnalysisForPath } = require('@/lib/admin');
  expect(adminTrailForPath('/admin/sport-quiz').desk.label).toBe('Trivia');
  expect(adminTrailForPath('/admin/sport-quiz').fanHref).toBe('/sport-quiz');
  for (const lens of ['all', 'owner', 'marketing', 'engineer'] as const) {
    expect(navGroupsForLens(lens).flatMap(group => group.items.map(item => item.href))).toContain('/admin/sport-quiz');
  }
  expect(adminAnalysisForPath('/admin/sport-quiz').map((item: { href: string }) => item.href)).toContain('/admin/analytics');
});
it('makes the private Fan Zone desk discoverable without replacing Sport Quiz or financial lenses', () => {
 const { adminAnalysisForPath } = require('@/lib/admin');
 expect(adminTrailForPath('/admin/fan-zone').desk.label).toBe('Fan Zone');expect(adminTrailForPath('/admin/fan-zone').fanHref).toBe('/fan-zone');
 for(const lens of ['all','owner','marketing','engineer'] as const)expect(navGroupsForLens(lens).flatMap(group=>group.items.map(item=>item.href))).toContain('/admin/fan-zone');
 expect(navGroupsForLens('finance').flatMap(group=>group.items.map(item=>item.href))).not.toContain('/admin/fan-zone');expect(ADMIN_DESK_DIRECTORY.map(item=>item.href)).toContain('/admin/sport-quiz');
 expect(adminAnalysisForPath('/admin/fan-zone').map((item:{href:string})=>item.href)).toContain('/admin/analytics');
});
