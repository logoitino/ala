/** Exercises the actual installed Expo web player with queued DOM events. The test's observer
 * prevents Jest's own unhandled rejection while requiring the SDK to attach its own handler. */
// Runtime import tests the installed implementation without adding upstream source to app tsc.
const VideoPlayerWeb = require('expo-video/src/VideoPlayer.web').default;

function mediaFixture() {
  let source: string | null = 'old.mp4';
  const media = {
    paused: true, currentTime: 0, duration: 9, volume: 1, muted: true, playbackRate: 1,
    onplay: null as ((event: { target: unknown }) => void) | null,
    onpause: null as ((event: { target: unknown }) => void) | null,
    play: jest.fn((): Promise<void> => { media.paused = false; return Promise.resolve(); }),
    pause: jest.fn(() => { media.paused = true; }), load: jest.fn(),
    getAttribute: jest.fn(() => source),
    setAttribute: jest.fn((_key: string, value: string) => { source = value; }),
    removeAttribute: jest.fn(() => { source = null; }),
  };
  const player = new VideoPlayerWeb(null);
  player._mountedVideos.add(media as unknown as HTMLVideoElement);
  player._addListeners(media as unknown as HTMLVideoElement);
  return { player, media };
}
function rejection(media: ReturnType<typeof mediaFixture>['media']) {
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((_yes, no) => { reject = no; });
  void promise.catch(() => undefined);
  const catcher = jest.spyOn(promise, 'catch');
  // Pending HTML play clears paused before its queued event; replacing the implementation must
  // preserve this DOM side effect, especially when probing synchronization with a first video.
  media.play.mockImplementationOnce(() => { media.paused = false; return promise; });
  return { reject, catcher };
}

it('handles the browser play promise while preserving the public void contract', async () => {
  const { player, media } = mediaFixture(); const attempt = rejection(media);
  expect(player.play()).toBeUndefined(); expect(attempt.catcher).toHaveBeenCalled();
  attempt.reject(new DOMException('Interrupted', 'AbortError')); await Promise.resolve();
  expect(player.status).not.toBe('error');
});
it('does not autoplay a paused replacement or manufacture a playing event', async () => {
  const { player, media } = mediaFixture(); const changed = jest.fn(); player.addListener('playingChange', changed);
  await player.replaceAsync('next.mp4');
  expect(media.play).not.toHaveBeenCalled(); expect(player.playing).toBe(false); expect(changed).not.toHaveBeenCalled();
});
it('preserves an explicit pending play intent through replacement before DOM onplay', async () => {
  const { player, media } = mediaFixture(); const changed = jest.fn(); player.addListener('playingChange', changed);
  player.play(); expect(player.playing).toBe(false); await player.replaceAsync('next.mp4');
  expect(media.play).toHaveBeenCalledTimes(2); expect(changed).not.toHaveBeenCalled();
  media.onplay?.({ target: media }); expect(player.playing).toBe(true); expect(changed).toHaveBeenCalledTimes(1);
});
it('honors immediate pause then replacement even before the queued DOM onpause event', async () => {
  const { player, media } = mediaFixture(); player.play(); media.onplay?.({ target: media });
  player.pause(); media.play.mockClear(); await player.replaceAsync('next.mp4');
  expect(media.play).not.toHaveBeenCalled(); expect(media.paused).toBe(true);
});
it.each(['AbortError', 'NotAllowedError'])('consumes expected %s without failing the source', async name => {
  const { player, media } = mediaFixture(); const attempt = rejection(media); player.play();
  attempt.reject(new DOMException('Refused', name)); await Promise.resolve(); expect(player.status).not.toBe('error');
});
it('reports a genuine current-source failure through the public status event', async () => {
  const { player, media } = mediaFixture(); const changed = jest.fn(); player.addListener('statusChange', changed);
  const attempt = rejection(media); player.play(); attempt.reject(new DOMException('Unsuitable source', 'NotSupportedError')); await Promise.resolve();
  expect(player.status).toBe('error'); expect(changed).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', error: { message: 'Unsuitable source' } }));
});
it.each(['replaced', 'detached'])('ignores a late genuine failure from a %s attempt', async kind => {
  const { player, media } = mediaFixture(); const attempt = rejection(media); player.play();
  if (kind === 'replaced') await player.replaceAsync('next.mp4'); else player.unmountVideoView(media as unknown as HTMLVideoElement);
  attempt.reject(new DOMException('Old source', 'NotSupportedError')); await Promise.resolve(); expect(player.status).not.toBe('error');
});
it('owns promises initiated by replay and mounted follower synchronization', async () => {
  const { player, media } = mediaFixture(); const replay = rejection(media); player.replay(); expect(replay.catcher).toHaveBeenCalled();
  replay.reject(new DOMException('Interrupted', 'AbortError')); await Promise.resolve();
  const follower = mediaFixture().media; player._mountedVideos.add(follower as unknown as HTMLVideoElement);
  const synchronized = rejection(follower); player._synchronizeWithFirstVideo(follower as unknown as HTMLVideoElement);
  expect(synchronized.catcher).toHaveBeenCalled(); synchronized.reject(new DOMException('Policy', 'NotAllowedError')); await Promise.resolve();
  const onplay = rejection(follower); media.onplay?.({ target: media }); expect(onplay.catcher).toHaveBeenCalled();
  onplay.reject(new DOMException('Interrupted', 'AbortError')); await Promise.resolve();
});
it('ignores a queued onplay after pause instead of restarting a follower', () => {
  const { player, media } = mediaFixture(); const follower = mediaFixture().media;
  player._mountedVideos.add(follower as unknown as HTMLVideoElement); player.play(); player.pause();
  follower.play.mockClear(); const changed = jest.fn(); player.addListener('playingChange', changed);
  media.onplay?.({ target: media }); expect(follower.play).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
});
it('ignores a queued onpause after play instead of pausing a follower', () => {
  const { player, media } = mediaFixture(); const follower = mediaFixture().media;
  player._mountedVideos.add(follower as unknown as HTMLVideoElement); player.pause(); player.play();
  follower.pause.mockClear(); const changed = jest.fn(); player.addListener('playingChange', changed);
  media.onpause?.({ target: media }); expect(follower.pause).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
});
