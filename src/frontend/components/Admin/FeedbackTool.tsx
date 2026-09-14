import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminField,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminPills,
  AdminRow,
} from '@/components/Admin/AdminChrome';
import { colors, radii } from '@/constants/theme';
import {
  FEEDBACK_STATUSES,
  fetchAppFeedback,
  triageAppFeedback,
  type AppFeedback,
  type AppFeedbackStatus,
} from '@/lib/feedback';
import { FOCAL } from '@/theme/motion';

type StatusFilter = AppFeedbackStatus | 'all';

/**
 * @purpose Admin improvement queue: triage fan suggestions, pin a runtime path, open Lab or Look.
 * @sideEffects `get_app_feedback` / `triage_app_feedback`.
 */
export function FeedbackTool() {
  const router = useRouter();
  const [rows, setRows] = useState<AppFeedback[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [runtimePath, setRuntimePath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAppFeedback();
      setRows(next);
      setSelectedId((current) => {
        if (current && next.some((row) => row.id === current)) return current;
        return next[0]?.id ?? null;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load feedback.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    const row = rowsRef.current.find((item) => item.id === selectedId);
    if (!row) return;
    setNote(row.admin_note);
    setRuntimePath(row.runtime_path);
  }, [selectedId]);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((row) => row.status === filter)),
    [filter, rows],
  );

  const save = async (status: AppFeedbackStatus) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const next = await triageAppFeedback(selected.id, status, note, runtimePath);
      setRows((current) => current.map((row) => (row.id === next.id ? next : row)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this suggestion.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Feedback"
      lede="Fan suggestions become a shipped change: triage → planned → Engineer Lab → Publish to app → shipped."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
    >
      <AdminPanel title={`${rows.filter((row) => row.status === 'new').length} new`}>
        <Text style={styles.body}>Clip Report / Hide stays on the Highlight. This desk is app-level chrome and copy.</Text>
      </AdminPanel>

      <AdminPills
        label="Status"
        items={[{ id: 'all', label: 'All' }, ...FEEDBACK_STATUSES]}
        value={filter}
        onChange={setFilter}
      />

      {visible.length === 0 ? (
        <AdminEmpty text="No suggestions in this filter." />
      ) : (
        visible.map((row) => (
          <AdminRow
            key={row.id}
            title={row.body}
            meta={`${row.kind} · ${row.surface} · ${row.status}${row.runtime_path ? ` · ${row.runtime_path}` : ''}`}
            onPress={() => {
              setSelectedId(row.id);
              setNote(row.admin_note);
              setRuntimePath(row.runtime_path);
            }}
          >
            <Text style={[styles.badge, selectedId === row.id && styles.badgeOn]}>
              {selectedId === row.id ? 'Open' : row.status}
            </Text>
          </AdminRow>
        ))
      )}

      {selected ? (
        <View style={styles.detail}>
          <Text style={styles.section}>Triage</Text>
          <Text style={styles.body}>{selected.body}</Text>
          <AdminField
            label="Runtime path"
            value={runtimePath}
            onChangeText={setRuntimePath}
            placeholder="copy.spotlightLede or tabs.drip"
          />
          <AdminField
            label="Note"
            value={note}
            onChangeText={setNote}
            placeholder="What we will ship"
            multiline
            autoCapitalize="sentences"
            autoCorrect
          />
          <View style={styles.actions}>
            {FEEDBACK_STATUSES.map((item) => (
              <AdminBtn
                key={item.id}
                label={item.label}
                kind={item.id === selected.status ? 'primary' : item.id === 'declined' ? 'danger' : 'ghost'}
                disabled={busy}
                onPress={() => void save(item.id)}
              />
            ))}
          </View>
          <AdminBtn
            label="Open in Lab"
            kind="primary"
            onPress={() => router.push(`/admin/lab?feedbackId=${selected.id}` as Href)}
          />
          <AdminBtn label="Open Look" onPress={() => router.push('/admin/look')} />
          <AdminNotice
            text="Shipping means an engineer applied this onto the draft. Mark shipped after Publish to app."
            tone="warn"
          />
        </View>
      ) : null}
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
  badge: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  badgeOn: {
    color: FOCAL.neonJade,
  },
  detail: {
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  section: {
    color: FOCAL.neonJade,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
