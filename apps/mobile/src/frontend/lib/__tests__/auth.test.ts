import type { User } from '@supabase/supabase-js';

import {
  authFailureMessage,
  demoSignInShouldCreate,
  isNewAuthUser,
  oauthAuthorizeFailure,
  passwordMeetsPolicy,
  signUpBirthProblem,
  softWallEmailGates,
} from '@/lib/auth';

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

  it('keeps a disabled Google authorize response in the sheet', () => {
    const body = '{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}';
    expect(oauthAuthorizeFailure(400, body, 'google')).toMatch(/Google sign-in is turned off/);
    expect(oauthAuthorizeFailure(302, '', 'google')).toBeNull();
  });

  it('is false on malformed date strings rather than throwing', () => {
    expect(isNewAuthUser(fakeUser({ created_at: 'not-a-date', last_sign_in_at: 'also-not-a-date' }))).toBe(
      false,
    );
  });
});

describe('demoSignInShouldCreate', () => {
  it('tries to create the test account when the server does not recognize it', () => {
    expect(demoSignInShouldCreate('Invalid login credentials', 'invalid_credentials')).toBe(true);
    expect(demoSignInShouldCreate('Invalid credentials')).toBe(true);
    expect(demoSignInShouldCreate('Email not confirmed')).toBe(true);
  });

  it('does not treat a rate limit as a missing account', () => {
    expect(demoSignInShouldCreate('Email rate limit exceeded', 'over_request_rate_limit')).toBe(false);
  });
});

describe('softWallEmailGates', () => {
  const adult = { year: 1990, month: 4 };
  it('never blocks retroactively: Sign in is enabled without a birth month', () => {
    const gates = softWallEmailGates('returning@family.com', 'hunter2password', null);
    expect(gates.canSignIn).toBe(true);
  });

  it('gates Create account and magic link on a complete birth month and year (MINOR-01)', () => {
    const missing = softWallEmailGates('new@family.com', 'hunter2password', null);
    expect(missing.canCreate).toBe(false);
    expect(missing.canMagic).toBe(false);

    const given = softWallEmailGates('new@family.com', 'hunter2password', adult);
    expect(given.canCreate).toBe(true);
    expect(given.canMagic).toBe(true);
  });

  it('keeps the button live for an under-13 date, so the form never hints at the age that works', () => {
    const kid = { year: new Date().getFullYear() - 9, month: 1 };
    expect(softWallEmailGates('new@family.com', 'hunter2password', kid).canCreate).toBe(true);
    expect(signUpBirthProblem(kid)).toBe("We can't create your account right now.");
    expect(signUpBirthProblem(adult)).toBeNull();
    expect(signUpBirthProblem({ year: new Date().getFullYear() + 1, month: 1 })).toBe('Check your birth month and year.');
  });

  it('holds Create account to the password policy but lets a short existing password sign in', () => {
    const gates = softWallEmailGates('returning@family.com', 'short', { year: 1990, month: 4 });
    expect(gates.canCreate).toBe(false);
    expect(gates.canSignIn).toBe(true);
  });

  it('needs an email for every path, and a password for the two password paths', () => {
    expect(softWallEmailGates('   ', 'hunter2password', { year: 1990, month: 4 })).toEqual({
      canSignIn: false,
      canCreate: false,
      canMagic: false,
    });
    const noPassword = softWallEmailGates('fan@family.com', '', { year: 1990, month: 4 });
    expect(noPassword.canSignIn).toBe(false);
    expect(noPassword.canCreate).toBe(false);
    expect(noPassword.canMagic).toBe(true);
  });
});
