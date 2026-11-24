/** UX-20 removes the extra explanation row at rest without overlapping any touch targets.
 * The inbox remains separate from factual Activity and invitation queues. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { cardShadow, colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNotificationInbox } from '@/hooks/useNotifications';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

const EXPLANATION = 'New connected account updates appear here. Your gift history and invitations stay in their own sections.';

/** @purpose Review read/unread and archived notifications without mutating receipt or invitation history. */
export function NotificationInbox({ enabled = true }: { enabled?: boolean }) {
  const { user, isGuest } = useAuth();
  const router = useRouter();
  const state = useNotificationInbox(enabled && Boolean(user && !isGuest));
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!user || isGuest) return null;
  const { page, archived, loading, busy, error, notice } = state;
  const locked = loading || busy || !enabled;

  return <View style={styles.card}>
    <View style={styles.heading}>
      <View style={styles.headingLabels}>
        <Text accessibilityRole="header" style={styles.title}>Notifications</Text>
        {page ? <Text style={styles.unread}>{page.unreadCount} unread{archived ? ' in inbox' : ''}</Text> : null}
      </View>
      <Pressable accessibilityRole="button"
        accessibilityLabel={detailsOpen ? 'Less about notifications' : `More about notifications. ${EXPLANATION}`}
        aria-expanded={detailsOpen}
        onPress={() => setDetailsOpen(open => !open)} style={styles.detailsToggle}>
        <Text style={styles.actionLabel}>{detailsOpen ? 'Less' : 'More'}</Text>
      </Pressable>
    </View>
    {detailsOpen ? <Text style={styles.hint}>{EXPLANATION}</Text> : null}
    <View testID="notification-segments" accessibilityRole="tablist" style={styles.segments}>
      <Pressable accessibilityRole="tab" accessibilityLabel="Current notifications" accessibilityState={{ selected: !archived, disabled: locked }}
        disabled={locked} onPress={() => void state.showArchived(false)} style={[styles.segment, !archived && styles.segmentOn]}>
        <Text style={[styles.segmentLabel, !archived && styles.segmentLabelOn]}>Inbox</Text>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel="Archived notifications" accessibilityState={{ selected: archived, disabled: locked }}
        disabled={locked} onPress={() => void state.showArchived(true)} style={[styles.segment, archived && styles.segmentOn]}>
        <Text style={[styles.segmentLabel, archived && styles.segmentLabelOn]}>Archived</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh notifications" accessibilityState={{ disabled: locked }}
        disabled={locked} onPress={() => void state.reload()} style={[styles.iconAction, locked && styles.disabled]}>
        <Ionicons name="refresh" size={18} color={colors.primary} />
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
        <Text style={styles.itemMetadata}>{item.readAt ? 'Read' : 'Unread'} · {new Date(item.createdAt).toLocaleDateString()}</Text>
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
      <Text style={styles.hint}>Up to 20 notifications per page. The refresh button returns to the newest page.</Text>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, paddingVertical: 6, paddingHorizontal: 10, gap: 4, ...cardShadow },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headingLabels: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
  title: { ...TYPE.body, ...figtree('700'), color: colors.text, flexShrink: 1 },
  detailsToggle: { minWidth: 44, minHeight: 44, maxWidth: '40%', paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  iconAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  // Each button owns its layout box; there is no overhanging hit area to clear.
  segments: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: FOCAL.mistJade, borderRadius: 12, gap: 2 },
  // Let the wider label claim the space it needs before sharing the leftover width.
  segment: { flexGrow: 1, flexShrink: 1, minWidth: 44, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentOn: { backgroundColor: FOCAL.jadeInk },
  segmentLabel: { color: colors.textMuted, ...TYPE.button, ...figtree('700'), textAlign: 'center' },
  segmentLabelOn: { color: colors.onAccent },
  unread: { color: colors.primary, ...TYPE.caption, ...figtree('700'), flexShrink: 1 },
  hint: { ...figtree('400'), color: colors.textMuted, ...TYPE.body,  },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  action: { minWidth: 44, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 8,
    paddingVertical: 4, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  actionLabel: { color: colors.primary, ...TYPE.body,  ...figtree('700') },
  error: { ...figtree('400'), color: colors.danger, ...TYPE.body,  },
  empty: { paddingVertical: 4, gap: 4 },
  item: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 4, gap: 4 },
  unreadItem: { borderColor: colors.primary },
  itemTitle: { color: colors.text, ...TYPE.body, ...figtree('700') },
  itemMetadata: { ...TYPE.caption, ...figtree('400'), color: colors.textMuted },
  body: { ...figtree('400'), color: colors.text, ...TYPE.body,  },
  disabled: { minHeight: 44, opacity: 0.5 },
});
