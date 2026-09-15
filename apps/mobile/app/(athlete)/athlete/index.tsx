import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Stack, type Href, useRouter } from 'expo-router';

import { TrainingBadgeBoard } from '@/components/Athlete/TrainingBadgeBoard';
import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenHeading } from '@/components/ScreenHeading';
import { ScreenShell } from '@/components/ScreenShell';
import { TagConfirmList } from '@/components/Spotlight/TagConfirmList';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { EmptyState } from '@/components/UI/EmptyState';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { displayValue } from '@/data/players';
import { useAthleteTrainingBadges } from '@/hooks/useAthleteTrainingBadges';
import { usePendingPlayerTags } from '@/hooks/usePendingPlayerTags';
import { useRoster } from '@/hooks/useRoster';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { TipLedgerEntry } from '@/types/database';

/**
 * @purpose Athlete HQ: confirm pending tags, private Mālo ledger, training badges, and display name that writes `profiles.full_name`.
 * @sideEffects `tips` SELECT; `profiles` UPDATE on Save name; tag confirm RPCs via `usePendingPlayerTags`; `sync_athlete_training_badges`.
 */
export default function AthleteHomeScreen() {
  const router = useRouter();
  const { profile, refreshProfile, user, isAdmin } = useAuth();
  const { players } = useRoster();
  const pending = usePendingPlayerTags();
  const claimedId = profile?.player_id ?? null;
  const athlete = claimedId ? (players.find((item) => item.id === claimedId) ?? null) : null;
  const training = useAthleteTrainingBadges(claimedId);
  const [tips, setTips] = useState<TipLedgerEntry[]>([]);
  const [headline, setHeadline] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.full_name) setHeadline(profile.full_name);
  }, [profile?.full_name]);

  const loadTips = useCallback(async () => {
    if (!claimedId) {
      setTips([]);
      return;
    }
    const { data } = await supabase
      .from('tips')
      .select('*')
      .eq('player_id', claimedId)
      .order('created_at', { ascending: false })
      .limit(20);
    setTips((data as TipLedgerEntry[] | null) ?? []);
  }, [claimedId]);

  useEffect(() => {
    void loadTips();
  }, [loadTips]);

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
    const { error } = await supabase.from('profiles').update({ full_name: next }).eq('user_id', user.id);
    if (error) {
      setSaveMsg(error.message);
    } else {
      await refreshProfile();
      setSaveMsg('Saved to Profile.');
    }
    setSaving(false);
  };

  const resolveTag = async (id: string, action: 'confirm' | 'reject') => {
    await pending.resolve(id, action);
    if (action === 'confirm') void training.refresh();
  };

  const total = tips.reduce((sum, tip) => sum + tip.amount_cents, 0);

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Athlete' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeading
          kicker="Tapua'i athlete"
          title="Athlete HQ"
          lede="Private Mālo ledger, badges, and confirm fan tags that name you."
        />
        <TagConfirmList
          tags={pending.tags}
          busyId={pending.busyId}
          error={pending.error}
          emptyText="No one has tagged you in a clip that still needs That's me."
          onConfirm={(id) => void resolveTag(id, 'confirm')}
          onReject={(id) => void resolveTag(id, 'reject')}
        />
        <DashboardPanel
          title="Private Mālo ledger"
          body={
            athlete
              ? `${displayValue(athlete.name)} has received $${(total / 100).toFixed(2)} from fans.`
              : claimedId
                ? 'Roster row is claimed. Tips for that athlete land here after PaymentSheet checkouts.'
                : 'No linked athlete profile yet. Unlock Athlete from Profile → Account Capability.'
          }
        >
          {tips.length === 0 ? (
            <EmptyState
              kicker="Mālo"
              title="No Mālo yet"
              lede="Tips land here after PaymentSheet checkouts on your tagged clips."
              actionLabel="Open Profile"
              onAction={() => router.push('/profile' as Href)}
              adminHref="/admin/money"
              adminLabel="Open Money"
            />
          ) : (
            tips.map((tip) => (
              <Text key={tip.id} style={styles.row}>
                ${(tip.amount_cents / 100).toFixed(2)} · {new Date(tip.created_at).toLocaleDateString()}
              </Text>
            ))
          )}
        </DashboardPanel>
        <DashboardPanel
          title="Training badges"
          body="Earned from That's me, Mālo received, and a claimed roster — not placeholder chips."
        >
          <TrainingBadgeBoard
            badges={training.badges}
            rosterClaimed={training.rosterClaimed}
            loading={training.loading}
          />
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
