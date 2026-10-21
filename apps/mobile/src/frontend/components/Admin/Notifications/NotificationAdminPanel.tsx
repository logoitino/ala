/**
 * Features desk notification controls, synthetic template previews and bounded failed-job repair.
 * Source authority is server-owned; staff cannot enable an unimplemented donation source or send mail here.
 * @sideEffects Admin notification RPCs and fixed safe Support signals; previews never send.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NOTIFICATION_CATEGORIES, type NotificationConfig, type NotificationAdminJobsPage } from '@tapuai/shared-types/notifications';
import { previewNotificationTemplate } from '@tapuai/shared-types/notificationTemplates';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchAdminNotificationConfig, fetchAdminNotificationJobs, saveAdminNotificationConfig, retryNotificationJob, notificationErrorText } from '@/lib/notifications';
import { TelemetryManager } from '@/services/TelemetryManager';

/** @purpose Shared 44-point staff action with a visible disabled state. */
function Action({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
    style={[styles.action, disabled && styles.disabled]} onPress={onPress}><Text style={styles.actionText}>{label}</Text></Pressable>;
}

/** @purpose Staff-only operational control; every RPC independently checks the server role. */
export function NotificationAdminPanel() {
  const { isAdmin, user, isSessionCurrent } = useAuth();
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [draft, setDraft] = useState<NotificationConfig | null>(null);
  const [jobs, setJobs] = useState<NotificationAdminJobsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof previewNotificationTemplate> | null>(null);
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0); const flight = useRef(false);

  const load = useCallback(async () => {
    if (!(isSessionCurrent?.() ?? true)) return;
    const token = ++epoch.current;
    const current = () => token === epoch.current && (isSessionCurrent?.() ?? true);
    setConfig(null); setDraft(null); setJobs(null); setError(null); setJobError(null); setNotice(null);
    if (!isAdmin) return;
    setBusy(true);
    const results = await Promise.allSettled([fetchAdminNotificationConfig(), fetchAdminNotificationJobs()]);
    if (!current()) return;
    if (results[0].status === 'fulfilled') { setConfig(results[0].value); setDraft(results[0].value); }
    else { setError(notificationErrorText(results[0].reason)); TelemetryManager.getInstance().trackIssue('notifications.admin_source_failed', 'admin'); }
    if (results[1].status === 'fulfilled') setJobs(results[1].value);
    else { setJobError(notificationErrorText(results[1].reason)); TelemetryManager.getInstance().trackIssue('notifications.admin_jobs_failed', 'admin'); }
    setBusy(false);
  }, [isAdmin, user?.id, isSessionCurrent]);
  useEffect(() => { void load(); return () => { epoch.current++; flight.current = false; }; }, [load]);

  const act = async (work: () => Promise<void>) => {
    if (flight.current || busy || !isAdmin || !(isSessionCurrent?.() ?? true)) return;
    const token = epoch.current;
    const current = () => token === epoch.current && (isSessionCurrent?.() ?? true);
    flight.current = true; setBusy(true); setNotice(null);
    try { await work(); }
    catch (caught) { if (current()) { setNotice(notificationErrorText(caught)); TelemetryManager.getInstance().trackIssue('notifications.admin_action_failed', 'admin'); } }
    finally { if (current()) { flight.current = false; setBusy(false); } }
  };
  const save = () => act(async () => {
    if (!draft || !user) return;
    const token = epoch.current;
    const saved = await saveAdminNotificationConfig(draft, user.id);
    if (token !== epoch.current || !(isSessionCurrent?.() ?? true)) return;
    setConfig(saved); setDraft(saved); setNotice('Notification controls saved.');
  });
  const retry = (id: string) => act(async () => {
    const token = epoch.current;
    if (!user) return;
    await retryNotificationJob(id, user.id);
    if (token !== epoch.current || !(isSessionCurrent?.() ?? true)) return;
    const updated = await fetchAdminNotificationJobs();
    if (token !== epoch.current || !(isSessionCurrent?.() ?? true)) return;
    setJobs(updated); setNotice('Known failure queued for a fresh eligibility check.');
  });
  const moreJobs = () => act(async () => {
    if (!jobs?.nextCursor) return;
    const token = epoch.current; const next = await fetchAdminNotificationJobs(jobs.nextCursor);
    if (token !== epoch.current || !(isSessionCurrent?.() ?? true)) return;
    // Each page replaces the last one: operational reads and rendered rows remain bounded.
    setJobs(next);
  });

  if (!isAdmin) return <Text style={styles.body}>Admin access is required.</Text>;
  return <View style={styles.panel}>
    <Text style={styles.title}>Notifications</Text>
    <Text style={styles.body}>Optional emails start off for every user. Verification and password reset use the separate account service.</Text>
    <Text style={styles.body}>Email delivery requires configuration and unsubscribe support. This desk previews templates and pauses alerts; it sends no email.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {config && draft ? <>
      <View style={styles.actions}>
        <Action label={draft.inAppEnabled ? 'Pause in-app alerts' : 'Enable in-app alerts'} disabled={busy}
          onPress={() => setDraft({ ...draft, inAppEnabled: !draft.inAppEnabled })} />
        <Action label={draft.emailEnabled ? 'Pause optional email' : 'Email delivery paused'} disabled={busy || !draft.emailEnabled}
          onPress={() => setDraft({ ...draft, emailEnabled: false })} />
      </View>
      {NOTIFICATION_CATEGORIES.map(category => <View key={category.id} style={styles.row}>
        <Text style={styles.strong}>{category.label}</Text>
        <Text style={styles.body}>{config.sourceAvailability[category.id] ? 'Reviewed source available' : 'Source unavailable · delivery remains off'}</Text>
        <View style={styles.actions}>
          <Action label={`${draft.categories[category.id] ? 'Disable' : 'Enable'} ${category.label}`}
            disabled={busy || !config.sourceAvailability[category.id]}
            onPress={() => setDraft({ ...draft, categories: { ...draft.categories, [category.id]: !draft.categories[category.id] } })} />
          <Action label={`Preview ${category.label}`} disabled={busy} onPress={() => setPreview(previewNotificationTemplate(category.id))} />
        </View>
      </View>)}
      <Action label="Save notification controls" disabled={busy} onPress={() => { void save(); }} />
    </> : busy ? <Text style={styles.body}>Loading notification controls…</Text> : null}
    {preview ? <View style={styles.preview}>
      <Text style={styles.strong}>Template preview · no email sent</Text>
      <Text style={styles.body}>Version {preview.templateVersion}</Text>
      <Text style={styles.strong}>{preview.subject}</Text><Text style={styles.body}>{preview.text}</Text>
      <Action label="Close notification preview" onPress={() => setPreview(null)} />
    </View> : null}
    <Text style={styles.strong}>Delivery jobs · 20 per page</Text>
    <Text style={styles.body}>Unknown outcomes need reconciliation before retry.</Text>
    {jobError ? <Text accessibilityRole="alert" style={styles.error}>{jobError}</Text> : null}
    {jobs ? jobs.items.length ? jobs.items.map(job => <View key={job.id} style={styles.row}>
      <Text style={styles.strong}>{job.category}</Text>
      <Text style={styles.body}>{job.status} · {job.attempts} {job.attempts === 1 ? 'attempt' : 'attempts'}</Text>
      {job.lastErrorCode ? <Text style={styles.body}>{job.lastErrorCode}</Text> : null}
      {job.status === 'failed' && job.attempts < 3 && job.lastErrorCode === 'NOTIF_RETRYABLE'
        ? <Action label={`Retry notification ${job.id}`} disabled={busy} onPress={() => { void retry(job.id); }} /> : null}
    </View>) : <Text style={styles.body}>No failed or uncertain jobs in this page.</Text> : null}
    {jobs?.nextCursor ? <Action label="Next notification job page" disabled={busy} onPress={() => { void moreJobs(); }} /> : null}
    {notice ? <Text accessibilityRole="alert" style={styles.body}>{notice}</Text> : null}
    <Action label="Reload notification controls" disabled={busy} onPress={() => { void load(); }} />
  </View>;
}

const styles = StyleSheet.create({
  panel: { padding: 14, gap: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg },
  title: { color: colors.text, fontSize: 19, fontWeight: '800' }, strong: { color: colors.text, fontSize: 14, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, error: { color: colors.danger, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, row: { gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.background },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '700' }, disabled: { opacity: 0.45 }, preview: { gap: 8, paddingVertical: 12 },
});
