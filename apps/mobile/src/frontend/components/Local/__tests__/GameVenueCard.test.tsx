/** LOCAL-02: render actual venue UI, keep unknown addresses readable, and guard map handoff failures and late completions. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GameVenueCard } from '@/components/Local/GameVenueCard';
import { openGameDirections } from '@/lib/gameVenue';
import { TelemetryManager } from '@/services/TelemetryManager';
import type { Game } from '@/types/database';
jest.mock('@/lib/gameVenue', () => ({ ...jest.requireActual('@/lib/gameVenue'), openGameDirections: jest.fn() }));
jest.mock('@/services/TelemetryManager', () => ({ TelemetryManager: { getInstance: () => ({ trackFeature: mockFeature, trackIssue: mockIssue }) } }));
const mockFeature = jest.fn();
const mockIssue = jest.fn();
const game: Game = { id: 'g1', home_team: 'Home', away_team: 'Away', home_school: 'Home School', away_school: 'Away School', home_score: 0, away_score: 0, status: 'live', is_active: true, venue: 'Tournament gym', venue_school: 'Neutral School', venue_address: '12 Main St, Honolulu, HI', venue_notes: 'East entrance' };

beforeEach(() => { jest.clearAllMocks(); jest.mocked(openGameDirections).mockResolvedValue(undefined); });

it('shows the public venue and arrival instructions without assuming the home school', async () => {
  await render(<GameVenueCard game={game} />);
  expect(screen.getByText('Tournament gym')).toBeTruthy();
  expect(screen.getByText('Neutral School')).toBeTruthy();
  expect(screen.queryByText('Home School')).toBeNull();
  expect(screen.getByText(game.venue_address!)).toBeTruthy();
  expect(screen.getByText('East entrance')).toBeTruthy();
  expect(openGameDirections).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Get directions' }));
  expect(openGameDirections).toHaveBeenCalledWith('12 Main St, Honolulu, HI');
  expect(TelemetryManager.getInstance().trackFeature).toHaveBeenCalledWith('local_directions', 'local');
});

it('keeps legacy and unknown venues readable without a misleading directions action', async () => {
  await render(<GameVenueCard game={{ ...game, venue: ' ', venue_school: undefined, venue_address: undefined, venue_notes: undefined }} />);
  expect(screen.getByText('Venue TBA')).toBeTruthy();
  expect(screen.getByText('Address TBA')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Get directions' })).toBeNull();
  expect(openGameDirections).not.toHaveBeenCalled();
});

it('keeps the address visible with a retry after maps fail and logs no destination or exception', async () => {
  jest.mocked(openGameDirections).mockRejectedValueOnce(new Error('private provider exception'));
  await render(<GameVenueCard game={game} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Get directions' }));
  expect(await screen.findByText(/Couldn’t open maps/)).toBeTruthy();
  expect(screen.getByText(game.venue_address!)).toBeTruthy();
  expect(screen.queryByText('private provider exception')).toBeNull();
  expect(mockIssue).toHaveBeenCalledWith('local_directions_open_failed', 'local');
  await fireEvent.press(screen.getByRole('button', { name: 'Get directions' }));
  expect(screen.queryByText(/Couldn’t open maps/)).toBeNull();
  expect(openGameDirections).toHaveBeenCalledTimes(2);
});

it('blocks duplicate map launches while a handoff is pending', async () => {
  let finish!: () => void;
  jest.mocked(openGameDirections).mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await render(<GameVenueCard game={game} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Get directions' }));
  expect(screen.getByRole('button', { name: 'Opening maps…' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Opening maps…' }));
  expect(openGameDirections).toHaveBeenCalledTimes(1);
  await act(async () => finish());
});

it('does not put an old venue failure under a newly selected game', async () => {
  let fail!: (error: Error) => void;
  jest.mocked(openGameDirections).mockImplementation(() => new Promise<void>((_resolve, reject) => { fail = reject; }));
  const view = await render(<GameVenueCard game={game} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Get directions' }));
  await view.rerender(<GameVenueCard game={{ ...game, id: 'g2', venue_address: '34 Park Rd' }} />);
  await act(async () => fail(new Error('old request')));
  expect(screen.queryByText(/Couldn’t open maps/)).toBeNull();
  expect(screen.getByText('34 Park Rd')).toBeTruthy();
});
