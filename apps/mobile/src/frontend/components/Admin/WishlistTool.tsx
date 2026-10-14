import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminField,
  AdminFieldRow,
  AdminMetrics,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminPills,
  AdminRow,
  AdminSectionTitle,
  AdminSuggest,
} from '@/components/Admin/AdminChrome';
import { WISHLIST_CHIP_IN_DOLLARS, WISHLIST_EQUIP_AURA, wishlistProgressPct } from '@/data/wishlist';
import { useRoster } from '@/hooks/useRoster';
import {
  centsFromDollarsInput,
  dollarsInputFromCents,
  fetchAdminWishlist,
  setWishlistItemActive,
  upsertWishlistItem,
  type AdminWishlistRow,
} from '@/lib/adminCatalog';
import { colors } from '@/constants/theme';
import { formatTipDollars } from '@/lib/reels';

type RackFilter = 'all' | 'funding' | 'equipped' | 'hidden';

type GearForm = {
  id: string;
  playerId: string;
  playerQuery: string;
  title: string;
  photoUrl: string;
  buyUrl: string;
  goal: string;
  raised: string;
  sortOrder: string;
};

const EMPTY: GearForm = {
  id: '',
  playerId: '',
  playerQuery: '',
  title: '',
  photoUrl: '',
  buyUrl: '',
  goal: '120.00',
  raised: '0.00',
  sortOrder: '10',
};

/**
 * @purpose Locker Room desk: build the gear cards fans fund on Profile → Stats 📊, and see what each goal has raised.
 * @returns Gear rack with a builder form, funding progress, and the hide / restore control.
 * @sideEffects `wishlist_items` SELECT / INSERT / UPDATE through `adminCatalog`.
 */
