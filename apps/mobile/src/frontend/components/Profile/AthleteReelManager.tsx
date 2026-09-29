import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSheetFrame } from '@/hooks/useSheetFrame';

import { TaggedReelGrid } from '@/components/Profile/TaggedReelGrid';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import {
  FLASH_UNLOCK_ACTION,
  FLASH_UNLOCK_TOAST,
  formatFlashUnlockRemaining,
  isClipVaultOnly,
  isFlashUnlockActive,
  VAULT_MOVE_TO_PUBLIC,
  VAULT_MOVE_TO_VAULT,
} from '@/data/exclusive';
import type { HighlightClip } from '@/data/highlights';
import type { Player } from '@/data/players';
import { setReelFlashUnlock } from '@/lib/crew';
import { toggleReelVaultStatus, type ReelHype } from '@/lib/reels';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';

type AthleteReelManagerProps = {
  clips: HighlightClip[];
  player?: Player | null;
  tipping?: boolean;
  onOpenAthlete?: (playerId: string) => void;
  onHypeChange?: (reelId: string, hype: ReelHype) => void;
  onBacked?: (nextCount: number) => void;
  /** Optimistic parent write after `toggle_reel_vault_status`. */
  onVaultChange?: (reelId: string, vaultOnly: boolean) => void;
  /** Optimistic parent write after `set_reel_flash_unlock`. */
  onFlashUnlock?: (reelId: string, until: string) => void;
  /** Opens this clip in the pager (Rally "Watch what it paid for"). */
  openClipId?: string | null;
};

/**
 * @purpose Athlete-management 3×3 grid: long-press a thumbnail to move it into Subscriber Vault, Flash Unlock it for 2 hours, or send it to the free public feed.
 * @param clips Tagged highlights on the athlete’s own Profile.
 * @param onVaultChange Parent updates `reels.is_vault_only` locally so the chip flips immediately.
 * @param onFlashUnlock Parent stores `reels.flash_unlock_until` so the feed countdown starts immediately.
 * @returns Tagged grid plus a vault-options sheet.
 * @sideEffects Medium `impactAsync`; `toggle_reel_vault_status` / `set_reel_flash_unlock` RPCs; Crew push queue; toast.
 */
