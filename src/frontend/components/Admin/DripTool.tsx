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
} from '@/components/Admin/AdminChrome';
import { DRIP_CATEGORY_LABELS, DRIP_FILTERS, dripPriceLabel, type DripCategory } from '@/data/shop';
import {
  centsFromDollarsInput,
  dollarsInputFromCents,
  fetchAdminShopProducts,
  slugify,
  upsertShopProduct,
} from '@/lib/adminCatalog';
import type { ShopProduct } from '@/types/database';

const empty: ShopProduct = {
  id: '',
  name: '',
  category: 'apparel',
  price_cents: 0,
  blurb: '',
  has_sizes: true,
  inventory: 0,
  icon: 'shirt',
  is_active: true,
  sort_order: 100,
};

type RackFilter = 'all' | 'live' | 'hidden' | 'low';

const ICONS: { id: ShopProduct['icon']; label: string }[] = [
  { id: 'shirt', label: 'Apparel' },
  { id: 'sparkles', label: 'Aura card' },
  { id: 'basketball', label: 'Merch' },
];

/**
 * @purpose Drip marketplace desk: dollars, category chips, stock, hide/show.
 * @sideEffects `shop_products` UPSERT.
 */
export function DripTool() {
  const router = useRouter();
  const [rows, setRows] = useState<ShopProduct[]>([]);
  const [form, setForm] = useState<ShopProduct>(empty);
  const [price, setPrice] = useState('0.00');
  const [filter, setFilter] = useState<RackFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchAdminShopProducts());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load Drip.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const visible = useMemo(() => {
    if (filter === 'live') return rows.filter((row) => row.is_active !== false);
    if (filter === 'hidden') return rows.filter((row) => row.is_active === false);
    if (filter === 'low') return rows.filter((row) => row.is_active !== false && row.inventory < 8);
    return rows;
  }, [filter, rows]);

  const fill = (row: ShopProduct) => {
    setForm(row);
    setPrice(dollarsInputFromCents(row.price_cents));
  };

  const save = async (row: ShopProduct, nextPrice = price) => {
    setBusy(true);
    setMessage(null);
    try {
      await upsertShopProduct({
        ...row,
        id: row.id || slugify(row.name),
        price_cents: centsFromDollarsInput(nextPrice),
      });
      setForm(empty);
      setPrice('0.00');
      setMessage(row.is_active === false ? 'Hidden from Drip.' : 'On the Drip tab.');
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not save this item.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Drip"
      lede="This catalog is the production marketplace. Price in dollars. Hide an item to pull it off the rack."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminBtn label="View Drip tab" onPress={() => router.push('/drip' as Href)} />
      <AdminPills
        label="Rack"
        items={[
          { id: 'all', label: 'All' },
          { id: 'live', label: 'On Drip' },
          { id: 'low', label: 'Low stock' },
          { id: 'hidden', label: 'Hidden' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <AdminPanel title={form.id ? 'Edit item' : 'New item'}>
        <AdminField label="Name" value={form.name} onChangeText={(name) => setForm((c) => ({ ...c, name }))} placeholder="Hawks Booster Hoodie" />
        <AdminField label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="54.00" />
        <AdminPills
          label="Category"
          items={DRIP_FILTERS.filter((item) => item.id !== 'all').map((item) => ({
            id: item.id as DripCategory,
            label: item.label,
          }))}
          value={form.category as DripCategory}
          onChange={(category) =>
            setForm((c) => ({
              ...c,
              category,
              icon: category === 'aura_cards' ? 'sparkles' : category === 'merch' ? 'basketball' : 'shirt',
            }))
          }
        />
        <AdminField label="Blurb" value={form.blurb} onChangeText={(blurb) => setForm((c) => ({ ...c, blurb }))} multiline />
        <AdminField
          label="Inventory"
          value={String(form.inventory)}
          onChangeText={(inventory) => setForm((c) => ({ ...c, inventory: Number(inventory) || 0 }))}
          keyboardType="number-pad"
        />
        <AdminPills
          label="Sizes"
          items={[
            { id: 'yes', label: 'Has sizes' },
            { id: 'no', label: 'One size' },
          ]}
          value={form.has_sizes ? 'yes' : 'no'}
          onChange={(id) => setForm((c) => ({ ...c, has_sizes: id === 'yes' }))}
        />
        <AdminPills label="Icon" items={ICONS} value={form.icon} onChange={(icon) => setForm((c) => ({ ...c, icon }))} />
        <AdminBtn
          label={busy ? 'Saving…' : 'Save item'}
          kind="primary"
          disabled={busy}
          onPress={() => void save({ ...form, is_active: form.id ? form.is_active : true })}
        />
        {form.id ? <AdminBtn label="Clear form" onPress={() => { setForm(empty); setPrice('0.00'); }} /> : null}
        <AdminNotice text={message} />
      </AdminPanel>
      {visible.length === 0 ? (
        <AdminEmpty text="Nothing in this rack." />
      ) : (
        visible.map((row) => (
          <AdminRow
            key={row.id}
            title={row.name}
            meta={`${dripPriceLabel(row.price_cents)} · ${DRIP_CATEGORY_LABELS[row.category as DripCategory] ?? row.category} · ${row.inventory} in stock${row.inventory < 8 && row.is_active ? ' · Low' : ''} · ${row.is_active ? 'On Drip' : 'Hidden'}`}
          >
            <AdminBtn label="Edit" onPress={() => fill(row)} />
            <AdminBtn
              label={row.is_active ? 'Hide' : 'Show'}
              onPress={() => void save({ ...row, is_active: !row.is_active }, dollarsInputFromCents(row.price_cents))}
            />
          </AdminRow>
        ))
      )}
    </AdminPage>
  );
}
