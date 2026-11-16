/** Filmer appreciation menu uses fan-sheet geometry; props stay nonfinancial and server-owned. */
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { SheetRise } from '@/components/UI/SheetRise';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { FilmerCard } from '@/components/Filmers/FilmerCard';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { useFilmerStats } from '@/hooks/useFilmerStats';
import { FILMER_AURA_RULES, giveFilmerProps } from '@/lib/filmers';
import { FOCAL } from '@/theme/motion';

type FilmerSheetProps = {
  visible: boolean;
  onClose: () => void;
  filmerName: string;
  /** `reels.uploaded_by` (a `profiles.id`). */
  filmerProfileId: string | null | undefined;
  reelId: string;
};

/**
 * @purpose Opened from "🎥 Filmed by …" on a clip: the filmer's card and a "Give Props" button.
 *   Props are once per fan per clip and give the filmer +1 Aura on the server. No money.
 *   Mount it only while open (it needs the soft wall provider).
 * @sideEffects `filmer_stats` on open; `give_filmer_props` on tap; guests get the sign-in soft wall.
 */
export function FilmerSheet({ visible, onClose, filmerName, filmerProfileId, reelId }: FilmerSheetProps) {
  const frame = useSheetFrame();
  const { user } = useAuth();
  const { requireAuth } = useSoftWall();
  const { stats, refresh } = useFilmerStats(visible ? filmerProfileId : null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSent(false);
    setMessage(null);
  }, [reelId]);

  const giveProps = async () => {
    if (!user?.id) {
      requireAuth({ kind: 'signin', resume: () => undefined });
      return;
    }
    if (busy || sent) return;
    setBusy(true);
    const result = await giveFilmerProps(reelId);
    setBusy(false);
    if (result.ok) {
      setSent(true);
      setMessage(`Props sent to ${filmerName}. Thanks for cheering on the people who film.`);
      void refresh();
    } else {
      setMessage(result.message);
    }
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable haptic="none" style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={frame.dock}>
        <SheetRise active={visible} style={[styles.sheet, frame.card]}>
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={onClose} />
          <Text style={styles.title}>🎥 Filmed by {filmerName}</Text>
          <Text style={styles.lede}>
            Fans who film help athletes get seen. Gifts always go to the athlete in the clip.
          </Text>
          <FilmerCard stats={stats} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || sent }}
            haptic="medium"
            onPress={giveProps}
            style={[styles.props, sent && styles.propsSent]}
          >
            <Text style={[styles.propsLabel, sent && styles.propsLabelSent]}>
              {sent ? 'Props sent 🎥' : busy ? 'Sending…' : 'Give Props 🎥'}
            </Text>
          </Pressable>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.rules}>
            <Text style={styles.rulesTitle}>How filmers earn Aura</Text>
            {FILMER_AURA_RULES.map((rule) => (
              <Text key={rule.label} style={styles.rule}>
                {rule.label} · +{rule.points}
              </Text>
            ))}
          </View>
        </SheetRise>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,20,22,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 20,
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  lede: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  props: {
    minHeight: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    backgroundColor: FOCAL.jadeInk,
  },
  propsSent: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: FOCAL.jadeInk,
  },
  propsLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  propsLabelSent: {
    color: FOCAL.jadeInk,
  },
  message: {
    color: colors.text,
    fontSize: 13,
    textAlign: 'center',
  },
  rules: {
    gap: 2,
    marginTop: 4,
  },
  rulesTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rule: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
