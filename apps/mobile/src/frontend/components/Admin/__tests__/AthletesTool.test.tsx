/** UX-17: actual roster editor saves retain the existing team label independently of school.
 * Helpers and native chrome are synthetic boundaries; no hosted administrative write occurs. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AthletesTool } from '../AthletesTool';
import type { Player } from '@/types/database';

const mockSave = jest.fn();
const mockRefresh = jest.fn();
const school = { id: 'catalog-school', name: 'Synthetic School', mascot: 'Hawks', level: 'high_school', division: 'High School', region: 'UT' };
const player: Player = { id: 'roster-player', name: 'Synthetic Athlete', jersey_number: 7, position: 'Wing', height: '', school_name: school.name, team: 'Varsity Basketball', backer_count: 0 };
let mockPlayers: Player[] = [player];

jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('@/hooks/useRoster', () => ({ useRoster: () => ({ players: mockPlayers, loading: false, error: null, refresh: mockRefresh }) }));
jest.mock('@/hooks/useSportConfigs', () => ({ useSportConfigs: () => ({ configs: [], configFor: () => ({ positions: [] }) }) }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: () => null } }));
jest.mock('@/lib/vault', () => ({ setPlayerVaultLocked: jest.fn() }));
jest.mock('@/components/Admin/AthleteRecordsPanel', () => ({ AthleteRecordsPanel: () => null }));
jest.mock('@/lib/adminCatalog', () => ({
  upsertAthlete: (...args: unknown[]) => mockSave(...args),
  fetchAdminSchools: async () => [school],
  fetchAdminPeople: async () => [],
  adminSetPlayerGuardian: jest.fn(),
}));
jest.mock('@/components/Admin/AdminChrome', () => {
  const React = require('react');
  const { Text, View, TextInput, Pressable } = jest.requireActual('react-native');
  const Field = ({ label, ...props }: any) => React.createElement(TextInput, { ...props, accessibilityLabel: label });
  return {
    AdminPage: ({ children, error }: any) => React.createElement(View, null, error ? React.createElement(Text, null, error) : null, children),
    AdminPanel: ({ children }: any) => React.createElement(View, null, children),
    AdminFieldRow: ({ children }: any) => React.createElement(View, null, children),
    AdminRow: ({ children, title, meta }: any) => React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, meta), children),
    AdminNotice: ({ text }: any) => text ? React.createElement(Text, null, text) : null,
    AdminEmpty: ({ text }: any) => React.createElement(Text, null, text),
    AdminField: Field,
    AdminSuggest: ({ options, onPick, ...props }: any) => React.createElement(View, null, React.createElement(Field, props),
      options.map((option: any) => React.createElement(Pressable, { key: option.id, accessibilityRole: 'button', accessibilityLabel: `Choose ${option.title}`, onPress: () => onPick(option) }, React.createElement(Text, null, option.title)))),
    AdminPills: () => null,
    AdminBtn: ({ label, onPress, disabled }: any) => React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: label, onPress, disabled }, React.createElement(Text, null, label)),
  };
});

beforeEach(() => {
  mockPlayers = [player];
  mockSave.mockReset().mockResolvedValue(undefined);
  mockRefresh.mockReset().mockResolvedValue(undefined);
});

it('saving an unrelated jersey change retains the loaded distinct team', async () => {
  await render(<AthletesTool />);
  await fireEvent.press(screen.getByLabelText('Edit'));
  await fireEvent.changeText(screen.getByLabelText('Jersey'), '12');
  await fireEvent.press(screen.getByLabelText('Save athlete'));
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: player.id, school_name: school.name, team: 'Varsity Basketball', jersey_number: 12 }));
});

it('staff can correct a team without rewriting the school', async () => {
  await render(<AthletesTool />);
  await fireEvent.press(screen.getByLabelText('Edit'));
  expect(screen.getByLabelText('Team').props.value).toBe('Varsity Basketball');
  await fireEvent.changeText(screen.getByLabelText('Team'), 'Junior Varsity Basketball');
  await fireEvent.press(screen.getByLabelText('Save athlete'));
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: player.id, school_name: school.name, team: 'Junior Varsity Basketball' }));
});

it('a new roster entry keeps the existing school picker and explicit team choice', async () => {
  await render(<AthletesTool />);
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Synthetic New Athlete');
  await fireEvent.press(screen.getByLabelText(`Choose ${school.name}`));
  await fireEvent.changeText(screen.getByLabelText('Team'), 'Varsity Volleyball');
  await fireEvent.press(screen.getByLabelText('Save athlete'));
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Synthetic New Athlete', school_name: school.name, team: 'Varsity Volleyball' }));
});

it('a missing legacy team remains explicit instead of becoming the school name', async () => {
  mockPlayers = [{ ...player, team: null }];
  await render(<AthletesTool />);
  await fireEvent.press(screen.getByLabelText('Edit'));
  expect(screen.getByLabelText('Team').props.value).toBe('');
  await fireEvent.press(screen.getByLabelText('Save athlete'));
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: player.id, school_name: school.name, team: '' }));
});

it('a denied save keeps the team draft and a successful explicit retry sends it', async () => {
  mockSave.mockRejectedValueOnce(new Error('Synthetic roster write refused'));
  await render(<AthletesTool />);
  await fireEvent.press(screen.getByLabelText('Edit'));
  await fireEvent.changeText(screen.getByLabelText('Team'), 'Junior Varsity Basketball');
  await fireEvent.press(screen.getByLabelText('Save athlete'));
  expect(screen.getByText('Synthetic roster write refused')).toBeTruthy();
  expect(screen.getByLabelText('Team').props.value).toBe('Junior Varsity Basketball');
  await fireEvent.press(screen.getByLabelText('Save athlete'));
  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(mockSave).toHaveBeenLastCalledWith(expect.objectContaining({ id: player.id, team: 'Junior Varsity Basketball' }));
  expect(screen.getByLabelText('Team').props.value).toBe('');
});

it('the current team label can filter the existing roster list', async () => {
  await render(<AthletesTool />);
  await fireEvent.changeText(screen.getByLabelText('Filter'), 'Varsity Basketball');
  expect(screen.getByLabelText('Edit')).toBeTruthy();
  expect(screen.getByText(player.name)).toBeTruthy();
});
