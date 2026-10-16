/** FUN-01 bounded concern receipts and tracked all-revision removal; policy information is not report intake. */
import { useState } from 'react';
import { Text } from 'react-native';
import { LegalModal } from '@/components/Legal/LegalModal';
import type { FanZoneState } from '@/hooks/useFanZone';
import { FanButton, FanField, FanPanel, fanStyles } from './FanZoneChrome';
const uuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
/** @purpose Guest intake needs a supplied entry ID and reveals no campaign or private object existence. */
export function FanZoneSafety({ state }: {
    state: FanZoneState;
}) {
    const [entryId, setEntryId] = useState(''), [details, setDetails] = useState(''), [id, setId] = useState(''), [secret, setSecret] = useState(''), [legal, setLegal] = useState(false);
    const busy = !!state.busy;
    const entry = state.snapshot?.entry;
    const privateEntries = [...(entry ? [entry] : []), ...(state.snapshot?.guardian_queue ?? [])];
    const validDetails = Array.from(details).length <= 1000 && Array.from(details.replace(/^ +| +$/g, '')).length >= 3;
    return <FanPanel title="Fan Zone Help & Safety">
 {state.snapshot?.campaign?.support_contact ? <><Text>Configured campaign support contact:</Text><Text selectable>{state.snapshot.campaign.support_contact}</Text><Text>Use this staffed contact if the in-app concern queue refuses your request. Contact delivery is outside this form.</Text></> : <Text>No campaign support contact is available to this account. An in-app request may be unavailable; try again or check an existing receipt. Staffed public support remains unavailable here.</Text>}
 <FanField label="Concern entry ID" value={entryId} onChange={setEntryId}/><FanField label="Concern details" value={details} onChange={setDetails} multiline/>
 <Text style={fanStyles.copy}>3–1000 characters. Do not include addresses or beneficiary photos. A concern does not automatically hide a candidate.</Text>
 <FanButton label="Send concern" disabled={busy || !uuid(entryId) || !validDetails} onPress={() => void state.concern(entryId, 'report', details)}/>
 {privateEntries.map(e => <FanPanel key={e.id} title={`Private removal: ${e.alias}`}>
  <FanButton label="Appeal entry review" disabled={busy || !validDetails} onPress={() => void state.concern(e.id, 'appeal', details)}/>
  <FanButton label="Request media removal" disabled={busy || !validDetails} onPress={() => void state.concern(e.id, 'deletion', details)}/>
  <FanButton label="Continue tracked removal" disabled={busy} onPress={() => void state.removeAll(e)}/>
  <Text>Withdrawal or permission revocation stops exposure. Removal completes only after every stored revision is absent; an existing deletion request can continue here.</Text>
 </FanPanel>)}
 {state.removal ? <Text>{`${state.removal.removed} of ${state.removal.total} revisions removed. ${state.removal.completed ? 'Server completion confirmed.' : 'Partial or pending; actual completion not confirmed.'}`}</Text> : null}
 <FanField label="Receipt ID" value={id} onChange={setId}/><FanField label="Private receipt secret" value={secret} onChange={setSecret}/>
 <FanButton label="Check concern status" disabled={busy || !uuid(id) || !uuid(secret)} onPress={() => void state.caseStatus(id, secret)}/>
 {state.cases.map(c => <Text selectable key={c.receipt.id}>{`Receipt ${c.receipt.id}\nSecret ${c.secret}\n${c.receipt.kind}: ${c.receipt.status}; expires ${c.receipt.expires_at}`}</Text>)}
 <Text>Save your receipt and secret privately. They are kept on this screen only and expire after 30 days.</Text>
 <FanButton label="Read Minor Safety information" onPress={() => setLegal(true)}/><Text>Policy information does not receive reports.</Text><LegalModal visible={legal} onClose={() => setLegal(false)}/>
 </FanPanel>;
}
