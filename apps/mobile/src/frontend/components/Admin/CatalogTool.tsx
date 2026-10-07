import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AdminBtn,
  AdminEmpty,
  AdminField,
  AdminFieldRow,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminPublishBar,
  AdminRow,
  AdminSectionTitle,
} from '@/components/Admin/AdminChrome';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import {
  cloneAppRuntime,
  type AppRuntimeCatalog,
  type AppRuntimeCatalogFilter,
  type AppRuntimeCatalogTier,
} from '@/lib/runtime';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Catalogs desk: Mālo amounts, exclusive pass, class years, Local chips, booster tiers, and upload category labels. Draft until Publish to app.
 * @sideEffects `patch_app_runtime_draft` on Save.
 */
export function CatalogTool() {
  const { draft, published, saveDraft } = useAppRuntime();
  const [message, setMessage] = useState<string | null>(null);

  const patch = async (catalog: AppRuntimeCatalog, note: string) => {
    await saveDraft({ ...cloneAppRuntime(draft), catalog });
    setMessage(note);
  };

  const catalog = draft.catalog;
  const live = published.catalog;
  const dirty = JSON.stringify(catalog) !== JSON.stringify(live);

  return (
    <AdminPage
      title="Catalogs"
      lede="Prices and chips fans tap that used to live only in code. Edit here, then Publish to app. Sports scoring still lives on Sports; Drip SKUs still live on Drip."
      saveMode="publish"
    >
      <AdminPublishBar note={dirty ? 'Catalog edits are draft until Publish to app.' : 'Live catalog matches this draft.'} />
      <AdminNotice text={message} />

      <MoneyPane catalog={catalog} onSave={(next) => void patch(next, 'Donation amounts and exclusive prices saved to draft.')} />
      <ClassYearPane catalog={catalog} onSave={(next) => void patch(next, 'Class years saved to draft.')} />
      <FilterPane catalog={catalog} onSave={(next) => void patch(next, 'Local chips saved to draft.')} />
      <TierPane catalog={catalog} onSave={(next) => void patch(next, 'Booster tiers saved to draft.')} />
      <CategoryPane catalog={catalog} onSave={(next) => void patch(next, 'Upload categories saved to draft.')} />
      <AdminEmpty text="Sports playbooks, Drip SKUs, schools, and wishlist gear still save instantly on their own desks." />
    </AdminPage>
  );
}

function MoneyPane({
  catalog,
  onSave,
}: {
  catalog: AppRuntimeCatalog;
  onSave: (next: AppRuntimeCatalog) => void;
}) {
  const [amounts, setAmounts] = useState(catalog.maloAmounts.join(', '));
  const [fee, setFee] = useState(String(catalog.maloFeeDollars));
  const [exclusive, setExclusive] = useState(String(catalog.exclusiveDollars));
  const [aura, setAura] = useState(String(catalog.exclusiveAura));

  return (
    <AdminPanel title="Donations + exclusive">
      <AdminField
        label="Donation presets (dollars, comma-separated)"
        value={amounts}
        onChangeText={setAmounts}
        placeholder="5, 10, 25"
        keyboardType="numbers-and-punctuation"
      />
      <AdminFieldRow>
        <AdminField label="Cover-fee dollars" value={fee} onChangeText={setFee} placeholder="0.50" keyboardType="decimal-pad" />
        <AdminField
          label="Exclusive pass dollars"
          value={exclusive}
          onChangeText={setExclusive}
          placeholder="4.99"
          keyboardType="decimal-pad"
        />
        <AdminField label="Exclusive Aura grant" value={aura} onChangeText={setAura} placeholder="100" keyboardType="number-pad" />
      </AdminFieldRow>
      <AdminBtn
        label="Save prices"
        kind="primary"
        onPress={() =>
          onSave({
            ...catalog,
            maloAmounts: amounts
              .split(/[,\s]+/)
              .map((part) => Number(part))
              .filter((part) => Number.isFinite(part) && part > 0),
            maloFeeDollars: Math.max(0, Number(fee) || 0),
            exclusiveDollars: Math.max(0.5, Number(exclusive) || catalog.exclusiveDollars),
            exclusiveAura: Math.max(0, Math.round(Number(aura) || 0)),
          })
        }
      />
    </AdminPanel>
  );
}

