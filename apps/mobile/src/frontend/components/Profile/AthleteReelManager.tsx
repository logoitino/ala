/** UX-13 readable shared type preserves every action and required notice.
 * Confirmed account-bound Vault updates in the athlete's own clip manager: long-press a tile to move a video between the free feed and one-time Exclusive access, or
 * Flash Unlock it. Fan menu uses shared Daylight chrome. Photo stories are public only (database constraint,
 * PHOTO_STORIES_DESIGN.md decision 1), so they never open the Vault sheet.
 * UPLOAD-STUDIO-01: the same long-press also offers Edit description for posts this account uploaded, using the
 * POST-EDIT-01 ownership rule and save call the playback menu uses, so owners can fix a caption from their profile
 * without opening the player. A photo story opens the sheet only for that edit.
 */
import { offlineQueue } from '@/services/OfflineQueue';
import type { OfflineActor } from '@/lib/offlineActor';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { useRef, useState } from 'react';
import { PostDescriptionEditor } from '@/components/Reels/PostDescriptionEditor';
import { useOptionalAuth } from '@/context/AuthContext';
import { saveReelDescription } from '@/lib/postCaptions';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useSheetFrame } from '@/hooks/useSheetFrame';

import { TaggedReelGrid } from '@/components/Profile/TaggedReelGrid';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS } from '@/constants/theme';
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
import { isPhotoStory, type HighlightClip } from '@/data/highlights';
import type { Player } from '@/data/players';
import { setReelFlashUnlock } from '@/lib/crew';
import { isReelUuid, toggleReelVaultStatus, type ReelHype } from '@/lib/reels';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

export const PHOTO_STORY_PUBLIC_TOAST = 'Photo stories stay on the free public feed.';

type AthleteReelManagerProps = {
  clips: HighlightClip[];
  player?: Player | null;
  tipping?: boolean;
  onOpenAthlete?: (playerId: string) => void;
  onHypeChange?: (reelId: string, hype: ReelHype) => void;
  onBacked?: (nextCount: number) => void;
  /** Confirmed parent write after `toggle_reel_vault_status`. */
  onVaultChange?: (reelId: string, vaultOnly: boolean) => void;
  /** Optimistic parent write after `set_reel_flash_unlock`. */
  onFlashUnlock?: (reelId: string, until: string) => void;
  /** Opens this clip in the pager (Rally "Watch what it paid for"). */
  openClipId?: string | null;
};

