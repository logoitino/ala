/**
 * Caption box for the Highlight composer with inline @ tagging (UPLOAD-STUDIO-01). Typing @ opens suggestions:
 * roster athletes first, then accounts from the existing `search_taggable_accounts` search. Choosing an athlete
 * sets who is in the clip, the same explicit choice the athlete row makes, so gifts never follow a typo. Choosing
 * an account adds one of at most three pending mentions; each person still confirms before their name shows.
 * Why the picked word leaves the caption: a public caption must not reveal a name before that person confirms,
 * so the tag lives as a chip instead. An @ word the uploader never picks stays ordinary caption text.
 * @sideEffects `search_taggable_accounts` via `lib/accountTags` while an @ word of two or more letters is active.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS, radii } from '@/constants/theme';
import { displayValue } from '@/data/players';
import { searchTaggableAccounts, type AccountTagHit } from '@/lib/accountTags';
import { playerTagLabel } from '@/lib/reels';
import type { Player } from '@/types/database';
import { TYPE, figtree } from '@/theme/fonts';
import { FOCAL } from '@/theme/motion';

/** Same cap the server-side `tag_reel_accounts` call and the former mention field enforce. */
export const MAX_MENTIONS = 3;
const MENTION_WORD = /(^|\s)@([^\s@]{0,30})$/;

/**
 * @purpose Find the @ word that ends at the caret.
 * @returns Start index of the @ and the typed query, or null when the caret is not inside an @ word.
 */
export function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, Math.max(0, Math.min(caret, text.length)));
  const match = MENTION_WORD.exec(before);
  if (!match) return null;
  return { start: before.length - match[2].length - 1, query: match[2] };
}

/**
 * @purpose Drop the active @ word and the extra space it would leave.
 * @returns Caption text without the word and the caret position where it was.
 */
export function removeMention(text: string, start: number, caret: number): { text: string; caret: number } {
  const head = text.slice(0, start);
  const tail = text.slice(caret);
  // The word always follows whitespace or the start, so trimming the tail's leading space avoids a double gap.
  const next = head + (head === '' || /\s$/.test(head) ? tail.replace(/^\s+/, '') : tail);
  return { text: next, caret: head.length };
}

type Props = {
  value: string;
  onChange: (text: string) => void;
  maxLength: number;
  placeholder: string;
  editable: boolean;
  players: Player[];
  playerId: string;
  onPickAthlete: (playerId: string) => void;
  mentions: AccountTagHit[];
  onMentions: (next: AccountTagHit[]) => void;
};

