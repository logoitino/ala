/** Recovery registers bounded package metadata. Restore always creates a separate local preview. */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AdminBtn, AdminField, AdminNotice, AdminPanel } from '../AdminChrome';
import type { EngineeringSupportSnapshot } from '@tapuai/shared-types/admin/engineeringSupport';
export function SupportRecoveryTab({ snapshot, busy, register }: { snapshot: EngineeringSupportSnapshot; busy: boolean; register: (text: string) => Promise<void> }) {
  const [metadata, setMetadata] = useState('');
  return <View style={{ gap: 24 }}>
    <AdminPanel title="Recover without losing the evidence">
      <Text>Transient reads can retry once when safe. A feature render failure offers an explicit retry and keeps its signal. Money, authorization, publishing and destructive actions require controlled repair.</Text>
      <Text>Source packages include dependency locks, assets, patches and migrations. They exclude credentials, customer data and runtime logs. Restore verifies hashes and writes into a fresh private preview.</Text>
      <Text selectable>{'1 · pnpm recovery:package --verify-code\n2 · pnpm recovery:verify PACKAGE\n3 · pnpm recovery:restore PACKAGE'}</Text>
      <AdminNotice tone="warn" text="The package verifies file integrity, not a trusted signature or hosted compatibility. Restore does not replace running code, restore database backups or reverse financial records. Recovery must check the deployed schema, rehearse an approved database backup, and obtain release approval before switching versions." />
    </AdminPanel>
    <AdminPanel title="Register a source package">
      <Text>Paste only the generated .metadata.json file. This records the reporting admin and server time; it does not upload code or certify deployment.</Text>
      <AdminField label="Recovery metadata JSON" value={metadata} onChangeText={setMetadata} multiline />
      <AdminBtn label="Register package metadata" kind="primary" disabled={busy || !metadata.trim() || metadata.length > 64000} onPress={() => { void register(metadata); }} />
    </AdminPanel>
    {snapshot.releases.map(row => <AdminPanel key={row.id} title={row.manifest.releaseId}>
      <Text selectable>{`Registered ${row.created_at} by ${row.actor_id ?? 'Unknown'}\nPackaged ${row.manifest.createdAt} · ${row.manifest.filesCount} files / ${row.manifest.byteCount} bytes\nLocal verification: ${row.manifest.verification} (operator reported)\nCommit ${row.manifest.gitCommit ?? 'Uncommitted source; editor unknown'}\nSource hash ${row.manifest.treeHash}\nPackage hash ${row.manifest.capsuleHash}\nProvenance hash ${row.manifest.provenanceHash}\nSchema ${row.manifest.schemaHash ?? 'Not included'} · ${row.manifest.migrationHashes.length} migrations`}</Text>
    </AdminPanel>)}
    {!snapshot.releases.length ? <Text>No package metadata registered in the retained snapshot.</Text> : null}
  </View>;
}
