import { THANKS_MESSAGES, parseDonationsToThank, parseThanksReceived, thanksText } from '@/lib/donationThanks';

jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

describe('donation thank-yous', () => {
  it('offers presets only, and every preset says thank you', () => {
    expect(THANKS_MESSAGES.map((m) => m.key)).toEqual(['malo', 'season', 'gear', 'family', 'work']);
    for (const message of THANKS_MESSAGES) expect(message.text).toMatch(/thank/i);
    expect(thanksText('gear')).toMatch(/gear/);
    expect(thanksText('hey call me')).toBeNull();
  });

  it('parses donations to thank and drops unknown thank keys', () => {
    const rows = parseDonationsToThank([
      { tip_id: 't1', amount_cents: 500, created_at: '2026-09-29T00:00:00Z', fan_name: 'Sina', rally_title: 'Cleats', thanked_key: 'malo' },
      { tip_id: 't2', amount_cents: 1000, thanked_key: 'free text' },
      { amount_cents: 1 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ tipId: 't1', fanName: 'Sina', rallyTitle: 'Cleats', thankedKey: 'malo' });
    expect(rows[1]).toMatchObject({ tipId: 't2', fanName: 'A fan', thankedKey: null });
  });

  it('keeps only received thank-yous with a known preset', () => {
    const rows = parseThanksReceived([
      { tip_id: 't1', player_id: 'p1', athlete_name: 'Kaleo', message_key: 'work', amount_cents: 500 },
      { tip_id: 't2', message_key: 'custom' },
    ]);
    expect(rows).toEqual([expect.objectContaining({ tipId: 't1', athleteName: 'Kaleo', messageKey: 'work' })]);
  });
});
