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
  });
});
