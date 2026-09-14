import { useCallback, useMemo, useState } from 'react';
import { type Href, useFocusEffect, useRouter } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminField,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminPills,
  AdminRow,
  AdminSuggest,
} from '@/components/Admin/AdminChrome';
import { SPONSOR_TIERS, sponsorTierById } from '@/data/sponsorships';
import { formatTeamBadge, type SchoolTeam } from '@/data/teams';
import {
  centsFromDollarsInput,
  dollarsInputFromCents,
  fetchAdminBoosters,
  fetchAdminSchools,
  upsertBooster,
} from '@/lib/adminCatalog';
import { formatTipDollars } from '@/lib/reels';
import type { Sponsorship, SponsorshipTierId } from '@/types/database';

const empty = {
  id: '',
  business_name: '',
  school_team: '',
  logo_url: '',
  tier: 'silver' as SponsorshipTierId,
  amount: '50.00',
  status: 'active',
};

type RailFilter = 'all' | 'active' | 'paused';

/**
 * @purpose Local Top Boosters desk: tier chips fill dollars, school picker, pause/activate.
 * @sideEffects `sponsorships` INSERT / UPDATE.
 */
export function BoostersTool() {
  const router = useRouter();
  const [rows, setRows] = useState<Sponsorship[]>([]);
  const [schools, setSchools] = useState<SchoolTeam[]>([]);
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState<RailFilter>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRows, nextSchools] = await Promise.all([fetchAdminBoosters(), fetchAdminSchools()]);
      setRows(nextRows);
      setSchools(nextSchools);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load boosters.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const schoolOptions = useMemo(
    () => schools.map((row) => ({ id: row.id, title: row.name, meta: formatTeamBadge(row) })),
    [schools],
  );

  const visible = useMemo(() => {
    if (filter === 'active') return rows.filter((row) => (row.status || 'active') === 'active');
    if (filter === 'paused') return rows.filter((row) => row.status === 'paused');
    return rows;
  }, [filter, rows]);

  const applyTier = (tier: SponsorshipTierId) => {
    const pack = sponsorTierById(tier);
    setForm((current) => ({
      ...current,
      tier,
      amount: (pack.dollars).toFixed(2),
    }));
  };

  const save = async (extra?: Partial<Sponsorship> & { amount?: string }) => {
    setBusy(true);
    setMessage(null);
    try {
      const amountCents = extra?.amount_cents ?? centsFromDollarsInput(extra?.amount ?? form.amount);
      const tier = extra?.tier === 'gold' || extra?.tier === 'platinum' ? extra.tier : extra?.tier === 'silver' ? 'silver' : form.tier;
      const pack = sponsorTierById(tier);
      await upsertBooster({
        id: extra?.id ?? (form.id || undefined),
        business_name: extra?.business_name ?? form.business_name,
        school_team: extra?.school_team ?? form.school_team,
        logo_url: extra?.logo_url ?? form.logo_url,
        tier,
        amount_cents: amountCents,
        aura_points: extra?.aura_points ?? pack.auraPoints,
        status: extra?.status ?? form.status,
      });
      if (!extra?.id || extra.id === form.id) setForm(empty);
      setMessage((extra?.status ?? form.status) === 'paused' ? 'Paused. Off Local.' : 'On Local Top Boosters.');
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not save this booster.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Boosters"
      lede="Active boosters appear on Local. Pick a tier to fill the dollar amount, then pause to pull it off the rail."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminBtn label="View Local boosters" onPress={() => router.push('/local' as Href)} />
      <AdminPills
        label="Rail"
        items={[
          { id: 'active', label: 'On Local' },
          { id: 'paused', label: 'Paused' },
          { id: 'all', label: 'All' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <AdminPanel title={form.id ? 'Edit booster' : 'New booster'}>
        <AdminField label="Business" value={form.business_name} onChangeText={(business_name) => setForm((c) => ({ ...c, business_name }))} placeholder="Saratoga Springs Pizza" />
        <AdminSuggest
          label="School"
          value={form.school_team}
          onChangeText={(school_team) => setForm((c) => ({ ...c, school_team }))}
          options={schoolOptions}
          placeholder="Westlake High"
          onPick={(option) => setForm((c) => ({ ...c, school_team: option.title }))}
        />
        <AdminPills
          label="Tier"
          items={SPONSOR_TIERS.map((tier) => ({ id: tier.id, label: `${tier.name} · $${tier.dollars}` }))}
          value={form.tier}
          onChange={applyTier}
        />
        <AdminField label="Amount" value={form.amount} onChangeText={(amount) => setForm((c) => ({ ...c, amount }))} keyboardType="decimal-pad" />
        <AdminField label="Logo URL" value={form.logo_url} onChangeText={(logo_url) => setForm((c) => ({ ...c, logo_url }))} />
        <AdminBtn label={busy ? 'Saving…' : 'Save booster'} kind="primary" disabled={busy} onPress={() => void save({ status: 'active' })} />
        {form.id ? <AdminBtn label="Clear form" onPress={() => setForm(empty)} /> : null}
        <AdminNotice text={message} />
      </AdminPanel>
      {visible.length === 0 ? (
        <AdminEmpty text="No boosters in this rail." />
      ) : (
        visible.map((row) => (
          <AdminRow
            key={row.id}
            title={row.business_name}
            meta={`${row.school_team || 'All schools'} · ${formatTipDollars(row.amount_cents)} · ${row.tier} · ${row.status === 'active' || !row.status ? 'On Local' : 'Paused'}`}
          >
            <AdminBtn
              label="Edit"
              onPress={() =>
                setForm({
                  id: row.id,
                  business_name: row.business_name,
                  school_team: row.school_team,
                  logo_url: row.logo_url,
                  tier: row.tier === 'gold' || row.tier === 'platinum' ? row.tier : 'silver',
                  amount: dollarsInputFromCents(row.amount_cents),
                  status: row.status || 'active',
                })
              }
            />
            <AdminBtn
              label={row.status === 'active' || !row.status ? 'Pause' : 'Activate'}
              onPress={() => void save({ ...row, status: row.status === 'active' || !row.status ? 'paused' : 'active' })}
            />
          </AdminRow>
        ))
      )}
    </AdminPage>
  );
}
