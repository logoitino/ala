/**
 * Expo web left navigation for the three-panel desktop shell (WEB-DESKTOP-01).
 * Replaces the bottom FanTabBar at ≥820px; collapses labels below 1280 (icons only).
 */
import { type Href, usePathname, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '@/context/AuthContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { colors, space } from '@/constants/theme';
import { FONT } from '@/theme/fonts';
import { ROLE_HOME } from '@/lib/roles';
import { useWebDesktopMode } from '@/hooks/useAppViewport';
import type { UserRole } from '@/types/database';

type NavItem = {
  key: string;
  label: string;
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  iconOn: keyof typeof Ionicons.glyphMap;
};

const FAN_NAV: NavItem[] = [
  { key: 'home', label: 'Highlights', href: '/', icon: 'flash-outline', iconOn: 'flash' },
  { key: 'local', label: 'Local', href: '/local', icon: 'location-outline', iconOn: 'location' },
  { key: 'spotlight', label: 'Spotlight', href: '/spotlight', icon: 'star-outline', iconOn: 'star' },
  { key: 'drip', label: 'Drip', href: '/drip', icon: 'shirt-outline', iconOn: 'shirt' },
  { key: 'activity', label: 'Activity', href: '/activity', icon: 'notifications-outline', iconOn: 'notifications' },
  { key: 'receipts', label: 'Receipts', href: '/receipts', icon: 'receipt-outline', iconOn: 'receipt' },
  { key: 'profile', label: 'Profile', href: '/profile', icon: 'person-outline', iconOn: 'person' },
];

const ROLE_NAV: { role: UserRole; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { role: 'athlete', label: 'Athlete HQ', icon: 'trophy-outline' },
  { role: 'parent', label: 'Parent HQ', icon: 'people-outline' },
  { role: 'booster', label: 'Booster', icon: 'school-outline' },
  { role: 'admin', label: 'Admin', icon: 'settings-outline' },
];

function pathMatches(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname === '' || pathname === '/index';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * @purpose Left rail links for Expo web desktop / tablet (WEB-DESKTOP-01).
 * @param compact When true (tablet), show icons only.
 */
export function DesktopLeftRail({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const mode = useWebDesktopMode();
  const iconsOnly = compact ?? mode !== 'desktop';
  const { roles, isGuest, isAdmin } = useAuth();
  const { live } = useAppRuntime();

  const fanItems = FAN_NAV.filter((item) => {
    if (item.key === 'drip' && live.tabs.drip === false) return false;
    if (item.key === 'activity' && live.tabs.activity === false) return false;
    if (item.key === 'spotlight' && live.tabs.spotlight === false) return false;
    if (item.key === 'home' && live.tabs.home === false) return false;
    if (item.key === 'profile' && live.tabs.profile === false) return false;
    return true;
  });

  const roleItems = ROLE_NAV.filter((row) => {
    if (row.role === 'admin') return isAdmin;
    return roles.includes(row.role);
  });

  return (
    <View
      style={[styles.root, iconsOnly && styles.rootCompact]}
      accessibilityRole="navigation"
      accessibilityLabel="Main"
    >
      <Pressable
        onPress={() => router.push('/')}
        accessibilityRole="link"
        accessibilityLabel="Tapua'i Home"
        style={[styles.brand, iconsOnly && styles.brandCompact]}
      >
        {iconsOnly ? (
          <Text style={styles.brandMark}>T</Text>
        ) : (
          <Text style={styles.brandName}>{"Tapua'i"}</Text>
        )}
      </Pressable>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {fanItems.map((item) => {
          const on = pathMatches(pathname, String(item.href));
          return (
            <Pressable
              key={item.key}
              onPress={() => router.push(item.href)}
              accessibilityRole="link"
              accessibilityState={{ selected: on }}
              accessibilityLabel={item.label}
              style={[styles.item, on && styles.itemOn, iconsOnly && styles.itemCompact]}
            >
              <Ionicons
                name={on ? item.iconOn : item.icon}
                size={22}
                color={on ? colors.primary : colors.text}
              />
              {!iconsOnly ? (
                <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                  {item.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}

        {roleItems.length > 0 ? (
          <View style={styles.section}>
            {!iconsOnly ? <Text style={styles.sectionTitle}>Roles</Text> : null}
            {roleItems.map((row) => (
              <Pressable
                key={row.role}
                onPress={() => router.push(ROLE_HOME[row.role] as Href)}
                accessibilityRole="link"
                accessibilityLabel={row.label}
                style={[styles.item, iconsOnly && styles.itemCompact]}
              >
                <Ionicons name={row.icon} size={22} color={colors.text} />
                {!iconsOnly ? (
                  <Text style={styles.label} numberOfLines={1}>
                    {row.label}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          {!iconsOnly ? <Text style={styles.sectionTitle}>Crew</Text> : null}
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="link"
            accessibilityLabel={isGuest ? 'Sign in to see Crew' : 'Open Profile for Crew'}
            style={[styles.item, iconsOnly && styles.itemCompact]}
          >
            <Ionicons name="flash-outline" size={22} color={colors.textMuted} />
            {!iconsOnly ? (
              <Text style={[styles.label, styles.muted]} numberOfLines={2}>
                {isGuest ? 'Sign in for Crew' : 'Crew on Profile'}
              </Text>
            ) : null}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 240,
    flexShrink: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
  },
  rootCompact: {
    width: 72,
  },
  brand: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
    minHeight: 52,
    justifyContent: 'center',
  },
  brandCompact: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  brandName: {
    fontFamily: FONT.display,
    fontSize: 26,
    color: colors.primary,
  },
  brandMark: {
    fontFamily: FONT.display,
    fontSize: 22,
    color: colors.primary,
  },
  scroll: {
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    gap: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 10,
    paddingHorizontal: space.sm,
    borderRadius: 10,
    minHeight: 44,
  },
  itemCompact: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  itemOn: {
    backgroundColor: colors.primaryMuted,
  },
  label: {
    flex: 1,
    fontFamily: FONT.semibold,
    fontSize: 14,
    color: colors.text,
  },
  labelOn: {
    color: colors.primary,
  },
  muted: {
    color: colors.textMuted,
    fontFamily: FONT.regular,
    fontSize: 12,
  },
  section: {
    marginTop: space.md,
    gap: 2,
  },
  sectionTitle: {
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    paddingHorizontal: space.sm,
    marginBottom: 4,
  },
});
