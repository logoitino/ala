import type { User } from '@supabase/supabase-js';

import { authFailureMessage, isNewAuthUser, passwordMeetsPolicy } from '@/lib/auth';

function fakeUser(overrides: Partial<Pick<User, 'created_at' | 'last_sign_in_at'>>): User {
  return {
    created_at: '2026-01-01T00:00:00.000Z',
    last_sign_in_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as User;
}

describe('isNewAuthUser', () => {
  it('is true when created_at and last_sign_in_at land in the same instant (brand-new account)', () => {
    expect(
      isNewAuthUser(
        fakeUser({ created_at: '2026-01-01T00:00:00.000Z', last_sign_in_at: '2026-01-01T00:00:00.000Z' }),
      ),
    ).toBe(true);
  });

  it('is true within the 10s creation-window tolerance', () => {
    expect(
      isNewAuthUser(
        fakeUser({ created_at: '2026-01-01T00:00:00.000Z', last_sign_in_at: '2026-01-01T00:00:09.000Z' }),
      ),
    ).toBe(true);
  });

  it('is false once last_sign_in_at has diverged past the tolerance (a returning user)', () => {
    expect(
      isNewAuthUser(
        fakeUser({ created_at: '2026-01-01T00:00:00.000Z', last_sign_in_at: '2026-01-02T00:00:00.000Z' }),
      ),
    ).toBe(false);
  });

  it('is false for a very old account signing in today', () => {
    expect(
      isNewAuthUser(
        fakeUser({ created_at: '2020-01-01T00:00:00.000Z', last_sign_in_at: '2026-01-01T00:00:00.000Z' }),
      ),
    ).toBe(false);
  });

  it('never blocks retroactively: false whenever last_sign_in_at is missing', () => {
    expect(isNewAuthUser(fakeUser({ created_at: '2026-01-01T00:00:00.000Z', last_sign_in_at: undefined }))).toBe(
      false,
    );
  });

  it('rejects a short password and accepts eight characters', () => {
    expect(passwordMeetsPolicy('short')).toBe(false);
    expect(passwordMeetsPolicy('12345678')).toBe(true);
  });

  it('names a disabled Google provider instead of the raw validation code', () => {
    expect(authFailureMessage('provider is not enabled', 'google')).toMatch(/Google sign-in is turned off/);
    expect(authFailureMessage('User already registered', 'signup')).toMatch(/Sign in instead/);
  });

  it('is false on malformed date strings rather than throwing', () => {
    expect(isNewAuthUser(fakeUser({ created_at: 'not-a-date', last_sign_in_at: 'also-not-a-date' }))).toBe(
      false,
    );
  });
});
