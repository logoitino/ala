/** The compact poll keeps its policy line in full and puts each side's share on the vote button (and its label). */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CheerPollCard } from '@/components/Local/CheerPollCard';
import { COMPLIANCE_POLL } from '@/data/legal';

const mockVote = jest.fn();
jest.mock('@/hooks/useCheerPoll', () => ({
  useCheerPoll: () => ({ poll: { slug: 's', home_label: 'Westlake', away_label: 'Lone Peak', home_votes: 130, away_votes: 102 }, myVote: null, vote: mockVote }),
}));
const mockRequireAuth = jest.fn((intent: { resume: () => void }) => intent.resume());
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));

describe('CheerPollCard (compact)', () => {
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