export function AthleteReelManager({
  clips,
  player = null,
  tipping = false,
  onOpenAthlete,
  onHypeChange,
  onBacked,
  onVaultChange,
  onFlashUnlock,
  openClipId,
}: AthleteReelManagerProps) {
  const frame = useSheetFrame();
  const celebration = useOptionalCelebration();
  const { live } = useAppRuntime();
  const [menuClip, setMenuClip] = useState<HighlightClip | null>(null);
  const [toggling, setToggling] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const vaultOnly = isClipVaultOnly(menuClip);
  const flashLive = isFlashUnlockActive(menuClip?.flashUnlockUntil);
  const flashRemaining = formatFlashUnlockRemaining(menuClip?.flashUnlockUntil);
  const sheetBusy = toggling || flashing;

  const closeMenu = () => {
    if (!sheetBusy) setMenuClip(null);
  };

  const applyToggle = async () => {
    if (!menuClip || sheetBusy) return;
    const nextVault = !vaultOnly;
    setToggling(true);
    onVaultChange?.(menuClip.id, nextVault);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Simulator / web may not expose haptics.
    }
    try {
      const saved = await toggleReelVaultStatus(menuClip.id, vaultOnly);
      if (saved !== nextVault) onVaultChange?.(menuClip.id, saved);
      celebration?.showToast(saved ? VAULT_MOVE_TO_VAULT : VAULT_MOVE_TO_PUBLIC);
      setMenuClip(null);
    } finally {
      setToggling(false);
    }
  };

  const applyFlashUnlock = async () => {
    if (!menuClip || sheetBusy || !vaultOnly) return;
    setFlashing(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Simulator / web may not expose haptics.
    }
    try {
      const result = await setReelFlashUnlock(menuClip.id);
      onFlashUnlock?.(menuClip.id, result.flash_unlock_until);
      telemetry.track({
        event_type: 'flash_unlock',
        video_id: menuClip.id,
        payload: {
          athlete_id: menuClip.playerId ?? player?.id ?? null,
          notified_count: result.notified_count,
          flash_unlock_until: result.flash_unlock_until,
        },
      });
      celebration?.showToast(FLASH_UNLOCK_TOAST);
      setMenuClip(null);
    } catch (caught) {
      celebration?.showToast(caught instanceof Error ? caught.message : 'Could not start Flash Unlock.');
    } finally {
      setFlashing(false);
    }
  };

  return (
    <View>
      <Text style={styles.hint}>
        Long-press a clip to move it between the free feed and Subscriber Vault, or Flash Unlock a Vault clip for 2
        hours.
      </Text>
      <TaggedReelGrid
        clips={clips}
        player={player}
        tipping={tipping}
        showVaultBadge
        onLongPressClip={setMenuClip}
        onOpenAthlete={onOpenAthlete}
        onHypeChange={onHypeChange}
        onBacked={onBacked}
        openClipId={openClipId}
      />
      <Modal
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={Boolean(menuClip)}
        onRequestClose={closeMenu}
      >
        <View style={styles.root}>
          <Pressable haptic="none" disabled={sheetBusy} onPress={closeMenu} style={StyleSheet.absoluteFill}>
            <BlurView intensity={48} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
            <View style={styles.dim} />
          </Pressable>
          <View pointerEvents="box-none" style={frame.dock}>
          <View style={[styles.sheet, frame.card]}>
            <View style={styles.handle} />
            <Text style={styles.kicker}>Content placement</Text>
            <Text style={styles.title} numberOfLines={2}>
              {menuClip?.tag ?? 'Highlight'}
            </Text>
            <Text style={styles.body}>
              {vaultOnly
                ? 'This clip is in Subscriber Vault. Move it to the free public Highlights ⚡ feed anytime.'
                : `This clip is on the free public feed. Vault it so only $${live.catalog.exclusiveDollars.toFixed(2)}/mo subscribers can watch.`}
            </Text>
            {live.buttons.vault ? (
            <AnimatedButton
              accessibilityLabel={vaultOnly ? VAULT_MOVE_TO_PUBLIC : VAULT_MOVE_TO_VAULT}
              disabled={sheetBusy}
              haptic="none"
              onPress={() => {
                void applyToggle();
              }}
              contentStyle={[styles.toggleBtn, sheetBusy && styles.busy]}
            >
              <Text style={styles.toggleLabel}>
                {toggling ? 'Updating…' : vaultOnly ? VAULT_MOVE_TO_PUBLIC : VAULT_MOVE_TO_VAULT}
              </Text>
            </AnimatedButton>
            ) : null}
            {vaultOnly && live.buttons.flashUnlock ? (
              <AnimatedButton
                accessibilityLabel={FLASH_UNLOCK_ACTION}
                disabled={sheetBusy}
                haptic="none"
                onPress={() => {
                  void applyFlashUnlock();
                }}
                contentStyle={[styles.flashBtn, sheetBusy && styles.busy]}
              >
                <Text style={styles.flashLabel}>
                  {flashing
                    ? 'Notifying Crew…'
                    : flashLive && flashRemaining
                      ? `${FLASH_UNLOCK_ACTION} · ${flashRemaining} left`
                      : FLASH_UNLOCK_ACTION}
                </Text>
              </AnimatedButton>
            ) : null}
            <AnimatedButton
              accessibilityLabel="Cancel vault options"
              disabled={sheetBusy}
              haptic="light"
              onPress={closeMenu}
              contentStyle={styles.cancelBtn}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </AnimatedButton>
          </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 8,
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.videoScrimSoft,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  kicker: {
    color: FOCAL.jadeInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  toggleBtn: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  busy: {
    opacity: 0.55,
  },
  toggleLabel: {
    color: FOCAL.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  flashBtn: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0,230,118,0.16)',
    borderWidth: 1,
    borderColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  flashLabel: {
    color: FOCAL.jadeInk,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  cancelBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
