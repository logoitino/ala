/** FUN-01 permission testing draft binds video readiness and copy confirmation to the exact server scope. */
import { useState } from 'react';
import { Text } from 'react-native';
import type { FanZoneEntry } from '@shared/fanZone';
import type { FanZoneState } from '@/hooks/useFanZone';
import { FanZoneVideo } from './FanZoneVideo';
import { FanButton, FanCheck, FanPanel, fanStyles } from './FanZoneChrome';
export type FanVideoControl = {
    openKey: string | null;
    readyKey: string | null;
    open: (key: string) => void;
    close: () => void;
    ready: (key: string, value: boolean) => void;
};
/** @purpose Every current revision remount resets copy confirmation; prior guardian grants never substitute automatically. */
export function FanZonePermission({ entry, guardian, state, video }: {
    entry: FanZoneEntry;
    guardian: boolean;
    state: FanZoneState;
    video: FanVideoControl;
}) {
    const [confirmed, setConfirmed] = useState(false);
    const key = JSON.stringify([state.identityKey, entry.id, entry.revision, entry.digest, entry.consent_scope]);
    const disabled = !!state.busy || state.loading;
    const canConfirm = entry.verified && !entry.removed_at && entry.status !== 'withdrawn' && video.readyKey === key && confirmed;
    return <FanPanel title={guardian ? 'Guardian permission review' : 'Exact entry permission'}>
 <Text style={fanStyles.copy}>{`Revision ${entry.revision}: ${entry.alias} — ${entry.caption}`}</Text>
 <Text style={fanStyles.copy}>Testing draft permission: this exact sanitized video, alias and caption may appear only to approved pilot accounts for this campaign. No reuse. The supervision link is not independent proof of legal guardianship.</Text>
 <Text selectable style={fanStyles.copy}>{JSON.stringify(entry.consent_scope)}</Text>
 {entry.verified && !entry.removed_at && entry.status !== 'withdrawn' ? <FanZoneVideo entryId={entry.id} revision={entry.revision} reviewKey={key} open={video.openKey === key} onOpen={() => video.open(key)} onClose={video.close} onReady={video.ready}/> : <Text>Exact video is not available for permission review.</Text>}
 <FanCheck label="I reviewed this caption and exact permission scope" value={confirmed} onChange={setConfirmed} disabled={disabled}/>
 <FanButton label={guardian ? 'Grant exact revision permission' : 'Assent to this exact revision'} disabled={disabled || !canConfirm} onPress={() => void state.permission(entry, guardian ? 'grant' : 'assent')}/>
 <FanButton label="Revoke my exact permission" disabled={disabled} onPress={() => void state.permission(entry, 'revoke')}/>
 <Text>{entry.permission_valid ? 'Current exact permission is valid. Staff acceptance and audience authorization still apply.' : 'Current permission is incomplete or revoked. Teens need their own assent and a fresh linked guardian grant.'}</Text>
 {!guardian ? <><FanButton label="Submit private entry for review" disabled={disabled || entry.status !== 'draft' || !entry.verified || !entry.rights_confirmed || !!entry.removed_at} onPress={() => void state.submit(entry)}/><FanButton label="Withdraw my entry" disabled={disabled || entry.status === 'withdrawn'} onPress={() => void state.withdraw(entry)}/></> : null}
 </FanPanel>;
}
