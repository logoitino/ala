import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { colors, radii } from '@/constants/theme';
import {
  HIGHLIGHT_RAIL_ITEMS,
  THEME_PRESETS,
  moveHighlightRailItem,
  type AppRuntimeHighlights,
  type AppRuntimeProfile,
  type AppRuntimeTheme,
  type HighlightRailItem,
} from '@/lib/runtime';
import { FOCAL } from '@/theme/motion';

type LookTab = 'colors' | 'profile' | 'highlights';

/**
 * @purpose Draft brand colors, Profile chrome, and Highlights ⚡ rail. Publish to app ships the look.
 * @sideEffects `patch_app_runtime_draft` on each change.
 */
export function LookTool() {
  const { draft, published, dirty, pendingCount, publishedAt, saveDraft, publishLive, discardDraft } = useAppRuntime();
  const [tab, setTab] = useState<LookTab>('colors');

  const patchTheme = (theme: AppRuntimeTheme) => void saveDraft({ ...draft, theme });
  const patchProfile = (key: keyof AppRuntimeProfile, value: boolean) =>
    void saveDraft({ ...draft, profile: { ...draft.profile, [key]: value } });
  const patchHighlights = (next: Partial<AppRuntimeHighlights>) =>
    void saveDraft({ ...draft, highlights: { ...draft.highlights, ...next } });

  return (
    <AdminPage
      title="Look"
      lede="Brand colors, what sits on Profile, and where Highlights ⚡ buttons live. Draft until Publish to app."
      saveMode="publish"
    >
      <AdminPanel title={dirty ? `${pendingCount} unpublished change${pendingCount === 1 ? '' : 's'}` : 'Live with the fan app'}>
        <Text style={styles.body}>
          {publishedAt ? `Last published ${publishedAt.replace('T', ' ').slice(0, 16)} UTC.` : 'Defaults are Tapua\'i Obsidian / Neon Jade / Electric Gold.'}
        </Text>
        <AdminBtn label={dirty ? 'Publish to app' : 'Already live'} kind="primary" disabled={!dirty} onPress={() => void publishLive()} />
        {dirty ? <AdminBtn label="Discard draft" kind="danger" onPress={() => void discardDraft()} /> : null}
        <AdminNotice text={dirty ? 'Fans still see the previous look until you publish.' : null} tone="warn" />
      </AdminPanel>

      <AdminPills
        label="Desk"
        items={[
          { id: 'colors', label: 'Colors' },
          { id: 'profile', label: 'Profile' },
          { id: 'highlights', label: 'Highlights' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'colors' ? (
        <ColorsPane
          theme={draft.theme}
          live={published.theme}
          onPreset={patchTheme}
          onHex={(key, value) => patchTheme({ ...draft.theme, [key]: value })}
        />
      ) : null}

      {tab === 'profile' ? (
        <View style={styles.group}>
          <Text style={styles.section}>Athlete sheet</Text>
          <Text style={styles.body}>Hide a block for a campaign. Vault still respects the Features Vault switch.</Text>
          <ToggleRow
            title="Trading card"
            meta="3D Aura card at the top of Profile"
            on={draft.profile.showCard}
            live={published.profile.showCard}
            onPress={() => patchProfile('showCard', !draft.profile.showCard)}
          />
          <ToggleRow
            title="Crew counters"
            meta="The Crew ⚡ / Your Squad 🛡️"
            on={draft.profile.showCrew}
            live={published.profile.showCrew}
            onPress={() => patchProfile('showCrew', !draft.profile.showCrew)}
          />
          <ToggleRow
            title="Stats tab"
            meta="Combine + career + game log"
            on={draft.profile.showStats}
            live={published.profile.showStats}
            onPress={() => patchProfile('showStats', !draft.profile.showStats)}
          />
          <ToggleRow
            title="Vault tab"
            meta="Subscriber Vault 🔒 pane"
            on={draft.profile.showVault}
            live={published.profile.showVault}
            onPress={() => patchProfile('showVault', !draft.profile.showVault)}
          />
          <ToggleRow
            title="Actions on top"
            meta="Mālo / Subscribe sit above the card"
            on={draft.profile.actionsOnTop}
            live={published.profile.actionsOnTop}
            onPress={() => patchProfile('actionsOnTop', !draft.profile.actionsOnTop)}
          />
          <ToggleRow
            title="Open on Stats"
            meta="Land on Stats 📊 instead of Highlights ⚡"
            on={draft.profile.statsFirst}
            live={published.profile.statsFirst}
            onPress={() => patchProfile('statsFirst', !draft.profile.statsFirst)}
          />
        </View>
      ) : null}

      {tab === 'highlights' ? (
        <HighlightsPane draft={draft.highlights} live={published.highlights} onPatch={patchHighlights} />
      ) : null}

      <AdminEmpty text="Catalog spelling and stats still save instantly on their own desks." />
    </AdminPage>
  );
}

function ToggleRow({
  title,
  meta,
  on,
  live,
  onPress,
}: {
  title: string;
  meta: string;
  on: boolean;
  live: boolean;
  onPress: () => void;
}) {
  return (
    <AdminRow
      title={title}
      meta={`${meta}${on !== live ? (on ? ' · draft ON, live OFF' : ' · draft OFF, live ON') : live ? ' · live' : ' · live off'}`}
    >
      <AdminBtn label={on ? 'On' : 'Off'} kind={on ? 'primary' : 'danger'} onPress={onPress} />
    </AdminRow>
  );
}

function ColorsPane({
  theme,
  live,
  onPreset,
  onHex,
}: {
  theme: AppRuntimeTheme;
  live: AppRuntimeTheme;
  onPreset: (theme: AppRuntimeTheme) => void;
  onHex: (key: keyof AppRuntimeTheme, value: string) => void;
}) {
  const [draftHex, setDraftHex] = useState(theme);
  useEffect(() => {
    setDraftHex(theme);
  }, [theme]);
  const fields: { key: keyof AppRuntimeTheme; label: string }[] = [
    { key: 'background', label: 'Background' },
    { key: 'surface', label: 'Surface' },
    { key: 'jade', label: 'Accent (jade)' },
    { key: 'gold', label: 'Gold' },
    { key: 'text', label: 'Text' },
  ];
  return (
    <View style={styles.group}>
      <Text style={styles.section}>Presets</Text>
      {THEME_PRESETS.map((preset) => (
        <AdminRow key={preset.id} title={preset.label} meta={preset.hint}>
          <View style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: preset.theme.background, borderColor: preset.theme.jade }]} />
            <View style={[styles.swatch, { backgroundColor: preset.theme.jade }]} />
            <View style={[styles.swatch, { backgroundColor: preset.theme.gold }]} />
          </View>
          <AdminBtn label="Use" kind="primary" onPress={() => onPreset(preset.theme)} />
        </AdminRow>
      ))}
      <Text style={styles.section}>Hex</Text>
      <View style={[styles.preview, { backgroundColor: theme.background, borderColor: theme.jade }]}>
        <Text style={[styles.previewKicker, { color: theme.jade }]}>Highlights ⚡</Text>
        <Text style={[styles.previewTitle, { color: theme.text }]}>Friday night</Text>
        <View style={[styles.previewBtn, { backgroundColor: theme.jade }]}>
          <Text style={[styles.previewBtnLabel, { color: theme.background }]}>Mālo</Text>
        </View>
        <Text style={[styles.previewMeta, { color: theme.gold }]}>Live vs draft {theme.jade !== live.jade ? '· unpublished jade' : '· live'}</Text>
      </View>
      {fields.map((field) => (
        <View key={field.key} style={styles.colorRow}>
          <View style={[styles.swatchLg, { backgroundColor: theme[field.key] }]} />
          <View style={styles.colorField}>
            <AdminField
              label={field.label}
              value={draftHex[field.key]}
              onChangeText={(value) => {
                const next = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
                setDraftHex((current) => ({ ...current, [field.key]: next.toUpperCase() }));
                if (/^#[0-9A-Fa-f]{6}$/.test(next)) onHex(field.key, next.toUpperCase());
              }}
              placeholder="#00E676"
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function HighlightsPane({
  draft,
  live,
  onPatch,
}: {
  draft: AppRuntimeHighlights;
  live: AppRuntimeHighlights;
  onPatch: (next: Partial<AppRuntimeHighlights>) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.section}>Clip overlay</Text>
      <View style={[styles.phone, draft.railSide === 'left' && styles.phoneFlip]}>
        <View style={styles.phoneCopy}>
          <Text style={styles.phoneName}>Athlete</Text>
          {draft.showSchool ? <Text style={styles.phoneMeta}>School</Text> : null}
          {draft.showCaption ? <Text style={styles.phoneMeta}>Caption on the clip</Text> : null}
        </View>
        <View style={styles.phoneRail}>
          {draft.railOrder.map((id) => (
            <Text key={id} style={styles.phoneChip}>
              {HIGHLIGHT_RAIL_ITEMS.find((item) => item.id === id)?.label ?? id}
            </Text>
          ))}
        </View>
      </View>
      <ToggleRow
        title="Rail on the left"
        meta="Seki / Aura / Flex / Mālo / ⋯"
        on={draft.railSide === 'left'}
        live={live.railSide === 'left'}
        onPress={() => onPatch({ railSide: draft.railSide === 'left' ? 'right' : 'left' })}
      />
      <ToggleRow
        title="Name at the top"
        meta="Athlete + caption sit under the status area"
        on={draft.namePlacement === 'top'}
        live={live.namePlacement === 'top'}
        onPress={() => onPatch({ namePlacement: draft.namePlacement === 'top' ? 'bottom' : 'top' })}
      />
      <ToggleRow
        title="School line"
        meta="Team under the athlete name"
        on={draft.showSchool}
        live={live.showSchool}
        onPress={() => onPatch({ showSchool: !draft.showSchool })}
      />
      <ToggleRow
        title="Caption"
        meta="Clip title on the overlay"
        on={draft.showCaption}
        live={live.showCaption}
        onPress={() => onPatch({ showCaption: !draft.showCaption })}
      />
      <Text style={styles.section}>Button order</Text>
      {draft.railOrder.map((id, index) => (
        <AdminRow key={id} title={`${index + 1}. ${HIGHLIGHT_RAIL_ITEMS.find((item) => item.id === id)?.label ?? id}`} meta="Up / down on the rail">
          <AdminBtn label="Up" disabled={index === 0} onPress={() => onPatch({ railOrder: moveHighlightRailItem(draft.railOrder, id, -1) })} />
          <AdminBtn
            label="Down"
            disabled={index === draft.railOrder.length - 1}
            onPress={() => onPatch({ railOrder: moveHighlightRailItem(draft.railOrder, id as HighlightRailItem, 1) })}
          />
        </AdminRow>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  section: {
    color: FOCAL.neonJade,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 4,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatchLg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 22,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  colorField: {
    flex: 1,
  },
  preview: {
    borderRadius: radii.md,
    borderWidth: 2,
    padding: 14,
    gap: 6,
  },
  previewKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  previewBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  previewBtnLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  previewMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  phone: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    minHeight: 160,
    borderRadius: radii.md,
    backgroundColor: '#070A0B',
    padding: 12,
  },
  phoneFlip: {
    flexDirection: 'row-reverse',
  },
  phoneCopy: {
    flex: 1,
    gap: 4,
  },
  phoneName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  phoneMeta: {
    color: 'rgba(243,251,247,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  phoneRail: {
    gap: 6,
    alignItems: 'center',
    width: 56,
  },
  phoneChip: {
    color: FOCAL.neonJade,
    fontSize: 10,
    fontWeight: '800',
  },
});
