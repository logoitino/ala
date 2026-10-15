/** QUIZ-04 fun presentation (2026-10-15), browser: short, soft, playful trivia sounds synthesized with the Web
 * Audio API (no sound files, no dependency). Metro uses this file on web instead of `quizSound.ts`.
 * - Nothing plays before the person interacts: the AudioContext is created only after a pointer, touch or key
 *   gesture on the page (browsers block audio until then anyway) and only while Sound is on.
 * - Low volume: one master gain of 0.16. Each cue is under about 0.6 s; the two fanfares are about 1.2 s.
 * - A missing or blocked AudioContext (old browser, autoplay policy, private mode) is a silent no-op.
 * Every cue also has on-screen text, so muting or a blocked context never hides information.
 * @sideEffects Window gesture listeners while armed; one lazily created AudioContext; short oscillator nodes.
 */
import type { QuizCue } from './quizSound.types';

export type { QuizCue } from './quizSound.types';

type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number; slideTo?: number; vibrato?: number };
type AudioContextCtor = new () => AudioContext;

const MASTER_GAIN = 0.16;
const GESTURES = ['pointerdown', 'touchend', 'keydown'] as const;
const FANFARES: readonly QuizCue[] = ['roundComplete', 'levelUp'];

/** Note recipes (seconds from the cue's start). Bright major chimes for good news, a gentle low pair for "not quite". */
const CUES: Record<QuizCue, Note[]> = {
    // A soft click: a very short triangle blip that slides down.
    tap: [{ freq: 880, slideTo: 620, at: 0, dur: 0.05, type: 'triangle', gain: 0.5 }],
    // C–E–G chime.
    correct: [
        { freq: 523.25, at: 0, dur: 0.14, type: 'triangle' },
        { freq: 659.25, at: 0.09, dur: 0.14, type: 'triangle' },
        { freq: 783.99, at: 0.18, dur: 0.3, type: 'triangle' },
    ],
    // "Boop-bop": two soft sine notes stepping down a third. Friendly, never a buzzer.
    notQuite: [
        { freq: 392, at: 0, dur: 0.16, type: 'sine', gain: 0.8 },
        { freq: 329.63, at: 0.17, dur: 0.22, type: 'sine', gain: 0.8 },
    ],
    // A referee-style double toot: high sine with a little warble.
    timeUp: [
        { freq: 1760, at: 0, dur: 0.12, type: 'sine', gain: 0.35, vibrato: 40 },
        { freq: 1760, at: 0.17, dur: 0.32, type: 'sine', gain: 0.35, vibrato: 40 },
    ],
    // Mini fanfare: G–C–E rising, landing on a held high C.
    roundComplete: [
        { freq: 392, at: 0, dur: 0.14, type: 'triangle' },
        { freq: 523.25, at: 0.13, dur: 0.14, type: 'triangle' },
        { freq: 659.25, at: 0.26, dur: 0.14, type: 'triangle' },
        { freq: 1046.5, at: 0.4, dur: 0.6, type: 'triangle' },
        { freq: 783.99, at: 0.4, dur: 0.6, type: 'sine', gain: 0.5 },
    ],
    // Bigger fanfare: C–E–G–C, a short pickup, then a held major chord.
    levelUp: [
        { freq: 523.25, at: 0, dur: 0.12, type: 'triangle' },
        { freq: 659.25, at: 0.11, dur: 0.12, type: 'triangle' },
        { freq: 783.99, at: 0.22, dur: 0.12, type: 'triangle' },
        { freq: 1046.5, at: 0.33, dur: 0.18, type: 'triangle' },
        { freq: 783.99, at: 0.55, dur: 0.1, type: 'triangle' },
        { freq: 1046.5, at: 0.68, dur: 0.5, type: 'triangle' },
        { freq: 659.25, at: 0.68, dur: 0.5, type: 'sine', gain: 0.5 },
        { freq: 523.25, at: 0.68, dur: 0.5, type: 'sine', gain: 0.4 },
    ],
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let interacted = false;
/** When the current fanfare ends (context time), so a level-up fanfare waits for the round fanfare. */
let fanfareEnd = 0;

function audioContextCtor(): AudioContextCtor | null {
    const g = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
    return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** Create (or wake) the shared context. Only called after a gesture, so the browser allows it. */
function ensureContext(): AudioContext | null {
    try {
        if (!ctx) {
            const Ctor = audioContextCtor();
            if (!Ctor) return null;
            ctx = new Ctor();
            master = ctx.createGain();
            master.gain.value = MASTER_GAIN;
            master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
        return ctx.state === 'closed' ? null : ctx;
    } catch {
        // Blocked by policy or unsupported: stay silent for this page.
        ctx = null;
        master = null;
        return null;
    }
}

function schedule(context: AudioContext, out: GainNode, note: Note, start: number): void {
    const t0 = start + note.at;
    const t1 = t0 + note.dur;
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = note.type ?? 'sine';
    osc.frequency.setValueAtTime(note.freq, t0);
    if (note.slideTo) osc.frequency.exponentialRampToValueAtTime(note.slideTo, t1);
    // Soft attack and an exponential tail so nothing clicks or blares.
    const peak = note.gain ?? 1;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(env);
    env.connect(out);
    if (note.vibrato) {
        const lfo = context.createOscillator();
        const depth = context.createGain();
        lfo.frequency.value = 28;
        depth.gain.value = note.vibrato;
        lfo.connect(depth);
        depth.connect(osc.frequency);
        lfo.start(t0);
        lfo.stop(t1 + 0.02);
    }
    osc.start(t0);
    osc.stop(t1 + 0.02);
}

/** @purpose While Sound is on, listen for the person's first (and later) gestures to unlock / wake audio.
 * Returns the cleanup; with Sound off nothing is listened to and no context is created. */
export function armQuizSound(enabled: boolean): () => void {
    const w = typeof window !== 'undefined' ? window : null;
    if (!enabled || !w || typeof w.addEventListener !== 'function') return () => {};
    const unlock = () => {
        interacted = true;
        ensureContext();
    };
    for (const name of GESTURES) w.addEventListener(name, unlock, { capture: true, passive: true });
    return () => { for (const name of GESTURES) w.removeEventListener(name, unlock, { capture: true }); };
}

/** @purpose Play one cue. Silent when Sound is off, before any gesture, or without Web Audio. Never throws. */
export function playQuizCue(cue: QuizCue, enabled: boolean): void {
    if (!enabled || !interacted) return;
    try {
        const context = ensureContext();
        if (!context || !master) return;
        const notes = CUES[cue];
        const now = context.currentTime + 0.01;
        const fanfare = FANFARES.includes(cue);
        const start = fanfare ? Math.max(now, fanfareEnd) : now;
        for (const note of notes) schedule(context, master, note, start);
        if (fanfare) fanfareEnd = start + Math.max(...notes.map(n => n.at + n.dur));
    } catch {
        // A context closed mid-cue or a browser quirk: skip this cue, keep the round going.
    }
}

