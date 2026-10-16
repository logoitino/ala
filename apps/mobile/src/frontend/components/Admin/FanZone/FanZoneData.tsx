/**
 * FUN-01 corrective Data view: full bounded DTOs, explicit populations and independent trace/concern paging.
 * @sideEffects Invokes the parent paging callback when the admin requests an earlier page.
 */
import { Text } from 'react-native';
import { AdminBtn, AdminPanel } from '@/components/Admin/AdminChrome';
import type { FanZoneAdminSnapshot, FanZoneEntry } from '@/lib/fanZone';
/** @purpose Display exact private consent/media details without implying staff grant or legal proof of guardianship. */
export function FanZoneEntryData({ entry }: {
    entry: FanZoneEntry;
}) {
    return <>
  <Text>{`${entry.alias || 'Unnamed draft'} · ${entry.status} · revision ${entry.revision}`}</Text>
  <Text>{entry.caption}</Text><Text>{`Entry ${entry.id} · owner profile ${entry.owner_id}`}</Text>
  <Text>{`Rights confirmed: ${entry.rights_confirmed ? 'yes' : 'no'} · media verified: ${entry.verified ? 'yes' : 'no'} · permission: ${entry.permission_valid ? 'valid' : 'not valid'}`}</Text>
  <Text>{`Relied-on guardian grant: ${entry.guardian_consent_id ?? 'none'}. This supervision link is not proof of legal guardianship.`}</Text>
  <Text>{`Digest ${entry.digest ?? 'not verified'} · ${entry.bytes ?? 'unknown'} bytes · ${entry.duration_ms ?? 'unknown'} ms`}</Text>
  <Text selectable>{`Exact consent scope: ${JSON.stringify(entry.consent_scope)}`}</Text>
  <Text>{`Private reason: ${entry.reason ?? 'none'} · created ${entry.created_at} · updated ${entry.updated_at} · removed ${entry.removed_at ?? 'not removed'}`}</Text>
  <Text selectable>{`Current private path: ${entry.path}`}</Text>
  {entry.media_revisions.map(m => <Text key={m.revision} selectable>{`Media revision ${m.revision} · ${m.present ? 'present' : 'absent'} · ${m.path}`}</Text>)}
 </>;
}
/** @purpose Complete current selected populations; pages never masquerade as total case/audit counts. */
export function FanZoneData({ data, busy, onMore }: {
    data: FanZoneAdminSnapshot;
    busy: boolean;
    onMore: (kind: 'cases' | 'audit') => void;
}) {
    return <>
  <Text>{`${data.entries.length} of ${data.counts.entries} entries · complete selected campaign, cap 100`}</Text>
  <Text>{`${data.ballots.length} of ${data.counts.ballots} ballots · complete selected campaign; ${data.counts.valid_ballots} currently valid`}</Text>
  <Text>{`${data.cases.length} loaded of ${data.counts.cases} cases · ${data.counts.open_cases} open/escalated. ${data.audit.length} loaded of ${data.counts.audit} audit records.`}</Text>
  <AdminPanel title="Stored campaign"><Text selectable>{JSON.stringify(data.campaign, null, 2)}</Text></AdminPanel>
  {data.entries.length === 0 ? <Text>No stored entries in this selected campaign.</Text> : data.entries.map(entry => <AdminPanel key={entry.id} title={`Private entry ${entry.id}`}><FanZoneEntryData entry={entry}/></AdminPanel>)}
  <AdminPanel title="Complete private ballots">
   {data.ballots.length === 0 ? <Text>No stored ballots in this selected campaign.</Text> : data.ballots.map(b => <Text key={b.id} selectable>{JSON.stringify(b)}</Text>)}
  </AdminPanel>
  <AdminPanel title="Cases and removal receipts">
   {data.cases.length === 0 ? <Text>No cases on this loaded page.</Text> : data.cases.map(c => <Text key={c.id} selectable>{JSON.stringify(c)}</Text>)}
   <AdminBtn label="Load earlier cases" disabled={busy || !data.case_next_cursor} onPress={() => onMore('cases')}/>
  </AdminPanel>
  <AdminPanel title="Server audit">
   {data.audit.length === 0 ? <Text>No audit records on this loaded page.</Text> : data.audit.map(a => <Text key={a.id} selectable>{JSON.stringify(a)}</Text>)}
   <AdminBtn label="Load earlier audit" disabled={busy || !data.audit_next_cursor} onPress={() => onMore('audit')}/>
  </AdminPanel>
  <Text>Restricted identity, reasons, consent and paths stay on this corrective desk. Source unavailable is never counted as zero. Refresh resets loaded pages to current source.</Text>
 </>;
}
