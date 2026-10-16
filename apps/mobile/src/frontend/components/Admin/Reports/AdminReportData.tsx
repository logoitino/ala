/** Native Data disclosure for report figures and catalogs. Rows retain column names in spoken
 * labels; horizontal scrolling is confined to this table, never the surrounding report page. */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { ReportTable } from './reportChartModel';
import { reportStyles as s } from './reportStyles';

export type AdminReportDataProps = { title: string; table: ReportTable; source?: string; initiallyOpen?: boolean };
/** @purpose Expand all values and their source, with a native-sized target and explicit expanded state. */
export function AdminReportData({ title, table, source, initiallyOpen = false }: AdminReportDataProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const label = table.rows.length ? 'Data' : 'Source';
  return <View style={{ gap: 10, minWidth: 0 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} for ${title}`} accessibilityState={{ expanded: open }}
      onPress={() => setOpen(!open)} style={({ pressed }) => [s.button, { alignSelf: 'flex-start', opacity: pressed ? 0.75 : 1 }]}>
      <Text style={s.buttonText}>{open ? '⌄' : '›'} {label}</Text>
    </Pressable>
    {open ? <>
      {table.rows.length ? <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }} accessibilityLabel={`${title}: every value`}>
        <View style={[s.table, { flexGrow: 1 }]}>
          <View style={[s.tableRow, s.tableHead]}>{table.columns.map((column, i) => <Text key={`${column}-${i}`} style={[s.tableCell, { fontWeight: '800' }]}>{column}</Text>)}</View>
          {table.rows.map((row, at) => <View key={at} style={s.tableRow} accessible accessibilityLabel={row.map((value, i) => `${table.columns[i]}: ${value}`).join(', ')}>
            {row.map((cell, i) => <Text key={i} style={[s.tableCell, i === 0 && { fontWeight: '700' }]}>{cell}</Text>)}
          </View>)}
        </View>
      </ScrollView> : null}
      {source ? <View style={{ gap: 4 }}><Text style={s.small}>Source</Text><Text selectable style={s.source}>{source}</Text></View> : null}
    </> : null}
  </View>;
}
