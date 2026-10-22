/**
 * The soft wall gates every Donate / Join Crew / gear goal / Upload tap for guests: a signed-in action runs at once,
 * a guest's action waits behind sign-in and runs exactly once afterwards — never before a new account's 13+
 * confirmation — and cancelling the sheet drops it.
 */
import { act, render } from '@testing-library/react-native';
import { SoftWallProvider, useSoftWall } from '@/context/SoftWallContext';

type MockAuth = { isGuest: boolean; session: object | null; loading: boolean; needsAgeConfirmation: boolean };
let mockAuth: MockAuth;
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));

let wall: ReturnType<typeof useSoftWall>;
function Probe() {
  wall = useSoftWall();
  return null;
}

const guest: MockAuth = { isGuest: true, session: null, loading: false, needsAgeConfirmation: false };
const signedIn: MockAuth = { isGuest: false, session: { user: { id: 'u1' } }, loading: false, needsAgeConfirmation: false };

async function mount(auth: MockAuth) {
  mockAuth = auth;
  const view = await render(<SoftWallProvider><Probe /></SoftWallProvider>);
  return {
    becomes: async (next: MockAuth) => {
      mockAuth = next;
      await view.rerender(<SoftWallProvider><Probe /></SoftWallProvider>);
    },
  };
}

beforeEach(() => {
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});
afterEach(() => jest.restoreAllMocks());

describe('soft wall', () => {
  it('runs a signed-in action immediately without the sheet', async () => {
    await mount(signedIn);
    const resume = jest.fn();
    await act(async () => wall.requireAuth({ kind: 'malo', athleteId: 'p1', resume }));
    expect(resume).toHaveBeenCalledTimes(1);
    expect(wall.visible).toBe(false);
  });

  it('does nothing while auth is still loading', async () => {
    await mount({ ...guest, loading: true });
    const resume = jest.fn();
    await act(async () => wall.requireAuth({ kind: 'malo', resume }));
    expect(resume).not.toHaveBeenCalled();
    expect(wall.visible).toBe(false);
  });

  it("holds a guest's donation behind sign-in, then closes the sheet and runs it exactly once", async () => {
    const auth = await mount(guest);
    const resume = jest.fn();
    await act(async () => wall.requireAuth({ kind: 'malo', athleteName: 'Mele', athleteId: 'p1', resume }));
    expect(wall.visible).toBe(true);
    expect(wall.intent?.kind).toBe('malo');
    expect(resume).not.toHaveBeenCalled();

    await auth.becomes(signedIn);
    expect(wall.visible).toBe(false);
    expect(resume).toHaveBeenCalledTimes(1);

    await auth.becomes({ ...signedIn, session: { user: { id: 'u1' }, refreshed: true } });
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("waits for a new account's age confirmation before releasing the action", async () => {
    const auth = await mount(guest);
    const resume = jest.fn();
    await act(async () => wall.requireAuth({ kind: 'crew', resume }));

    await auth.becomes({ ...signedIn, needsAgeConfirmation: true });
    expect(wall.visible).toBe(false);
    expect(resume).not.toHaveBeenCalled();

    await auth.becomes(signedIn);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('drops the action when the guest closes the sheet, even if they sign in later', async () => {
    const auth = await mount(guest);
    const resume = jest.fn();
    await act(async () => wall.requireAuth({ kind: 'wishlist', resume }));
    await act(async () => wall.close());
    expect(wall.visible).toBe(false);

    await auth.becomes(signedIn);
    expect(resume).not.toHaveBeenCalled();
  });

  it('asks the sheet to present again on every request', async () => {
    await mount(guest);
    await act(async () => wall.requireAuth({ kind: 'upload', resume: jest.fn() }));
    const first = wall.presentId;
    await act(async () => wall.requireAuth({ kind: 'upload', resume: jest.fn() }));
    expect(wall.presentId).toBe(first + 1);
  });
});
