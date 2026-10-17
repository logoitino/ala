/** Pinned fan bar for screens that live outside the tab group (trivia, Fan Zone, the trivia preview).
 * Those routes stay outside the fan-only tab gate so every enrolled role can open them. This bar is the same
 * destinations, fixed to the bottom, so Home never scrolls away.
 * @sideEffects Ends the caller's in-progress play before navigation. Upload opens the root upload sheet, then Home,
 * because the composer is mounted with the tab bar.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HIGHLIGHT_NAV_LABEL, SPOTLIGHT_NAV_LABEL } from '@/data/highlights';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useUploadSheet } from '@/context/UploadSheetContext';
import { colors } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';

type Slot = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
};

const SLOTS: Slot[] = [
  { key: 'home', label: HIGHLIGHT_NAV_LABEL, icon: 'home-outline', href: '/' },
  { key: 'activity', label: 'Activity', icon: 'notifications-outline', href: '/activity' },
  { key: 'spotlight', label: SPOTLIGHT_NAV_LABEL, icon: 'trophy-outline', href: '/spotlight' },
  { key: 'profile', label: 'Profile', icon: 'person-outline', href: '/profile' },
];

/**
 * @purpose The familiar fan bar, pinned, on a play screen that is not inside the tab navigator.
 * @param onBeforeLeave Runs before any destination (end a trivia round, close a Fan Zone clip).
 * @returns A bottom bar: Home, Activity, Upload, Spotlight, Profile.
 * @sideEffects Router push, or the upload sheet then Home. Calls `onBeforeLeave` first.
 */
export function PlayNavBar({ onBeforeLeave }: { onBeforeLeave?: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { openUpload } = useUploadSheet();
  const { live } = useAppRuntime();
  const tabs = live.tabs;
  const visible = SLOTS.filter((slot) => {
    if (!tabs) return true;
    if (slot.key === 'home') return tabs.home;
    if (slot.key === 'activity') return tabs.activity;
    if (slot.key === 'spotlight') return tabs.spotlight;
    if (slot.key === 'profile') return tabs.profile;
    return true;
  });
  const left = visible.slice(0, 2);
  const right = visible.slice(2);
  const go = (href: Href) => {
    onBeforeLeave?.();
    router.push(href);
  };
  const upload = () => {
    onBeforeLeave?.();
    openUpload();
    router.push('/');
  };
  const tab = (slot: Slot) => (
    <Pressable key={slot.key} accessibilityRole="button" accessibilityLabel={slot.label} onPress={() => go(slot.href)} style={styles.hit}>
      <Ionicons name={slot.icon} size={20} color={colors.textMuted} />
      <Text style={styles.label} numberOfLines={1}>{slot.label}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 6), backgroundColor: live.theme.surface ?? colors.surface }]}>
      <View style={styles.bar}>
        {left.map(tab)}
        {tabs?.upload !== false ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Upload" onPress={upload} style={styles.fabHit}>
            <View style={styles.fab}><Ionicons name="add" size={26} color="#FFFFFF" /></View>
          </Pressable>
        ) : null}
        {right.map(tab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderTopWidth: 1, borderTopColor: colors.border },
  bar: { flexDirection: 'row', alignItems: 'flex-end', minHeight: 58, paddingHorizontal: 4, paddingTop: 4 },
  hit: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 6 },
  label: { fontSize: 11, fontWeight: '800', color: colors.textMuted, textAlign: 'center' },
  fabHit: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: FOCAL.jadeInk, alignItems: 'center', justifyContent: 'center' },
});
