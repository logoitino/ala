import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { ScreenHeading } from '@/components/ScreenHeading';
import { colors, radii } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';

type AdminPageProps = {
  title: string;
  lede: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  error?: string | null;
  /** Instant catalog edits vs chrome that waits for Publish to app. */
  saveMode?: 'instant' | 'publish';
};

/**
 * @purpose Shared scroll canvas for every `/admin` tool (heading, pull-to-refresh, error line).
 */
export function AdminPage({
  title,
  lede,
  children,
  refreshing = false,
  onRefresh,
  error,
  saveMode,
}: AdminPageProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 28) },
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={FOCAL.neonJade}
            colors={[FOCAL.neonJade]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined
      }
    >
      <ScreenHeading kicker="Tapua'i admin" title={title} lede={lede} />
      {saveMode === 'instant' ? (
        <Text style={styles.saveCue}>Saves instantly — spelling, stats, scores, and prices hit the fan app on Save.</Text>
      ) : null}
      {saveMode === 'publish' ? (
        <Text style={styles.saveCuePublish}>
          Draft only. Hit Publish to app in the sidebar when you want fans to see tab, color, Profile, and Highlights layout changes.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {children}
    </ScrollView>
  );
}

type AdminFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
};

export function AdminField({
  label,
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  keyboardType,
  multiline,
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
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.field, multiline && styles.fieldMulti]}
      />
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

export function AdminBusy() {
  return (
    <View style={styles.busy}>
      <ActivityIndicator color={FOCAL.neonJade} />
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
  page: {
    flex: 1,
    backgroundColor: FOCAL.backgroundBase,
  },
  content: {
    paddingHorizontal: 20,
    gap: 14,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  saveCue: {
    color: FOCAL.neonJade,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  saveCuePublish: {
    color: FOCAL.electricGold,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  fieldWrap: {
    gap: 6,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  field: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  rowCopy: {
    flex: 1,
    minWidth: 160,
    gap: 4,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: FOCAL.neonJade,
    borderColor: FOCAL.neonJade,
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
    fontSize: 13,
    fontWeight: '800',
  },
  btnLabelPrimary: {
    color: FOCAL.backgroundBase,
  },
  btnLabelDanger: {
    color: colors.danger,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  busy: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  notice: {
    color: FOCAL.neonJade,
    fontSize: 14,
    fontWeight: '700',
  },
  noticeDanger: {
    color: colors.danger,
  },
  noticeWarn: {
    color: colors.electricGold,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 8,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: {
    backgroundColor: FOCAL.neonJade,
    borderColor: FOCAL.neonJade,
  },
  pillLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  pillLabelOn: {
    color: FOCAL.backgroundBase,
  },
  suggest: {
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
    fontSize: 14,
    fontWeight: '800',
  },
  suggestMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
