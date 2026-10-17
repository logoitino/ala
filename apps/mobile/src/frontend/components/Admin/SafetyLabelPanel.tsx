/** SAFETY-01 on the Highlights desk: suggested labels, add or remove with a reason, and the audit.
 * A missing migration says the counts are unknown. It never shows zero labelled clips.
 * @sideEffects coach_label_desk and set_coach_label.
 */
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';

import { AdminBtn, AdminEmpty, AdminField, AdminMetrics, AdminNotice, AdminRow, AdminSectionTitle } from '@/components/Admin/AdminChrome';
import { COACH_LEVEL_REPORT, fetchCoachLabelDesk, setCoachLabel, type CoachLabelDesk } from '@/lib/safetyLabels';
import { NOT_SWITCHED_ON } from '@/lib/rpc';

/** @purpose Review queue and recorded label changes for risky workouts. */
export function SafetyLabelPanel() {
  const [desk, setDesk] = useState<CoachLabelDesk | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [targetId, setTargetId] = useState('');
  const [kind, setKind] = useState<'reel' | 'beyond_post'>('reel');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDesk(await fetchCoachLabelDesk());
      setUnknown(false);
    } catch (caught) {
      setDesk(null);
      const text = caught instanceof Error ? caught.message : 'Could not load coach-level labels.';
      setUnknown(text === NOT_SWITCHED_ON);
      setError(text);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const apply = (next: 'none' | 'coach_level') => {
    const id = targetId.trim();
    if (reason.trim().length < 8 || !id || busy) return;
    setBusy(true);
    setMessage(null);
    void setCoachLabel(kind, id, next, reason.trim())
      .then(() => { setMessage(next === 'coach_level' ? 'Coach-level label saved.' : 'Coach-level label removed.'); setReason(''); return load(); })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'That label was not saved.'))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <AdminSectionTitle>Coach-level moves</AdminSectionTitle>
      <Text>A labelled workout asks for a coach or spotter. Removing a wrong label needs a reason. The notice stays on until an admin removes it.</Text>
      {unknown ? <AdminNotice tone="warn" text="Coach-level counts are unknown. The database update is not applied yet." /> : null}
      {error && !unknown ? <AdminNotice tone="danger" text={error} /> : null}
      <AdminNotice text={message} tone="ok" />
      {desk ? (
        <AdminMetrics items={[
          { label: 'Labelled Highlights', value: desk.labelledReels },
          { label: 'Labelled workouts', value: desk.labelledPosts },
          { label: 'Open suggestions', value: desk.openSuggestions },
          { label: 'Median review hours', value: desk.medianReviewHours == null ? 'unknown' : desk.medianReviewHours.toFixed(1) },
        ]} />
      ) : null}
      <AdminBtn label="Refresh coach-level labels" disabled={busy} onPress={() => { void load(); }} />
      {desk && desk.suggestions.length === 0 ? <AdminEmpty text="No open suggestions." /> : null}
      {desk?.suggestions.map((row) => (
        <AdminRow key={row.id} title={row.title} meta={`${row.reports} ${COACH_LEVEL_REPORT} · ${row.id}`} />
      ))}
      <AdminField label="Highlight or workout id" value={targetId} onChangeText={setTargetId} autoCapitalize="none" />
      <AdminField label="Reason (at least 8 characters)" value={reason} onChangeText={setReason} autoCapitalize="sentences" />
      <AdminBtn label={kind === 'reel' ? 'This is a Highlight' : 'This is a Beyond workout'} onPress={() => setKind(kind === 'reel' ? 'beyond_post' : 'reel')} />
      <AdminBtn kind="primary" label="Add Coach-level label" disabled={busy || reason.trim().length < 8 || targetId.trim().length < 8} onPress={() => apply('coach_level')} />
      <AdminBtn kind="danger" label="Remove Coach-level label" disabled={busy || reason.trim().length < 8 || targetId.trim().length < 8} onPress={() => apply('none')} />
      {desk?.events.map((event) => (
        <AdminRow key={event.id} title={`${event.oldLabel} → ${event.newLabel}`} meta={`${event.targetKind} ${event.targetId} · ${event.reason} · ${event.createdAt}`} />
      ))}
    </>
  );
}
