/** Occurrence-preserving issue review. Protected finance/security dispositions need a separate admin. */
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AdminBtn, AdminField, AdminNotice, AdminPanel, AdminPills, AdminDeskLink } from '../AdminChrome';
import { SUPPORT_FEATURES, groupSupportSignals, type EngineeringSupportSnapshot, type SupportDisposition } from '@tapuai/shared-types/admin/engineeringSupport';
import topology from '@tapuai/shared-types/admin/supportTopology.json';
import { AdminReportLink } from '../Reports/AdminReportSection';
import type { SupportReviewInput } from '@/lib/engineeringSupport';
const featureSources: Record<string, string> = { highlights: 'reels', activity: 'tips', local: 'games', spotlight: 'spotlight_awards', drip: 'shop_products', profile: 'profiles', auth: 'profiles', donation: 'tips', payouts: 'disbursements', operator: 'game_events', upload: 'reels', admin: 'app_runtime_config', support: 'support_signals', app: 'support_signals' };
export function SupportIssuesTab({ snapshot, identity, busy, review }: { snapshot: EngineeringSupportSnapshot; identity: string; busy: boolean; review: (input: SupportReviewInput) => Promise<void> }) {
  const [filter, setFilter] = useState('open');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [disposition, setDisposition] = useState<SupportDisposition>('investigating');
  const groups = useMemo(() => groupSupportSignals(snapshot.signals, snapshot.reviews, snapshot.read_at).sort((a, b) => ({info:0,warning:1,error:2,critical:3}[b.severity] - {info:0,warning:1,error:2,critical:3}[a.severity])), [snapshot]);
  const shown = groups.filter(group => (filter === 'all' || filter === 'open' ? filter === 'all' || (group.state !== 'reviewed' && group.classification.kind !== 'expected') : filter === 'expected' ? group.classification.kind === 'expected' : group.category === filter || (filter === 'finance' && SUPPORT_FEATURES[group.feature].sensitivity === 'finance')) && `${group.feature} ${group.code} ${group.release}`.includes(query.trim().toLowerCase()));
  const group = groups.find(item => item.fingerprint === selected);
  const pending = group?.review?.decision === 'pending' ? group.review : null;
  return <View style={{ gap: 24 }}>
    <Text>{`${snapshot.signals.length} retained occurrences · ${groups.length} distinct event groups in this bounded snapshot. Counts are not lifetime totals.`}</Text>
    <AdminPills label="Show findings" items={['open','all','expected','ui','runtime','network','data','finance','security','syntax','user_report'].map(id => ({ id, label: id.replace('_', ' ') }))} value={filter} onChange={setFilter} />
    <AdminField label="Find a feature, event or release" value={query} onChangeText={setQuery} />
    {shown.length ? shown.map(item => <AdminPanel key={item.fingerprint} title={`${item.feature} · ${item.code.replace(/_/g, ' ')}`}>
      <Text>{`${item.severity} · ${item.classification.kind.replace(/_/g,' ')} · ${item.state.replace(/_/g,' ')} · ${item.count} occurrences (${item.recentCount} in 24h)`}</Text>
      <Text>{item.classification.reason}</Text>
      <AdminReportLink label={`Source owner: ${topology.sources.find(source => source.name === featureSources[item.feature])?.owner ?? 'Unmapped'} · view team flow`} href={`/admin/support?tab=flow&source=${featureSources[item.feature]}`} />
      <Text>{`${item.environment} / ${item.release} · ${item.occurrences[0].source} evidence · last ${item.lastOccurredAt}`}</Text>
      <AdminBtn label="Review evidence" onPress={() => { setSelected(item.fingerprint); setRationale(''); setDisposition(item.review?.disposition ?? 'investigating'); }} />
    </AdminPanel>) : <Text>No matching findings in the retained snapshot. This does not certify full coverage.</Text>}
    {group ? <AdminPanel title={`Evidence & review · ${group.feature}`}>
      <Text selectable>{group.fingerprint}</Text>
      {group.occurrences.map(row => <Text selectable key={row.id}>{`${row.occurred_at} · ${row.source} · actor ${row.actor_id ?? 'System / unidentified'} · ${row.id}`}</Text>)}
      {snapshot.reviews.filter(row => row.fingerprint === group.fingerprint).map(row => <Text key={row.id} selectable>{`${row.created_at} · ${row.actor_id} · ${row.disposition} (${row.decision}) · through ${row.reviewed_through}\n${row.rationale}`}</Text>)}
      <AdminNotice tone="warn" text={group.category === 'finance' || group.category === 'security' || SUPPORT_FEATURES[group.feature].sensitivity !== 'general' ? 'Closing, marking expected or false positive, or confirming an attack requires a second admin. New occurrences reopen the group. Client evidence cannot establish a confirmed attack.' : 'Reviews preserve original evidence. A new occurrence reopens the group.'} />
      <AdminPills label="Review decision" items={(['investigating','expected','false_positive','resolved','confirmed_attack'] as SupportDisposition[]).filter(id => id !== 'confirmed_attack' || group.category === 'security').map(id => ({ id, label: id.replace(/_/g,' ') }))} value={disposition} onChange={setDisposition} />
      <AdminField label="Rationale · no credentials or personal details" multiline value={rationale} onChangeText={setRationale} />
      <AdminBtn label={pending && pending.disposition === disposition ? 'Confirm as second reviewer' : 'Save review'} kind="primary" disabled={busy || !rationale.trim() || rationale.length > 600 || (!!pending && pending.disposition === disposition && pending.actor_id === identity)} onPress={() => { void review({ fingerprint: group.fingerprint, disposition, rationale, reviewedThrough: group.lastOccurredAt, parentReviewId: pending?.disposition === disposition ? pending.id : null }); }} />
      {pending?.actor_id === identity ? <Text>Your pending disposition needs a different admin to confirm it.</Text> : null}
    </AdminPanel> : null}
    <AdminDeskLink href="/admin/feedback" title="User reports & suggestions" meta="The Feedback desk retains report details and suggestion workflow." />
    <AdminDeskLink href="/admin/health" title="Platform health" meta="Health owns full operational measures and telemetry analysis." />
    <AdminDeskLink href="/admin/books" title="Money reconciliation" meta="Finance & Books owns ledger analysis and financial correction controls." />
  </View>;
}
