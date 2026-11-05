/** Fan menu uses shared Daylight chrome; the feature retains its identity, validation and data ownership.
 * QUIZ-05: after a first athlete claim has finished, an optional last step offers "Share a fun fact?" with Not now
 * from the first frame. The claim never waits for it; the step closes itself when the server says this account can't
 * share (no recorded age, not linked yet, or fun facts off). */
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { TeamSearchField } from '@/components/Profile/TeamSearchField';
import { FunFactShare } from '@/components/Profile/FunFactShare';
import { LegalAckToggle, LegalModal } from '@/components/Legal/LegalModal';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { FilterPills } from '@/components/UI/FilterPills';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { cardShadow, colors, MENU_METRICS, radii } from '@/constants/theme';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { useAuth } from '@/context/AuthContext';
import { useCelebration } from '@/context/CelebrationContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useSportConfigs } from '@/hooks/useSportConfigs';
import {
  ATHLETE_CLASS_YEARS,
  ATHLETE_SPORTS,
  classYearLabel,
  formatTeamBadge,
  formatTeamTitle,
  type SchoolTeam,
} from '@/data/teams';
import { activeSportNames } from '@/data/sports';
import { SPRING_CARD } from '@/theme/motion';
import { useLegalAck } from '@/hooks/useLegalAck';

const SHEET_OFF = 720;

type RoleSwitcherModalProps = {
  visible: boolean;
  onClose: () => void;
};

function fireMediumHaptic() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Simulator / web may not expose haptics.
  }
}

/**
 * @purpose Account Capability sheet: Fan vs Athlete cards, unified HS/college team search, identical roster onboarding, dual-role view toggle.
 * @param visible Opens the Reanimated bottom sheet.
 * @param onClose Dismiss after backdrop tap or a successful conversion.
 * @returns Modal bottom sheet over an `expo-blur` backdrop.
 * @sideEffects `search_schools_and_teams`; `add_user_role` + `profiles.school_id` / `athlete_division`; Medium `impactAsync`; Aura toast on unlock; legal ack required before claiming a roster (Varsity is a later team-code step).
 */
