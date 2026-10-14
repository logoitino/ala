/** Native Health tabs select a single operations lens without adding a second scroll owner. */
import { View } from 'react-native';
import { AdminReportLink } from './AdminReportSection';
import { reportStyles as s } from './reportStyles';
export type AdminReportTabsProps = { tabs: { id: string; label: string }[]; selected: string; onSelect: (id: string) => void; scope?: string };
/** @purpose Select a report panel through a 44-point accessible native tab. */
export function AdminReportTabs({ tabs, selected, onSelect, scope = 'health' }: AdminReportTabsProps) {
  return <View style={s.row}>{tabs.map(tab => <AdminReportLink key={tab.id} id={`${scope}-tab-${tab.id}`} label={tab.label} selected={selected === tab.id} tab onPress={() => onSelect(tab.id)} />)}</View>;
}
