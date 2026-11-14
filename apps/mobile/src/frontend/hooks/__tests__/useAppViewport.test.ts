/** App viewport width clamps to the web phone column on wide desktop browsers. */
import { appViewportWidth, WEB_PHONE_WIDTH } from '@/hooks/useAppViewport';

describe('appViewportWidth', () => {
  it('clamps wide Expo web to the phone column', () => {
    expect(appViewportWidth(1440, 'web')).toBe(WEB_PHONE_WIDTH);
  });

  it('keeps native and narrow web at the real window width', () => {
    expect(appViewportWidth(1440, 'ios')).toBe(1440);
    expect(appViewportWidth(390, 'web')).toBe(390);
  });

  it('leaves wide web unclamped until the shell layout is ready (SSR / first paint)', () => {
    expect(appViewportWidth(1440, 'web', false)).toBe(1440);
  });
});