export function RoleSwitcherModal({ visible, onClose }: RoleSwitcherModalProps) {
  const frame = useSheetFrame();
  const { live } = useAppRuntime();
  const classYears =
    live.catalog.classYears.length > 0 ? live.catalog.classYears : [...ATHLETE_CLASS_YEARS];
  const { activeRole, isAthlete, profile, completeAthleteOnboarding, setActiveRole } = useAuth();
  const { configs } = useSportConfigs();
  const sportOptions = (activeSportNames(configs).length > 0 ? activeSportNames(configs) : [...ATHLETE_SPORTS]).map(
    (item) => ({ id: item, label: item }),
  );
  const { showToast } = useCelebration();
  const { accepted: legalAccepted, accept: acceptLegal } = useLegalAck();
  const [legalOpen, setLegalOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');
  const [team, setTeam] = useState<SchoolTeam | null>(null);
  const [sport, setSport] = useState<string | null>(null);
  const [jersey, setJersey] = useState('');
  const [position, setPosition] = useState('');
  const [classYear, setClassYear] = useState<string | null>(null);
  // Optional fun-fact step, shown only after a first claim has already saved.
  const [funStep, setFunStep] = useState(false);
  // The step sits at the top of the list, but Apply is at the bottom: bring it into view when it appears.
  const scrollRef = useRef<ScrollViewInstance>(null);
  useEffect(() => { if (funStep) scrollRef.current?.scrollTo?.({ y: 0, animated: false }); }, [funStep]);
  const translateY = useSharedValue(0);
  const dim = useSharedValue(0);
  const toggleLayouts = useRef<Partial<Record<'fan' | 'athlete', { x: number; width: number }>>>({});
  const togglePlaced = useRef(false);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);

  /** Athletes always keep Fan (`deriveRoles`); this is the dual-capability sheet. */
  const dual = isAthlete;
  const savedTeam = profile?.team ?? null;
  const needsRoster = !savedTeam;

  const resetForm = () => {
    setTeamQuery('');
    setTeam(null);
    setSport(null);
    setJersey('');
    setPosition('');
    setClassYear(null);
  };

  const moveToggle = (id: 'fan' | 'athlete', animate: boolean) => {
    const box = toggleLayouts.current[id];
    if (!box) return;
    if (!animate || !togglePlaced.current) {
      indicatorX.value = box.x;
      indicatorW.value = box.width;
      togglePlaced.current = true;
      return;
    }
    indicatorX.value = withSpring(box.x, SPRING_CARD);
    indicatorW.value = withSpring(box.width, SPRING_CARD);
  };

  useEffect(() => {
    if (!dual) return;
    moveToggle(activeRole, true);
    // Layout boxes live in a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole, dual]);

  useEffect(() => {
    if (!visible) return;
    setOpen(true);
    resetForm();
    setFunStep(false);
    if (Platform.OS === 'web') {
      translateY.value = 0;
      dim.value = 1;
      return;
    }
    translateY.value = SHEET_OFF;
    dim.value = 0;
    const frame = requestAnimationFrame(() => {
      translateY.value = withSpring(0, SPRING_CARD);
      dim.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    });
    return () => cancelAnimationFrame(frame);
  }, [dim, translateY, visible]);

  const finishClose = () => {
    setOpen(false);
    onClose();
  };

  const dismiss = () => {
    if (!open || applying) return;
    dim.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(SHEET_OFF, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  };

  const onSelectView = (next: 'fan' | 'athlete') => {
    if (!dual || next === activeRole) return;
    fireMediumHaptic();
    void setActiveRole(next);
  };

  const onApply = async () => {
    if (applying) return;
    if (!legalAccepted) {
      showToast('Agree to Terms of Service & NIL Compliance first.');
      return;
    }
    // Growth rule (owner, 2026-09-29): claiming must take seconds. Only team + sport are required;
    // number, position and class year can be added later from Profile.
    if (!team || !sport) {
      showToast('Pick your team and sport.');
      return;
    }
    fireMediumHaptic();
    setApplying(true);
    try {
      await completeAthleteOnboarding({
        team,
        sport,
        jersey: jersey.trim(),
        position: position.trim(),
        classYear: classYear ?? '',
      });
      showToast(isAthlete ? 'Roster saved 🏆' : 'School claimed 🏆 Get Varsity verified to unlock Player of the Week');
      if (isAthlete) dismiss();
      else setFunStep(true);
    } finally {
      setApplying(false);
    }
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  const body = (
    <View pointerEvents="box-none" style={[styles.root, Platform.OS === 'web' ? styles.webRoot : styles.nativeRoot]}>
      <Pressable haptic="none" style={StyleSheet.absoluteFill} onPress={dismiss}>
        <Animated.View style={[styles.dim, backdropStyle]}>
          <BlurView intensity={48} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Pressable>
      <View pointerEvents="box-none" style={frame.dock}>
      <Animated.View style={[styles.sheet, frame.card, sheetStyle]}>
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={dismiss} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>Account Capability</Text>
          <Text style={styles.title}>Roles on this account</Text>
          <Text style={styles.blurb}>
            Fan is the base. Claim a High School or NCAA roster so fans can find you — Varsity verification (team code)
            is a later glow, not a gate. Highlights stay public while you wait.
          </Text>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
          >
        {funStep ? <FunFactShare variant="signup" onSkip={dismiss} onHidden={dismiss} /> : null}

        <View style={[styles.card, styles.cardOn]} accessibilityRole="summary">
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Fan ⚡</Text>
            <View style={styles.pill}>
              <Text style={styles.pillLabel}>Active Base</Text>
            </View>
          </View>
          <Text style={styles.cardBody}>
            Discover highlights, give to athletes, vote in cheer polls, and level up your Aura Card.
          </Text>
        </View>

        <View style={[styles.card, isAthlete && styles.cardOn]} accessibilityRole="summary">
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Athlete 🏆</Text>
            {isAthlete ? (
              <View style={styles.pill}>
                <Text style={styles.pillLabel}>Unlocked</Text>
              </View>
            ) : (
              <View style={styles.pillMuted}>
                <Text style={styles.pillMutedLabel}>Locked</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardBody}>
            Claim a High School or NCAA roster, receive gifts, and host one-time Exclusive access for $
            {live.catalog.exclusiveDollars.toFixed(2)}. School claim is not Varsity — fans will
            see Not verified yet until a team code or coach/parent approval.
          </Text>
          {savedTeam ? (
            <View style={styles.teamChip} accessibilityRole="summary">
              <Text style={styles.teamChipTitle}>{formatTeamTitle(savedTeam)}</Text>
              <Text style={styles.teamChipBadge}>{formatTeamBadge(savedTeam)}</Text>
            </View>
          ) : null}
        </View>

        {needsRoster ? (
          <View style={styles.onboard} accessibilityRole="summary">
            <Text style={[styles.toggleLabel, styles.toggleLabelFlush]}>Athlete roster</Text>
            <Text style={styles.onboardHint}>Same steps for High School and college. Search any team in the catalog.</Text>
            <TeamSearchField
              query={teamQuery}
              onQueryChange={setTeamQuery}
              selected={team}
              onSelect={(next) => {
                setTeam(next);
                setTeamQuery(formatTeamTitle(next));
              }}
              onClear={() => {
                setTeam(null);
                setTeamQuery('');
              }}
            />
            {team ? (
              <>
                <Text style={styles.fieldLabel}>Sport</Text>
                <FilterPills
                  items={sportOptions}
                  value={sport}
                  onChange={(id) => setSport(id)}
                  accessibilityLabel="Sport"
                />
                <Text style={styles.fieldLabel}>Roster number (optional)</Text>
                <TextInput
                  value={jersey}
                  onChangeText={(value) => setJersey(value.replace(/[^\d]/g, '').slice(0, 3))}
                  keyboardType="number-pad"
                  placeholder="7"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Roster number"
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Position (optional)</Text>
                <TextInput
                  value={position}
                  onChangeText={setPosition}
                  autoCapitalize="characters"
                  placeholder="QB · Wing · Setter"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Position"
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Graduation class (optional)</Text>
                <FilterPills
                  items={classYears.map((item) => ({ id: item, label: classYearLabel(item) }))}
                  value={classYear}
                  onChange={(id) => setClassYear(id)}
                  accessibilityLabel="Graduation class year"
                />
              </>
            ) : null}
          </View>
        ) : null}

        {dual && !applying ? (
          <View style={styles.activeModeWrap}>
            <Text style={[styles.toggleLabel, styles.toggleLabelFlush]}>Active mode</Text>
            <View style={styles.switcher} accessibilityRole="tablist">
              <Animated.View pointerEvents="none" style={[styles.switchIndicator, indicatorStyle]} />
              {(['fan', 'athlete'] as const).map((id) => {
                const selected = activeRole === id;
                const label = id === 'fan' ? 'Fan View' : 'Athlete Management';
                return (
                  <View
                    key={id}
                    style={styles.switchHit}
                    onLayout={(event) => {
                      const { x, width } = event.nativeEvent.layout;
                      toggleLayouts.current[id] = { x, width };
                      if (selected) moveToggle(id, togglePlaced.current);
                    }}
                  >
                    <AnimatedButton
                      accessibilityLabel={id === 'fan' ? 'Fan View' : 'Athlete Management View'}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      haptic="none"
                      onPress={() => onSelectView(id)}
                      contentStyle={[styles.switchTab, selected && styles.switchTabOn]}
                    >
                      <Text style={[styles.switchCopy, selected && styles.switchCopyOn]}>{label}</Text>
                    </AnimatedButton>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {needsRoster ? (
          <>
            <LegalAckToggle
              checked={legalAccepted}
              disabled={legalAccepted}
              onCheckedChange={(next) => {
                if (next) void acceptLegal();
              }}
              onOpenTerms={() => setLegalOpen(true)}
            />
            <AnimatedButton
              accessibilityLabel={isAthlete ? 'Save athlete roster' : 'Claim athlete profile'}
              disabled={applying || !legalAccepted}
              haptic="none"
              onPress={() => void onApply()}
              contentStyle={[styles.applyBtn, (applying || !legalAccepted) && styles.busy]}
            >
              {applying ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.applyLabel}>
                  {isAthlete ? 'Save roster 🏆' : 'Claim athlete profile 🏆'}
                </Text>
              )}
            </AnimatedButton>
          </>
        ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
      </View>
    </View>
  );

  if (!open && !visible) return null;

  return (
    <>
      <Modal
        animationType="none"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={open}
        onRequestClose={dismiss}
      >
        {body}
      </Modal>
      <LegalModal visible={legalOpen} requireAck onClose={() => setLegalOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  webRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
  },
  nativeRoot: {
    flex: 1,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.border,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    maxHeight: '88%',
    ...Platform.select({
      ios: {
        shadowColor: '#0F1416',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: -8 },
      },
      android: { elevation: 16 },
      default: { boxShadow: '0px -8px 24px rgba(15, 20, 22, 0.45)' },
    }),
  },
  sheetScroll: {
    maxHeight: 520,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 6,
  },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  blurb: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  cardOn: {
    borderColor: colors.primary,
    ...cardShadow,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  teamChip: {
    gap: 4,
    marginTop: 4,
  },
  teamChipTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  teamChipBadge: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  onboard: {
    gap: 10,
  },
  onboardHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 48,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
  },
  pill: {
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  pillMuted: {
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillMutedLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  toggleLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  toggleLabelFlush: {
    marginBottom: 0,
  },
  activeModeWrap: {
    gap: 8,
  },
  switcher: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  switchIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    zIndex: 0,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  switchHit: {
    flex: 1,
    zIndex: 1,
  },
  switchTab: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  switchTabOn: {
    backgroundColor: 'transparent',
  },
  switchCopy: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  switchCopyOn: {
    color: colors.onAccent,
  },
  applyBtn: {
    minHeight: 52,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  applyLabel: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  busy: {
    opacity: 0.7,
  },
});
