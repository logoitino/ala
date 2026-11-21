/** Only explicitly scoped session publications are guarded; ordinary Auth storage remains compatible. */
export type AuthStorage = {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
};

function tokenOf(value: string | null): string | null {
  if (!value) return null;
  try {
    const token: unknown = JSON.parse(value)?.access_token;
    return typeof token === 'string' ? token : null;
  } catch { return null; }
}

/** Tokens and lifetime checks live in memory only, for the duration of the public Auth operation. */
export function createAuthPublicationScope() {
  const scopes = new Map<string, () => void>();
  let writes: Promise<void> = Promise.resolve();
  const assertToken = (token: string | null | undefined) => { if (token) scopes.get(token)?.(); };
  const isCurrent = (token: string | null | undefined) => {
    try { assertToken(token); return true; } catch { return false; }
  };
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const next = writes.then(work);
    writes = next.then(() => undefined, () => undefined);
    return next;
  };
  return {
    isCurrent,
    assertValue(value: string | null) { assertToken(tokenOf(value)); },
    async run<T>(token: string, assertCurrent: () => void, work: () => Promise<T>): Promise<T> {
      assertCurrent();
      if (scopes.has(token)) throw new Error('This session publication is already in progress.');
      scopes.set(token, assertCurrent);
      try { const result = await work(); assertCurrent(); return result; } finally { scopes.delete(token); }
    },
    /** Prevent scoped validation failures from reaching GoTrue's unowned session-removal branch. */
    wrapFetch(request: typeof fetch): typeof fetch {
      return async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const headers = new Headers(init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined));
        const token = headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
        const validation = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase() === 'GET'
          && new URL(url).pathname.endsWith('/auth/v1/user');
        const guard = validation && token ? scopes.get(token) : undefined;
        guard?.();
        const response = await request(input, init);
        guard?.();
        // Even a current scope must not feed a SessionMissing error into the mutable global Auth client.
        // SDK error parsing awaits the body and can outlive this account. Ordinary Auth requests pass through.
        if (guard && !response.ok) throw new Error('Could not validate the verified session. Sign in again to continue.');
        return response;
      };
    },
    wrapStorage(storage: AuthStorage): AuthStorage {
      return {
        async getItem(key) {
          const value = await storage.getItem(key);
          return isCurrent(tokenOf(value)) ? value : null;
        },
        setItem(key, value) {
          return serialize(async () => {
            const token = tokenOf(value);
            assertToken(token);
            const prior = await storage.getItem(key);
            assertToken(token);
            await storage.setItem(key, value);
            try { assertToken(token); } catch (error) {
              // An external writer may already have installed another session. Never replace that value.
              if (await storage.getItem(key) === value) {
                if (prior === null) await storage.removeItem(key);
                else await storage.setItem(key, prior);
              }
              throw error;
            }
          });
        },
        removeItem(key) { return serialize(async () => { await storage.removeItem(key); }); },
      };
    },
  };
}
