/**
 * FUN-01 one all-role testing journey: private entry, exact guardian permission, free ballots and voluntary service.
 * @sideEffects Identity-scoped hook actions, explicit player selection and Back/account Home navigation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { useFanZone, type FanZoneDraft } from '@/hooks/useFanZone';
import { ROLE_HOME } from '@/lib/roles';
import { FanButton, FanPanel, fanStyles } from './FanZoneChrome';
import { FanZoneEntryForm } from './FanZoneEntryForm';
import { FanZonePermission, type FanVideoControl } from './FanZonePermission';
import { FanZoneSafety } from './FanZoneSafety';
import { FanZoneStory } from './FanZoneStory';
import { FanZoneVideo } from './FanZoneVideo';
/** @purpose Presentation-only route parameters never assign, consent, reserve or vote automatically. */
export function FanZoneScreen({ campaignId = null, initialSection }: {
    campaignId?: string | null;
    initialSection?: 'permissions';
}) {
    const state = useFanZone(campaignId);
    const auth = useAuth();
    const router = useRouter();
    const { requireAuth } = useSoftWall();
    const [path, setPath] = useState<'join' | 'story' | 'serve'>('join');
    const [openKey, setOpenKey] = useState<string | null>(null), [readyKey, setReadyKey] = useState<string | null>(null);
    const activeVideo = useRef<string | null>(null);
    activeVideo.current = openKey;
    const [local, setLocal] = useState<{
        identity: string | null;
        draft: FanZoneDraft;
    }>({ identity: state.identityKey, draft: { uri: '', alias: '', caption: '', rights: false } });
    const draft = local.identity === state.identityKey ? local.draft : { uri: '', alias: '', caption: '', rights: false };
    const close = useCallback(() => { activeVideo.current = null; setOpenKey(null); setReadyKey(null); }, []);
    useEffect(() => { close(); }, [state.identityKey, state.permissionReviewEpoch, close]);
    useEffect(() => { if (!state.snapshot)
        close(); }, [state.snapshot, close]);
    const open = useCallback((key: string) => { activeVideo.current = key; setReadyKey(null); setOpenKey(key); }, []);
    const ready = useCallback((key: string, value: boolean) => { setReadyKey(old => value ? (key === activeVideo.current ? key : old) : (old === key ? null : old)); }, []);
    const video: FanVideoControl = { openKey, readyKey, open, close, ready };
    const s = state.snapshot, c = s?.campaign, busy = !!state.busy || state.loading;
    const home = () => { close(); router.replace(ROLE_HOME[auth.role] as Href); };
    const back = () => { close(); if (router.canGoBack())
        router.back();
    else
        home(); };
    const entryWindow = !!c && c.status === 'open' && Date.now() >= Date.parse(c.entry_opens_at) && Date.now() < Date.parse(c.entry_closes_at);
    const voteWindow = !!c && c.status === 'open' && Date.now() >= Date.parse(c.vote_opens_at) && Date.now() < Date.parse(c.vote_closes_at);
    return <ScreenShell edges={['top', 'bottom', 'left', 'right']}><ScrollView contentContainerStyle={fanStyles.page}>
 <View style={fanStyles.row}><FanButton label="Back" onPress={back}/><FanButton label="Account Home" onPress={home}/></View>
 <Text accessibilityRole="header" style={fanStyles.title}>Fan Zone</Text><Text style={fanStyles.copy}>Optional family fun · Approved-account testing only</Text>
 <Text style={fanStyles.copy}>Free ballots choose recognition. Donations, watching, service and Aura never add votes. No entry fee or cash award.</Text>
 {state.loading && !s ? <Text>Checking Fan Zone availability…</Text> : null}{state.error ? <Text accessibilityRole="alert" style={fanStyles.notice}>{state.error}</Text> : null}{state.notice ? <Text style={fanStyles.notice}>{state.notice}</Text> : null}
 <FanButton label="Refresh Fan Zone" disabled={!!state.busy} onPress={() => { close(); void state.refresh(); }}/>
 {state.pendingBallot ? <FanPanel title="Pending ballot"><Text>Ballot confirmation is pending. Keep the original choice until it is resolved.</Text><FanButton label="Retry original ballot" disabled={busy} onPress={() => void state.vote(state.pendingBallot!.entryId)}/><Text>A receipt describes the original request; a fresh server read must confirm the current ballot.</Text></FanPanel> : null}
 {!c && !state.loading ? <Text>Fan Zone is not available for this account right now. Your concern receipt can still be checked below.</Text> : null}
 {auth.isGuest ? <FanButton label="Sign in to join Fan Zone" onPress={() => requireAuth({ kind: 'signin', resume: () => { } })}/> : null}
 {c ? <>
 <FanPanel title={c.title}><Text style={fanStyles.copy}>{c.theme}</Text><Text>{`Entries ${c.entry_opens_at} to ${c.entry_closes_at}. Voting ${c.vote_opens_at} to ${c.vote_closes_at}; deadlines excluded.`}</Text><Text>{c.rules}</Text><Text>{`Campaign ${c.status}. ${s?.can_participate ? 'This account is enrolled.' : 'Private review only; this account is not enrolled to enter or vote.'}`}</Text></FanPanel>
 <View style={fanStyles.row}><FanButton label="Join the fun" onPress={() => { close(); setPath('join'); }}/><FanButton label="Meet an athlete" onPress={() => { close(); setPath('story'); }}/><FanButton label="Serve together" onPress={() => { close(); setPath('serve'); }}/></View>
 {path === 'join' ? <>
 {s?.can_participate && entryWindow ? <FanZoneEntryForm state={state} draft={draft} onChange={next => setLocal({ identity: state.identityKey, draft: next })}/> : <Text>Entry creation is unavailable. Private review, revocation and tracked removal remain separate.</Text>}
 <FanPanel title="Eligible fan candidates">
 {!s?.candidates.length ? <Text>No eligible candidates are visible to this account.</Text> : s.candidates.map(e => {
                    const key = JSON.stringify([state.identityKey, e.id, e.revision, 'candidate']);
                    return <View key={e.id} style={{ gap: 8 }}><Text style={fanStyles.copy}>{`${e.alias}: ${e.caption}`}</Text>
 <FanZoneVideo entryId={e.id} revision={e.revision} reviewKey={key} open={openKey === key} onOpen={() => open(key)} onClose={close} onReady={ready} label={`Watch candidate ${e.alias}`}/>
 <FanButton label={`Vote for ${e.alias}`} disabled={busy || !!state.pendingBallot || !voteWindow || !s.can_participate || s.entry?.id === e.id || !!s.ballot?.invalidated || !!state.error} onPress={() => void state.vote(e.id)}/></View>;
                })}
 {state.pendingBallot ? <Text>The current ballot is awaiting confirmation.</Text> : s?.ballot ? <Text>{`Current ballot: ${s.candidates.find(e => e.id === s.ballot!.entry_id)?.alias ?? 'candidate unavailable'} · version ${s.ballot.version}${s.ballot.invalidated ? ' · invalidated' : ''}`}</Text> : <Text>No current ballot recorded in this source read.</Text>}
 </FanPanel>
 </> : null}
 {path === 'story' ? <FanZoneStory story={s?.story ?? null} open={openKey === 'story'} onOpen={() => open('story')} onClose={close}/> : null}
 {path === 'serve' ? <FanPanel title="Serve together — optional">
 <Text>Accessible ideas, private receipts and no required proof. This never adds votes, money, Aura or a public badge.</Text>
 {([{ idea: 'encourage', label: 'Encourage someone' }, { idea: 'help_at_home', label: 'Help at home' }, { idea: 'serve_together', label: 'Serve together privately' }, { idea: 'thank_someone', label: 'Thank someone' }] as const).map(i => <FanButton key={i.idea} label={i.label} disabled={busy || !s?.can_participate} onPress={() => void state.reflection(i.idea)}/>)}
 {s?.reflections.map(r => <View key={r.id}><Text>{`Private idea: ${r.idea} · ${r.created_at}`}</Text><FanButton label="Delete private reflection" disabled={busy} onPress={() => void state.deleteReflection(r.id)}/></View>)}
 </FanPanel> : null}
 {c.status === 'finalized' ? <FanPanel title="Recognition results">{c.recount_required ? <Text>Results are awaiting a valid recount.</Text> : s?.results.length ? <><Text>{s.results.length > 1 ? 'Shared recognition — tied valid ballots.' : 'Recognition from valid free ballots.'}</Text>{s.results.map(r => <Text key={r.entry_id}>{`${s.candidates.find(e => e.id === r.entry_id)?.alias ?? 'Eligible entry'}: ${r.votes} valid ballots`}</Text>)}</> : <Text>No award: there are no visible valid winning ballots.</Text>}</FanPanel> : null}
 </> : null}
 {s?.entry ? <><Text>{`Private entry ${s.entry.status}${s.entry.reason ? ': ' + s.entry.reason : ''}. A private receipt is separate from public candidacy.`}</Text><FanZonePermission key={JSON.stringify([state.identityKey, state.permissionReviewEpoch, s.entry.id, s.entry.consent_scope])} entry={s.entry} guardian={false} state={state} video={video}/></> : null}
 {s?.guardian_queue.length ? <><Text accessibilityRole="header" style={fanStyles.title}>{initialSection === 'permissions' ? 'Guardian permission review' : 'Your selected-campaign guardian queue'}</Text><Text>These are private entries for this campaign only. Being a reviewer does not enroll you to vote.</Text>{s.guardian_queue.map(e => <FanZonePermission key={JSON.stringify([state.identityKey, state.permissionReviewEpoch, e.id, e.consent_scope])} entry={e} guardian state={state} video={video}/>)}</> : null}
 <FanZoneSafety key={state.identityKey} state={state}/>
 </ScrollView></ScreenShell>;
}
