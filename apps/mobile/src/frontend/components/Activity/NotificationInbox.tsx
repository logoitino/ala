/** The bounded notification inbox is separate from factual Activity and its existing invitation queues. */
import { type Href, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { cardShadow, colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNotificationInbox } from '@/hooks/useNotifications';
import { FOCAL } from '@/theme/motion';

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
    </View>
    <Text style={styles.hint}>New connected account updates appear here. Your donation history and invitations stay in their own sections.</Text>
    <View style={styles.controls}>
      <Pressable accessibilityRole="tab" accessibilityLabel="Current notifications" accessibilityState={{ selected: !archived, disabled: locked }}
        disabled={locked} onPress={() => void state.showArchived(false)} style={[styles.action, !archived && styles.selected]}>
        <Text style={styles.actionLabel}>Inbox</Text>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel="Archived notifications" accessibilityState={{ selected: archived, disabled: locked }}
        disabled={locked} onPress={() => void state.showArchived(true)} style={[styles.action, archived && styles.selected]}>
        <Text style={styles.actionLabel}>Archived</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh notifications" accessibilityState={{ disabled: locked }}
        disabled={locked} onPress={() => void state.reload()} style={styles.action}>
        <Text style={styles.actionLabel}>Refresh</Text>
      </Pressable>
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.hint}>{notice}</Text> : null}
    {loading ? <ActivityIndicator accessibilityLabel="Loading notifications" color={FOCAL.violetInk} /> : null}
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
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: 16, gap: 12, ...cardShadow },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  unread: { color: FOCAL.violetInk, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 12,
    paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  actionLabel: { color: FOCAL.violetInk, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  selected: { borderColor: FOCAL.violetInk, backgroundColor: FOCAL.mistViolet },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  empty: { paddingVertical: 8, gap: 8 },
  item: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, gap: 8 },
  unreadItem: { borderColor: FOCAL.violetInk },
  itemTitle: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  disabled: { opacity: 0.5 },
});
