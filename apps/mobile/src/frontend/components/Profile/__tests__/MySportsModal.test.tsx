/** Atomic My sports drafts preserve manual primary selection, replacement and failed-save edits. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MySportsModal } from '@/components/Profile/MySportsModal';
import type { AthleteSportsSnapshot } from '@/lib/athleteSports';

const mockSave = jest.fn(); const mockRefresh = jest.fn();
const mockReloadSportChoices = jest.fn();
let mockAccount = 'owner-user';
let mockSessionGuard = () => true;
let mockSportChoices = { sportNames: ['Football', 'Volleyball'], status: 'ready' };
jest.mock('@/lib/athleteSports', () => ({ saveAthleteSports: (...args: unknown[]) => mockSave(...args) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockAccount }, refreshProfile: mockRefresh, isSessionCurrent: mockSessionGuard }) }));
jest.mock('@/hooks/useSheetFrame', () => ({ useSheetFrame: () => ({ dock: {}, card: {} }) }));
jest.mock('@/hooks/useStoredSportChoices', () => ({ useStoredSportChoices: () => ({ ...mockSportChoices, reload: mockReloadSportChoices }) }));
jest.mock('@/lib/teams', () => ({ searchSchoolsAndTeams: async () => [{ id: 'school-b', name: 'South High' }] }));
jest.mock('@/components/UI/HapticPressable', () => ({ HapticPressable: jest.requireActual('react-native').Pressable }));
jest.mock('@/components/UI/MenuChrome', () => ({ MenuBackdrop: () => null }));
const original: AthleteSportsSnapshot = { profileId: 'owner-profile', primarySport: 'Football', revision: 4,
  sports: [{ sport: 'Football', schoolId: 'school-a', teamName: 'North High', position: 'QB', jersey: '8' }] };
const props = { visible: true, profileId: original.profileId, snapshot: original, onClose: jest.fn(), onSaved: jest.fn() };
beforeEach(() => { mockSportChoices = { sportNames: ['Football', 'Volleyball'], status: 'ready' }; mockAccount = 'owner-user'; mockSessionGuard = () => true; jest.clearAllMocks(); mockSave.mockReset(); mockRefresh.mockResolvedValue(null); });
const addVolleyball = async () => {
  await fireEvent.press(screen.getByRole('button', { name: 'Add another sport' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add Volleyball' }));
};

it('adds independent credentials without changing primary and saves the exact revision', async () => {
  mockSave.mockImplementation(async (profileId, primarySport, sports) => ({ profileId, primarySport, sports, revision: 5 }));
  await render(<MySportsModal {...props} />); await addVolleyball();
  await fireEvent.changeText(screen.getByLabelText('Volleyball position'), 'Setter');
  await fireEvent.changeText(screen.getByLabelText('Volleyball jersey'), '12');
  await fireEvent.press(screen.getByRole('button', { name: 'Save sports' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(original.profileId, 'Football', [original.sports[0],
    { sport: 'Volleyball', schoolId: null, teamName: null, position: 'Setter', jersey: '12' }], 4));
  expect(props.onSaved).toHaveBeenCalledWith(expect.objectContaining({ revision: 5, primarySport: 'Football' }));
});

it('requires an explicit replacement after removing the primary', async () => {
  await render(<MySportsModal {...props} />); await addVolleyball();
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Football' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save sports' }));
  expect(mockSave).not.toHaveBeenCalled();
  expect(screen.getByText('Choose a primary sport before saving.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Make Volleyball primary' }));
  mockSave.mockResolvedValue({ ...original, primarySport: 'Volleyball', revision: 5, sports: [{ sport: 'Volleyball', schoolId: null, teamName: null, position: '', jersey: '' }] });
  await fireEvent.press(screen.getByRole('button', { name: 'Save sports' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(original.profileId, 'Volleyball', expect.any(Array), 4));
});

it('retains secondary draft and revision conflict after Back and reopen', async () => {
  mockSave.mockRejectedValue(new Error('Sports changed. Reload before saving.'));
  const view = await render(<MySportsModal {...props} />); await addVolleyball();
  await fireEvent.changeText(screen.getByLabelText('Volleyball position'), 'Setter');
  await fireEvent.press(screen.getByRole('button', { name: 'Save sports' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(props.onSaved).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await view.rerender(<MySportsModal {...props} visible={false} />);
  await view.rerender(<MySportsModal {...props} />);
  expect(screen.getByLabelText('Volleyball position').props.value).toBe('Setter');
});

it('shows source unavailability without accepting a legacy optimistic save', async () => {
  await render(<MySportsModal {...props} snapshot={null} />);
  expect(screen.getByText(/Sports editing is unavailable/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Save sports' })).toBeNull();
  expect(mockSave).not.toHaveBeenCalled();
});

it('does not acknowledge a save that resolves after an account switch', async () => {
  let resolve!: (value: AthleteSportsSnapshot) => void;
  mockSave.mockReturnValue(new Promise<AthleteSportsSnapshot>((done) => { resolve = done; }));
  const view = await render(<MySportsModal {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Save sports' }));
  mockAccount = 'different-user'; await view.rerender(<MySportsModal {...props} profileId="other-profile" snapshot={null} />);
  await act(async () => resolve({ ...original, revision: 5 }));
  expect(props.onSaved).not.toHaveBeenCalled(); expect(mockRefresh).not.toHaveBeenCalled();
});

it('reports a confirmed save accurately when only the profile refresh fails', async () => {
  mockSave.mockResolvedValue({ ...original, revision: 5 });
  mockRefresh.mockRejectedValue(new Error('offline'));
  await render(<MySportsModal {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Save sports' }));
  await waitFor(() => expect(screen.getByText(/Sports saved\. The profile refresh/)).toBeTruthy());
  expect(props.onSaved).toHaveBeenCalledWith(expect.objectContaining({ revision: 5 }));
});

it('retains a conflict draft after a reload until replacement is explicitly chosen', async () => {
  const view = await render(<MySportsModal {...props} />); await addVolleyball();
  await fireEvent.changeText(screen.getByLabelText('Volleyball position'), 'Setter');
  await view.rerender(<MySportsModal {...props} snapshot={{ ...original, revision: 5 }} />);
  expect(screen.getByLabelText('Volleyball position').props.value).toBe('Setter');
  await fireEvent.press(screen.getByRole('button', { name: 'Replace draft with latest sports' }));
  expect(screen.queryByLabelText('Volleyball position')).toBeNull();
});

it('releases the new session editor after A→B→A invalidates a pending save before rendering', async () => {
  let resolve!: (value: AthleteSportsSnapshot) => void;
  mockSave.mockReturnValue(new Promise<AthleteSportsSnapshot>(done => { resolve = done; }));
  const view = await render(<MySportsModal {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Save sports' }));
  mockSessionGuard = () => true;
  await view.rerender(<MySportsModal {...props} />);
  expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Save sports' })).toBeEnabled();
  await act(async () => resolve({ ...original, revision: 5 }));
  expect(props.onSaved).not.toHaveBeenCalled();
});

it('retains a secondary draft and blocks its save when authoritative choices become unavailable', async () => {
  const view = await render(<MySportsModal {...props} />); await addVolleyball();
  await fireEvent.changeText(screen.getByLabelText('Volleyball position'), 'Setter');
  mockSportChoices = { sportNames: [], status: 'unavailable' };
  await view.rerender(<MySportsModal {...props} />);
  expect(screen.getByLabelText('Volleyball position').props.value).toBe('Setter');
  expect(screen.getByText(/Sport choices are unavailable/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save sports' }));
  expect(mockSave).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Reload sport choices'));
  expect(mockReloadSportChoices).toHaveBeenCalledTimes(1);
  mockSportChoices = { sportNames: ['Football', 'Volleyball'], status: 'ready' };
  await view.rerender(<MySportsModal {...props} />);
  expect(screen.getByLabelText('Volleyball position').props.value).toBe('Setter');
  mockSave.mockResolvedValue({ ...original, revision: 5 });
  await fireEvent.press(screen.getByLabelText('Save sports'));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(original.profileId, 'Football', [original.sports[0], expect.objectContaining({ sport: 'Volleyball', position: 'Setter' })], 4));
});

it('allows correction of retained credentials with an empty stored active catalog', async () => {
  mockSportChoices = { sportNames: [], status: 'ready' };
  mockSave.mockResolvedValue({ ...original, revision: 5 });
  await render(<MySportsModal {...props} />);
  await fireEvent.changeText(screen.getByLabelText('Football position'), 'Receiver');
  await fireEvent.press(screen.getByRole('button', { name: 'Save sports' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(original.profileId, 'Football', [expect.objectContaining({ position: 'Receiver' })], 4));
  expect(screen.queryByRole('button', { name: 'Add another sport' })).toBeNull();
});
