/**
 * The supervision summary (MINOR-01): exactly what a linked guardian sees, and what the teen sees under "What your
 * guardian sees". Settings, safety counts (never who) and recent changes. Read-only.
 * QUIZ-05: the fun facts audience (when the server has it) and "Fun facts shared: n" from the server's count.
 */
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { BAND_LABEL, describeEvent, type Supervision } from '@/lib/minors';
import { AUDIENCE_LABEL, PRIVACY_ITEMS } from '@/lib/privacy';

const REQUESTS_LABEL = { everyone: 'anyone', teens: 'other teens only', nobody: 'nobody' } as const;

function when(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** @purpose Settings, counts and the event list for one teen. */
export function SupervisionSummary({ data }: { data: Supervision }) {
  const { settings, summary, status } = data;
  return (
    <View style={styles.wrap}>
      <Text style={styles.line}>
        {`${settings.accountPrivate ? 'Private' : 'Public'} account · ${status ? BAND_LABEL[status.ageBand] : ''} · friend requests from ${REQUESTS_LABEL[settings.friendRequestsFrom]}`}
      </Text>
      <Text style={styles.muted}>
        {[...PRIVACY_ITEMS.map((item) => `${item.label}: ${AUDIENCE_LABEL[settings.audience[item.key]]}`),
          ...(settings.funFacts ? [`Fun facts: ${AUDIENCE_LABEL[settings.funFacts]}`] : [])].join(' · ')}
      </Text>
      <View style={styles.counts}>
        <Text style={styles.count}>{`${summary.friends} friends`}</Text>
        <Text style={styles.count}>{`${summary.incomingRequests} requests waiting`}</Text>
        <Text style={styles.count}>{`${summary.blockedAccounts} blocked`}</Text>
        <Text style={styles.count}>{`${summary.tagsWaiting} tags to review`}</Text>
        <Text style={styles.count}>{summary.hiddenFromSearch ? 'Hidden from search' : 'Shown in search'}</Text>
        <Text style={styles.count}>{`${summary.challengeInvites7d} workout invites this week`}</Text>
        {summary.funFactsShared !== null ? <Text style={styles.count}>{`Fun facts shared: ${summary.funFactsShared}`}</Text> : null}
      </View>
      <Text style={styles.heading}>Recent changes</Text>
      {data.events.length === 0 ? <Text style={styles.muted}>Nothing yet.</Text> : null}
      {data.events.slice(0, 10).map((event, index) => (
        <Text key={`${event.at}-${index}`} style={styles.muted}>{`${when(event.at)} · ${describeEvent(event)}`}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  line: { fontSize: 14, fontWeight: '700', color: colors.text },
  muted: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  count: { fontSize: 12, fontWeight: '700', color: colors.text, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  heading: { marginTop: 4, fontSize: 13, fontWeight: '800', color: colors.text },
});
