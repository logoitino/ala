/**
 * WebAppShell: native pass-through; web ≥820 gets desktop rails after mount effects.
 * Tablet extras are mounted only while open, close on navigation, and reset when leaving tablet mode.
 * SSR / first-paint sameness is covered by deferring desktop on `layoutReady`.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { WebAppShell } from '@/components/Common/WebAppShell';

jest.mock('@/components/Common/DesktopLeftRail', () => ({
  DesktopLeftRail: () => {
    const { Text } = require('react-native');
    return <Text>Left rail</Text>;
  },
}));

jest.mock('@/components/Common/DesktopRightRail', () => ({
  DesktopRightRail: ({ onNavigate }: { onNavigate?: () => void }) => {
    const { Text, Pressable } = require('react-native');
    return <><Text>Right rail</Text><Pressable accessibilityRole="button" accessibilityLabel="Choose extras destination" onPress={onNavigate} /></>;
  },
}));

let mockGuest=false;
jest.mock('@/context/AuthContext',()=>({useAuth:()=>({accountReady:!mockGuest,isGuest:mockGuest,loading:false,session:mockGuest?null:{user:{id:'one'}}})}));
const windowDimensions = jest.spyOn(require('react-native'), 'useWindowDimensions');

function viewport(width: number) {
  windowDimensions.mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

describe('WebAppShell', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    viewport(1440);
    mockGuest=false;
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

  it('loads the tablet drawer on demand and closes it after navigation', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    viewport(900);
    await render(<WebAppShell><Text>Home</Text></WebAppShell>);
    expect(screen.queryByText('Right rail')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Open extras panel'));
    expect(await screen.findByText('Right rail')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Explore Tapua’i' })).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Choose extras destination'));
    expect(screen.queryByText('Right rail')).toBeNull();
  });

  it('does not reopen an old drawer after switching through desktop mode', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    viewport(900);
    const view = await render(<WebAppShell><Text>Home</Text></WebAppShell>);
    await fireEvent.press(screen.getByLabelText('Open extras panel'));
    expect(await screen.findByText('Right rail')).toBeTruthy();
    viewport(1440);
    await view.rerender(<WebAppShell><Text>Home</Text></WebAppShell>);
    viewport(900);
    await view.rerender(<WebAppShell><Text>Home</Text></WebAppShell>);
    expect(screen.queryByText('Right rail')).toBeNull();
  });

});

it('guest web does not mount desktop discovery data or navigation rails',async()=>{Object.defineProperty(Platform,'OS',{configurable:true,value:'web'});viewport(1440);mockGuest=true;await render(<WebAppShell><Text>Preview</Text></WebAppShell>);expect(screen.getByText('Preview')).toBeTruthy();expect(screen.queryByText('Left rail')).toBeNull();expect(screen.queryByText('Right rail')).toBeNull();});
