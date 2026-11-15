/** App viewport: center-column width on desktop/tablet web; full width on phone / native. */
import {
  appViewportWidth,
  webDesktopMode,
  WEB_CENTER_MAX,
  WEB_PHONE_WIDTH,
} from '@/hooks/useAppViewport';

describe('webDesktopMode', () => {
  it('is mobile on native and before layout is ready', () => {
    expect(webDesktopMode(1440, 'ios')).toBe('mobile');
    expect(webDesktopMode(1440, 'web', false)).toBe('mobile');
  });

  it('splits tablet and desktop on Expo web', () => {
    expect(webDesktopMode(390, 'web')).toBe('mobile');
    expect(webDesktopMode(900, 'web')).toBe('tablet');
    expect(webDesktopMode(1440, 'web')).toBe('desktop');
  });
});

describe('appViewportWidth', () => {
  it('caps the center column on wide Expo web', () => {
    expect(appViewportWidth(1440, 'web')).toBe(WEB_CENTER_MAX);
    expect(appViewportWidth(900, 'web')).toBe(WEB_CENTER_MAX);
  });

  it('keeps native and phone web at the real window width', () => {
    expect(appViewportWidth(1440, 'ios')).toBe(1440);
    expect(appViewportWidth(390, 'web')).toBe(390);
  });

  it('leaves wide web unclamped until the shell layout is ready (SSR / first paint)', () => {
    expect(appViewportWidth(1440, 'web', false)).toBe(1440);
  });

  it('never shrinks the center below the legacy phone column on desktop', () => {
    expect(appViewportWidth(820, 'web')).toBeGreaterThanOrEqual(WEB_PHONE_WIDTH);
  });
});
