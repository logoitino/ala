// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · test cases from apps/mobile/src/frontend/data/__tests__/contentRights.test.ts, covering reportHidesNow.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

  it('hides immediately for music, logos, fake footage, impersonation, or the athlete', () => {
    expect(reportHidesNow('rights', false)).toBe(true);
    expect(reportHidesNow('fake_footage', false)).toBe(true);
    expect(reportHidesNow('impersonation', false)).toBe(true);
    expect(reportHidesNow('other', false)).toBe(false);
    expect(reportHidesNow('other', true)).toBe(true);
  });

