/** UX-13 readable controls preserve all consent, money and operator actions.
 * Shared Expo admin editor primitives: fields, rows, buttons, panels, notices, pills, metrics, desk links,
 * the Publish to app bar and catalog typeahead (split out of AdminChrome.tsx for R4-03; behaviour unchanged).
 * Readable report inks and 44-point controls carry the approved report design into every write desk.
 * Desks import these through `AdminChrome`, which re-exports them (tests mock that one path).
 * @sideEffects Only through callers' callbacks; `AdminPublishBar` publishes / discards the runtime draft.
 */
import { Children, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useRouter } from 'expo-router';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { ADMIN_REPORT_COLORS } from '@/components/Admin/adminReportColors';
import { radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import type { AdminNavHref } from '@/lib/admin';
import { TYPE, figtree } from '@/theme/fonts';

const colors = ADMIN_REPORT_COLORS;

type AdminFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  /** false shows the field read-only (for example a feature behind a switch that is off); default editable. */
  editable?: boolean;
};

export function AdminField({
  label,
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  keyboardType,
  multiline,
  autoCapitalize = 'none',
  autoCorrect = false,
  editable = true,
}: AdminFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel ?? label}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        accessibilityState={editable ? undefined : { disabled: true }}
        style={[styles.field, multiline && styles.fieldMulti, !editable && { opacity: 0.55 }]}
      />
    </View>
  );
}

/**
 * @purpose Lay related fields (Home school / Away school, Home name / Away name, …) side by side on
 *   wide screens instead of forcing every field into one full-width stacked column. Each child is
 *   wrapped in its own `flex: 1, minWidth: 200` box rather than touching `AdminField`'s own style, so
 *   plain (non-row) `AdminField` usage elsewhere is completely unaffected — wraps to a single column
 *   automatically on narrow viewports once two 200px-minimum boxes no longer fit side by side.
 */
export function AdminFieldRow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.fieldRow}>
      {Children.map(children, (child) => (child ? <View style={styles.fieldRowItem}>{child}</View> : child))}
    </View>
  );
}

type AdminRowProps = {
  title: string;
  meta?: string;
  children?: ReactNode;
  onPress?: () => void;
};

export function AdminRow({ title, meta, children, onPress }: AdminRowProps) {
  const Inner = (
    <>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      {children ? <View style={styles.rowActions}>{children}</View> : null}
    </>
  );
  if (!onPress) {
    return <View style={styles.row}>{Inner}</View>;
  }
  return (
    <AnimatedButton haptic="selection" accessibilityLabel={title} contentStyle={styles.row} onPress={onPress}>
      {Inner}
    </AnimatedButton>
  );
}

type AdminBtnProps = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
};

export function AdminBtn({ label, onPress, kind = 'ghost', disabled }: AdminBtnProps) {
  return (
    <AnimatedButton
      haptic="medium"
      disabled={disabled}
      accessibilityLabel={label}
      contentStyle={[
        styles.btn,
        kind === 'primary' && styles.btnPrimary,
        kind === 'danger' && styles.btnDanger,
        kind !== 'primary' && styles.btnInline,
        disabled && styles.btnDisabled,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.btnLabel,
          kind === 'primary' && styles.btnLabelPrimary,
          kind === 'danger' && styles.btnLabelDanger,
        ]}
      >
        {label}
      </Text>
    </AnimatedButton>
  );
}

export function AdminPanel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      {title ? <Text style={styles.panelTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function AdminNotice({ text, tone = 'ok' }: { text: string | null; tone?: 'ok' | 'warn' | 'danger' }) {
  if (!text) return null;
  return (
    <Text
      style={[
        styles.notice,
        tone === 'danger' && styles.noticeDanger,
        tone === 'warn' && styles.noticeWarn,
      ]}
    >
      {text}
    </Text>
  );
}

export function AdminEmpty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

type AdminPillsProps<T extends string> = {
  label?: string;
  items: { id: T; label: string }[];
  value: T | string;
  onChange: (id: T) => void;
};

/**
 * @purpose Wrap-friendly choice chips for admin forms (category, quarter, tier, filters).
 */
export function AdminPills<T extends string>({ label, items, value, onChange }: AdminPillsProps<T>) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.pills} accessibilityRole="tablist">
        {items.map((item) => {
          const on = item.id === value;
          return (
            <AnimatedButton
              key={item.id}
              haptic="selection"
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: on }}
              contentStyle={[styles.pill, on && styles.pillOn]}
              onPress={() => onChange(item.id)}
            >
              <Text style={[styles.pillLabel, on && styles.pillLabelOn]}>{item.label}</Text>
            </AnimatedButton>
          );
        })}
      </View>
    </View>
  );
}

/**
 * @purpose Uppercase jade divider used by every desk that stacks more than one list.
 */
export function AdminSectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

/**
 * @purpose Shared metric grid for operational desks so their own numbers are styled once.
 * @param items Big value, uppercase caption, and an optional line of context under it.
 */
