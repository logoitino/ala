import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminRow,
} from '@/components/Admin/AdminChrome';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { fetchAdminOpsInbox } from '@/lib/adminCatalog';
import { fetchAdminTelemetryDigest } from '@/lib/admin';
import { fetchAppFeedback, type AppFeedback } from '@/lib/feedback';
import { EMPTY_COMPANY_REVENUE, fetchCompanyRevenueSummary, type CompanyRevenueSummary } from '@/lib/finance';
import { applyFeedbackToDraft, parseLabRuntimeJson } from '@/lib/runtime';
import { formatTipDollars } from '@/lib/reels';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Engineer Lab: validated runtime JSON + apply a triaged suggestion, then the same Publish to app.
 * @sideEffects `patch_app_runtime_draft` / `publish_app_runtime`; reads feedback, telemetry, revenue, pending tags.
 */
export function LabTool() {
  const router = useRouter();
  const params = useLocalSearchParams<{ feedbackId?: string | string[] }>();
  const feedbackId = Array.isArray(params.feedbackId) ? params.feedbackId[0] : params.feedbackId;
  const { draft, published, dirty, pendingCount, publishedAt, saveDraft, publishLive, discardDraft } = useAppRuntime();
  const [json, setJson] = useState(() => JSON.stringify(draft, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  const [queue, setQueue] = useState<AppFeedback[]>([]);
  const [revenue, setRevenue] = useState<CompanyRevenueSummary>(EMPTY_COMPANY_REVENUE);
  const [stalls, setStalls] = useState(0);
  const [pendingTags, setPendingTags] = useState(0);
  const [loading, setLoading] = useState(true);

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, digest, money, inbox] = await Promise.all([
        fetchAppFeedback(),
        fetchAdminTelemetryDigest(),
        fetchCompanyRevenueSummary(),
        fetchAdminOpsInbox(),
      ]);
      setQueue(rows.filter((row) => row.status === 'planned' || row.status === 'shipping' || row.id === feedbackId));
      setStalls(digest.stalls);
      setRevenue(money);
      setPendingTags(inbox.pendingTags);
    } finally {
      setLoading(false);
    }
  }, [feedbackId]);

  useFocusEffect(
    useCallback(() => {
      setJson(JSON.stringify(draftRef.current, null, 2));
      void refresh();
    }, [refresh]),
  );

  const focused = queue.find((row) => row.id === feedbackId) ?? queue[0] ?? null;
  const unpublished = pendingCount;

  const applyJson = async () => {
    try {
      const next = parseLabRuntimeJson(json);
      setParseError(null);
      await saveDraft(next);
      setJson(JSON.stringify(next, null, 2));
    } catch (caught) {
      setParseError(caught instanceof Error ? caught.message : 'Could not parse this draft.');
    }
  };

  const applyRow = async (row: AppFeedback) => {
    const next = applyFeedbackToDraft(draft, row);
    await saveDraft(next);
    setJson(JSON.stringify(next, null, 2));
    setParseError(null);
  };

  const prettyDiff = useMemo(() => {
    const copyHits = (Object.keys(draft.copy) as (keyof typeof draft.copy)[]).filter(
      (key) => draft.copy[key] !== published.copy[key],
    ).length;
    return `${unpublished} unpublished · ${copyHits} copy field${copyHits === 1 ? '' : 's'} differ from live`;
  }, [draft.copy, published.copy, unpublished]);

  return (
    <AdminPage
      title="Lab"
      lede="Edit the live chrome draft as JSON. This is not a git IDE — Publish to app ships the same runtime map Features and Look write."
      saveMode="publish"
      refreshing={loading}
      onRefresh={() => void refresh()}
    >
      <AdminPanel title={dirty ? prettyDiff : 'Live with the fan app'}>
        <Text style={styles.body}>
          {publishedAt ? `Last published ${publishedAt.replace('T', ' ').slice(0, 16)} UTC.` : 'Defaults are on until the first publish.'}
        </Text>
        <AdminBtn label={dirty ? 'Publish to app' : 'Already live'} kind="primary" disabled={!dirty} onPress={() => void publishLive()} />
        {dirty ? <AdminBtn label="Discard draft" kind="danger" onPress={() => void discardDraft()} /> : null}
        <AdminNotice text={dirty ? 'Fans still see published until you hit Publish to app.' : null} tone="warn" />
      </AdminPanel>

      <View style={styles.health}>
        <Text style={styles.section}>Health (read-only)</Text>
        <AdminRow title={`QA stalls · ${stalls}`} meta="Open QA for the stall table">
          <AdminBtn label="QA" onPress={() => router.push('/admin/qa')} />
        </AdminRow>
        <AdminRow
          title={`Gross ${formatTipDollars(revenue.gross_volume_cents)} · net ${formatTipDollars(revenue.company_net_cents)}`}
          meta="Open Money for the full ledger"
        >
          <AdminBtn label="Money" onPress={() => router.push('/admin/money')} />
        </AdminRow>
        <AdminRow title={`Pending tags · ${pendingTags}`} meta="That's them queue on Spotlight">
          <AdminBtn label="Spotlight" onPress={() => router.push('/admin/spotlight')} />
        </AdminRow>
      </View>

      <View style={styles.editor}>
        <Text style={styles.section}>Draft JSON</Text>
        <Text style={styles.body}>Unknown keys and invalid theme hex are rejected. Nested objects merge onto the default map.</Text>
        <TextInput
          value={json}
          onChangeText={(value) => {
            setJson(value);
            setParseError(null);
          }}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Runtime draft JSON"
          style={styles.json}
        />
        {parseError ? <AdminNotice text={parseError} tone="danger" /> : null}
        <AdminBtn label="Save JSON to draft" kind="primary" onPress={() => void applyJson()} />
      </View>

      <View style={styles.editor}>
        <Text style={styles.section}>Apply this feedback</Text>
        {focused ? (
          <>
            <Text style={styles.body}>{focused.body}</Text>
            <Text style={styles.meta}>
              {focused.status}
              {focused.runtime_path ? ` · ${focused.runtime_path}` : ' · no path — becomes Home banner'}
            </Text>
            <AdminBtn label="Apply this feedback" kind="primary" onPress={() => void applyRow(focused)} />
          </>
        ) : (
          <AdminEmpty text="No planned or shipping suggestions. Pin a runtime path on Feedback first." />
        )}
        {queue
          .filter((row) => row.id !== focused?.id)
          .map((row) => (
            <AdminRow key={row.id} title={row.body} meta={`${row.status}${row.runtime_path ? ` · ${row.runtime_path}` : ''}`}>
              <AdminBtn label="Apply" onPress={() => void applyRow(row)} />
            </AdminRow>
          ))}
      </View>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  meta: {
    color: FOCAL.electricGold,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    color: FOCAL.neonJade,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  health: {
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  editor: {
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  json: {
    minHeight: 280,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#070A0B',
    color: colors.text,
    padding: 12,
    fontSize: 12,
    fontWeight: '600',
    textAlignVertical: 'top',
    fontFamily: Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', default: undefined }),
  },
});