export function WishlistTool() {
  const { players } = useRoster();
  const [rows, setRows] = useState<AdminWishlistRow[]>([]);
  const [form, setForm] = useState<GearForm>(EMPTY);
  const [filter, setFilter] = useState<RackFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchAdminWishlist());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the Locker Room rack.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const athleteOptions = useMemo(
    () => players.map((row) => ({ id: row.id, title: row.name, meta: row.school_name })),
    [players],
  );

  const visible = useMemo(() => {
    if (filter === 'funding') return rows.filter((row) => row.is_active !== false && !row.is_equipped);
    if (filter === 'equipped') return rows.filter((row) => row.is_equipped);
    if (filter === 'hidden') return rows.filter((row) => row.is_active === false);
    return rows;
  }, [filter, rows]);

  const raisedCents = rows.reduce((sum, row) => sum + row.current_amount_cents, 0);
  const goalCents = rows.reduce((sum, row) => sum + row.target_amount_cents, 0);

  const fill = (row: AdminWishlistRow) => {
    setForm({
      id: row.id,
      playerId: row.player_id ?? '',
      playerQuery: row.athleteName,
      title: row.title,
      photoUrl: row.photo_url,
      buyUrl: row.buy_url,
      goal: dollarsInputFromCents(row.target_amount_cents),
      raised: dollarsInputFromCents(row.current_amount_cents),
      sortOrder: String(row.sort_order ?? 10),
    });
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await upsertWishlistItem({
        id: form.id || undefined,
        player_id: form.playerId,
        title: form.title,
        photo_url: form.photoUrl,
        buy_url: form.buyUrl,
        target_amount_cents: centsFromDollarsInput(form.goal),
        current_amount_cents: centsFromDollarsInput(form.raised),
        sort_order: Number(form.sortOrder) || 0,
      });
      setForm(EMPTY);
      setMessage('Gear is on the athlete rack.');
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not save this gear goal.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row: AdminWishlistRow) => {
    setBusy(true);
    setMessage(null);
    try {
      await setWishlistItemActive(row.id, row.is_active === false);
      setMessage(row.is_active === false ? `${row.title} is back on the rack.` : `${row.title} is off the rack.`);
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not update this gear goal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Locker Room"
      lede={`Gear goals fans donate to on Profile → Stats 📊. Fans donate $${WISHLIST_CHIP_IN_DOLLARS} a tap; hitting the goal equips the item and pays the athlete +${WISHLIST_EQUIP_AURA} Aura.`}
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminMetrics
        items={[
          { label: 'Gear goals', value: rows.length, hint: `${rows.filter((row) => row.is_active !== false).length} on athlete racks` },
          { label: 'Raised', value: formatTipDollars(raisedCents), hint: `of ${formatTipDollars(goalCents)} asked` },
          { label: 'Equipped', value: rows.filter((row) => row.is_equipped).length, hint: 'Gear goals reached' },
        ]}
      />

      <AdminPanel title={form.id ? 'Edit gear' : 'New gear'}>
        <AdminFieldRow>
          <AdminSuggest
            label="Athlete"
            value={form.playerQuery}
            onChangeText={(playerQuery) => setForm((current) => ({ ...current, playerQuery, playerId: '' }))}
            options={athleteOptions}
            placeholder="Search roster"
            onPick={(option) => setForm((current) => ({ ...current, playerId: option.id, playerQuery: option.title }))}
          />
          <AdminField
            label="Gear"
            value={form.title}
            onChangeText={(title) => setForm((current) => ({ ...current, title }))}
            placeholder="Size 12 turf cleats"
            autoCapitalize="sentences"
          />
        </AdminFieldRow>
        <AdminFieldRow>
          <AdminField
            label="Photo URL"
            value={form.photoUrl}
            onChangeText={(photoUrl) => setForm((current) => ({ ...current, photoUrl }))}
            placeholder="https://…"
          />
          <AdminField
            label="Retailer link (Buy this item for them)"
            value={form.buyUrl}
            onChangeText={(buyUrl) => setForm((current) => ({ ...current, buyUrl }))}
            placeholder="https://…"
          />
        </AdminFieldRow>
        <AdminFieldRow>
          <AdminField label="Goal" value={form.goal} onChangeText={(goal) => setForm((current) => ({ ...current, goal }))} keyboardType="decimal-pad" />
          <AdminField
            label="Already raised"
            value={form.raised}
            onChangeText={(raised) => setForm((current) => ({ ...current, raised }))}
            keyboardType="decimal-pad"
          />
          <AdminField
            label="Rack order"
            value={form.sortOrder}
            onChangeText={(sortOrder) => setForm((current) => ({ ...current, sortOrder }))}
            keyboardType="number-pad"
          />
        </AdminFieldRow>
        <AdminBtn label={busy ? 'Saving…' : 'Save gear'} kind="primary" disabled={busy} onPress={() => void save()} />
        {form.id ? <AdminBtn label="Clear form" onPress={() => setForm(EMPTY)} /> : null}
        <AdminNotice text={message} />
      </AdminPanel>

      <AdminPills
        label="Rack"
        items={[
          { id: 'all', label: 'All' },
          { id: 'funding', label: 'Donations so far' },
          { id: 'equipped', label: 'Equipped' },
          { id: 'hidden', label: 'Hidden' },
        ]}
        value={filter}
        onChange={setFilter}
      />

      <AdminSectionTitle>Gear rack</AdminSectionTitle>
      {visible.length === 0 ? (
        <AdminEmpty text="No gear on this rack yet. Add a goal above and it shows on that athlete's Stats 📊 tab." />
      ) : (
        visible.map((row) => (
          <AdminRow
            key={row.id}
            title={`${row.title}${row.is_equipped ? ' · EQUIPPED ⚡' : ''}`}
            meta={`${row.athleteName}${row.school ? ` · ${row.school}` : ''} · ${formatTipDollars(row.current_amount_cents)} of ${formatTipDollars(row.target_amount_cents)} · ${wishlistProgressPct(row)}%${row.is_active === false ? ' · hidden' : ''}`}
          >
            <AdminBtn label="Edit" onPress={() => fill(row)} />
            <AdminBtn label={row.is_active === false ? 'Show' : 'Hide'} disabled={busy} onPress={() => void toggle(row)} />
          </AdminRow>
        ))
      )}

      <Text style={styles.note}>
        Gear-goal donations run through the same checkout, so every one also lands on the Revenue report.
      </Text>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  note: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
