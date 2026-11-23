/** UX-19: Inbox/Archived share one tinted segment track and Refresh is a compact icon button on the heading line, so the
 * controls stop outweighing the content; every target stays 44pt and the card drops its border for a soft shadow.
 * UX-18 tightens panel spacing and ordinary explanation layout while keeping every 44pt action and full notice/body. UX-13 readable shared type preserves every action and required notice. The bounded notification inbox is separate from factual Activity and its existing invitation queues. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { cardShadow, colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNotificationInbox } from '@/hooks/useNotifications';
import { FOCAL } from '@/theme/motion';
import { MoreText } from '@/components/UI/MoreText';
import { SECTION_HEADING, TYPE, figtree } from '@/theme/fonts';

/** @purpose Review read/unread and archived notifications without mutating receipt or invitation history. */
export function NotificationInbox({ enabled = true }: { enabled?: boolean }) {
  const { user, isGuest } = useAuth();
  const router = useRouter();
  const state = useNotificationInbox(enabled && Boolean(user && !isGuest));
  if (!user || isGuest) return null;
  const { page, archived, loading, busy, error, notice } = state;
  const locked = loading || busy || !enabled;

  return <View style={styles.card}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.title}>Notifications</Text>
      {page ? <Text style={styles.unread}>{page.unreadCount} unread{archived ? ' in inbox' : ''}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh notifications" accessibilityState={{ disabled: locked }}
        disabled={locked} onPress={() => void state.reload()} style={[styles.iconAction, locked && styles.disabled]}>
        <Ionicons name="refresh" size={18} color={colors.primary} />
      </Pressable>
    </View>
    <MoreText style={styles.hint} lines={1} inlineToggle>{'New connected account updates appear here. Your gift history and invitations stay in their own sections.'}</MoreText>
    <View testID="notification-segments" accessibilityRole="tablist" style={styles.segments}>
      <Pressable accessibilityRole="tab" accessibilityLabel="Current notifications" accessibilityState={{ selected: !archived, disabled: locked }}
        disabled={locked} onPress={() => void state.showArchived(false)} style={[styles.segment, !archived && styles.segmentOn]}>
        <Text style={[styles.segmentLabel, !archived && styles.segmentLabelOn]}>Inbox</Text>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel="Archived notifications" accessibilityState={{ selected: archived, disabled: locked }}
        disabled={locked} onPress={() => void state.showArchived(true)} style={[styles.segment, archived && styles.segmentOn]}>
        <Text style={[styles.segmentLabel, archived && styles.segmentLabelOn]}>Archived</Text>
      </Pressable>
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.hint}>{notice}</Text> : null}
    {loading ? <ActivityIndicator accessibilityLabel="Loading notifications" color={colors.primary} /> : null}
    {!loading && !error && page?.items.length === 0 ? <View style={styles.empty}>
      <Text style={styles.itemTitle}>{archived ? 'No archived notifications' : 'No notifications yet'}</Text>
      <Text style={styles.hint}>{archived ? 'Notifications you archive will appear here.' : 'When connected sources send you an update, it will appear here.'}</Text>
    </View> : null}
    {page ? <>
      {/* The server snapshot covers active inbox rows; an archived view must not mark unseen inbox items. */}
      {!archived ? <>
      <Pressable accessibilityRole="button" accessibilityLabel="Mark all notifications as read"
        accessibilityState={{ disabled: locked || !page.cutoff || page.unreadCount === 0 }}
        disabled={locked || !page.cutoff || page.unreadCount === 0} onPress={() => void state.markAllRead()}
        style={[styles.action, (locked || !page.cutoff || page.unreadCount === 0) && styles.disabled]}>
        <Text style={styles.actionLabel}>Mark all as read</Text>
      </Pressable>
      <Text style={styles.hint}>Mark all uses the last loaded snapshot; later arrivals stay unread.</Text>
      </> : null}
      {page.items.map(item => <View key={item.id} style={[styles.item, !item.readAt && styles.unreadItem]}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.hint}>{item.readAt ? 'Read' : 'Unread'} · {new Date(item.createdAt).toLocaleDateString()}</Text>
        <View style={styles.controls}>
          {item.href ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}
            disabled={locked} accessibilityState={{ disabled: locked }}
            onPress={() => void state.openItem(item.id, href => router.push(href as Href))} style={styles.action}>
            <Text style={styles.actionLabel}>Open update</Text>
          </Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Mark ${item.title} as ${item.readAt ? 'unread' : 'read'}`}
            disabled={locked} accessibilityState={{ disabled: locked }}
            onPress={() => void state.setRead(item.id, !item.readAt)} style={styles.action}>
            <Text style={styles.actionLabel}>{item.readAt ? 'Mark unread' : 'Mark read'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${archived ? 'Restore' : 'Archive'} ${item.title}`}
            disabled={locked} accessibilityState={{ disabled: locked }}
            onPress={() => void state.setArchived(item.id, !archived)} style={styles.action}>
            <Text style={styles.actionLabel}>{archived ? 'Restore' : 'Archive'}</Text>
          </Pressable>
        </View>
      </View>)}
      {page.nextCursor ? <Pressable accessibilityRole="button" accessibilityLabel="Next notifications page"
        disabled={locked} accessibilityState={{ disabled: locked }} onPress={() => void state.nextPage()} style={styles.action}>
        <Text style={styles.actionLabel}>Next page</Text>
      </Pressable> : null}
      <Text style={styles.hint}>Up to 20 notifications per page. Refresh returns to the newest page.</Text>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 12, gap: 6, ...cardShadow },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  title: { ...SECTION_HEADING, color: colors.text, flexShrink: 1 },
  iconAction: { minWidth: 44, minHeight: 44, marginLeft: 'auto', alignItems: 'center', justifyContent: 'center' },
  segments: { flexDirection: 'row', backgroundColor: FOCAL.mistJade, borderRadius: 12, padding: 2, gap: 2 },
  segment: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentOn: { backgroundColor: FOCAL.jadeInk },
  segmentLabel: { color: colors.textMuted, ...TYPE.button, ...figtree('700'), textAlign: 'center' },
  segmentLabelOn: { color: colors.onAccent },
  unread: { color: colors.primary, ...TYPE.caption, ...figtree('700') },
  hint: { ...figtree('400'), color: colors.textMuted, ...TYPE.body,  },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  action: { minWidth: 44, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 8,
    paddingVertical: 4, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  actionLabel: { color: colors.primary, ...TYPE.body,  ...figtree('700') },
  selected: { minHeight: 44, borderColor: colors.text, backgroundColor: FOCAL.mistJade },
  error: { ...figtree('400'), color: colors.danger, ...TYPE.body,  },
  empty: { paddingVertical: 4, gap: 4 },
  item: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 4, gap: 4 },
  unreadItem: { borderColor: colors.primary },
  itemTitle: { color: colors.text, ...TYPE.body, ...figtree('700') },
  body: { ...figtree('400'), color: colors.text, ...TYPE.body,  },
  disabled: { minHeight: 44, opacity: 0.5 },
});
