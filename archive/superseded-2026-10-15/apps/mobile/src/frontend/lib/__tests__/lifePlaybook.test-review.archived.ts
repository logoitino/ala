// ARCHIVED 2026-10-15 · QUIZ-04 owner simplification · owner approved · excerpt from apps/mobile/src/frontend/lib/__tests__/lifePlaybook.test.ts (lifePlaybook sign-off / reviewer adapter tests).
// Not built, tested or imported. Restore: restore with the archived lib wrappers.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

  it('sends settings, chapter, sign-off and reviewer writes with the reason and expected actor', async () => {
    mockClient.response = { contract_version: 4, life_enabled: true, level_thresholds: th };
    await life.saveLifeSettings({ life_enabled: true, level_thresholds: th }, 'Turn Life on for testers.', profile);
    expect(mockClient.calls[0]).toEqual({ fn: 'quiz_admin_life_settings', args: { p_payload: { life_enabled: true, level_thresholds: th }, p_reason: 'Turn Life on for testers.', p_expected_actor_id: profile } });
    mockClient.response = { contract_version: 4, chapter: 'credit_clock', ...chapterState, switched_open: false };
    await life.setLifeChapterOpen('credit_clock', false, 'Close for review.', profile);
    expect(mockClient.calls[1].args).toEqual({ p_chapter: 'credit_clock', p_open: false, p_reason: 'Close for review.', p_expected_actor_id: profile });
    const so = { contract_version: 4, id: '1', chapter: 'credit_clock', signed_by_name: 'Pat Example, CPA', signed_on: '2026-10-01', note: null, recorded_by: profile, recorded_at: now,
      confirmed_by: null, confirmed_at: null, expires_on: '2027-10-01', covers_count: 20, current: false };
    mockClient.response = so;
    expect((await life.recordLifeSignoff({ chapter: 'credit_clock', signed_by_name: 'Pat Example, CPA', signed_on: '2026-10-01', note: null }, 'Signed letter on file.', profile)).current).toBe(false);
    await expect(life.confirmLifeSignoff('1', 'Second admin checked the letter.', profile)).rejects.toThrow(/unavailable/i);
    mockClient.response = { ...so, current: true, confirmed_by: request, confirmed_at: now };
    expect((await life.confirmLifeSignoff('1', 'Second admin checked the letter.', profile)).current).toBe(true);
    expect(mockClient.calls.at(-1)?.args).toEqual({ p_signoff_id: 1, p_reason: 'Second admin checked the letter.', p_expected_actor_id: profile });
    mockClient.response = { ...so, current: true, confirmed_at: null }; await expect(life.confirmLifeSignoff('1', 'x'.repeat(12), profile)).rejects.toThrow(/unavailable/i);
    const grant = { contract_version: 4, id: 'g1', profile_id: request, domain: 'tax', qualification: 'Acting for TAX', granted_by: profile, granted_at: now, expires_at: null, revoked_at: null, revoked_by: null,
      confirmed_by: null, confirmed_at: null, active: false };
    mockClient.response = grant;
    await life.grantLifeReviewer({ profile_id: request, domain: 'tax', qualification: 'Acting for TAX', expires_at: null }, 'Named tax reviewer.', profile);
    expect(mockClient.calls.at(-1)?.args).toEqual({ p_action: 'grant', p_payload: { profile_id: request, domain: 'tax', qualification: 'Acting for TAX', expires_at: null }, p_reason: 'Named tax reviewer.', p_expected_actor_id: profile });
    await expect(life.confirmLifeReviewer('g1', 'Second admin confirms TAX.', profile)).rejects.toThrow(/unavailable/i);
    mockClient.response = { ...grant, confirmed_by: group2, confirmed_at: now, active: true };
    expect((await life.confirmLifeReviewer('g1', 'Second admin confirms TAX.', profile)).active).toBe(true);
    expect(mockClient.calls.at(-1)?.args).toEqual({ p_action: 'confirm', p_payload: { grant_id: 'g1' }, p_reason: 'Second admin confirms TAX.', p_expected_actor_id: profile });
    await expect(life.revokeLifeReviewer('g1', 'Stepped down from TAX.', profile)).rejects.toThrow(/unavailable/i);
    mockClient.response = { ...grant, active: false, revoked_at: now, revoked_by: profile };
    expect((await life.revokeLifeReviewer('g1', 'Stepped down from TAX.', profile)).active).toBe(false);
  });
});
