/** Existing athlete support screen/helper: visible money copy names personal gifts; identifiers and financial behavior stay unchanged. */
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Stack, type Href, useRouter } from 'expo-router';

import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenHeading } from '@/components/ScreenHeading';
import { ScreenShell } from '@/components/ScreenShell';
import { TagConfirmList } from '@/components/Spotlight/TagConfirmList';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { EmptyState } from '@/components/UI/EmptyState';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { displayValue } from '@/data/players';
import { usePendingPlayerTags } from '@/hooks/usePendingPlayerTags';
import { useReceivedMalo } from '@/hooks/useReceivedMalo';
import { tipChannelLabel } from '@/lib/finance';
import { updateOwnDisplayName } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

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
        />
        <TagConfirmList
          tags={pending.tags}
          busyId={pending.busyId}
          error={pending.error}
          emptyText="No one has tagged you in a clip that still needs That's me."
          onConfirm={(id) => void pending.resolve(id, 'confirm')}
          onReject={(id) => void pending.resolve(id, 'reject')}
        />
        <DashboardPanel
          title="Private gift record"
          body={
            profile?.player_id
              ? `${athleteName} has received $${(total / 100).toFixed(2)} from fans.`
              : 'No linked athlete profile yet. Unlock Athlete from Profile → Account Capability.'
          }
        >
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
              <Text key={tip.id} style={styles.row}>
                {tip.fan_name} · ${((tip.amount_cents) / 100).toFixed(2)} · {tipChannelLabel(tip.origin, tip.entry, tip.source_label)} · {new Date(tip.created_at).toLocaleDateString()}
              </Text>
            ))
          )}
        </DashboardPanel>
        <DashboardPanel title="Training badges" body="Unlocked by live-game volume and fan support.">
          <Text style={styles.badge}>Film Room · Starter</Text>
          <Text style={styles.badge}>Community Favorite</Text>
          <Text style={styles.badge}>Friday Night Lights</Text>
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
            style={styles.input}
          />
          <AnimatedButton
            accessibilityLabel="Save display name"
            haptic="medium"
            disabled={saving}
            onPress={() => void saveHeadline()}
            contentStyle={[styles.saveBtn, saving && styles.saveBtnOff]}
          >
            <Text style={styles.saveLabel}>{saving ? 'Saving…' : 'Save name'}</Text>
          </AnimatedButton>
          {saveMsg ? <Text style={styles.muted}>{saveMsg}</Text> : null}
          <AnimatedButton
            accessibilityLabel="Edit roster on Profile"
            haptic="light"
            onPress={() => router.push('/profile' as Href)}
            contentStyle={styles.secondaryBtn}
          >
            <Text style={styles.secondaryLabel}>Edit roster on Profile</Text>
          </AnimatedButton>
          {isAdmin ? (
            <AnimatedButton
              accessibilityLabel="Open Athletes desk"
              haptic="light"
              onPress={() => router.push('/admin/athletes' as Href)}
              contentStyle={styles.secondaryBtn}
            >
              <Text style={styles.secondaryLabel}>Open Athletes desk</Text>
            </AnimatedButton>
          ) : null}
        </DashboardPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 14,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  row: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  badge: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.deepGreen,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  saveBtn: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  saveBtnOff: {
    opacity: 0.55,
  },
  saveLabel: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    minHeight: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryLabel: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
  },
});