function ClassYearPane({
  catalog,
  onSave,
}: {
  catalog: AppRuntimeCatalog;
  onSave: (next: AppRuntimeCatalog) => void;
}) {
  const [years, setYears] = useState(catalog.classYears.join(', '));
  return (
    <AdminPanel title="Athlete class years">
      <Text style={styles.hint}>Onboarding pills. Write 26 for class of 2026 — the app shows '26.</Text>
      <AdminField label="Years (comma-separated)" value={years} onChangeText={setYears} placeholder="26, 27, 28" />
      <AdminBtn
        label="Save class years"
        kind="primary"
        onPress={() =>
          onSave({
            ...catalog,
            classYears: years
              .split(/[,\s]+/)
              .map((part) => part.replace(/^'+/, '').trim())
              .filter(Boolean),
          })
        }
      />
    </AdminPanel>
  );
}

function FilterPane({
  catalog,
  onSave,
}: {
  catalog: AppRuntimeCatalog;
  onSave: (next: AppRuntimeCatalog) => void;
}) {
  const [rows, setRows] = useState<AppRuntimeCatalogFilter[]>(catalog.localFilters.map((row) => ({ ...row })));
  return (
    <AdminPanel title="Local board chips">
      <Text style={styles.hint}>Keep rivalry as the chip id for the rivalry filter. Other ids should match a Local region (utah-county, salt-lake).</Text>
      {rows.map((row, index) => (
        <View key={`${row.id}-${index}`} style={styles.line}>
          <View style={styles.grow}>
            <AdminField
              label="Chip id"
              value={row.id}
              onChangeText={(id) => setRows((current) => current.map((item, i) => (i === index ? { ...item, id } : item)))}
              placeholder="utah-county"
            />
          </View>
          <View style={styles.grow}>
            <AdminField
              label="Label"
              value={row.label}
              onChangeText={(label) => setRows((current) => current.map((item, i) => (i === index ? { ...item, label } : item)))}
              placeholder="Utah County"
              autoCapitalize="words"
            />
          </View>
          <AdminBtn label="Remove" onPress={() => setRows((current) => current.filter((_, i) => i !== index))} />
        </View>
      ))}
      <AdminBtn label="+ Add chip" onPress={() => setRows((current) => [...current, { id: '', label: '' }])} />
      <AdminBtn label="Save Local chips" kind="primary" onPress={() => onSave({ ...catalog, localFilters: rows.filter((row) => row.id.trim() && row.label.trim()) })} />
    </AdminPanel>
  );
}

function TierPane({
  catalog,
  onSave,
}: {
  catalog: AppRuntimeCatalog;
  onSave: (next: AppRuntimeCatalog) => void;
}) {
  const [rows, setRows] = useState<AppRuntimeCatalogTier[]>(catalog.sponsorTiers.map((row) => ({ ...row })));
  return (
    <AdminPanel title="Booster tiers">
      <Text style={styles.hint}>Silver / Gold / Platinum dollars and Aura. The Boosters desk still adds individual sponsors.</Text>
      {rows.map((row, index) => (
        <View key={row.id} style={styles.stack}>
          <AdminRow title={row.name} meta={`${row.badge} · $${row.dollars} · ${row.auraPoints} Aura`} />
          <View style={styles.line}>
            <View style={styles.grow}>
              <AdminField
                label="Name"
                value={row.name}
                onChangeText={(name) => setRows((current) => current.map((item, i) => (i === index ? { ...item, name } : item)))}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.narrow}>
              <AdminField
                label="Dollars"
                value={String(row.dollars)}
                onChangeText={(value) =>
                  setRows((current) =>
                    current.map((item, i) => (i === index ? { ...item, dollars: Number(value.replace(/[^0-9.]/g, '')) || 0 } : item)),
                  )
                }
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.narrow}>
              <AdminField
                label="Aura"
                value={String(row.auraPoints)}
                onChangeText={(value) =>
                  setRows((current) =>
                    current.map((item, i) => (i === index ? { ...item, auraPoints: Number(value.replace(/[^0-9]/g, '')) || 0 } : item)),
                  )
                }
                keyboardType="number-pad"
              />
            </View>
          </View>
          <AdminField
            label="Perks"
            value={row.perks}
            onChangeText={(perks) => setRows((current) => current.map((item, i) => (i === index ? { ...item, perks } : item)))}
            multiline
            autoCapitalize="sentences"
          />
        </View>
      ))}
      <AdminBtn label="Save booster tiers" kind="primary" onPress={() => onSave({ ...catalog, sponsorTiers: rows })} />
    </AdminPanel>
  );
}

function CategoryPane({
  catalog,
  onSave,
}: {
  catalog: AppRuntimeCatalog;
  onSave: (next: AppRuntimeCatalog) => void;
}) {
  const [rows, setRows] = useState(catalog.reelCategories.map((row) => ({ ...row })));
  return (
    <AdminPanel title="Upload category pills">
      <Text style={styles.hint}>Game Day / Train Like Me / Serve Like Me labels on the + sheet and Highlights desk.</Text>
      {rows.map((row, index) => (
        <AdminField
          key={row.id}
          label={row.id}
          value={row.label}
          onChangeText={(label) => setRows((current) => current.map((item, i) => (i === index ? { ...item, label } : item)))}
          autoCapitalize="words"
        />
      ))}
      <AdminBtn label="Save category labels" kind="primary" onPress={() => onSave({ ...catalog, reelCategories: rows })} />
    </AdminPanel>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  grow: {
    flex: 1,
  },
  narrow: {
    width: 92,
  },
  stack: {
    gap: 6,
    borderLeftWidth: 2,
    borderLeftColor: FOCAL.jadeInk,
    paddingLeft: 10,
  },
});
