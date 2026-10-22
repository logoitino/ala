/** QR links may only open a trusted web origin; a bad setting falls back to tapuai.app instead of printing a broken code. */
import { formatGiftUrl, shareQrSubtitle, webOrigin } from '@/data/share';

describe('webOrigin', () => {
  it('keeps an https origin and drops any path', () => {
    expect(webOrigin('https://preview.tapuai.app/some/path/')).toBe('https://preview.tapuai.app');
  });

  it('allows plain http only on this machine', () => {
    expect(webOrigin('http://localhost:8081')).toBe('http://localhost:8081');
    expect(webOrigin('http://preview.tapuai.app')).toBe('https://tapuai.app');
  });

  it('falls back when unset or not a URL', () => {
    expect(webOrigin(undefined)).toBe('https://tapuai.app');
    expect(webOrigin('tapuai')).toBe('https://tapuai.app');
    expect(webOrigin('javascript:alert(1)')).toBe('https://tapuai.app');
  });
});

describe('formatGiftUrl', () => {
  it('encodes the handle under /gift', () => {
    expect(formatGiftUrl('@Mele')).toBe('https://tapuai.app/gift/mele');
  });
});

describe('shareQrSubtitle', () => {
  it('names the athlete without promising an instant, app-free donation', () => {
    const line = shareQrSubtitle('Mele');
    expect(line).toBe('Scan or share to support Mele. Friends and family can donate from the link.');
    expect(line).not.toMatch(/instantly|without downloading/i);
    expect(shareQrSubtitle('  ')).toMatch(/support this athlete/);
  });
});

