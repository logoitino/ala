/** Server change audit shows actor/time and changed field names, never row values or credentials. */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AdminField, AdminNotice, AdminPanel } from '../AdminChrome';
import type { EngineeringSupportSnapshot } from '@tapuai/shared-types/admin/engineeringSupport';
export function SupportAuditTab({ snapshot }: { snapshot: EngineeringSupportSnapshot }) {
  const [query, setQuery] = useState('');
  const rows = snapshot.audit.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  return <View style={{ gap: 24 }}>
    <AdminNotice tone="warn" text="Selected admin and money tables have transactional change capture. Hashes detect changes within a retained chain; privileged database operators remain a trust boundary. This is not a complete security incident history." />
    <AdminField label="Find actor, time, table, operation or field" value={query} onChangeText={setQuery} />
    <Text>{`${rows.length} matching changes · newest ${snapshot.limits.audit} maximum records. Times are UTC from the server.`}</Text>
    {rows.map(row => <AdminPanel key={row.id} title={`${row.table_name} · ${row.operation}`}>
      <Text selectable>{`Actor ${row.actor_id ?? 'System / service'} (${row.actor_role}) · ${row.occurred_at}\nRecord ${row.record_id}\nChanged fields: ${row.changed_fields.join(', ') || 'None'}\nChain ${row.event_hash}\nPrevious ${row.previous_hash ?? 'First record'}`}</Text>
    </AdminPanel>)}
    {!rows.length ? <Text>No matching changes in this retained snapshot.</Text> : null}
  </View>;
}
