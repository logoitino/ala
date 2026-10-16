/** Moderation keeps complete report evidence readable at phone widths and larger text, with actions tied to each row. */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ModerationTable } from '@/components/Admin/ModerationTable';
import type { AdminFlagRow } from '@/lib/admin';

// Report colors stay real; these context imports otherwise initialize unrelated sessions and native clients.
jest.mock('@/context/AuthContext', () => ({}));
jest.mock('@/context/SoftWallContext', () => ({}));
jest.mock('@/context/AdminLensContext', () => ({}));
jest.mock('@/context/AppRuntimeContext', () => ({}));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('@/lib/spotlight', () => ({ parseSpotlightAward: jest.fn(), utcWeekStart: jest.fn() }));

const highlight: AdminFlagRow = {
  id: 'highlight-1', kind: 'highlight',
  title: 'Championship game highlight with the complete athlete and team names',
  subtitle: 'Athlete: Leilani Tapua‘i · North Valley High School · Volleyball championship final',
  reasonLabel: 'The athlete or guardian did not give permission to share this full championship clip.',
  reportCount: 3, athleteOrGuardian: 'yes', openedAt: '2026-10-12T18:10:00Z',
};
const secondHighlight: AdminFlagRow = {
  ...highlight, id: 'highlight-2', title: 'Second highlight', reportCount: 1, athleteOrGuardian: 'unchecked',
};
const technical: AdminFlagRow = {
  id: 'technical-1', kind: 'telemetry', title: 'Playback reconnect incident',
  subtitle: 'Android client reconnect after a prolonged network stall', reasonLabel: 'Bug report',
  reportCount: 1, athleteOrGuardian: 'na', openedAt: '2026-10-12T18:20:00Z',
};

const onDismiss = jest.fn();
const onRemove = jest.fn();
// Spy on the original module: a wildcard import creates a separate getter in Babel's interop wrapper.
const windowDimensions = jest.spyOn(require('react-native'), 'useWindowDimensions');

function viewport(width: number, fontScale = 1) {
  windowDimensions.mockReturnValue({ width, height: 900, scale: 1, fontScale });
}

function expectCompleteEvidence() {
  for (const text of [highlight.title, highlight.subtitle, highlight.reasonLabel]) {
    expect(screen.getByText(text).props.numberOfLines).toBeUndefined();
  }
  expect(screen.getByLabelText('Kind: User flag')).toBeTruthy();
  expect(screen.getByLabelText('Reports: 3')).toBeTruthy();
  expect(screen.getByLabelText('Athlete or guardian: Yes')).toBeTruthy();
  const opened = screen.getByLabelText(/^Opened: /);
  expect(opened.props.children).toBeTruthy();
  expect(opened.props.accessibilityLabel).toContain('Oct');
}

beforeEach(() => {
  jest.clearAllMocks();
  viewport(390);
});

it.each([320, 390, 768])('keeps complete labeled evidence in detail rows at %i points', async (width) => {
  viewport(width);
  await render(<ModerationTable flags={[highlight]} busyId={null} onDismiss={onDismiss} onRemove={onRemove} />);
  expect(screen.queryByText('Kind')).toBeNull();
  expectCompleteEvidence();
  expect(screen.getByText('Reports')).toBeTruthy();
  expect(screen.getByText('Athlete or guardian')).toBeTruthy();
  expect(screen.getByText('Opened')).toBeTruthy();
});

it('uses detail rows when enlarged text would crowd wide columns', async () => {
  viewport(1440, 1.5);
  await render(<ModerationTable flags={[highlight]} busyId={null} onDismiss={onDismiss} onRemove={onRemove} />);
  expect(screen.queryByText('Kind')).toBeNull();
  expectCompleteEvidence();
});

it.each([1100, 1440])('keeps all untruncated evidence in the wide table at %i points', async (width) => {
  viewport(width);
  await render(<ModerationTable flags={[highlight]} busyId={null} onDismiss={onDismiss} onRemove={onRemove} />);
  expect(screen.getByText('Kind')).toBeTruthy();
  expectCompleteEvidence();
});

it('dismisses and removes the selected highlight row, keeping both actions available', async () => {
  await render(<ModerationTable flags={[highlight, secondHighlight]} busyId={null} onDismiss={onDismiss} onRemove={onRemove} />);
  await fireEvent.press(screen.getByRole('button', { name: `Dismiss ${secondHighlight.title}` }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledWith(secondHighlight);
  expect(onRemove).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: `Remove content ${highlight.title}` }));
  expect(onRemove).toHaveBeenCalledTimes(1);
  expect(onRemove).toHaveBeenCalledWith(highlight);
  expect(screen.getAllByRole('button')).toHaveLength(4);
});

it('keeps technical incidents dismissible without offering content removal', async () => {
  await render(<ModerationTable flags={[technical]} busyId={null} onDismiss={onDismiss} onRemove={onRemove} />);
  expect(screen.getByLabelText('Kind: Bug report')).toBeTruthy();
  expect(screen.getByText(technical.subtitle)).toBeTruthy();
  expect(screen.getByLabelText('Athlete or guardian: —')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Remove content / })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: `Dismiss ${technical.title}` }));
  expect(onDismiss).toHaveBeenCalledWith(technical);
  expect(onRemove).not.toHaveBeenCalled();
});

it('keeps a busy row readable while hiding its actions until the parent releases it', async () => {
  const view = await render(<ModerationTable flags={[highlight]} busyId={highlight.id} onDismiss={onDismiss} onRemove={onRemove} />);
  expectCompleteEvidence();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.getByLabelText(`Updating ${highlight.title}`)).toBeTruthy();
  expect(onDismiss).not.toHaveBeenCalled();
  expect(onRemove).not.toHaveBeenCalled();
  await view.rerender(<ModerationTable flags={[highlight]} busyId={null} onDismiss={onDismiss} onRemove={onRemove} />);
  expect(screen.getAllByRole('button')).toHaveLength(2);
});

it('gives both phone actions at least a 44-point hit target', async () => {
  await render(<ModerationTable flags={[highlight]} busyId={null} onDismiss={onDismiss} onRemove={onRemove} />);
  for (const name of [`Dismiss ${highlight.title}`, `Remove content ${highlight.title}`]) {
    expect(screen.getByRole('button', { name })).toHaveStyle({ minHeight: 44, minWidth: 44 });
  }
});

it('shows the empty queue without action controls', async () => {
  await render(<ModerationTable flags={[]} busyId={null} onDismiss={onDismiss} onRemove={onRemove} />);
  expect(screen.getByText('Queue is clear.')).toBeTruthy();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});
