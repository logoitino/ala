/** Dock scroll regressions protect visible navigation, bounded updates and stop/focus recovery. */
import { createFanNavigationScroll } from '../fanNavigationScroll';

describe('fan dock scroll recovery', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('softens after meaningful downward travel and ignores small scroll noise', () => {
    const changes = jest.fn();
    const scroll = createFanNavigationScroll(changes);
    scroll.sample(0);
    for (let y = 1; y < 12; y++) { jest.advanceTimersByTime(80); scroll.sample(y); }
    expect(changes).not.toHaveBeenCalled();
    scroll.sample(24);
    expect(changes).toHaveBeenLastCalledWith(true);
    for (let y = 25; y < 120; y++) { jest.advanceTimersByTime(10); scroll.sample(y); }
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('restores on upward travel, then softens for a new downward gesture', () => {
    const changes = jest.fn();
    const scroll = createFanNavigationScroll(changes);
    scroll.sample(0); jest.advanceTimersByTime(80); scroll.sample(80);
    jest.advanceTimersByTime(80); scroll.sample(60);
    expect(changes.mock.calls).toEqual([[true], [false]]);
    jest.advanceTimersByTime(80); scroll.sample(90);
    expect(changes).toHaveBeenLastCalledWith(true);
  });

  it('restores once scrolling stops and reuses the last position for the next gesture', () => {
    const changes = jest.fn();
    const scroll = createFanNavigationScroll(changes);
    scroll.sample(0); jest.advanceTimersByTime(80); scroll.sample(40);
    jest.advanceTimersByTime(650);
    expect(changes.mock.calls).toEqual([[true], [false]]);
    scroll.sample(70);
    expect(changes).toHaveBeenLastCalledWith(true);
    scroll.dispose(); jest.advanceTimersByTime(1000);
    expect(changes).toHaveBeenCalledTimes(3);
  });

  it('focus reset cancels old work and establishes a fresh route coordinate', () => {
    const changes = jest.fn();
    const scroll = createFanNavigationScroll(changes);
    scroll.sample(0); jest.advanceTimersByTime(80); scroll.sample(1000);
    scroll.reset();
    expect(changes).toHaveBeenLastCalledWith(false);
    scroll.sample(8000);
    jest.advanceTimersByTime(80); scroll.sample(7970);
    expect(changes).toHaveBeenCalledTimes(2);
    scroll.sample(Number.NaN);
    jest.advanceTimersByTime(650);
    expect(changes).toHaveBeenCalledTimes(2);
  });
});
