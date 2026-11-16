/**
 * WebAppShell: native pass-through; web ≥820 gets desktop rails after mount effects.
 * SSR / first-paint sameness is covered by deferring desktop on `layoutReady`.
 */
import { render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { WebAppShell } from '@/components/Common/WebAppShell';

jest.mock('@/components/Common/DesktopLeftRail', () => ({
  DesktopLeftRail: () => {
    const { Text } = require('react-native');
    return <Text>Left rail</Text>;
  },
}));

jest.mock('@/components/Common/DesktopRightRail', () => ({
  DesktopRightRail: () => {
    const { Text } = require('react-native');
    return <Text>Right rail</Text>;
  },
}));

const windowDimensions = jest.spyOn(require('react-native'), 'useWindowDimensions');

function viewport(width: number) {
  windowDimensions.mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

describe('WebAppShell', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    viewport(1440);
  });

  it('passes children through on native', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    viewport(1440);
    await render(
      <WebAppShell>
        <Text>Home</Text>
      </WebAppShell>,
    );
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.queryByLabelText("Tapua'i web app")).toBeNull();
  });

  it('uses three-panel chrome on wide Expo web after mount', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    viewport(1440);
    await render(
      <WebAppShell>
        <Text>Home</Text>
      </WebAppShell>,
    );
    expect(await screen.findByLabelText("Tapua'i web app")).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Left rail')).toBeTruthy();
    expect(screen.getByText('Right rail')).toBeTruthy();
  });

  it('uses icon rail + extras toggle on tablet Expo web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    viewport(900);
    await render(
      <WebAppShell>
        <Text>Home</Text>
      </WebAppShell>,
    );
    expect(await screen.findByLabelText("Tapua'i web app")).toBeTruthy();
    expect(screen.getByText('Left rail')).toBeTruthy();
    expect(screen.getByLabelText('Open extras panel')).toBeTruthy();
  });

  it('stays full-bleed on phone Expo web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    viewport(390);
    await render(
      <WebAppShell>
        <Text>Home</Text>
      </WebAppShell>,
    );
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.queryByLabelText("Tapua'i web app")).toBeNull();
  });
});
