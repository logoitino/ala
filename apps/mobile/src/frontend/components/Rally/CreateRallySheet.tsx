/** Fan menu presentation uses shared Daylight chrome; feature data and confirmation rules stay with the parent.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { colors, MENU_METRICS, radii } from '@/constants/theme';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import {
  RALLY_COST_KINDS,
  RALLY_STORY_MAX,
  RALLY_TITLE_MAX,
  createRally,
  rallyDraftProblem,
  type Rally,
  type RallyDraft,
} from '@/lib/rallies';
import { TYPE, figtree } from '@/theme/fonts';

type CreateRallySheetProps = {
  visible: boolean;
  playerId: string;
  athleteName: string;
  onClose: () => void;
  onCreated: (rally: Rally) => void;
};

const EMPTY: RallyDraft = { title: '', story: '', costKind: 'season', targetDollars: '', endsOn: '' };

/**
 * @purpose Start a Rally: name the cost, pick what it's for, set the goal, tell the story in a few lines.
 *   A guardian's Rally goes live at once; an athlete's waits for their parent / guardian to approve.
 * @sideEffects `create_rally` RPC.
 */
export function CreateRallySheet({ visible, playerId, athleteName, onClose, onCreated }: CreateRallySheetProps) {
  const frame = useSheetFrame();
  const { height: windowHeight } = useWindowDimensions();
  const [draft, setDraft] = useState<RallyDraft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(EMPTY);
      setError(null);
    }
  }, [visible]);

  const set = <K extends keyof RallyDraft>(key: K, value: RallyDraft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const problem = rallyDraftProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await createRally(playerId, draft);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onCreated(result.rally);
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={busy ? undefined : onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={frame.dock}>
          <View style={[styles.sheet, frame.card, { maxHeight: windowHeight * 0.85 }]}>
            <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={busy ? undefined : onClose} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              <Text style={styles.title}>Start a Rally for {athleteName}</Text>
              <Text style={styles.lede}>
                Name a real sports cost and tell your community why it matters. Gifts go to the family account for that cost.
              </Text>

              <Text style={styles.label}>What is it for?</Text>
              <View style={styles.kinds}>
                {RALLY_COST_KINDS.map((kind) => {
                  const selected = draft.costKind === kind.id;
                  return (
                    <Pressable
                      key={kind.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => set('costKind', kind.id)}
                      style={[styles.kind, selected && styles.kindOn]}
                    >
                      <Text style={[styles.kindText, selected && styles.kindTextOn]}>
                        {kind.emoji} {kind.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                accessibilityLabel="Rally name"
                maxLength={RALLY_TITLE_MAX}
                onChangeText={(value) => set('title', value)}
                placeholder="New cleats for the season"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={draft.title}
              />

              <Text style={styles.label}>Goal ($)</Text>
              <TextInput
                accessibilityLabel="Rally goal in dollars"
                keyboardType="decimal-pad"
                onChangeText={(value) => set('targetDollars', value)}
                placeholder="250"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={draft.targetDollars}
              />

              <Text style={styles.label}>The story (optional)</Text>
              <TextInput
                accessibilityLabel="Rally story"
                maxLength={RALLY_STORY_MAX}
                multiline
                onChangeText={(value) => set('story', value)}
                placeholder="What the money pays for, and what this season means to them."
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.story]}
                value={draft.story}
              />

              <Text style={styles.label}>End date (optional, YYYY-MM-DD)</Text>
              <TextInput
                accessibilityLabel="Rally end date"
                autoCapitalize="none"
                onChangeText={(value) => set('endsOn', value)}
                placeholder="2026-12-01"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={draft.endsOn}
              />

              <Text style={styles.note}>
                Keep it to real costs — fees, gear, travel, camps, college prep. Never ask for money for a play, a stat or a win.
                If the athlete starts the Rally, a parent or guardian approves it before fans can give.
              </Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => void submit()}
                style={[styles.primary, busy && styles.dim]}
              >
                <Text style={styles.primaryText}>{busy ? 'Starting…' : 'Start the Rally'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={styles.cancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,

  },
  body: {
    gap: 10,
    paddingBottom: 12,
  },
  title: {
    ...TYPE.title,
    ...figtree('800'),
    color: colors.text,
  },
  lede: { ...figtree('400'),
    ...TYPE.body,

    color: colors.textMuted,
  },
  label: {
    ...TYPE.button,
    ...figtree('800'),
    color: colors.text,
    marginTop: 4,
  },
  kinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kind: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  kindOn: {
    borderColor: colors.deepGreen,
    backgroundColor: colors.accentSoft,
  },
  kindText: {
    ...TYPE.body,
    ...figtree('700'),
    color: colors.textMuted,
  },
  kindTextOn: {
    color: colors.deepGreen,
  },
  input: { ...figtree('400'),
    minHeight: 46,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    ...TYPE.body,
    paddingHorizontal: 12,
  },
  story: {
    minHeight: 96,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  note: { ...figtree('400'),
    ...TYPE.caption,

    color: colors.textMuted,
  },
  error: {
    ...TYPE.body,
    ...figtree('700'),
    color: colors.danger,
  },
  primary: {
    alignItems: 'center',
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.deepGreen,
    paddingVertical: 14,
    marginTop: 4,
  },
  primaryText: {
    ...TYPE.body,
    ...figtree('800'),
    color: '#FFFFFF',
  },
  dim: {
    opacity: 0.5,
  },
  cancel: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    ...TYPE.body,
    ...figtree('700'),
    color: colors.deepGreen,
  },
});
