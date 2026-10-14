/** FUN-01 local preserved composer; only the hook reserves private paths and writes bounded verified MP4 bytes. */
import { useState } from 'react';
import { Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { FanZoneDraft, FanZoneState } from '@/hooks/useFanZone';
import { FanButton, FanCheck, FanField, FanPanel, fanStyles } from './FanZoneChrome';
/** @sideEffects Explicit system picker only; upload action delegates the server-reserved pipeline to useFanZone. */
export function FanZoneEntryForm({ state, draft, onChange }: {
    state: FanZoneState;
    draft: FanZoneDraft;
    onChange: (draft: FanZoneDraft) => void;
}) {
    const [error, setError] = useState<string | null>(null);
    const disabled = !!state.busy || state.loading;
    const pick = async () => { try {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false, allowsMultipleSelection: false });
        if (!result.canceled && result.assets[0]?.uri)
            onChange({ ...draft, uri: result.assets[0].uri });
    }
    catch {
        setError('Video picker is unavailable. Please try again.');
    } };
    return <FanPanel title="Your private entry">
 <Text style={fanStyles.copy}>Choose a supported MP4, 1–30 seconds and at most 20 MiB. Keep names, addresses and children under 13 out of the clip.</Text>
 <FanField label="Fan alias" value={draft.alias} onChange={alias => onChange({ ...draft, alias })}/><FanField label="Fan caption" value={draft.caption} onChange={caption => onChange({ ...draft, caption })} multiline/>
 <FanCheck label="I have rights to share this video and the people shown" value={draft.rights} onChange={rights => onChange({ ...draft, rights })} disabled={disabled}/>
 <Text style={fanStyles.copy}>School logos and official film are not permission. This entry stays private during review.</Text>
 <FanButton label={draft.uri ? 'Choose replacement video' : 'Choose MP4 video'} disabled={disabled} onPress={() => void pick()}/>{draft.uri ? <Text>Video selected. Your draft stays here while you review other paths.</Text> : null}
 {state.uploadPending ? <><FanButton label="Retry private upload" disabled={disabled} onPress={() => void state.retryUpload()}/><FanButton label="Replace failed private draft" disabled={disabled} onPress={state.replaceFailedUpload}/></> : <FanButton label="Upload private entry" disabled={disabled || !draft.uri || !draft.rights || !draft.alias.replace(/^ +| +$/g, '') || !draft.caption.replace(/^ +| +$/g, '') || Array.from(draft.alias).length > 40 || Array.from(draft.caption).length > 240} onPress={() => void state.saveDraft(draft)}/>}
 {error ? <Text accessibilityRole="alert">{error}</Text> : null}
 </FanPanel>;
}
