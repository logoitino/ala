/** Source/focus races must not start the wrong Highlight or count load/failure time as playback.
 * Deferred replacements model the native async boundary without fetching media or using a decoder. */
function deferred() { let resolve!: () => void; let reject!: (error: unknown) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(native = false) {
  let uri = 'a.mp4'; let allowed = true;
  const player = { status: 'readyToPlay', playing: false, duration: 9, play: jest.fn(), pause: jest.fn(), replaceAsync: jest.fn(async (_uri: string): Promise<void> => undefined) };
  const onError = jest.fn(); const onReady = jest.fn(); const onPlaybackChange = jest.fn();
  const controller = require('../reelPlayback').createReelPlaybackController({ player, native, currentUri: () => uri, canPlay: () => allowed, onError, onReady, onPlaybackChange });
  player.replaceAsync.mockImplementation(async next => { controller.sourceChanged(next); });
  return { controller, player, onError, onReady, onPlaybackChange, uri: (next: string) => { uri = next; }, allowed: (next: boolean) => { allowed = next; } };
}
it('waits for the current replacement before playing and deduplicates repeated ready events', async () => {
  const f = fixture(); const loading = deferred(); f.player.replaceAsync.mockReturnValueOnce(loading.promise);
  const pending = f.controller.load('a.mp4'); await Promise.resolve(); f.controller.statusChanged('readyToPlay');
  expect(f.player.play).not.toHaveBeenCalled(); f.controller.sourceChanged('a.mp4'); loading.resolve(); await pending;
  f.controller.statusChanged('readyToPlay'); f.controller.requestPlay();
  expect(f.player.play).toHaveBeenCalledTimes(1);
});
it('serializes replacements and ignores a stale URI completion', async () => {
  const f = fixture(); const first = deferred(); f.player.replaceAsync.mockReturnValueOnce(first.promise);
  const a = f.controller.load('a.mp4'); await Promise.resolve(); f.uri('b.mp4'); const b = f.controller.load('b.mp4');
  expect(f.player.replaceAsync).toHaveBeenCalledTimes(1); first.resolve(); await a; await b;
  expect(f.player.replaceAsync.mock.calls.map(call => call[0])).toEqual(['a.mp4', 'b.mp4']); expect(f.player.play).toHaveBeenCalledTimes(1);
});
it('does not play a source that lost focus or became locked while replacing', async () => {
  const f = fixture(); const loading = deferred(); f.player.replaceAsync.mockReturnValueOnce(loading.promise);
  const pending = f.controller.load('a.mp4'); await Promise.resolve(); f.allowed(false); f.controller.pause(); loading.resolve(); await pending;
  f.controller.statusChanged('readyToPlay'); expect(f.player.play).not.toHaveBeenCalled();
});
it('reports a current replacement rejection, clears view time and permits a reviewed retry', async () => {
  const f = fixture(); f.player.replaceAsync.mockRejectedValueOnce(new Error('Unsupported source'));
  await f.controller.load('a.mp4'); expect(f.onError).toHaveBeenCalledTimes(1); expect(f.onPlaybackChange).toHaveBeenLastCalledWith(false, null);
  expect(f.player.play).not.toHaveBeenCalled(); await f.controller.load('a.mp4'); expect(f.player.play).toHaveBeenCalledTimes(1);
});
it('drops a stale failed load and continues to the latest source', async () => {
  const f = fixture(); const old = deferred(); f.player.replaceAsync.mockReturnValueOnce(old.promise);
  const a = f.controller.load('a.mp4'); await Promise.resolve(); f.uri('b.mp4'); const b = f.controller.load('b.mp4'); old.reject(new Error('Old failure'));
  await a; await b; expect(f.onError).not.toHaveBeenCalled(); expect(f.player.play).toHaveBeenCalledTimes(1);
});
it('counts only eligible actual playing events and stops counting on loading and failure', async () => {
  const f = fixture(); await f.controller.load('a.mp4'); expect(f.onPlaybackChange).not.toHaveBeenCalledWith(true, expect.anything());
  f.controller.playingChanged(true); expect(f.onPlaybackChange).toHaveBeenLastCalledWith(true, 9);
  f.controller.statusChanged('loading'); expect(f.onPlaybackChange).toHaveBeenLastCalledWith(false, null);
  f.controller.statusChanged('error', { message: 'Unavailable' }); expect(f.onPlaybackChange).toHaveBeenLastCalledWith(false, null); expect(f.onError).toHaveBeenCalledTimes(1);
});
it('does not count or keep an unexpected offscreen play event', async () => {
  const f = fixture(); await f.controller.load('a.mp4'); f.allowed(false); f.controller.playingChanged(true);
  expect(f.onPlaybackChange).toHaveBeenLastCalledWith(false, null); expect(f.player.pause).toHaveBeenCalled();
});
it('does not restore playback from a late completion after disposal', async () => {
  const f = fixture(); const loading = deferred(); f.player.replaceAsync.mockReturnValueOnce(loading.promise);
  const pending = f.controller.load('a.mp4'); await Promise.resolve(); f.controller.dispose(); loading.resolve(); await pending;
  expect(f.player.play).not.toHaveBeenCalled(); expect(f.onError).not.toHaveBeenCalled();
});
it('ignores stale ready events until the requested source is actually confirmed', async () => {
  const f = fixture(); f.player.replaceAsync.mockImplementationOnce(async () => undefined);
  await f.controller.load('a.mp4'); f.controller.sourceChanged('old.mp4'); f.controller.statusChanged('readyToPlay');
  expect(f.player.play).not.toHaveBeenCalled(); f.controller.sourceChanged('a.mp4'); expect(f.player.play).toHaveBeenCalledTimes(1);
});
it('waits when replacement resolves and confirms its URI before the ready event', async () => {
  const f = fixture(); f.player.status = 'loading'; await f.controller.load('a.mp4');
  expect(f.player.play).not.toHaveBeenCalled(); f.controller.statusChanged('readyToPlay');
  // The SDK getter still says loading during this callback; the event is the authority.
  expect(f.player.play).toHaveBeenCalledTimes(1);
});
it('accepts ready-before-source ordering only after the matching source event', async () => {
  const f = fixture(); f.player.replaceAsync.mockImplementationOnce(async () => undefined);
  await f.controller.load('a.mp4'); f.controller.statusChanged('readyToPlay'); expect(f.player.play).not.toHaveBeenCalled();
  f.controller.sourceChanged('a.mp4'); expect(f.player.play).toHaveBeenCalledTimes(1);
});
it('does not confuse the previous source playing getter with a current play request', async () => {
  const f = fixture(); f.player.playing = true; await f.controller.load('a.mp4');
  expect(f.player.play).toHaveBeenCalledTimes(1);
});
it('does not use the previous native ready getter or unbound ready event for a new source', async () => {
  const f = fixture(true); f.player.replaceAsync.mockImplementationOnce(async () => undefined);
  const pending = f.controller.load('a.mp4'); await Promise.resolve(); f.controller.statusChanged('readyToPlay'); await pending;
  f.controller.sourceChanged('a.mp4'); expect(f.player.play).not.toHaveBeenCalled();
  f.controller.statusChanged('readyToPlay'); expect(f.player.play).toHaveBeenCalledTimes(1);
});
it.each(['metadata-first', 'source-first'])('supports native ready-before-source with matching metadata (%s)', async order => {
  const f = fixture(true); f.player.replaceAsync.mockImplementationOnce(async () => undefined);
  await f.controller.load('a.mp4'); f.controller.statusChanged('readyToPlay');
  if (order === 'metadata-first') { f.controller.sourceLoaded('a.mp4'); f.controller.sourceChanged('a.mp4'); }
  else { f.controller.sourceChanged('a.mp4'); expect(f.player.play).not.toHaveBeenCalled(); f.controller.sourceLoaded('a.mp4'); }
  expect(f.player.play).toHaveBeenCalledTimes(1);
});
it('does not mark a newly requested native source failed from an unconfirmed old error event', async () => {
  const f = fixture(true); const loading = deferred(); f.player.replaceAsync.mockReturnValueOnce(loading.promise);
  const pending = f.controller.load('a.mp4'); await Promise.resolve(); f.controller.statusChanged('error', { message: 'Old item error' });
  expect(f.onError).not.toHaveBeenCalled(); f.controller.sourceChanged('a.mp4'); f.controller.statusChanged('readyToPlay'); loading.resolve(); await pending;
  expect(f.player.play).toHaveBeenCalledTimes(1);
});
it('does not treat native metadata as buffering-ready or accept old source metadata', async () => {
  const f = fixture(true); f.player.replaceAsync.mockImplementationOnce(async () => undefined);
  await f.controller.load('a.mp4'); f.controller.sourceChanged('a.mp4'); f.controller.sourceLoaded('a.mp4');
  expect(f.player.play).not.toHaveBeenCalled();
  f.controller.statusChanged('loading'); f.controller.sourceLoaded('old.mp4'); expect(f.player.play).not.toHaveBeenCalled();
});
it('allows one explicit mute retry after a refused start without inventing playback', async () => {
  const f = fixture(); await f.controller.load('a.mp4');
  // Autoplay refusal has no real playing event; the public SDK play method remains void.
  expect(f.onPlaybackChange.mock.calls.every((call: unknown[]) => call[0] === false)).toBe(true);
  f.controller.retryPlay(); f.controller.requestPlay();
  expect(f.player.play).toHaveBeenCalledTimes(2);
  expect(f.onPlaybackChange.mock.calls.every((call: unknown[]) => call[0] === false)).toBe(true);
});
it('does not restart actual playback to change mute or retry an offscreen request', async () => {
  const f = fixture(); await f.controller.load('a.mp4'); f.controller.playingChanged(true); f.controller.retryPlay();
  expect(f.player.play).toHaveBeenCalledTimes(1); f.controller.pause(); f.allowed(false); f.controller.retryPlay();
  expect(f.player.play).toHaveBeenCalledTimes(1);
});
it('reports a delayed web media error before source metadata or sourceChange can load', async () => {
  const f = fixture(); f.player.status = 'loading'; f.player.replaceAsync.mockImplementationOnce(async () => undefined);
  await f.controller.load('a.mp4'); f.controller.statusChanged('error', { message: 'Unsupported media' });
  expect(f.onError).toHaveBeenCalledTimes(1); expect(f.onPlaybackChange).toHaveBeenLastCalledWith(false, null);
  expect(f.player.play).not.toHaveBeenCalled();
});
