/** App-wide field lines follow the viewer: an athlete's own sport, the generic field for everyone else. */
import { renderHook } from '@testing-library/react-native';

let mockAuth: { isAthlete: boolean; profile: { athlete_sport?: string | null } | null } | null = null;
jest.mock('@/context/AuthContext', () => ({ useOptionalAuth: () => mockAuth }));

import { useViewerSport } from '@/hooks/useViewerSport';

describe('useViewerSport', () => {
  it("uses an athlete's own sport", async () => {
    mockAuth = { isAthlete: true, profile: { athlete_sport: ' Rugby ' } };
    const { result } = await renderHook(() => useViewerSport());
    expect(result.current).toBe('Rugby');
  });

  it('gives fans, parents and athletes without a sport the generic field', async () => {
    mockAuth = { isAthlete: false, profile: { athlete_sport: 'Football' } };
    expect((await renderHook(() => useViewerSport())).result.current).toBeNull();
    mockAuth = { isAthlete: true, profile: { athlete_sport: '' } };
    expect((await renderHook(() => useViewerSport())).result.current).toBeNull();
  });

  it('never throws outside AuthProvider', async () => {
    mockAuth = null;
    expect((await renderHook(() => useViewerSport())).result.current).toBeNull();
  });
});
