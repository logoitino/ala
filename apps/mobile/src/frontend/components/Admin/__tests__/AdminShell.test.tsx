/** The shared admin shell must gate desk mounting and leave scrolling to the page containing its header. */
import { render, screen, type RenderResult } from '@testing-library/react-native';
import { ScrollView, Text } from 'react-native';
import { AdminShell } from '@/components/Admin/AdminShell';
import { useState } from 'react';

let mockAuth: Record<string, unknown> = { isAdmin: true, loading: false };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/context/AdminLensContext', () => ({
  AdminLensProvider: ({ children }: { children: React.ReactNode }) => children,
  useAdminLens: () => ({ lens: 'all', setLens: jest.fn() }),
}));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ dirty: false, live: { theme: {} } }) }));
jest.mock('expo-router', () => ({ usePathname: () => '/admin', useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('@/lib/spotlight', () => ({ parseSpotlightAward: jest.fn(), utcWeekStart: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));

beforeEach(() => { mockAuth = { isAdmin: true, loading: false }; });

function descendants(node: RenderResult['container']): RenderResult['container'][] {
  return [node, ...node.children.flatMap((child) => typeof child === 'string' ? [] : descendants(child))];
}

it.each([{ isAdmin: true, loading: true }, { isAdmin: false, loading: false }])(
  'does not mount desk children while access is unresolved or restricted: %j', async (auth) => {
    mockAuth = auth;
    await render(<AdminShell><Text>Private desk controls</Text></AdminShell>);
    expect(screen.queryByText('Private desk controls')).toBeNull();
  },
);

it('mounts the authorized page without a second header scroll area', async () => {
  await render(<AdminShell><ScrollView><Text>Private desk controls</Text></ScrollView></AdminShell>);
  expect(screen.getByText('Private desk controls')).toBeTruthy();
  expect(descendants(screen.container).filter((node) => node.type === 'RCTScrollView')).toHaveLength(1);
  expect(screen.queryByText('Admin Portal')).toBeNull();
});

it('drops outgoing desk local state when Studio stays enabled across accounts', async () => {
  function Desk() { const [privateOwner] = useState(mockAuth.user); return <Text>{String(privateOwner)}</Text>; }
  mockAuth = { isAdmin: true, loading: false, user: { id: 'A', toString: () => 'private A' }, isSessionCurrent: () => true };
  await render(<AdminShell><Desk /></AdminShell>);
  expect(screen.getByText('private A')).toBeTruthy();
  mockAuth = { isAdmin: true, loading: false, user: { id: 'B', toString: () => 'private B' }, isSessionCurrent: () => true };
  await screen.rerender(<AdminShell><Desk /></AdminShell>);
  expect(screen.queryByText('private A')).toBeNull(); expect(screen.getByText('private B')).toBeTruthy();
});
