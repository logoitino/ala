/**
 * Optional account mentions on the Highlight upload sheet. The selected athlete still
 * decides who receives a gift. At most three accounts.
 * @sideEffects `search_taggable_accounts`.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { searchTaggableAccounts, type AccountTagHit } from '@/lib/accountTags';
import { TYPE, figtree } from '@/theme/fonts';

const MAX_TAGS = 3;

/**
 * @purpose Search and pick accounts to mention on a Highlight.
 * @param value Accounts already chosen.
 * @param onChange Replacement list, capped at three.
 */
export function AccountTagField({
  value,
  onChange,
  disabled,
}: {
  value: AccountTagHit[];
  onChange: (next: AccountTagHit[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<AccountTagHit[]>([]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void searchTaggableAccounts(query).then(setHits);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const add = (hit: AccountTagHit) => {
    if (value.some((row) => row.id === hit.id) || value.length >= MAX_TAGS) return;
    onChange([...value, hit]);
    setQuery('');
    setHits([]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Tag accounts</Text>
      <Text style={styles.hint}>Optional. They confirm before their name shows. Gifts still go to the selected athlete.</Text>
      <View style={styles.chips}>
        {value.map((row) => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${row.label}`}
            disabled={disabled}
            onPress={() => onChange(value.filter((item) => item.id !== row.id))}
            style={styles.chip}
          >
            <Text style={styles.chipLabel}>{row.label} ✕</Text>
          </Pressable>
        ))}
      </View>
      {value.length < MAX_TAGS ? (
        <TextInput
          accessibilityLabel="Search accounts to tag"
          editable={!disabled}
          value={query}
          onChangeText={setQuery}
          placeholder="Name or username"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : null}
      {hits
        .filter((hit) => !value.some((row) => row.id === hit.id))
        .map((hit) => (
          <Pressable
            key={hit.id}
            accessibilityRole="button"
            accessibilityLabel={`Tag ${hit.label}`}
            disabled={disabled}
            onPress={() => add(hit)}
            style={styles.hit}
          >
            <Text style={styles.hitLabel}>{hit.label}</Text>
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { ...TYPE.button, ...figtree('800'), color: colors.text },
  hint: { ...figtree('400'), ...TYPE.caption,  color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.deepGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipLabel: { color: colors.deepGreen, ...TYPE.button, ...figtree('800') },
  input: { ...figtree('400'),
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    color: colors.text,
    ...TYPE.body,
  },
  hit: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  hitLabel: { ...TYPE.body, ...figtree('700'), color: colors.text },
});
