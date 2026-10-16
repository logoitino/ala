/** QUIZ-04 fun presentation: the phone cue map (haptics only, silent when Sound is off) and the browser synth
 * (no-op without Web Audio, silent before a gesture, plays after one). */
import * as Haptics from 'expo-haptics';

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(async () => {}), notificationAsync: jest.fn(async () => {}),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' }, NotificationFeedbackType: { Success: 'success' },
}));

type WebSound = typeof import('../quizSound.web');
/** A fresh copy of the web module per test (its context and gesture flag are module state). */
function freshWeb(): WebSound {
    let mod!: WebSound;
    jest.isolateModules(() => { mod = require('../quizSound.web'); });
    return mod;
}
/** A fake window that records gesture listeners so a test can "tap" the page. */
function fakeWindow() {
    const listeners: Record<string, () => void> = {};
    const win = { addEventListener: jest.fn((name: string, fn: () => void) => { listeners[name] = fn; }), removeEventListener: jest.fn() };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
    return { win, tap: () => listeners.pointerdown?.() };
}
const param = () => ({ value: 0, setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() });
function fakeAudio() {
    const oscillators: { start: jest.Mock }[] = [];
    class FakeContext {
        state = 'running'; currentTime = 0; destination = {};
        createGain() { return { gain: param(), connect: jest.fn() }; }
        createOscillator() { const o = { type: 'sine', frequency: param(), connect: jest.fn(), start: jest.fn(), stop: jest.fn() }; oscillators.push(o); return o; }
        resume() { return Promise.resolve(); }
    }
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FakeContext });
    return oscillators;
}
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
afterEach(() => {
    jest.clearAllMocks();
    Reflect.deleteProperty(globalThis, 'AudioContext');
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
});

describe('phones (haptics only)', () => {
    const { playQuizCue, armQuizSound } = require('../quizSound') as typeof import('../quizSound');
    it('maps each cue to a gentle haptic: success for good news, a light tap (never the error buzz) for not quite', () => {
        playQuizCue('correct', true);
        playQuizCue('roundComplete', true);
        playQuizCue('levelUp', true);
        expect(Haptics.notificationAsync).toHaveBeenCalledTimes(3);
        expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
        playQuizCue('notQuite', true);
        playQuizCue('tap', true);
        expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
        playQuizCue('timeUp', true);
        expect(Haptics.impactAsync).toHaveBeenLastCalledWith('medium');
    });
    it('Sound off silences every cue, and a broken haptics engine never throws', () => {
        playQuizCue('correct', false);
        playQuizCue('tap', false);
        expect(Haptics.notificationAsync).not.toHaveBeenCalled();
        expect(Haptics.impactAsync).not.toHaveBeenCalled();
        (Haptics.impactAsync as jest.Mock).mockImplementationOnce(() => { throw Error('no engine'); });
        expect(() => playQuizCue('tap', true)).not.toThrow();
        expect(armQuizSound(true)).toEqual(expect.any(Function));
    });
});

describe('browser (Web Audio synth)', () => {
    it('no-ops safely without AudioContext or window', () => {
        Reflect.deleteProperty(globalThis, 'window');
        const web = freshWeb();
        expect(() => web.armQuizSound(true)()).not.toThrow();
        const { tap } = fakeWindow();
        const dispose = web.armQuizSound(true);
        tap();
        expect(() => web.playQuizCue('correct', true)).not.toThrow();
        expect(() => web.playQuizCue('levelUp', true)).not.toThrow();
        dispose();
    });
    it('never plays before a gesture, plays after one, and stays silent while Sound is off', () => {
        const oscillators = fakeAudio();
        const { win, tap } = fakeWindow();
        const web = freshWeb();
        const dispose = web.armQuizSound(true);
        web.playQuizCue('correct', true);
        expect(oscillators).toHaveLength(0);
        tap();
        web.playQuizCue('correct', true);
        expect(oscillators).toHaveLength(3);
        web.playQuizCue('notQuite', false);
        expect(oscillators).toHaveLength(3);
        dispose();
        expect(win.removeEventListener).toHaveBeenCalled();
    });
    it('with Sound off no gesture listener is added, so no audio context is ever created', () => {
        const oscillators = fakeAudio();
        const { win } = fakeWindow();
        const web = freshWeb();
        web.armQuizSound(false);
        expect(win.addEventListener).not.toHaveBeenCalled();
        web.playQuizCue('tap', true);
        expect(oscillators).toHaveLength(0);
    });
    it('a context that throws on creation (blocked) is a silent no-op', () => {
        Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: class { constructor() { throw Error('blocked'); } } });
        const { tap } = fakeWindow();
        const web = freshWeb();
        web.armQuizSound(true);
        expect(() => tap()).not.toThrow();
        expect(() => web.playQuizCue('roundComplete', true)).not.toThrow();
    });
});
