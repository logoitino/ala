/** QUIZ-03 group page: members' names as the backend returns them with a played-this-week mark, group totals only
 * when the backend sends them, opt-in visible badges, the theme, "Everyone played!", and the group round button.
 * Owner-only Remove uses the opaque member_ref. Leave, Renew code and Report group are here too. No chat, no
 * per-member counts, answers, times or ranking.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import type { TriviaGroupsState } from '@/hooks/useTriviaGroups';
import { TRIVIA_GROUP_LABELS, TRIVIA_REPORT_REASONS, type TriviaReportReason } from '@shared/triviaPlayTogether';
import { colors, radii } from '@/constants/theme';
import { QuizButton } from './QuizButton';
import { TYPE, figtree } from '@/theme/fonts';

const REPORT_LABELS: Record<TriviaReportReason, string> = {
    safety: 'Someone may be unsafe', unwanted_contact: 'Someone I don’t know is in it', name_or_theme: 'The name or theme isn’t okay', other: 'Something else',
};
/** Share codes only with people you know; said next to every code and inside the shared message. */
export const TRIVIA_CODE_SAFETY = 'Share codes only with family or friends you know.';
const shortDate = (iso: string | null) => iso ? new Date(iso).toISOString().slice(0, 10) : null;
/** @purpose One group's live page. `playable` is false when this week's round is already used or groups are off. */
export function SportQuizGroupPage({ groups, sports, playable, playNote, onPlay, onBack }: {
    groups: TriviaGroupsState;
    /** Sports with approved questions (from the trivia snapshot), offered as themes. */
    sports: string[];
    playable: boolean;
    playNote: string | null;
    onPlay: (groupId: string, label: string, theme: string | null) => void;
    onBack: () => void;
}) {
    const [confirm, setConfirm] = useState<{ kind: 'remove'; ref: string; name: string } | { kind: 'leave' } | null>(null);
    const [reporting, setReporting] = useState(false);
    const [theming, setTheming] = useState(false);
    const page = groups.page;
    const busy = !!groups.busy;
    const back = <QuizButton label="Back to my groups" quiet onPress={onBack}/>;
    const messages = <>{groups.error ? <Text style={{ ...figtree('400'), ...TYPE.body }} accessibilityRole="alert">{groups.error}</Text> : null}{groups.notice ? <Text style={{ ...figtree('400'), ...TYPE.body }} accessibilityLiveRegion="polite">{groups.notice}</Text> : null}</>;
    if (!page) return <View style={{ gap: 12 }}>{back}{messages}{!groups.error ? <Text style={{ ...figtree('400'), ...TYPE.body }}>Loading the group…</Text> : null}</View>;
    const label = TRIVIA_GROUP_LABELS[page.name_key];
    const report = <>
        <QuizButton label="Report group" quiet disabled={busy} onPress={() => setReporting(v => !v)}/>
        {reporting ? <View style={{ gap: 8 }}><Text style={{ ...figtree('400'), ...TYPE.body }}>What’s wrong? Our safety team will look. The group isn’t told who reported it.</Text>
            {TRIVIA_REPORT_REASONS.map(r => <QuizButton key={r} label={REPORT_LABELS[r]} quiet disabled={busy} onPress={() => { setReporting(false); void groups.report(page.group_id, r); }}/>)}</View> : null}
    </>;
    if (page.outcome === 'removed') return <View style={{ gap: 12 }}>{back}<Text style={{ ...TYPE.section, ...figtree('700') }} accessibilityRole="header">{label}</Text>{messages}
        <Text style={{ ...figtree('400'), ...TYPE.body }}>You’re no longer in this group.</Text>{report}</View>;
    if (page.status === 'closed') return <View style={{ gap: 12 }}>{back}<Text style={{ ...TYPE.section, ...figtree('700') }} accessibilityRole="header">{label}</Text>{messages}
        <Text style={{ ...figtree('400'), ...TYPE.body }}>This group has closed.</Text>{report}</View>;
    const code = groups.code?.groupId === page.group_id ? groups.code : null;
    const share = (value: string) => { void Share.share({ message: `Join my ${label} trivia group on Tapua'i with code ${value}. ${TRIVIA_CODE_SAFETY}` }).catch(() => { }); };
    const t = page.totals;
    return <View style={{ gap: 12 }}>
        {back}
        <Text accessibilityRole="header" style={{ ...figtree('400'), ...TYPE.title }}>{label}</Text>
        <Text style={{ ...figtree('400'), ...TYPE.body }}>{`Theme: ${page.theme_sport ?? 'All sports'}`}</Text>
        {messages}
        {page.everyone_played ? <Text accessibilityLiveRegion="polite" style={{ ...TYPE.title, ...figtree('700'), color: colors.primary }}>Everyone played this week!</Text> : null}
        <Text style={{ ...figtree('400'), ...TYPE.body }}>{`${t.played_this_week} of ${t.members} played this week`}</Text>
        {t.facts_this_week !== null ? <Text style={{ ...figtree('400'), ...TYPE.body }}>{`Together you learned ${t.facts_this_week}+ facts this week`}</Text> : null}
        {t.facts_this_season !== null ? <Text style={{ ...figtree('400'), ...TYPE.body }}>{`and ${t.facts_this_season}+ facts this season`}</Text> : null}
        <Text style={{ ...TYPE.section, ...figtree('700') }} accessibilityRole="header">Members</Text>
        {page.members.map((m, index) => <View key={m.member_ref ?? `${index}`} style={{ gap: 4, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <Text style={{ ...TYPE.body, ...figtree('600'), color: colors.text }}>{`${m.display_name}${m.is_me ? ' (you)' : ''}${m.is_owner ? ' · made the group' : ''}`}</Text>
            <Text style={{ ...figtree('400'), ...TYPE.body }}>{m.played_this_week ? '✓ Played this week' : 'Not yet this week'}</Text>
            {m.badges.length ? <Text style={{ color: colors.textMuted }}>{`Badges: ${m.badges.join(', ')}`}</Text> : null}
            {page.is_owner && !m.is_me && m.member_ref ? <QuizButton label={`Remove ${m.display_name}`} quiet disabled={busy} onPress={() => setConfirm({ kind: 'remove', ref: m.member_ref!, name: m.display_name })}/> : null}
        </View>)}
        {confirm?.kind === 'remove' ? <View style={{ gap: 8 }}><Text style={{ ...figtree('400'), ...TYPE.body }}>{`Remove ${confirm.name}? They can’t rejoin this group, and the code changes.`}</Text>
            <QuizButton label="Yes, remove" disabled={busy} onPress={() => { const ref = confirm.ref; setConfirm(null); void groups.remove(page.group_id, ref); }}/>
            <QuizButton label="Keep them" quiet onPress={() => setConfirm(null)}/></View> : null}
        <QuizButton label="Play this week’s group round" disabled={!playable || busy} onPress={() => onPlay(page.group_id, label, page.theme_sport)}/>
        {playNote ? <Text style={{ ...figtree('400'), ...TYPE.body }}>{playNote}</Text> : null}
        {page.is_owner ? <View style={{ gap: 8 }}>
            <Text style={{ ...TYPE.section, ...figtree('700') }} accessibilityRole="header">Group code</Text>
            {code ? <View style={{ gap: 8, padding: 12, borderRadius: radii.md, backgroundColor: colors.accentSoft }}>
                <Text accessibilityLabel={`Group code ${code.code.split('').join(' ')}`} style={{ ...TYPE.title, ...figtree('700'), letterSpacing: 4, color: colors.text }}>{code.code}</Text>
                {shortDate(code.expiresAt) ? <Text style={{ ...figtree('400'), ...TYPE.body }}>{`Works until ${shortDate(code.expiresAt)}. You’ll only see it now.`}</Text> : null}
                <Text style={{ ...figtree('400'), ...TYPE.body }}>{TRIVIA_CODE_SAFETY}</Text>
                <QuizButton label="Share code" hint="Opens your phone’s share options" onPress={() => share(code.code)}/>
            </View> : <Text style={{ ...figtree('400'), ...TYPE.body }}>{page.code_active ? `A code works until ${shortDate(page.code_expires_at) ?? 'soon'}. Make a new one to see and share it.` : 'No code is working right now.'}</Text>}
            {page.can_invite ? <QuizButton label="Renew code" quiet disabled={busy} onPress={() => { void groups.renew(page.group_id); }}/> : <Text style={{ ...figtree('400'), ...TYPE.body }}>The group is full (12 people).</Text>}
            <QuizButton label="Change theme" quiet disabled={busy} onPress={() => setTheming(v => !v)}/>
            {theming ? <View style={{ gap: 8 }}>
                <QuizButton label="All sports" quiet selected={page.theme_sport === null} disabled={busy} onPress={() => { setTheming(false); void groups.setTheme(page.group_id, null); }}/>
                {sports.map(s => <QuizButton key={s} label={s} quiet selected={page.theme_sport === s} disabled={busy} onPress={() => { setTheming(false); void groups.setTheme(page.group_id, s); }}/>)}
            </View> : null}
        </View> : null}
        <QuizButton label="Leave group" quiet disabled={busy} onPress={() => setConfirm({ kind: 'leave' })}/>
        {confirm?.kind === 'leave' ? <View style={{ gap: 8 }}><Text style={{ ...figtree('400'), ...TYPE.body }}>{page.is_owner ? 'Leave this group? It passes to the member who joined first, or closes if you’re the last one.' : 'Leave this group? You can join again later with a new code.'}</Text>
            <QuizButton label="Yes, leave" disabled={busy} onPress={() => { setConfirm(null); void groups.leave(page.group_id); }}/>
            <QuizButton label="Stay" quiet onPress={() => setConfirm(null)}/></View> : null}
        {report}
    </View>;
}
