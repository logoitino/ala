import { StyleSheet, Text, View } from 'react-native';

import { AdminBtn, AdminEmpty, AdminNotice, AdminPanel, AdminRow } from '@/components/Admin/AdminChrome';
import { DashboardPanel } from '@/components/DashboardPanel';
import { colors } from '@/constants/theme';
import type { PendingPlayerTag } from '@/types/database';

type TagConfirmListProps = {
  tags: PendingPlayerTag[];
  busyId?: string | null;
  error?: string | null;
  emptyText?: string;
  /** Admin chrome vs Athlete / Parent / Operator HQ panel. */
  variant?: 'admin' | 'hq';
  onConfirm: (reelId: string) => void;
  onReject: (reelId: string) => void;
};

/**
 * @purpose That's me / That's our player queue. Confirmed tags enter Player of the Week scoring; rejected tags do not.
 * @param tags Pending `reels` rows for people allowed to verify the jersey.
 * @sideEffects Parent calls `confirm_reel_player_tag`.
 */
export function TagConfirmList({
  tags,
  busyId,
  error,
  emptyText = 'No pending player tags.',
  variant = 'hq',
  onConfirm,
  onReject,
}: TagConfirmListProps) {
  const rows = tags.map((tag) => {
    const hype = tag.seki_count + tag.aura_count + tag.flex_count;
    const who = tag.uploader_name ? `Clip by ${tag.uploader_name}` : 'Fan clip';
    const meta = `${tag.school_name || 'Untagged school'} · ${hype} hype · ${who}`;
    const busy = busyId === tag.id;
    const actions = (
      <View style={styles.actions}>
        <AdminBtn
          label={busy ? 'Saving' : "That's them"}
          kind="primary"
          disabled={Boolean(busyId)}
          onPress={() => onConfirm(tag.id)}
        />
        <AdminBtn
          label="Not them"
          kind="danger"
          disabled={Boolean(busyId)}
          onPress={() => onReject(tag.id)}
        />
      </View>
    );
    if (variant === 'admin') {
      return (
        <AdminRow key={tag.id} title={`${tag.player_name} · ${tag.title}`} meta={meta}>
          {actions}
        </AdminRow>
      );
    }
    return (
      <View key={tag.id} style={styles.hqRow}>
        <Text style={styles.hqTitle}>{tag.player_name}</Text>
        <Text style={styles.hqMeta}>{tag.title}</Text>
        <Text style={styles.hqMeta}>{meta}</Text>
        {actions}
      </View>
    );
  });

  if (variant === 'admin') {
    return (
      <AdminPanel title="Pending tags">
        {error ? <AdminNotice text={error} tone="danger" /> : null}
        {tags.length === 0 ? <AdminEmpty text={emptyText} /> : rows}
      </AdminPanel>
    );
  }

  return (
    <DashboardPanel
      title="Is this you?"
      body="Fans can tag a jersey. Only you, a parent, your school operator, or admin can confirm it. Confirmed Game Play hype elects Player of the Week."
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {tags.length === 0 ? <Text style={styles.empty}>{emptyText}</Text> : rows}
    </DashboardPanel>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hqRow: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  hqTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  hqMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
