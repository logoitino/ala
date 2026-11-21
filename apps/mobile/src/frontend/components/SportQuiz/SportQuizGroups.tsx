/** QUIZ-03 family challenge entry: My groups, make a group (preset names only) and join by code. No search, no
 * chat; a refused code always reads the same. The group page itself lives in SportQuizGroupPage.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { TriviaGroupsState } from '@/hooks/useTriviaGroups';
import { TRIVIA_GROUP_LABELS, TRIVIA_GROUP_NAMES, type TriviaGroupName } from '@shared/triviaPlayTogether';
import { colors, radii } from '@/constants/theme';
import { QuizButton } from './QuizButton';
import { TYPE, figtree } from '@/theme/fonts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** @purpose My groups list plus the create and join forms; opening a group hands off to the group page. */
export function SportQuizGroups({ groups }: { groups: TriviaGroupsState }) {
    const [name, setName] = useState<TriviaGroupName | null>(null);
    const [code, setCode] = useState('');
    const mine = groups.mine;
    const busy = !!groups.busy;
    const canCreate = !!mine && mine.groups_enabled && mine.limits.created < mine.limits.create_limit && mine.limits.belong < mine.limits.belong_limit;
    return <View style={{ gap: 12 }}>
        <Text style={{ ...TYPE.section, ...figtree('700') }} accessibilityRole="header">Play together</Text>
        <Text style={{ ...figtree('400'), ...TYPE.body }}>Make a group with family or friends. Everyone plays their own weekly round. The group sees who played, never answers, scores or times.</Text>
        {groups.loading && !mine ? <Text style={{ ...figtree('400'), ...TYPE.body }}>Loading your groups…</Text> : null}
        {groups.error ? <Text style={{ ...figtree('400'), ...TYPE.body }} accessibilityRole="alert">{groups.error}</Text> : null}
        {groups.notice ? <Text style={{ ...figtree('400'), ...TYPE.body }} accessibilityLiveRegion="polite">{groups.notice}</Text> : null}
        {mine && !mine.groups_enabled ? <Text style={{ ...figtree('400'), ...TYPE.body }}>Groups are paused right now. Your groups are safe and will be back.</Text> : null}
        <Text style={{ ...TYPE.section, ...figtree('700') }} accessibilityRole="header">My groups</Text>
        {mine && !mine.groups.length ? <Text style={{ ...figtree('400'), ...TYPE.body }}>You’re not in a group yet.</Text> : null}
        {mine?.groups.map(g => <View key={g.group_id} style={{ gap: 4, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <Text style={{ ...TYPE.body, ...figtree('700'), color: colors.text }}>{TRIVIA_GROUP_LABELS[g.name_key]}</Text>
            <Text style={{ color: colors.textMuted }}>{`${plural(g.members, 'member')} · ${g.theme_sport ?? 'All sports'}${g.is_owner ? ' · You made this group' : ''}`}</Text>
            <Text style={{ ...figtree('400'), ...TYPE.body }}>{g.everyone_played ? 'Everyone played this week!' : g.played_this_week ? 'You played this week.' : 'You haven’t played this week yet.'}</Text>
            <QuizButton label={`Open ${TRIVIA_GROUP_LABELS[g.name_key]} group`} quiet disabled={busy} onPress={() => groups.open(g.group_id)}/>
        </View>)}
        {mine?.removed.map(g => <Text style={{ ...figtree('400'), ...TYPE.body }} key={g.group_id}>{`You’re no longer in the ${TRIVIA_GROUP_LABELS[g.name_key]} group.`}</Text>)}
        {mine?.groups_enabled ? <>
            <Text style={{ ...TYPE.section, ...figtree('700') }} accessibilityRole="header">Make a group</Text>
            <Text style={{ ...figtree('400'), ...TYPE.body }}>Pick a name. Names come from a short list so groups stay friendly.</Text>
            <View style={{ gap: 8 }}>
                {TRIVIA_GROUP_NAMES.map(n => <QuizButton key={n} label={TRIVIA_GROUP_LABELS[n]} quiet selected={name === n} disabled={busy} onPress={() => setName(n)}/>)}
            </View>
            {mine && !canCreate ? <Text style={{ ...figtree('400'), ...TYPE.body }}>{mine.limits.created >= mine.limits.create_limit ? 'You’ve made 3 groups, the most allowed.' : 'You’re in 5 groups, the most allowed. Leave one to make another.'}</Text> : null}
            <QuizButton label="Make group" disabled={busy || !name || !canCreate} onPress={() => { if (name) void groups.create(name); }}/>
            <Text style={{ ...TYPE.section, ...figtree('700') }} accessibilityRole="header">Join with a code</Text>
            <Text style={{ ...figtree('400'), ...TYPE.body }}>Got a code from family or a friend you know? Enter it here.</Text>
            <TextInput accessibilityLabel="Group code" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={12}
                placeholder="8-letter code" placeholderTextColor={colors.textMuted}
                style={{ ...figtree('400'), minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 12, ...TYPE.title, letterSpacing: 2, color: colors.text, backgroundColor: colors.surface }}/>
            <QuizButton label="Join group" disabled={busy || code.trim().length < 8} onPress={() => { void groups.join(code).then(result => { if (result?.outcome === 'joined') setCode(''); }); }}/>
        </> : null}
        <QuizButton label="Refresh groups" quiet disabled={busy || groups.loading} onPress={() => { void groups.refresh(); }}/>
    </View>;
}