export function AdminMetrics({ items }: { items: { label: string; value: string | number; hint?: string }[] }) {
  return (
    <View style={styles.metrics} accessibilityRole="summary">
      {items.map((item) => (
        <View key={item.label} style={styles.metric} accessibilityRole="summary" accessibilityLabel={`${item.label} ${item.value}`}>
          <Text style={styles.metricLabel}>{item.label}</Text>
          <Text style={styles.metricValue}>{item.value}</Text>
          {item.hint ? <Text style={styles.metricHint}>{item.hint}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * @purpose Hand a queue item to the desk that owns it instead of repeating that desk's controls.
 */
export function AdminDeskLink({
  title,
  meta,
  href,
  label = 'Open desk',
  kind = 'primary',
}: {
  title: string;
  meta?: string;
  href: AdminNavHref;
  label?: string;
  kind?: 'primary' | 'ghost' | 'danger';
}) {
  const router = useRouter();
  return (
    <AdminRow title={title} meta={meta}>
      <AdminBtn label={label} kind={kind} onPress={() => router.push(href)} />
    </AdminRow>
  );
}

/**
 * @purpose The one Publish to app / Discard draft control, for any desk that writes the runtime draft.
 * @param note Extra line explaining what stays hidden from fans until the ship.
 * @sideEffects `publish_app_runtime` / `patch_app_runtime_draft` through AppRuntimeContext.
 */
export function AdminPublishBar({ note }: { note?: string }) {
  const { dirty, pendingCount, publishedAt, publishLive, discardDraft, saveError } = useAppRuntime();
  const [publishing, setPublishing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const ship = async () => {
    setPublishing(true);
    setLocalError(null);
    try {
      await publishLive();
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Could not publish.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AdminPanel title={dirty ? `${pendingCount} unpublished change${pendingCount === 1 ? '' : 's'}` : 'Live with the fan app'}>
      <Text style={styles.publishBody}>
        {publishedAt
          ? `Last published ${publishedAt.replace('T', ' ').slice(0, 16)} UTC.`
          : 'No publication timestamp is available. Check the published controls.'}
      </Text>
      <AdminBtn
        label={publishing ? 'Publishing…' : dirty ? 'Publish to app' : 'Already live'}
        kind="primary"
        disabled={!dirty || publishing}
        onPress={() => void ship()}
      />
      {dirty ? (
        <AdminBtn
          label="Discard draft"
          kind="danger"
          onPress={() =>
            void discardDraft().catch((caught) =>
              setLocalError(caught instanceof Error ? caught.message : 'Could not discard.'),
            )
          }
        />
      ) : null}
      <AdminNotice text={localError || saveError} tone="warn" />
      <AdminNotice text={dirty ? note ?? 'Fans still see the previous chrome until you publish.' : null} tone="warn" />
    </AdminPanel>
  );
}

type SuggestOption = { id: string; title: string; meta?: string };

type AdminSuggestProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  options: SuggestOption[];
  placeholder?: string;
  onPick?: (option: SuggestOption) => void;
};

/**
 * @purpose Typeahead over a catalog (schools, athletes) so admins never paste ids.
 */
export function AdminSuggest({ label, value, onChangeText, options, placeholder, onPick }: AdminSuggestProps) {
  const needle = value.trim().toLowerCase();
  const hits =
    needle.length < 1
      ? []
      : options
          .filter((row) => `${row.title} ${row.meta ?? ''}`.toLowerCase().includes(needle))
          .slice(0, 6);
  return (
    <View style={styles.fieldWrap}>
      <AdminField label={label} value={value} onChangeText={onChangeText} placeholder={placeholder} />
      {hits.map((row) => (
        <AnimatedButton
          key={row.id}
          haptic="selection"
          accessibilityLabel={`Use ${row.title}`}
          contentStyle={styles.suggest}
          onPress={() => {
            onChangeText(row.title);
            onPick?.(row);
          }}
        >
          <Text style={styles.suggestTitle}>{row.title}</Text>
          {row.meta ? <Text style={styles.suggestMeta}>{row.meta}</Text> : null}
        </AnimatedButton>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    gap: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fieldRowItem: {
    flexGrow: 1,
    minWidth: 200,
  },
  label: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  field: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 12,
    ...TYPE.section,
    ...figtree('600'),
  },
  fieldMulti: {
    minHeight: 72,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    minWidth: 44,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
  },
  rowCopy: {
    flex: 1,
    minWidth: 160,
    gap: 4,
  },
  rowTitle: {
    color: colors.text,
    ...TYPE.section,
    ...figtree('800'),
  },
  rowMeta: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.jade,
    borderColor: colors.jade,
  },
  btnDanger: {
    borderColor: colors.danger,
  },
  btnInline: {
    alignSelf: 'flex-start',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnLabel: {
    color: colors.text,
    ...TYPE.body,
    ...figtree('800'),
  },
  btnLabelPrimary: {
    color: '#FFFFFF',
  },
  btnLabelDanger: {
    color: colors.danger,
  },
  // Card panels (2026-11 Lovable refresh), matching the portal's card panels.
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 18,
    marginTop: 12,
    gap: 12,
  },
  panelTitle: {
    color: colors.text,
    ...TYPE.title,
    ...figtree('900'),
  },
  busy: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  notice: {
    color: colors.jade,
    ...TYPE.body,
    ...figtree('700'),
  },
  noticeDanger: {
    color: colors.danger,
  },
  noticeWarn: {
    color: colors.electricGold,
  },
  empty: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),
    paddingVertical: 8,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: {
    borderBottomColor: colors.jade,
  },
  pillLabel: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('800'),
  },
  pillLabelOn: {
    color: colors.jade,
  },
  section: {
    color: colors.jade,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    flexGrow: 1,
    minWidth: 88,
    borderBottomWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  metricValue: {
    color: colors.jade,
    ...TYPE.display,
    ...figtree('800'),
  },
  metricLabel: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metricHint: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),

  },
  publishBody: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),

  },
  suggest: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-start',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  suggestTitle: {
    color: colors.text,
    ...TYPE.body,
    ...figtree('800'),
  },
  suggestMeta: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('600'),
  },
});
