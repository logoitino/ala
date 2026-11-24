/** Shared caption draft stays mounted on an unconfirmed save and leaves the post unchanged until a receipt arrives. */
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { TYPE, figtree } from '@/theme/fonts';

type Props = {
  initialCaption: string;
  maxLength: number;
  note?: string;
  onClose: () => void;
  onSave: (caption: string) => Promise<void>;
};

/** @purpose Edit one currently authorized post; callers key the editor to the post and account lifetime. */
export function PostDescriptionEditor({ initialCaption, maxLength, note, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(initialCaption);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const caption = draft.trim();
  const count = Array.from(caption).length;
  const valid = count > 0 && count <= maxLength && caption !== initialCaption;
  const close = () => { if (!locked.current) onClose(); };
  const save = async () => {
    if (locked.current || !alive.current || !valid) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave(caption);
      if (alive.current) onClose();
    } catch (caught) {
      if (alive.current) setError(caught instanceof Error ? caught.message : 'Could not confirm the save. Your draft is still here.');
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return (
    <Modal visible animationType="none" presentationStyle="fullScreen" onRequestClose={close}>
      <SafeAreaView accessibilityViewIsModal style={styles.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Edit description</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close description editor" onPress={close}
              style={styles.action} disabled={busy}>
              <Text style={styles.link}>Close</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {note ? <Text style={styles.note}>{note}</Text> : null}
            <TextInput accessibilityLabel="Post description" value={draft} editable={!busy}
              onChangeText={value => { if (!locked.current) setDraft(value); }} multiline
              autoCapitalize="sentences" textAlignVertical="top" style={styles.input} />
            <Text style={[styles.counter, count > maxLength && styles.error]}>{count}/{maxLength} characters</Text>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Save description" disabled={!valid || busy}
              accessibilityState={{ disabled: !valid || busy, busy }} onPress={() => void save()}
              style={[styles.action, styles.save, (!valid || busy) && styles.disabled]}>
              <Text style={styles.saveText}>{busy ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  keyboard: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  title: { ...TYPE.section, ...figtree('700'), color: colors.text, flexShrink: 1 },
  content: { gap: 8, padding: 12 },
  note: { ...TYPE.body, ...figtree('400'), color: colors.textMuted },
  counter: { ...TYPE.caption, ...figtree('400'), color: colors.textMuted },
  input: { minHeight: 96, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 10,
    ...TYPE.body, ...figtree('400'), color: colors.text },
  action: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
  link: { ...TYPE.button, ...figtree('700'), color: colors.primary },
  save: { backgroundColor: colors.primary, borderRadius: radii.md },
  saveText: { ...TYPE.button, ...figtree('700'), color: colors.onAccent },
  disabled: { opacity: 0.55 },
  error: { ...TYPE.body, ...figtree('400'), color: colors.danger },
});
