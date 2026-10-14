/** Interactive source/team diagram uses generated static lineage; gaps never imply healthy hosted delivery. */
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text, View, useWindowDimensions } from 'react-native';
import { AdminBtn, AdminField, AdminNotice, AdminPanel } from '../AdminChrome';
import topology from '@tapuai/shared-types/admin/supportTopology.json';
import { flowForSource, teamReportingChain } from '@tapuai/shared-types/admin/teamFlow';
const stageStyle = { flexGrow: 1, flexBasis: 180, minWidth: 0, borderLeftWidth: 3, borderLeftColor: '#00733c', padding: 14, gap: 8 };
export function SupportFlowTab() {
  const [query, setQuery] = useState('');
  const params = useLocalSearchParams<{ source?: string }>();
  const [source, setSource] = useState(params.source && topology.sources.some(item => item.name === params.source) ? params.source : 'support_signals');
  useEffect(() => { if (params.source && topology.sources.some(item => item.name === params.source)) setSource(params.source); }, [params.source]);
  const [team, setTeam] = useState('SUPPORT');
  const { width } = useWindowDimensions();
  const flow = useMemo(() => flowForSource(topology, source), [source]);
  const chain = teamReportingChain(topology, team);
  const needle = query.trim().toLowerCase();
  const sources = topology.sources.filter(item => `${item.name} ${item.owner} ${item.purpose}`.toLowerCase().includes(needle)).slice(0, 8);
  const roles = topology.roles.filter(item => `${item.id} ${item.department}`.toLowerCase().includes(needle)).slice(0, 8);
  return <View style={{ gap: 24 }}>
    <AdminNotice tone="warn" text={topology.basis} />
    <AdminField label="Find a data source or team" value={query} onChangeText={setQuery} placeholder="For example: donation, support, ledger, security" />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{sources.map(item => <AdminBtn key={item.name} label={item.name} kind={source === item.name ? 'primary' : 'ghost'} onPress={() => { setSource(item.name); if (item.owner) setTeam(item.owner); }} />)}</View>
    {flow ? <AdminPanel title={`${flow.source} · ${flow.owner ?? 'Owner missing'}`}>
      <Text>{flow.purpose ?? 'Purpose not documented'}</Text>
      <View accessibilityLabel="Data flow: writers to source to readers" style={{ flexDirection: width < 800 ? 'column' : 'row', gap: 10 }}>
        {[{ title: '1 · Writes from', refs: flow.writers }, { title: `2 · ${flow.source}`, refs: [{ reference: 'Accountable owner', team: flow.owner }] }, { title: '3 · Read by', refs: flow.readers }].map(stage => <View key={stage.title} style={[stageStyle, width < 800 && { flexBasis: 'auto', flexGrow: 0 }]}><Text style={{ fontWeight: '800' }}>{stage.title}</Text>{stage.refs.length ? stage.refs.map(ref => <View key={ref.reference} style={{ gap: 4 }}><Text selectable style={{ fontSize: 12, flexShrink: 1 }}>{ref.reference}</Text>{ref.team ? <AdminBtn label={ref.team} onPress={() => setTeam(ref.team!)} /> : <Text>Unmapped owner</Text>}</View>) : <Text>No reference found</Text>}</View>)}
      </View>
      {flow.gaps.map(gap => <AdminNotice key={gap} tone="warn" text={gap} />)}
      <Text selectable>{`Screens: ${flow.screens.join(', ') || 'No screen reference'}\nTriggers: ${flow.triggers.join(', ') || 'None in this map'}`}</Text>
    </AdminPanel> : <AdminNotice tone="warn" text="Choose a source. No source connection is inferred." />}
    <AdminPanel title="Team responsibility">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{roles.map(role => <AdminBtn key={role.id} label={role.id} onPress={() => setTeam(role.id)} kind={team === role.id ? 'primary' : 'ghost'} />)}</View>
      <Text selectable>{chain.roles.join(' → ')}</Text>
      <AdminNotice tone="warn" text={chain.issue} />
      <Text selectable>{topology.roles.find(role => role.id === team)?.paths.join('\n') || 'No source paths assigned; see the registered operating contract.'}</Text>
    </AdminPanel>
    <AdminPanel title="How a finding moves to a fix">
      <Text>Operational workflow · these stages describe responsibility, not live ticket delivery.</Text>
      <View style={{ flexDirection: width < 1000 ? 'column' : 'row', flexWrap: 'wrap', gap: 10 }}>{[
        ['Capture', 'Client, server and checks retain distinct evidence.'],
        ['SUPPORT → INCIDENT_TRIAGE', 'Group occurrences; separate expected events and reported problems.'],
        ['Feature owner + SECURITY', 'Reproduce; test suspected attacks and false positives. Finance joins money findings.'],
        ['Developer → independent QA', 'Repair the affected feature and verify the regression.'],
        ['RELEASE + RECOVERY', 'Verify package and schema compatibility; retain a restore preview.'],
        ['TELEMETRY + RELIABILITY', 'Observe after release. A new occurrence reopens review.'],
      ].map(([title, detail]) => <View key={title} style={[stageStyle, width < 1000 && { flexBasis: 'auto', flexGrow: 0 }]}><Text style={{ fontWeight: '800' }}>{title}</Text><Text>{detail}</Text></View>)}</View>
    </AdminPanel>
  </View>;
}
