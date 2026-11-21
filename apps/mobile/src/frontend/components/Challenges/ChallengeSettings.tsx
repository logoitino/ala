/** Own CHAL-01 settings, private self-report badges and explicit private-data CSV export.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fetchMyChallengeStatus, setChallengeMute, setAllowChallenges, exportMyChallengeData } from '@/lib/challenges';
import { exportCsv } from '@/lib/csvExport';
import { useChallenges } from '@/hooks/useChallenges';
import { NOT_SWITCHED_ON } from '@/lib/rpc';
import { colors } from '@/constants/theme';
import { ChallengeButton, ChallengeFeedback } from './ChallengeControls';
import { TYPE, figtree } from '@/theme/fonts';

// Explicit own export only. Quote cells and guard spreadsheet formulas; no payload is displayed or persisted here.
const cell = (value: unknown) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  const safe = /^[\s\u200B-\u200F\uFEFF]*[=+@-]/u.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
function csv(data: Record<string, unknown>) {
  const lines = ['section,record,field,value'];
  for (const [section, value] of Object.entries(data)) {
    const records = Array.isArray(value) ? value : [value];
    records.forEach((record, index) => {
      if (record && typeof record === 'object') {
        for (const [field, item] of Object.entries(record)) lines.push([section, index, field, item].map(cell).join(','));
      } else lines.push([section, index, 'value', record].map(cell).join(','));
    });
  }
  return lines.join('\r\n');
}

/**
 * @purpose Workout-challenge mute, private badges, and the owner's export. Mounted from Account settings.
 * @param active When false, the panel does not read or write.
 * @returns The settings section, or nothing when the database update is not applied.
 * @sideEffects Reads challenge status and writes mute, athlete allowance, and the private CSV export.
 */
export function ChallengeSettings({ active = true }: { active?: boolean }) {
  const read = useCallback(async (actor: string | null) => {
    if (!actor) throw Error('Sign in to manage challenges.');
    return fetchMyChallengeStatus(actor);
  }, []);
  const model = useChallenges('settings', active, read);
  const status = model.data;
  const disabled = model.busy || model.reading || !model.ready;
  if (model.error === NOT_SWITCHED_ON) return null;
  return (
    <View style={styles.section}>
      <ChallengeFeedback error={model.error} notice={model.notice} reading={model.reading} />
      {!model.canRead ? <Text style={styles.note}>Sign in to manage your workout challenges.</Text> : null}
      {status ? (
        <>
          {!status.enabled ? (
            <Text style={styles.status}>Workout challenges are paused. Your private history and settings remain available.</Text>
          ) : null}
          {status.isAthlete ? (
            <View style={styles.block}>
              <ChallengeButton
                label="Allow challenges on my workouts"
                selected={status.allowChallenges}
                disabled={disabled}
                onPress={() => void model.run(async (actor) => {
                  await setAllowChallenges(!status.allowChallenges, actor);
                  return status.allowChallenges ? 'Challenges on your workouts are off.' : 'Challenges on your workouts are on.';
                })}
              />
              <Text style={styles.note}>Minor athlete defaults are off. Changing this setting is included in guardian supervision.</Text>
            </View>
          ) : null}
          <ChallengeButton
            label={status.mutedAll ? 'Allow challenge invites again' : 'Mute all challenge invites'}
            disabled={disabled}
            onPress={() => void model.run(async (actor) => {
              await setChallengeMute(null, !status.mutedAll, actor);
              return status.mutedAll ? 'All-invite mute removed.' : 'All challenge invites muted.';
            })}
          />
          {status.mutedSenders.map((sender) => (
            <ChallengeButton
              key={sender.profileId}
              label={`Unmute ${sender.name}`}
              disabled={disabled}
              onPress={() => void model.run(async (actor) => {
                await setChallengeMute(sender.profileId, false, actor);
                return 'Sender mute removed.';
              })}
            />
          ))}
          <View style={styles.notes}>
            <Text style={styles.note}>Private and noncash. Badges reflect self-reported responses, not verified exercise completion.</Text>
            {status.badges.map((badge) => (
              <View key={badge.badge}>
                <Text style={styles.badge}>Challenge finisher</Text>
                <Text style={styles.note}>Earned {badge.earnedAt.slice(0, 10)} by reporting “Did it!” on three workouts.</Text>
              </View>
            ))}
            {status.badges.length === 0 ? <Text style={styles.note}>No private challenge badges recorded.</Text> : null}
            <Text style={styles.note}>Export includes your private challenge records and account links. Save or share only if you intend to disclose them.</Text>
          </View>
          <ChallengeButton
            label="Export my challenge data"
            disabled={disabled}
            onPress={() => void model.run(async (actor, accepted) => {
              const data = await exportMyChallengeData(actor);
              if (!accepted()) return '';
              const result = await exportCsv('tapuai-challenges.csv', csv(data));
              return result === 'downloaded'
                ? 'Challenge data downloaded.'
                : result === 'dismissed'
                  ? 'Export sharing dismissed.'
                  : 'Challenge data shared with your selected destination.';
            })}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  status: {
    color: colors.text,
    ...TYPE.body,

    ...figtree('700'),
  },
  block: { gap: 6 },
  notes: { gap: 6 },
  note: { ...figtree('400'), color: colors.textMuted, ...TYPE.body,  },
  badge: { color: colors.text, ...TYPE.body, ...figtree('800') },
});
