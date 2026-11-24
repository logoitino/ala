/** Compact clip identity keeps the real reaction rail, roster context and tag states without duplicate story pills. */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ReelActionOverlay } from '@/components/Reels/ReelActionOverlay';

jest.mock('@/lib/haptics', () => ({ impactPress: jest.fn() }));
jest.mock('@/components/Effects/HypeBurst', () => {
  const { Text } = jest.requireActual('react-native');
  return { HypeBurst: ({ kind }: { kind: string }) => <Text>{`burst:${kind}`}</Text> };
});
jest.mock('@/context/AppRuntimeContext', () => ({
  useAppRuntime: () => ({
    live: {
      buttons: { seki: true, aura: true, flex: true, malo: false, more: false },
      highlights: { railOrder: ['seki', 'aura', 'flex'], showSchool: false, showCaption: false, namePlacement: 'bottom', railSide: 'right' },
      theme: { jade: '#00E676', background: '#0B1014' },
    },
  }),
}));

const hype = { seki_count: 4, aura_count: 7, flex_count: 2, total_tips_cents: 0 };

function renderRail(voted = { seki: false, aura: false, flex: false }, onReact = jest.fn()) {
  return render(
    <ReelActionOverlay
      athleteName="Sione"
      auraColor="#00E676"
      auraLabel="Rising"
      hype={hype}
      voted={voted}
      onReact={onReact}
    />,
  );
}

describe('ReelActionOverlay hype chips', () => {
  it('only Aura fires the burst; Seki shows the football; Flex has no effect', async () => {
    const onReact = jest.fn();
    await renderRail(undefined, onReact);
    expect(screen.getByText('🏈', { includeHiddenElements: true })).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Flex 2'));
    await fireEvent.press(screen.getByLabelText('Seki 4'));
    expect(screen.queryByText(/burst:/)).toBeNull();
    expect(screen.queryByText('SEKI!')).toBeNull();
    expect(screen.queryByText('FLEX!')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Aura 7'));
    expect(screen.queryByText('Seki play')).toBeNull();
    expect(screen.getByText('burst:aura')).toBeTruthy();
    expect(onReact.mock.calls.map(([kind]) => kind)).toEqual(['flex', 'seki', 'aura']);
  });

  it('removing a vote is a plain tap with no burst', async () => {
    const onReact = jest.fn();
    await renderRail({ seki: true, aura: true, flex: false }, onReact);
    await fireEvent.press(screen.getByLabelText('Remove Aura'));
    await fireEvent.press(screen.getByLabelText('Remove Seki'));
    expect(screen.queryByText(/burst:/)).toBeNull();
    expect(onReact.mock.calls.map(([kind]) => kind)).toEqual(['aura', 'seki']);
    expect(screen.getByTestId('hype-halo-aura')).toBeTruthy();
    expect(screen.getByTestId('hype-halo-seki')).toBeTruthy();
    expect(screen.queryByTestId('hype-halo-flex')).toBeNull();
    expect(screen.queryByText('You called it')).toBeNull();
  });

  it('keeps selected Seki and Flex on the working rail without repeating their story below the name', async () => {
    const onReact = jest.fn();
    await renderRail({ seki: true, aura: false, flex: true }, onReact);
    expect(screen.queryByText('You called it')).toBeNull();
    expect(screen.queryByText('Riding with Sione')).toBeNull();
    expect(screen.queryByLabelText('Hide the story')).toBeNull();
    expect(screen.queryByLabelText('Show the Seki and Flex story')).toBeNull();
    expect(screen.getByTestId('hype-halo-seki')).toBeTruthy();
    expect(screen.getByTestId('hype-halo-flex')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Remove Seki'));
    await fireEvent.press(screen.getByLabelText('Remove Flex'));
    expect(onReact.mock.calls.map(([kind]) => kind)).toEqual(['seki', 'flex']);
  });

  it('shows the current photo description above the name for a photo story (UX-05)', async () => {
    await render(<ReelActionOverlay athleteName="Sione" caption="Service day" storyNote="Packing food boxes" auraColor="#00E676" auraLabel="Rising" hype={hype} />);
    expect(screen.getByText('Packing food boxes')).toBeTruthy();
  });

  it('shows who filmed the clip when a fan posted it', async () => {
    await render(<ReelActionOverlay athleteName="Sione" filmedBy="hawksmom" auraColor="#00E676" auraLabel="Rising" hype={hype} />);
    expect(screen.getByText('🎥 Filmed by hawksmom')).toBeTruthy();
  });
  it('includes jersey zero and real position in profile context without inventing missing fields', async () => {
    const onOpenAthlete = jest.fn();
    const view = await render(<ReelActionOverlay athleteName="Sione Tui" jerseyNumber={0} position="Point guard" auraColor="#00E676" auraLabel="Rising" hype={hype} canOpenAthlete onOpenAthlete={onOpenAthlete} />);
    expect(screen.getByText('#0 · Point guard')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open Sione Tui profile, Rising, #0 · Point guard'));
    expect(onOpenAthlete).toHaveBeenCalledTimes(1);
    await view.rerender(<ReelActionOverlay athleteName="Sione Tui" auraColor="#00E676" auraLabel="Rising" hype={hype} />);
    expect(screen.queryByText('#0 · Point guard')).toBeNull();
  });
});

describe('tag state chip (PRIV-01)', () => {
  const hype = { seki_count: 0, aura_count: 0, flex_count: 0, total_tips_cents: 0 };
  it('tells an approved tag from a pending one, and shows nothing without a state', async () => {
    const view = await render(<ReelActionOverlay athleteName="Sione" tagState="approved" auraColor="#00E676" auraLabel="Rising" hype={hype} />);
    expect(screen.getByText('✓ Tagged')).toBeTruthy();
    expect(screen.getByLabelText('Sione approved this tag')).toBeTruthy();
    await view.rerender(<ReelActionOverlay athleteName="Sione" tagState="pending" auraColor="#00E676" auraLabel="Rising" hype={hype} />);
    expect(screen.getByText('Tag pending')).toBeTruthy();
    expect(screen.getByLabelText('Tag waiting for the athlete to approve')).toBeTruthy();
    await view.rerender(<ReelActionOverlay athleteName="Sione" auraColor="#00E676" auraLabel="Rising" hype={hype} />);
    expect(screen.queryByText('Tag pending')).toBeNull();
    expect(screen.queryByText('✓ Tagged')).toBeNull();
  });
});
