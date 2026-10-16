/** Main-admin Engineering Support: operational issue review, actual team lineage, audit and recovery. */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminPage, AdminNotice, AdminBtn } from '../AdminChrome';
import { AdminReportLink } from '../Reports/AdminReportSection';
import { supportSignals } from '@/services/SupportSignalManager';
import { useEngineeringSupport } from '@/hooks/useEngineeringSupport';
import { SupportIssuesTab } from './SupportIssuesTab';
import { SupportFlowTab } from './SupportFlowTab';
import { SupportAuditTab } from './SupportAuditTab';
import { SupportRecoveryTab } from './SupportRecoveryTab';
const tabs = [{ id: 'issues', label: 'Issues' }, { id: 'flow', label: 'Team flow' }, { id: 'history', label: 'Change history' }, { id: 'recovery', label: 'Recovery' }];
export function SupportScreen() {
  const support = useEngineeringSupport();
  const sensor = supportSignals.getStatus();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState(tabs.some(item => item.id === params.tab) ? params.tab! : 'issues');
  useEffect(() => { if (tabs.some(item => item.id === params.tab)) setTab(params.tab!); }, [params.tab]);
  return <AdminPage title="Engineering Support" lede="A clear path from a reported problem to a verified repair. Support works under Development, together with Security and the team that owns the feature." refreshing={support.loading} onRefresh={() => void support.refresh()} error={support.error}>
    {support.enabled ? <>
      <AdminBtn label={support.loading ? 'Reading sources…' : 'Refresh support sources'} disabled={support.loading || support.busy} onPress={() => void support.refresh()} />
      <View accessibilityRole="tablist" accessibilityLabel="Engineering Support workspace" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{tabs.map(item => <AdminReportLink key={item.id} label={item.label} tab selected={tab === item.id} onPress={() => setTab(item.id)} />)}</View>
      <View accessibilityLiveRegion="polite"><AdminNotice tone={support.messageTone} text={support.message} /></View>
      <Text>{`Client sensor in this session: ${sensor.phase} · ${sensor.queued} queued / ${sensor.delivered} delivered / ${sensor.dropped} dropped${sensor.lastFailure ? ' · ' + sensor.lastFailure : ''}. This does not certify platform coverage.`}</Text>
      {support.snapshot ? <Text>{`Read ${support.snapshot.read_at} UTC · bounded retained records, not lifetime totals`}</Text> : <AdminNotice tone="warn" text={support.loading ? 'Reading support sources… Coverage is unknown until the read succeeds.' : 'Support sources are unavailable. Team flow remains available from the source map.'} />}
      {tab === 'flow' ? <SupportFlowTab /> : null}
      {support.snapshot && tab === 'issues' ? <SupportIssuesTab key={support.identity} snapshot={support.snapshot} identity={support.identity} busy={support.busy} review={support.review} /> : null}
      {support.snapshot && tab === 'history' ? <SupportAuditTab snapshot={support.snapshot} /> : null}
      {support.snapshot && tab === 'recovery' ? <SupportRecoveryTab key={support.identity} snapshot={support.snapshot} busy={support.busy} register={support.register} /> : null}
    </> : <AdminNotice tone="warn" text={support.disabledReason} />}
  </AdminPage>;
}
