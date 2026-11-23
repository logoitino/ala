/** Poll selection stays visible without color alone, readable against its real surface, and separate from vote authority. */
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { CheerPollCard } from '@/components/Local/CheerPollCard';
import { COMPLIANCE_POLL } from '@/data/legal';

const mockVote = jest.fn();
let mockVoteSide: 'home' | 'away' | null = null;
jest.mock('@/hooks/useCheerPoll', () => ({
  useCheerPoll: () => ({ poll: { slug: 's', home_label: 'Westlake', away_label: 'Lone Peak', home_votes: 130, away_votes: 102 }, myVote: mockVoteSide, vote: mockVote }),
}));
const mockRequireAuth = jest.fn((intent: { resume: () => void }) => intent.resume());
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));

function contrast(first: string, second: string) {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(start => {
      const value = parseInt(hex.slice(start, start + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

/** Find the actual rendered choice surface, rather than comparing a named style token. */
function choiceSurface(text: ReturnType<typeof screen.getByText>) {
  let node: typeof text | null = text;
  while (node) {
    const style = StyleSheet.flatten(node.props.style);
    if (style && style.borderWidth >= 2 && typeof style.borderColor === 'string' && typeof style.backgroundColor === 'string') return style;
    node = node.parent;
  }
  throw new Error('Rendered team choice has no bordered surface.');
}

describe('CheerPollCard (compact)', () => {
  beforeEach(() => { mockVoteSide = null; mockVote.mockClear(); mockRequireAuth.mockClear(); });

  it.each(['home', 'away'] as const)('shows a visible selection cue for the %s team without changing shares or voting again', async side => {
    mockVoteSide = side;
    await render(<CheerPollCard homeLabel="Westlake" awayLabel="Lone Peak" />);
    const selected = screen.getByLabelText(side === 'home' ? 'Cheer Westlake, 56%' : 'Cheer Lone Peak, 44%');
    expect(selected.props.accessibilityState).toMatchObject({ selected: true });
    const cue = within(selected).getByText('Selected');
    const surface = choiceSurface(cue);
    expect(contrast(surface.borderColor, surface.backgroundColor)).toBeGreaterThanOrEqual(3);
    expect(contrast(StyleSheet.flatten(cue.props.style).color, surface.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(screen.getAllByText('Selected')).toHaveLength(1);
    expect(screen.getByText('56%')).toBeTruthy();
    expect(screen.getByText('44%')).toBeTruthy();
    expect(screen.getByText(COMPLIANCE_POLL).props.numberOfLines).toBeUndefined();
    await fireEvent.press(selected);
    expect(mockVote).not.toHaveBeenCalled();
  });

  it('has no selection cue before a vote is chosen', async () => {
    await render(<CheerPollCard homeLabel="Westlake" awayLabel="Lone Peak" />);
    expect(screen.queryByText('Selected')).toBeNull();
    for (const [label, spoken] of [['Westlake', 'Cheer Westlake, 56%'], ['Lone Peak', 'Cheer Lone Peak, 44%']]) {
      const surface = choiceSurface(within(screen.getByLabelText(spoken)).getByText(label));
      expect(contrast(surface.borderColor, surface.backgroundColor)).toBeGreaterThanOrEqual(3);
    }
    expect(screen.getByLabelText('Cheer Westlake, 56%').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByLabelText('Cheer Lone Peak, 44%').props.accessibilityState).toMatchObject({ selected: false });
  });
  it('shows the policy line in full and the totals in the header', async () => {
    await render(<CheerPollCard homeLabel="Westlake" awayLabel="Lone Peak" />);
    const policy = screen.getByText(COMPLIANCE_POLL);
    expect(policy.props.numberOfLines).toBeUndefined();
    expect(screen.getByText('232 cheers')).toBeTruthy();
  });

  it('puts each percentage on its vote button and in the spoken label', async () => {
    await render(<CheerPollCard homeLabel="Westlake" awayLabel="Lone Peak" />);
    expect(screen.getByLabelText('Cheer Westlake, 56%')).toBeTruthy();
    expect(screen.getByLabelText('Cheer Lone Peak, 44%')).toBeTruthy();
    expect(screen.getByText('56%')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cheer Westlake, 56%'));
    // Votes go through the soft wall: guests sign in first, then the vote lands.
    expect(mockRequireAuth).toHaveBeenCalledWith(expect.objectContaining({ kind: 'signin' }));
    expect(mockVote).toHaveBeenCalledWith('home');
  });
});
