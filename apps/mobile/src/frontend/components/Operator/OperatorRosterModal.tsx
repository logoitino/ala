/** UX-13 readable controls preserve all consent, money and operator actions.
 * Sideline scorer: bottom sheet that lists a team's players so the operator can credit a score or play to one.
 * Locks closing while `busy` so a play is not dropped mid-send.
 */

import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { colors, MENU_METRICS } from '@/constants/theme';
import { displayValue, type Player } from '@/data/players';
import { TYPE, figtree } from '@/theme/fonts';

type OperatorRosterModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  players: Player[];
  busy?: boolean;
  onSelect: (player: Player) => void;
  onClose: () => void;
};

export function OperatorRosterModal({
  visible,
  title,
  subtitle,
  players,
  busy = false,
  onSelect,
  onClose,
}: OperatorRosterModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={[styles.sheet, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <MenuBackdrop accent="jade" />
        <SheetHandle onDismiss={busy ? undefined : onClose} />
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close roster"
            disabled={busy}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {players.length === 0 ? (
            <Text style={styles.empty}>No players on this roster. Seed the players table, then retry.</Text>
          ) : (
            players.map((player) => (
              <Pressable
                key={player.id}
                accessibilityRole="button"
                accessibilityLabel={`Tag ${displayValue(player.name)}`}
                disabled={busy}
                onPress={() => onSelect(player)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed, busy && styles.disabled]}
              >
                <View style={styles.jersey}>
                  <Text style={styles.jerseyLabel}>#{displayValue(player.jersey_number)}</Text>
                </View>
                <View style={styles.copy}>
                  <Text style={styles.name}>{displayValue(player.name, 'Unknown player')}</Text>
                  <Text style={styles.meta}>
                    {displayValue(player.position)} · {displayValue(player.school_name || player.team_name || player.team)}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    ...TYPE.title,
    ...figtree('800'),
  },
  subtitle: {
    color: colors.textMuted,
    ...TYPE.section,
    ...figtree('600'),
  },
  close: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    color: colors.onAccent,
    ...TYPE.body,
    ...figtree('800'),
  },
  list: {
    gap: 8,
    paddingBottom: 16,
  },
  empty: { ...figtree('400'),
    color: colors.textMuted,
    ...TYPE.section,
    textAlign: 'center',
    paddingVertical: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 64,
    padding: 12,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  jersey: {
    minWidth: 40,
    minHeight: 40,
    paddingVertical: 4,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  jerseyLabel: {
    color: colors.onAccent,
    ...TYPE.section,
    ...figtree('800'),
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    ...TYPE.section,
    ...figtree('800'),
  },
  meta: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.55,
  },
});
