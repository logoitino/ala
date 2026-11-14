/**
 * FEED-01 Highlights desk note: interest picks are viewer Settings; Phase 2 stays env-gated.
 * Operators do not edit another user's prefs (owner-only RLS). No per-user ranking report.
 */
import { StyleSheet, Text, View } from 'react-native';

import { AdminPanel } from '@/components/Admin/AdminChrome';
import { colors } from '@/constants/theme';
import { feedImplicitSignalsEnabled } from '@/data/highlights';

/**
 * @purpose Admin/Highlights operational surface for FEED-01: where prefs live, how to disable,
 *   and that Phase 2 collection/ranking is off until counsel clears the env flag.
 */
export function FeedInterestPanel() {
  const phase2 = feedImplicitSignalsEnabled();
  return (
    <AdminPanel title="Interest feed (FEED-01)">
      <Text style={styles.body}>
        Signed-in viewers set sports, schools, and a category lean in Settings → Highlights (and a
        first-run sheet). Rows live in `user_feed_prefs` (owner-only RLS; deleted with the account).
        Staff never edit another viewer's picks. Ranking is client-side on `reels_feed` — money and
        ads never move order.
      </Text>
      <View style={styles.row}>
        <Text style={styles.label}>Personal feed off</Text>
        <Text style={styles.value}>Viewer toggle → newest-first Home, no bonuses</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Phase 2 / 3</Text>
        <Text style={[styles.value, phase2 ? styles.warn : null]}>
          {phase2
            ? 'EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS is ON — counsel gates must already be cleared'
            : 'OFF (default) — no view/save/hide collection or diversity until counsel clears'}
        </Text>
      </View>
      <Text style={styles.hint}>
        No staff report lists individual picks (privacy). Coverage maps the Home surface; pause is
        the viewer toggle plus keeping the Phase 2 env flag off.
      </Text>
    </AdminPanel>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  row: { marginBottom: 8, gap: 2 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' },
  value: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  warn: { color: colors.danger },
  hint: { marginTop: 4, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
});