/**
 * @purpose Athlete-management 3×3 grid: long-press a thumbnail to move it into one-time Exclusive access, Flash Unlock it for 2 hours, or send it to the free public feed.
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
  const { height: windowHeight } = useWindowDimensions();
  const celebration = useOptionalCelebration();
  const { live } = useAppRuntime();
  const menuActor = useRef<OfflineActor | null>(null);
  const [menuClip, setMenuClip] = useState<HighlightClip | null>(null);
  const [toggling, setToggling] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const vaultOnly = isClipVaultOnly(menuClip);
  const flashLive = isFlashUnlockActive(menuClip?.flashUnlockUntil);
  const flashRemaining = formatFlashUnlockRemaining(menuClip?.flashUnlockUntil);
  const sheetBusy = toggling || flashing;
  const account = useOptionalAuth();
  const [editing, setEditing] = useState<{
    reelId: string; previous: string; userId: string; profileId: string; isSessionCurrent: () => boolean;
  } | null>(null);
  // Same rule as the playback menu: only the uploader's current, unblocked account edits a live post.
  const canEdit = (clip: HighlightClip | null) => {
    const profile = account?.profile;
    const userId = account?.user?.id;
    return Boolean(clip && userId && profile?.id && profile.id === clip.uploadedBy && profile.user_id === userId
      && !profile.age_blocked_at && account?.isSessionCurrent?.() && typeof clip.editCaptionSource === 'string' && isReelUuid(clip.id));
  };
  const menuStory = menuClip ? isPhotoStory(menuClip) : false;
  const menuEditable = canEdit(menuClip);

  const openMenu = (clip: HighlightClip) => {
    // Vault / Flash Unlock would be rejected by the database for a photo story; say so instead of offering it.
    if (isPhotoStory(clip) && !canEdit(clip)) {
      celebration?.showToast(PHOTO_STORY_PUBLIC_TOAST);
      return;
    }
    if (menuActor.current && !menuActor.current.isCurrent()) { setToggling(false); setFlashing(false); }
    menuActor.current = offlineQueue.captureActor();
    setMenuClip(clip);
  };

  const closeMenu = () => {
    if (!sheetBusy) setMenuClip(null);
  };

  const startEdit = () => {
    const clip = menuClip;
    const userId = account?.user?.id;
    const profileId = account?.profile?.id;
    const isSessionCurrent = account?.isSessionCurrent;
    if (!clip || sheetBusy || !canEdit(clip) || !userId || !profileId || !isSessionCurrent) return;
    setMenuClip(null);
    setEditing({ reelId: clip.id, previous: clip.editCaptionSource!, userId, profileId, isSessionCurrent });
  };

  const applyToggle = async () => {
    if (!menuClip || sheetBusy || isPhotoStory(menuClip)) return;
    const actor = menuActor.current;
    const current = () => menuActor.current === actor && (!actor || actor.isCurrent());
    if (!current()) return;
    setToggling(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Simulator / web may not expose haptics.
    }
    try {
      const saved = await toggleReelVaultStatus(menuClip.id, vaultOnly, actor ?? undefined);
      if (!current()) return;
      onVaultChange?.(menuClip.id, saved);
      celebration?.showToast(saved ? VAULT_MOVE_TO_VAULT : VAULT_MOVE_TO_PUBLIC);
      setMenuClip(null);
    } catch (caught) {
      // toggleReelVaultStatus now throws instead of reporting a flip that did not save.
      if (current()) celebration?.showToast(caught instanceof Error && caught.message ? caught.message : 'Could not change Vault status.');
    } finally {
      if (current()) setToggling(false);
    }
  };

  const applyFlashUnlock = async () => {
    if (!menuClip || sheetBusy || !vaultOnly) return;
    const actor = menuActor.current;
    const current = () => menuActor.current === actor && (!actor || actor.isCurrent());
    if (!current()) return;
    setFlashing(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Simulator / web may not expose haptics.
    }
    try {
      const result = await setReelFlashUnlock(menuClip.id, actor ?? undefined);
      if (!current()) return;
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
      if (current()) celebration?.showToast(caught instanceof Error ? caught.message : 'Could not start Flash Unlock.');
    } finally {
      if (current()) setFlashing(false);
    }
  };

  return (
    <View>
      <Text style={styles.hint}>
        Long-press a clip to edit your description, move it between the free feed and one-time Exclusive access, or Flash
        Unlock a Vault clip for 2 hours. Photo stories always stay on the free feed.
      </Text>
      <TaggedReelGrid
        clips={clips}
        player={player}
        tipping={tipping}
        showVaultBadge
        onLongPressClip={openMenu}
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
        visible={Boolean(menuClip) && (menuActor.current?.isCurrent() ?? true)}
        onRequestClose={closeMenu}
      >
        <View style={styles.root}>
          <Pressable haptic="none" disabled={sheetBusy} onPress={closeMenu} style={StyleSheet.absoluteFill}>
            <BlurView intensity={48} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
            <View style={styles.dim} />
          </Pressable>
          <View pointerEvents="box-none" style={frame.dock}>
          <View style={[styles.sheet, frame.card, { maxHeight: windowHeight * 0.85 }]}>
          <MenuBackdrop accent="jade" />
            <SheetHandle onDismiss={sheetBusy ? undefined : closeMenu} />
            <Text style={styles.kicker}>{menuStory ? 'Your post' : 'Content placement'}</Text>
            <Text style={styles.title} numberOfLines={2}>
              {menuClip?.tag ?? 'Highlight'}
            </Text>
            {menuEditable ? (
              <AnimatedButton accessibilityLabel="Edit description" disabled={sheetBusy} haptic="selection"
                onPress={startEdit} contentStyle={[styles.editBtn, sheetBusy && styles.busy]}>
                <Ionicons name="create-outline" size={18} color={FOCAL.jadeInk} />
                <Text style={styles.editLabel}>Edit description</Text>
              </AnimatedButton>
            ) : null}
            <Text style={styles.body}>
              {menuStory
                ? PHOTO_STORY_PUBLIC_TOAST
                : vaultOnly
                ? 'This clip needs one-time Exclusive access. Move it to the free public Highlights ⚡ feed anytime.'
                : `This clip is on the free public feed. Vault it so only fans with one-time Exclusive access ($${live.catalog.exclusiveDollars.toFixed(2)}) can watch.`}
            </Text>
            {live.buttons.vault && !menuStory ? (
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
            {vaultOnly && !menuStory && live.buttons.flashUnlock ? (
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
      {editing ? (
        <PostDescriptionEditor key={editing.reelId} initialCaption={editing.previous} maxLength={120}
          onClose={() => setEditing(null)}
          onSave={async (value) => {
            const scope = editing;
            // A save that lands after sign-out or account switch is reported as unconfirmed, never applied.
            const isCurrent = () => scope.isSessionCurrent() && account?.profile?.id === scope.profileId;
            await saveReelDescription({ userId: scope.userId, profileId: scope.profileId, isCurrent }, scope.reelId, scope.previous, value);
            celebration?.showToast('Description updated ⚡');
          }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  editBtn: {
    minHeight: MENU_METRICS.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: FOCAL.jadeInk,
    backgroundColor: FOCAL.mistJade,
  },
  editLabel: {
    color: FOCAL.jadeInk,
    ...TYPE.button,
    ...figtree('800'),
  },
  hint: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('600'),

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
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    ...TYPE.title,
    ...figtree('800'),
  },
  body: {
    color: colors.textMuted,
    ...TYPE.body,

    ...figtree('600'),
  },
  toggleBtn: {
    minHeight: 52,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  busy: { minHeight: 44,
    opacity: 0.55,
  },
  toggleLabel: {
    color: FOCAL.ink,
    ...TYPE.body,
    ...figtree('800'),
    textAlign: 'center',
  },
  flashBtn: {
    minHeight: 52,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: 'rgba(0,230,118,0.16)',
    borderWidth: 1,
    borderColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  flashLabel: {
    color: FOCAL.jadeInk,
    ...TYPE.body,
    ...figtree('800'),
    textAlign: 'center',
  },
  cancelBtn: {
    minHeight: 48,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.text,
    ...TYPE.body,
    ...figtree('800'),
  },
});
