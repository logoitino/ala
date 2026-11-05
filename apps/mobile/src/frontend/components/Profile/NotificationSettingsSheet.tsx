/** Account notification choices belong to the current Auth lifetime; the hook owns confirmed state and writes. */
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { NOTIFICATION_CATEGORIES } from '@tapuai/shared-types/notifications';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { colors, MENU_METRICS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNotificationSettings } from '@/hooks/useNotifications';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { FOCAL } from '@/theme/motion';

/** A saved true choice can always be switched off, including while its delivery source is paused. */
function Choice({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void;
}) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label}
    accessibilityState={{ checked, disabled }} disabled={disabled} haptic="selection"
    onPress={() => onChange(!checked)} style={[styles.choice, checked && styles.choiceOn, disabled && styles.disabled]}>
    <Text style={styles.choiceLabel}>{label.includes(': ') ? label.split(': ').at(-1) : label}</Text>
    <Text style={styles.choiceValue}>{checked ? 'On' : 'Off'}</Text>
  </Pressable>;
}

/** @purpose Profile → Account notification settings; optional channels never control Auth recovery. */
export function NotificationSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, isGuest } = useAuth();
  const currentAccount = Boolean(user && !isGuest);
  const state = useNotificationSettings(visible && currentAccount);
  const frame = useSheetFrame();
  const { height } = useWindowDimensions();
  if (!visible || !currentAccount) return null;
  const { draft, availability, loading, busy, error, notice, dirty, conflicted } = state;
  const locked = loading || busy || conflicted;

  return <Modal visible animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.root}>
      <View style={frame.dock}>
        <View accessibilityViewIsModal style={[styles.sheet, frame.card, { maxHeight: height * 0.85 }]}>
          <MenuBackdrop accent="violet" />
          <SheetHandle onDismiss={onClose} />
          <Text style={styles.kicker}>Account</Text>
          <Text accessibilityRole="header" style={styles.title}>Notifications</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            <View style={styles.box}>
              <Text style={styles.section}>Verification and password reset</Text>
              <Text style={styles.hint}>Security emails stay available for signing in and recovering your account. Optional choices below do not turn them off.</Text>
              <Text style={styles.email}>{user?.email ?? 'No email address attached.'}</Text>
              {user?.email ? <Text style={styles.hint}>{user.email_confirmed_at ? 'Email verified.' : 'Email verification pending.'}</Text> : null}
            </View>
            <Text style={styles.hint}>These choices apply to new connected notification sources. Existing Crew alerts and workout invitations keep their own controls. Phone push notifications are coming later.</Text>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
            {loading ? <ActivityIndicator accessibilityLabel="Loading notification settings" color={colors.primary} /> : null}
            {draft && availability ? <>
              <Text style={styles.section}>Your channels</Text>
              <Text style={styles.hint}>Pausing a channel preserves category choices and existing history. Re-enabling it applies to future updates. Category switches show your choices. Save choices to confirm changes.</Text>
              <Choice label="Email notifications" checked={draft.emailEnabled}
                disabled={locked || (!draft.emailEnabled && !availability.emailEnabled)}
                onChange={value => state.setChannelEnabled('email', value)} />
              {!availability.emailEnabled ? <Text style={styles.hint}>Optional email delivery is paused. All optional email categories start off.</Text> : null}
              <Choice label="In-app notifications" checked={draft.inAppEnabled}
                disabled={locked || (!draft.inAppEnabled && !availability.inAppEnabled)}
                onChange={value => state.setChannelEnabled('inApp', value)} />
              {!availability.inAppEnabled ? <Text style={styles.hint}>New in-app notification delivery is paused. Saved inbox history stays available.</Text> : null}
              <Text style={styles.section}>Choose your updates</Text>
              {NOTIFICATION_CATEGORIES.map(category => {
                const sourceReady = availability.sourceAvailability[category.id];
                const categoryReady = sourceReady && availability.categories[category.id];
                const choices = draft.categories[category.id];
                return <View key={category.id} style={styles.box}>
                  <Text style={styles.itemTitle}>{category.label}</Text>
                  <Text style={styles.hint}>{category.description}</Text>
                  {!sourceReady ? <Text style={styles.hint}>Source not connected yet.</Text>
                    : !availability.categories[category.id] ? <Text style={styles.hint}>New updates in this category are paused.</Text> : null}
                  <View style={styles.choiceRow}>
                    <Choice label={`${category.label}: Email`} checked={choices.email}
                      disabled={locked || (!choices.email && (!categoryReady || !availability.emailEnabled || !draft.emailEnabled))}
                      onChange={value => state.setCategory(category.id, 'email', value)} />
                    <Choice label={`${category.label}: In-app`} checked={choices.inApp}
                      disabled={locked || (!choices.inApp && (!categoryReady || !availability.inAppEnabled || !draft.inAppEnabled))}
                      onChange={value => state.setCategory(category.id, 'inApp', value)} />
                  </View>
                </View>;
              })}
            </> : null}
            {error || conflicted ? <Pressable accessibilityRole="button" accessibilityLabel="Reload notification settings"
              disabled={busy || loading} accessibilityState={{ disabled: busy || loading }}
              onPress={() => void state.reload()} style={styles.action}>
              <Text style={styles.actionLabel}>Reload settings</Text>
            </Pressable> : null}
          </ScrollView>
          {draft && availability ? <Pressable accessibilityRole="button" accessibilityLabel="Save notification settings"
            disabled={locked || !dirty} accessibilityState={{ disabled: locked || !dirty }}
            onPress={() => void state.save()} style={[styles.save, (locked || !dirty) && styles.disabled]}>
            <Text style={styles.saveLabel}>{busy ? 'Saving…' : 'Save choices'}</Text>
          </Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Close notification settings" onPress={onClose} style={styles.close}>
            <Text style={styles.actionLabel}>Close</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,24,18,0.45)' },
  sheet: { backgroundColor: colors.surface, gap: 10 },
  kicker: { color: FOCAL.goldInk, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  scroll: { flexGrow: 0 },
  body: { paddingBottom: 8, gap: 12 },
  box: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.controlRadius, gap: 8 },
  section: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  itemTitle: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  email: { color: colors.text, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  notice: { color: colors.text, fontSize: 14, lineHeight: 20 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, flexGrow: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center',
    gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.controlRadius, backgroundColor: colors.background },
  choiceOn: { borderColor: colors.text, backgroundColor: FOCAL.mistJade },
  choiceLabel: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  choiceValue: { color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  action: { minHeight: 44, padding: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: colors.primary, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  save: { minHeight: 48, borderRadius: MENU_METRICS.controlRadius, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  saveLabel: { color: colors.onAccent, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  close: { minHeight: 44, padding: 8, alignItems: 'center', justifyContent: 'center' },
});
