// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · test cases from apps/mobile/src/frontend/lib/__tests__/verification.test.ts, covering fetchPlayerVerified.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

  it('treats an unknown verification check as held', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(fetchPlayerVerified('p1')).resolves.toBe(true);
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(fetchPlayerVerified('p1')).resolves.toBe(false);
    await expect(fetchPlayerVerified(null)).resolves.toBe(false);
  });

