/**
 * Health's notification Data view: current queue plus overlapping 24-hour attempts/outcomes.
 * Missing provider evidence stays unknown; accepted is never presented as delivered.
 * @sideEffects Admin-only notification Health RPC and fixed Support signal on failure.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NotificationHealthSnapshot } from '@tapuai/shared-types/notifications';
import { useAuth } from '@/context/AuthContext';
import { fetchAdminNotificationHealth, notificationErrorText } from '@/lib/notifications';
import { TelemetryManager } from '@/services/TelemetryManager';
import { reportStyles as s } from '../Reports/reportStyles';

/** @purpose Complete accessible data, with explicit windows and source evidence status. */
export function NotificationHealthSummary() {
  const { isAdmin, user, isSessionCurrent } = useAuth();
  const [data, setData] = useState<NotificationHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); const epoch = useRef(0);
  const load = useCallback(async () => {
    if (!(isSessionCurrent?.() ?? true)) return;
    const token = ++epoch.current; setData(null); setError(null);
    if (!isAdmin) return;
    setLoading(true);
    try {
      const value = await fetchAdminNotificationHealth();
      if (token === epoch.current && (isSessionCurrent?.() ?? true)) setData(value);
    } catch (caught) {
      if (token === epoch.current && (isSessionCurrent?.() ?? true)) {
        setError(notificationErrorText(caught)); TelemetryManager.getInstance().trackIssue('notifications.health_failed', 'admin');
      }
    } finally { if (token === epoch.current) setLoading(false); }
  }, [isAdmin, user?.id, isSessionCurrent]);
  useEffect(() => { void load(); return () => { epoch.current++; }; }, [load]);
  if (!isAdmin) return null;
  return <View style={{ gap: 8 }}>
    <Text accessibilityRole="header" style={s.h2}>Notification delivery</Text>
    {loading ? <Text style={s.sentence}>Reading notification Health…</Text> : null}
    {error ? <Text accessibilityRole="alert" style={s.sentence}>{error}</Text> : null}
    {data ? <>
      <Text style={s.sentence}>All queued now: {data.pending}</Text>
      <Text style={s.small}>Includes paused, expired and currently ineligible queued jobs.</Text>
      <Text style={s.small}>Snapshot: {data.asOf}</Text>
      <Text style={s.sentence}>Oldest eligible pending: {data.oldestPendingSeconds === null ? 'none eligible' : `${Math.round(data.oldestPendingSeconds)} seconds`}</Text>
      <Text style={s.strong}>Last 24 hours · attempts and outcomes overlap</Text>
      <Text style={s.small}>Window: {data.windowStart} to {data.asOf}</Text>
      {(['attempted', 'accepted', 'delivered', 'suppressed', 'failed', 'bounced', 'unknown'] as const).map(key =>
        <Text key={key} style={s.sentence}>{key}: {!data.providerEvidence && (key === 'delivered' || key === 'bounced') ? 'unknown' : data[key]}</Text>)}
      {!data.providerEvidence ? <Text style={s.small}>Recorded delivery events: {data.delivered} · recorded bounce events: {data.bounced}. These records do not establish provider delivery.</Text> : null}
      <Text style={s.sentence}>{data.providerEvidence ? 'Provider evidence is available for recorded events.' : 'Provider delivery evidence is unavailable. Accepted is not delivered.'}</Text>
    </> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Reload notification Health" disabled={loading}
      style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => { void load(); }}><Text style={s.strong}>Reload notification Health</Text></Pressable>
  </View>;
}
