/** Existing athlete support screen/helper: visible money copy names personal gifts; identifiers and financial behavior stay unchanged. */
import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, type Href, useRouter } from 'expo-router';

import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenHeading } from '@/components/ScreenHeading';
import { FOCAL } from '@/theme/motion';
import { ScreenShell } from '@/components/ScreenShell';
import { TagConfirmList } from '@/components/Spotlight/TagConfirmList';
import { KitButton } from '@/components/UI/Kit';
import { EmptyState } from '@/components/UI/EmptyState';
import { colors, KIT, radii, SCOREBOARD_DIGITS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { displayValue } from '@/data/players';
import { usePendingPlayerTags } from '@/hooks/usePendingPlayerTags';
import { useReceivedMalo } from '@/hooks/useReceivedMalo';
import { tipChannelLabel } from '@/lib/finance';
import { updateOwnDisplayName } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

/** Training badge names stay as shipped; icons are decorative and progress is not shown until it is measured. */
const BADGES: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Film Room · Starter', icon: 'film-outline' },
  { label: 'Community Favorite', icon: 'heart-outline' },
  { label: 'Friday Night Lights', icon: 'flame-outline' },
];

/**
 * @purpose Athlete HQ: confirm pending tags, private Mālo ledger, and display name that writes `profiles.full_name`.
 * @sideEffects `get_received_malo`; `updateOwnDisplayName` on Save name; tag confirm RPCs via `usePendingPlayerTags`.
 */
export default function AthleteHomeScreen() {
  const router = useRouter();
  const { profile, refreshProfile, user, isAdmin } = useAuth();
  const pending = usePendingPlayerTags();
  const received = useReceivedMalo(profile?.player_id ?? null);
  const [headline, setHeadline] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.full_name) setHeadline(profile.full_name);
  }, [profile?.full_name]);

  const saveHeadline = async () => {
    const next = headline.trim();
    if (!next) {
      setSaveMsg('Add a display name first.');
      return;
    }
    if (!user?.id || !isSupabaseConfigured) {
      setSaveMsg('Sign in to save your name to Profile.');
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    const error = await updateOwnDisplayName(user.id, next);
    if (error) {
      setSaveMsg(error);
    } else {
      await refreshProfile();
      setSaveMsg('Saved to Profile.');
    }
    setSaving(false);
  };

  const total = received.totalCents;
  const athleteName = displayValue(profile?.full_name, 'You');

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Athlete' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeading
          kicker="Tapua'i athlete"
          title="Athlete HQ"
          lede="Your private gift record, badges, and fan tags that name you."
          accent={FOCAL.jadeInk}
        />
        <TagConfirmList
          tags={pending.tags}
          busyId={pending.busyId}
          error={pending.error}
          emptyText="No one has tagged you in a clip that still needs That's me."
          onConfirm={(id) => void pending.resolve(id, 'confirm')}
          onReject={(id) => void pending.resolve(id, 'reject')}
        />
        {/* Gift total leads as a scoreboard card; the amount is the recorded ledger total, never an estimate. */}
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>Private gift record</Text>
          {profile?.player_id ? (
            <>
              <Text style={styles.heroTotal}>${(total / 100).toFixed(2)}</Text>
              <Text style={styles.heroLede}>{athleteName} has received this from fans.</Text>
            </>
          ) : (
            <Text style={styles.heroLede}>No linked athlete profile yet. Unlock Athlete from Profile → Account Capability.</Text>
          )}
        </View>
        <DashboardPanel title="Gifts">
          {received.loading ? (
            <ActivityIndicator color={colors.deepGreen} />
          ) : received.rows.length === 0 ? (
            <EmptyState
              kicker="Gifts"
              title="No gifts yet"
              lede="Gifts from a Highlight, a QR link, a wishlist item, your profile, or a live play show up here."
              actionLabel="Open Profile"
              onAction={() => router.push('/profile' as Href)}
              adminHref="/admin/money"
              adminLabel="Open Money"
            />
          ) : (
            received.rows.map((tip) => (
              <View key={tip.id} style={styles.giftRow}>
                <View style={styles.giftIcon}>
                  <Ionicons name="gift-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.giftText}>
                  <Text style={styles.giftName}>{tip.fan_name}</Text>
                  <Text style={styles.muted}>
                    {tipChannelLabel(tip.origin, tip.entry, tip.source_label)} · {new Date(tip.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.giftAmount}>${(tip.amount_cents / 100).toFixed(2)}</Text>
              </View>
            ))
          )}
        </DashboardPanel>
        <DashboardPanel title="Training badges" body="Unlocked by live-game volume and fan support.">
          {BADGES.map((badge) => (
            <View key={badge.label} style={styles.badgeRow}>
              <View style={styles.badgeIcon}>
                <Ionicons name={badge.icon} size={22} color={colors.gold} />
              </View>
              <Text style={styles.badge}>{badge.label}</Text>
            </View>
          ))}
        </DashboardPanel>
        <DashboardPanel title="Profile customization" body="Display name writes to your fan Profile. Roster (sport, team, class year) lives on Account Capability.">
          <TextInput
            value={headline}
            onChangeText={(value) => {
              setHeadline(value);
              setSaveMsg(null);
            }}
            placeholder="Display name / headline"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Display name / headline"
            style={styles.input}
          />
          <KitButton
            label={saving ? 'Saving…' : 'Save name'}
            accessibilityLabel="Save display name"
            haptic="medium"
            block
            disabled={saving}
            onPress={() => void saveHeadline()}
          />
          {saveMsg ? <Text style={styles.muted}>{saveMsg}</Text> : null}
          <View style={styles.actionRow}>
            <KitButton
              label="Edit roster on Profile"
              variant="secondary"
              style={styles.flex}
              onPress={() => router.push('/profile' as Href)}
            />
            {isAdmin ? (
              <KitButton
                label="Open Athletes desk"
                variant="ghost"
                style={styles.flex}
                onPress={() => router.push('/admin/athletes' as Href)}
              />
            ) : null}
          </View>
        </DashboardPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  hero: {
    backgroundColor: colors.videoSurface,
    borderRadius: KIT.heroRadius,
    padding: 20,
    gap: 6,
  },
  heroKicker: {
    color: colors.onVideoMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTotal: {
    ...SCOREBOARD_DIGITS,
    color: colors.glow,
    fontSize: 44,
  },
  heroLede: {
    color: colors.onVideo,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  giftIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftText: {
    flex: 1,
    gap: 2,
  },
  giftName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  giftAmount: {
    ...SCOREBOARD_DIGITS,
    fontSize: 17,
    color: colors.text,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: KIT.controlRadius,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flex: {
    flexGrow: 1,
  },
});
