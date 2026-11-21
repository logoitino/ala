/** Same-role account switches must discard HQ child state, while same-owner refresh and Studio preview preserve it. */
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { RoleGate } from '../RoleGate';
let mockUser = 'A', mockRole = 'athlete', mockGuard = () => true;
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUser }, role: mockRole, roles: ['athlete', 'fan', 'booster'], loading: false, isSessionCurrent: mockGuard }) }));
jest.mock('expo-router', () => { const { Text } = require('react-native'); return { Redirect: () => <Text>Redirect</Text> }; });
const mounts: string[] = [];
function Hq() {
  const [draft, setDraft] = useState(() => { mounts.push(mockUser); return ''; });
  return <><Text>{draft || 'Fresh HQ'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Edit draft" onPress={() => setDraft('Private A draft')}><Text>Edit</Text></Pressable></>;
}
const app = () => <RoleGate allow={['athlete', 'fan', 'booster']}><Hq /></RoleGate>;
beforeEach(() => { mockUser = 'A'; mockRole = 'athlete'; mockGuard = () => true; mounts.length = 0; });
it('remounts same-role HQ children for an incoming account', async () => {
  const view = await render(app()); await fireEvent.press(screen.getByRole('button', { name: 'Edit draft' }));
  mockUser = 'B'; mockGuard = () => true; await view.rerender(app());
  expect(screen.queryByText('Private A draft')).toBeNull();
  expect(mounts).toEqual(['A', 'B']);
});
it('remounts when A→B→A is batched and only the Auth lifetime changes', async () => {
  const view = await render(app()); await fireEvent.press(screen.getByRole('button', { name: 'Edit draft' }));
  mockGuard = () => true; await view.rerender(app());
  expect(screen.queryByText('Private A draft')).toBeNull();
  expect(mounts).toHaveLength(2);
});
it('preserves same-account token refresh and Studio role changes', async () => {
  const view = await render(app()); await fireEvent.press(screen.getByRole('button', { name: 'Edit draft' }));
  await view.rerender(app()); mockRole = 'booster'; await view.rerender(app());
  expect(screen.getByText('Private A draft')).toBeTruthy();
  expect(mounts).toEqual(['A']);
});
it('does not render children through an already-invalidated Auth frame', async () => {
  const view = await render(app()); await fireEvent.press(screen.getByRole('button', { name: 'Edit draft' }));
  await act(async () => { mockGuard = () => false; await view.rerender(app()); });
  expect(screen.queryByText('Private A draft')).toBeNull();
});