/** @purpose Caption input whose @ suggestions tag an athlete or mention an account without a separate search page. */
export function CaptionMentionInput(p: Props) {
  const [caret, setCaret] = useState(p.value.length);
  const [hits, setHits] = useState<{ query: string; rows: AccountTagHit[] }>({ query: '', rows: [] });
  const word = p.editable ? activeMention(p.value, caret) : null;
  const query = word ? word.query : null;
  const full = p.mentions.length >= MAX_MENTIONS;

  useEffect(() => {
    if (query === null || query.trim().length < 2 || full) return;
    let alive = true;
    const handle = setTimeout(() => {
      // Each reply is kept with the word that asked, so a slow older search never shows under a newer word.
      searchTaggableAccounts(query).then((rows) => { if (alive) setHits({ query, rows }); }, () => undefined);
    }, 250);
    return () => { alive = false; clearTimeout(handle); };
  }, [query, full]);

  const needle = (query ?? '').toLowerCase();
  const athletes = query === null ? [] : p.players
    .filter((player) => `${player.name} ${player.school_name ?? ''} ${player.jersey_number ?? ''}`.toLowerCase().includes(needle))
    .slice(0, 3);
  const accounts = query !== null && !full && hits.query === query
    ? hits.rows.filter((row) => !p.mentions.some((picked) => picked.id === row.id)).slice(0, 4)
    : [];

  const change = (text: string) => {
    // Typing at the end keeps the caret at the end; onSelectionChange corrects any other position right after.
    setCaret((current) => (current >= p.value.length ? text.length : Math.max(0, current + text.length - p.value.length)));
    p.onChange(text);
  };
  const clearWord = () => {
    if (!word) return;
    const next = removeMention(p.value, word.start, caret);
    setCaret(next.caret);
    setHits({ query: '', rows: [] });
    p.onChange(next.text);
  };
  const pickAthlete = (player: Player) => {
    clearWord();
    p.onPickAthlete(player.id);
  };
  const pickAccount = (hit: AccountTagHit) => {
    if (full || p.mentions.some((picked) => picked.id === hit.id)) return;
    clearWord();
    p.onMentions([...p.mentions, hit]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Caption</Text>
        <View style={styles.tip}><Text style={styles.tipText}>Type @ to tag</Text></View>
      </View>
      <TextInput
        accessibilityLabel="Highlight caption"
        accessibilityHint="Type @ to tag an athlete or mention an account"
        value={p.value}
        onChangeText={change}
        onSelectionChange={(event) => setCaret(event.nativeEvent.selection.end)}
        editable={p.editable}
        placeholder={p.placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        multiline
        maxLength={p.maxLength}
      />
      <Text style={styles.counter}>{p.value.length}/{p.maxLength}</Text>
      {word ? (
        <View style={styles.suggestions}>
          {athletes.map((player) => (
            <Pressable key={player.id} accessibilityRole="button" accessibilityLabel={`Tag athlete ${player.name}`}
              onPress={() => pickAthlete(player)} style={styles.suggestion}>
              <View style={[styles.badge, styles.athleteBadge]}><Ionicons name="flash" size={14} color={FOCAL.jadeInk} /></View>
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>{playerTagLabel(player)}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {player.id === p.playerId ? 'In this clip · gifts go here' : `Athlete · ${displayValue(player.school_name)}`}
                </Text>
              </View>
            </Pressable>
          ))}
          {accounts.map((hit) => (
            <Pressable key={hit.id} accessibilityRole="button" accessibilityLabel={`Mention ${hit.label}`}
              onPress={() => pickAccount(hit)} style={styles.suggestion}>
              <View style={[styles.badge, styles.accountBadge]}><Text style={styles.at}>@</Text></View>
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>{hit.label}</Text>
                <Text style={styles.meta}>Mention · they confirm first</Text>
              </View>
            </Pressable>
          ))}
          {full ? <Text style={styles.meta}>You can mention up to {MAX_MENTIONS} accounts.</Text> : null}
          {!full && athletes.length === 0 && accounts.length === 0 ? (
            <Text style={styles.meta}>{(query ?? '').trim().length < 2 ? 'Keep typing a name…' : 'No matches yet. Keep typing or pick later.'}</Text>
          ) : null}
        </View>
      ) : null}
      {p.mentions.length ? (
        <>
          <View style={styles.chips}>
            {p.mentions.map((picked) => (
              <Pressable key={picked.id} accessibilityRole="button" accessibilityLabel={`Remove mention ${picked.label}`}
                disabled={!p.editable} onPress={() => p.onMentions(p.mentions.filter((row) => row.id !== picked.id))} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>@{picked.label}</Text>
                <Ionicons name="close" size={14} color={colors.primary} />
              </Pressable>
            ))}
          </View>
          <Text style={styles.meta}>Mentions show after each person confirms. Gifts go to the athlete in the clip.</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  flex: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { ...figtree('800'), ...TYPE.body, color: colors.text },
  tip: { borderRadius: radii.pill, backgroundColor: FOCAL.mistJade, paddingHorizontal: 8, paddingVertical: 2 },
  tipText: { ...figtree('700'), ...TYPE.caption, color: FOCAL.jadeInk },
  input: {
    ...figtree('400'), ...TYPE.body, color: colors.text, minHeight: 72, paddingHorizontal: 10, paddingTop: 10,
    textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.controlRadius, backgroundColor: colors.surface,
  },
  counter: { ...figtree('400'), ...TYPE.caption, textAlign: 'right', color: colors.textMuted, marginTop: -2 },
  suggestions: {
    gap: 2, padding: 4, borderWidth: 1, borderColor: colors.primary, borderRadius: MENU_METRICS.controlRadius, backgroundColor: colors.surface,
  },
  suggestion: { minHeight: MENU_METRICS.touchTarget, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderRadius: radii.md },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  athleteBadge: { backgroundColor: FOCAL.mistJade },
  accountBadge: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  at: { ...figtree('800'), ...TYPE.body, color: colors.primary },
  name: { ...figtree('800'), ...TYPE.body, color: colors.text },
  meta: { ...figtree('400'), ...TYPE.caption, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    maxWidth: '100%', minHeight: MENU_METRICS.touchTarget, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12,
    borderRadius: radii.pill, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.accentSoft,
  },
  chipText: { ...figtree('700'), ...TYPE.body, color: colors.primary, flexShrink: 1 },
});
