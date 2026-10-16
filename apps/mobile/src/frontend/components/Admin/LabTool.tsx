import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminNotice,
  AdminPage,
  AdminPublishBar,
  AdminRow,
  AdminSectionTitle,
  ADMIN_REPORT_COLORS,
} from '@/components/Admin/AdminChrome';
import { radii } from '@/constants/theme';
const colors = ADMIN_REPORT_COLORS;
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { fetchAppFeedback, type AppFeedback } from '@/lib/feedback';
import { applyFeedbackToDraft, parseLabRuntimeJson } from '@/lib/runtime';

/**
 * @purpose Engineer Lab: validated runtime JSON + apply a triaged suggestion, then the same Publish to app.
 * @sideEffects `patch_app_runtime_draft` / `publish_app_runtime`; reads focused feedback only.
 */
export function LabTool() {
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 1100 && fontScale <= 1.3;
  const params = useLocalSearchParams<{ feedbackId?: string | string[] }>();
  const feedbackId = Array.isArray(params.feedbackId) ? params.feedbackId[0] : params.feedbackId;
  const { draft, published, pendingCount, saveDraft } = useAppRuntime();
  const [json, setJson] = useState(() => JSON.stringify(draft, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  const [queue, setQueue] = useState<AppFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setReadError(null);
      const rows = await fetchAppFeedback({ strict: true });
      setQueue(rows.filter(row => row.status === 'planned' || row.status === 'shipping' || row.id === feedbackId));
    } catch (caught) {
      setQueue([]);
      setReadError(caught instanceof Error ? caught.message : 'Could not read feedback.');
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
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const next = parseLabRuntimeJson(json);
      setParseError(null);
      await saveDraft(next);
      setJson(JSON.stringify(next, null, 2));
    } catch (caught) {
      setParseError(caught instanceof Error ? caught.message : 'Could not parse this draft.');
    } finally { savingRef.current = false; setSaving(false); }
  };

  const applyRow = async (row: AppFeedback) => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const next = applyFeedbackToDraft(draft, row);
      await saveDraft(next);
      setJson(JSON.stringify(next, null, 2)); setParseError(null);
    } catch (caught) { setParseError(caught instanceof Error ? caught.message : 'Could not save feedback to draft.'); }
    finally { savingRef.current = false; setSaving(false); }
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
      lede="Validate a JSON draft or apply planned feedback to the same App setup configuration."
      saveMode="publish"
      error={readError}
      refreshing={loading}
      onRefresh={() => void refresh()}
    >
      <AdminPublishBar note="Fans still see published until you hit Publish to app." />
      <Text style={styles.body}>{prettyDiff}</Text>

      <View style={[styles.workspace, { flexDirection: wide ? 'row' : 'column' }]}>
      <View style={[styles.editor, wide && styles.editorWide]}>
        <AdminSectionTitle>Draft JSON</AdminSectionTitle>
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
        <AdminBtn label={saving ? "Saving…" : "Save JSON to draft"} disabled={saving} kind="primary" onPress={() => void applyJson()} />
      </View>

      <View style={[styles.editor, wide && styles.editorWide]}>
        <AdminSectionTitle>Apply this feedback</AdminSectionTitle>
        {loading ? <Text style={styles.body}>Reading planned feedback…</Text> : readError ? <Text style={styles.body}>Feedback is not in this read.</Text> : focused ? (
          <>
            <Text style={styles.body}>{focused.body}</Text>
            <Text style={styles.meta}>
              {focused.status}
              {focused.runtime_path ? ` · ${focused.runtime_path}` : ' · no path — becomes Home banner'}
            </Text>
            <AdminBtn label="Apply this feedback" disabled={saving} kind="primary" onPress={() => void applyRow(focused)} />
          </>
        ) : (
          <AdminEmpty text="No planned or shipping suggestions. Pin a runtime path on Feedback first." />
        )}
        {queue
          .filter((row) => row.id !== focused?.id)
          .map((row) => (
            <AdminRow key={row.id} title={row.body} meta={`${row.status}${row.runtime_path ? ` · ${row.runtime_path}` : ''}`}>
              <AdminBtn label="Apply" disabled={saving} onPress={() => void applyRow(row)} />
            </AdminRow>
          ))}
        <AdminBtn label="Full feedback queue" onPress={() => router.push('/admin/feedback')} />
      </View>
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
    color: colors.electricGold,
    fontSize: 12,
    fontWeight: '700',
  },
  workspace: { gap: 28, alignItems: 'flex-start', minWidth: 0 },
  // Column editors keep their full content height; flex:1 would shrink the JSON block into feedback.
  editor: { gap: 10, flexShrink: 0, width: '100%', minWidth: 0, paddingVertical: 14, borderTopWidth: 1, borderColor: colors.border },
  editorWide: { flex: 1 },
  json: {
    minHeight: 280,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#151c23',
    color: '#ffffff',
    padding: 12,
    fontSize: 12,
    fontWeight: '600',
    textAlignVertical: 'top',
    fontFamily: Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', default: undefined }),
  },
});
