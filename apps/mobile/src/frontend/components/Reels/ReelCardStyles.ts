/**
 * Style sheet for `ReelCard` (split out of ReelCard.tsx for R4-03; behaviour unchanged).
 */

import { StyleSheet } from 'react-native';

import { colors, palette, radii } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';
import { OVERLAY_BOTTOM_INSET } from '@/components/Reels/reelCardModel';

export const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.night,
    overflow: 'hidden',
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
  videoFill: {
    ...StyleSheet.absoluteFill,
  },
  hitLayer: {
    ...StyleSheet.absoluteFill,
  },
  playbackFailure: {
    position: 'absolute', top: '35%', left: 24, right: 24, zIndex: 9,
    alignItems: 'center', gap: 12, padding: 20, borderRadius: radii.lg,
    backgroundColor: colors.videoScrimSoft,
  },
  playbackFailureText: { color: colors.onVideo, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  playbackRetry: { minWidth: 88, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 22, backgroundColor: palette.jadeInk },
  playbackRetryText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  lockBlur: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 8,
  },
  vaultPanel: {
    alignItems: 'center',
    gap: 14,
    maxWidth: 300,
  },
  vaultBadge: {
    backgroundColor: colors.videoScrimSoft,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,23,68,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  vaultBadgeLabel: {
    color: FOCAL.ember,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  unlockBtn: {
    backgroundColor: FOCAL.electricGold,
    borderRadius: radii.md,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minWidth: 220,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.55,
  },
  unlockLabel: {
    color: FOCAL.ink,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7,22,15,0.28)',
  },
  hypePop: {
    // Width/height/offset are set inline from `popSize` so the pop centres on the tap point.
    position: 'absolute',
    zIndex: 6,
  },
  muteBadge: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  muteChip: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.videoScrim,
    borderWidth: 1,
    borderColor: FOCAL.electricGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 4,
    zIndex: 3,
  },
  actionsLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: OVERLAY_BOTTOM_INSET,
    zIndex: 3,
  },
  focalLeft: {
    flex: 1,
    gap: 6,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.videoScrim,
    borderWidth: 1,
    borderColor: 'rgba(243,251,247,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  flashChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,230,118,0.18)',
    borderWidth: 1,
    borderColor: FOCAL.neonJade,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
    shadowColor: FOCAL.neonJade,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 4,
  },
  flashChipLabel: {
    color: FOCAL.neonJade,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  categoryBadgeServe: {
    borderColor: FOCAL.electricGold,
    backgroundColor: 'rgba(255,215,0,0.18)',
    shadowColor: FOCAL.electricGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 4,
  },
  categoryBadgeLabel: {
    color: colors.onVideo,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  categoryBadgeLabelServe: {
    color: FOCAL.electricGold,
  },
  loopFlash: {
    marginTop: 6,
    color: FOCAL.electricGold,
    fontSize: 12,
    fontWeight: '800',
  },
});
