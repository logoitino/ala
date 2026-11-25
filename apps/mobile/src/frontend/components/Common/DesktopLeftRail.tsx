/** UX-13 readable shared type preserves every action and required notice.
 * Expo web left navigation for the three-panel desktop shell (WEB-DESKTOP-01).
 * Replaces the bottom FanTabBar at ≥820px; collapses labels below 1280 (icons only).
 * The web-only rail carries the welcome brand and exposes existing account settings.
 */
import { useEffect, useState } from 'react';
import { type Href, usePathname, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '@/context/AuthContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { colors, space } from '@/constants/theme';
import { FONT, TYPE } from '@/theme/fonts';
import { fetchCrewShortcuts, type CrewShortcut } from '@/lib/crew';
import { userProfileHref } from '@/lib/navigation';
import { ROLE_HOME } from '@/lib/roles';
import { useWebDesktopMode } from '@/hooks/useAppViewport';
import { BrandMark } from '@/components/UI/BrandMark';
import { DesktopAccountSettings } from '@/components/Common/DesktopAccountSettings';
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
  // UX-17 school catalog — desktop Home omits the phone Local pill, so this rail is the web entry.
  {
    key: 'schools',
    label: 'Schools',
    href: '/local/directory',
    icon: 'school-outline',
    iconOn: 'school',
  },
  { key: 'spotlight', label: 'Spotlight', href: '/spotlight', icon: 'star-outline', iconOn: 'star' },
  { key: 'drip', label: 'Drip', href: '/drip', icon: 'shirt-outline', iconOn: 'shirt' },
  { key: 'activity', label: 'Activity', href: '/activity', icon: 'notifications-outline', iconOn: 'notifications' },
  { key: 'receipts', label: 'Receipts', href: '/receipts', icon: 'receipt-outline', iconOn: 'receipt' },
  { key: 'profile', label: 'Profile', href: '/profile', icon: 'person-outline', iconOn: 'person' },
];

const ROLE_NAV: { role: UserRole; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { role: 'athlete', label: 'Athlete HQ', icon: 'trophy-outline' },
  { role: 'parent', label: 'Parent HQ', icon: 'people-outline' },
  { role: 'booster', label: 'Booster', icon: 'business-outline' },
  { role: 'admin', label: 'Admin', icon: 'settings-outline' },
];

function pathMatches(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname === '' || pathname === '/index';
  // Keep Local selected on hub + game detail only — not on Schools (`/local/directory`).
  if (href === '/local') {
    return pathname === '/local' || pathname.startsWith('/local/game');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * @purpose Left rail links for Expo web desktop / tablet (WEB-DESKTOP-01), including Schools (`/local/directory`) and Crew shortcuts.
 * @param compact When true (tablet), show icons only.
 * @sideEffects `fetchCrewShortcuts` (`crew_follows` + `players`) for signed-in fans.
 */
export function DesktopLeftRail({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const mode = useWebDesktopMode();
  const iconsOnly = compact ?? mode !== 'desktop';
  const { user, roles, isGuest, isAdmin } = useAuth();
  const { live } = useAppRuntime();
  const [crew, setCrew] = useState<CrewShortcut[]>([]);

  useEffect(() => {
    let active = true;
    if (isGuest || !user?.id) {
      setCrew([]);
      return () => {
        active = false;
      };
    }
    void fetchCrewShortcuts(user.id, 5).then((rows) => {
      if (active) setCrew(rows);
    });
    return () => {
      active = false;
    };
  }, [isGuest, user?.id]);

  const fanItems = FAN_NAV.filter((item) => {
    if (item.key === 'drip' && live.tabs.drip === false) return false;
    if (item.key === 'activity' && live.tabs.activity === false) return false;
    if (item.key === 'spotlight' && live.tabs.spotlight === false) return false;
    if (item.key === 'home' && live.tabs.home === false) return false;
    if (item.key === 'profile' && live.tabs.profile === false) return false;
    // Schools rides the Local surface flag — same pause as /local and /local/directory.
    if ((item.key === 'local' || item.key === 'schools') && live.tabs.local === false) return false;
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
        <BrandMark dark size={iconsOnly ? 28 : 30} showWordmark={!iconsOnly} />
        {!iconsOnly ? <Text style={styles.brandCaption}>Athletes worth cheering for.</Text> : null}
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
                <Text style={[styles.label, on && styles.labelOn]}>
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
                  <Text style={styles.label}>
                    {row.label}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          {!iconsOnly ? <Text style={styles.sectionTitle}>Crew</Text> : null}
          {isGuest ? (
            <Pressable
              onPress={() => router.push('/profile')}
              accessibilityRole="link"
              accessibilityLabel="Sign in to see Crew"
              style={[styles.item, iconsOnly && styles.itemCompact]}
            >
              <Ionicons name="flash-outline" size={22} color={colors.textMuted} />
              {!iconsOnly ? (
                <Text style={[styles.label, styles.muted]}>
                  Sign in for Crew
                </Text>
              ) : null}
            </Pressable>
          ) : crew.length === 0 ? (
            <Pressable
              onPress={() => router.push('/profile')}
              accessibilityRole="link"
              accessibilityLabel="Open Profile for Crew"
              style={[styles.item, iconsOnly && styles.itemCompact]}
            >
              <Ionicons name="flash-outline" size={22} color={colors.textMuted} />
              {!iconsOnly ? (
                <Text style={[styles.label, styles.muted]}>
                  Follow athletes to fill Crew
                </Text>
              ) : null}
            </Pressable>
          ) : (
            crew.map((row) => {
              const initial = row.name.trim().charAt(0).toUpperCase() || '?';
              return (
                <Pressable
                  key={row.id}
                  onPress={() => router.push(userProfileHref(row.id))}
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${row.name} profile`}
                  style={[styles.item, iconsOnly && styles.itemCompact]}
                >
                  <View style={styles.crewDot} accessibilityElementsHidden>
                    <Text style={styles.crewInitial}>{initial}</Text>
                  </View>
                  {!iconsOnly ? (
                    <Text style={styles.label}>
                      {row.name}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
        {live.tabs.profile !== false ? <DesktopAccountSettings compact={iconsOnly} /> : null}
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
    backgroundColor: colors.videoSurface,
    gap: 8,
  },
  brandCompact: { minHeight: 44,
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  brandCaption: { ...TYPE.caption, color: colors.onVideoMuted, fontFamily: FONT.regular },
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
  itemCompact: { minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  itemOn: { minHeight: 44,
    backgroundColor: colors.primaryMuted,
  },
  label: {
    flex: 1,
    fontFamily: FONT.semibold,
    ...TYPE.body,
    color: colors.text,
  },
  labelOn: {
    color: colors.primary,
  },
  muted: {
    color: colors.textMuted,
    fontFamily: FONT.regular,
    ...TYPE.caption,
  },
  section: {
    marginTop: space.md,
    gap: 2,
  },
  sectionTitle: {
    fontFamily: FONT.bold,
    ...TYPE.caption,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    paddingHorizontal: space.sm,
    marginBottom: 4,
  },
  crewDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crewInitial: {
    fontFamily: FONT.bold,
    ...TYPE.caption,
    color: colors.primary,
  },
});
