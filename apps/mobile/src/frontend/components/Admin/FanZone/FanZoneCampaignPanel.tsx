/**
 * FUN-01 testing campaign editor; opened rules are immutable and lifecycle decisions stay server-authorized.
 * @sideEffects Invokes the parent action callback for explicitly requested campaign changes.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AdminBtn, AdminField, AdminFieldRow, AdminPanel, AdminPills } from '@/components/Admin/AdminChrome';
import type { FanZoneAdminCampaign, FanZoneCampaignAction, FanZoneCampaignPayload } from '@/lib/fanZone';
type Props = {
    campaign: FanZoneAdminCampaign | null;
    busy: boolean;
    onAction: (id: string | null, action: FanZoneCampaignAction, payload: FanZoneCampaignPayload) => void;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = ['title', 'theme', 'rules', 'support_contact', 'entry_opens_at', 'entry_closes_at', 'vote_opens_at', 'vote_closes_at', 'story_reel_id'] as const;
type Form = Record<typeof fields[number], string> & {
    period: 'game' | 'week';
    testers: string;
};
const fresh = (): Form => { const now = Date.now(); return { title: '', theme: '', period: 'week', rules: 'Free ballots; ties share recognition. Zero valid ballots means no award.', support_contact: '', entry_opens_at: new Date(now).toISOString(), entry_closes_at: new Date(now + 86400000).toISOString(), vote_opens_at: new Date(now).toISOString(), vote_closes_at: new Date(now + 172800000).toISOString(), story_reel_id: '', testers: '' }; };
const fromCampaign = (c: FanZoneAdminCampaign): Form => ({ ...Object.fromEntries(fields.map(k => [k, c[k] ?? ''])), period: c.period, testers: c.pilot_accounts.join('\n') } as Form);
const labels: Record<typeof fields[number], string> = { title: 'Campaign title', theme: 'Campaign theme', rules: 'Published testing rules', support_contact: 'Support contact', entry_opens_at: 'Entry opens (ISO date/time)', entry_closes_at: 'Entry closes (ISO date/time)', vote_opens_at: 'Voting opens (ISO date/time)', vote_closes_at: 'Voting closes (ISO date/time)', story_reel_id: 'Curated public free reel ID (optional)' };
/** @purpose Configure only drafts, or create another testing campaign with an explicit approved audience. */
export function FanZoneCampaignPanel({ campaign, busy, onAction }: Props) {
    const [creating, setCreating] = useState(!campaign), [form, setForm] = useState<Form>(() => campaign ? fromCampaign(campaign) : fresh());
    useEffect(() => { setCreating(!campaign); setForm(campaign ? fromCampaign(campaign) : fresh()); }, [campaign]);
    const ids = form.testers.split(/[\s,]+/).filter(Boolean), dates = [form.entry_opens_at, form.entry_closes_at, form.vote_opens_at, form.vote_closes_at].map(Date.parse);
    const size = (s: string, min: number, max: number) => Array.from(s).length >= min && Array.from(s).length <= max;
    const valid = size(form.title, 1, 80) && size(form.theme, 1, 240) && size(form.rules, 10, 4000) && size(form.support_contact, 0, 200)
        && ids.length <= 100 && ids.every(x => uuid.test(x)) && new Set(ids).size === ids.length && (!form.story_reel_id || uuid.test(form.story_reel_id))
        && dates.every(Number.isFinite) && dates[0] < dates[1] && dates[2] < dates[3] && dates[1] <= dates[3];
    const payload = (): FanZoneCampaignPayload => ({ ...Object.fromEntries(fields.filter(k => k !== 'story_reel_id').map(k => [k, form[k]])), period: form.period, story_reel_id: form.story_reel_id || null, pilot_accounts: ids } as FanZoneCampaignPayload);
    const opened = !!campaign?.opened_at, canOpen = !!campaign && ['draft', 'paused'].includes(campaign.status) && campaign.pilot_accounts.length > 0
        && Array.from(campaign.support_contact.replace(/^ +| +$/g, '')).length >= 5 && Date.parse(campaign.vote_closes_at) > Date.now();
    const ended = !!campaign && !!campaign.opened_at && Date.now() >= Date.parse(campaign.vote_closes_at);
    return <AdminPanel title={creating ? 'New testing campaign' : 'Campaign operations'}>
  <Text>{campaign ? `${campaign.status} · testing only · ${campaign.pilot_accounts.length}/100 approved accounts` : 'No selected campaign. Create a draft testing campaign.'}</Text>
  <Text>No production action. Empty lists stay closed. Opening uses the stored approved list and support contact.</Text>
  <AdminBtn label="New campaign" disabled={busy} onPress={() => { setCreating(true); setForm(fresh()); }}/>
  {creating && campaign ? <AdminBtn label="Return to selected campaign" disabled={busy} onPress={() => { setCreating(false); setForm(fromCampaign(campaign)); }}/> : null}
  <AdminPills label="Campaign period" items={[{ id: 'game', label: 'Game' }, { id: 'week', label: 'Week' }]} value={form.period} onChange={period => setForm(old => ({ ...old, period }))}/>
  <AdminFieldRow>{fields.map(k => <AdminField key={k} label={labels[k]} value={form[k]} multiline={['theme', 'rules'].includes(k)} onChangeText={value => setForm(old => ({ ...old, [k]: value }))}/>)}</AdminFieldRow>
  <AdminField label="Approved tester profile IDs" value={form.testers} onChangeText={testers => setForm(old => ({ ...old, testers }))} multiline placeholder="Canonical profile UUIDs, comma or newline separated; at most 100"/>
  {opened && !creating ? <Text>Opened schedule, theme, rules, story and audience are immutable. Create a new draft to change them.</Text> : null}
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
   <AdminBtn label="Create testing draft" kind="primary" disabled={busy || !creating || !valid} onPress={() => onAction(null, 'create', payload())}/>
   <AdminBtn label="Save campaign configuration" disabled={busy || creating || !valid || opened || !campaign} onPress={() => onAction(campaign!.id, 'configure', payload())}/>
   <AdminBtn label="Open for approved testers" disabled={busy || creating || !canOpen} onPress={() => onAction(campaign!.id, 'open', {})}/>
   <AdminBtn label="Pause campaign" kind="danger" disabled={busy || creating || campaign?.status !== 'open'} onPress={() => onAction(campaign!.id, 'pause', {})}/>
   <AdminBtn label="Close campaign" disabled={busy || creating || !campaign || !['open', 'paused'].includes(campaign.status)} onPress={() => onAction(campaign!.id, 'close', {})}/>
   <AdminBtn label="Finalize valid ballots" disabled={busy || creating || !ended} onPress={() => onAction(campaign!.id, 'finalize', {})}/>
   <AdminBtn label="Recount valid ballots" disabled={busy || creating || !ended} onPress={() => onAction(campaign!.id, 'recount', {})}/>
  </View>
  <Text>Only valid free ballots determine recognition. Maximum valid count wins; ties share recognition; zero means no award. Staff cannot choose a winner.</Text>
 </AdminPanel>;
}
