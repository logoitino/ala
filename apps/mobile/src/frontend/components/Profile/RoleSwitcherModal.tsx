/** UX-17 offers bounded existing-roster choices as pending school-review requests, without copying or verifying identity.
 * Choice/read/save lifetimes expire with school, account, name or sheet changes; failed claims stay retryable.
 * An issued save keeps its owner slot until settlement; replacing the visible draft does not cancel the write.
 * UX-13 readable shared type preserves every action and required notice. Fan menu uses shared Daylight chrome.
 * QUIZ-05: after a first athlete claim has finished, an optional last step offers "Share a fun fact?" with Not now
 * from the first frame. The claim never waits for it; the step closes itself when the server says this account can't
 * share (no recorded age, not linked yet, or fun facts off). */
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance, useWindowDimensions } from 'react-native';
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
import {
  SHEET_BACKDROP_IN_MS,
  SHEET_BACKDROP_OUT_MS,
  SHEET_DISMISS_MS,
  SPRING_CARD,
  SPRING_SHEET,
} from '@/theme/motion';
import { useLegalAck } from '@/hooks/useLegalAck';
import { TYPE, figtree } from '@/theme/fonts';
import { offlineQueue } from '@/services/OfflineQueue';
import { createOfflineActorClient } from '@/lib/offlineActor';
import { listDirectoryRoster, type DirectoryPlayer } from '@/lib/schoolDirectory';

const SHEET_OFF = 720;

type RoleSwitcherModalProps = {
  visible: boolean;
  onClose: () => void;
};

type AccountFrame = { ownerId: string | null; visible: boolean; guard?: () => boolean };
type ChoiceFrame = { account: AccountFrame; schoolId: string | null; schoolName: string | null; fullName: string | null; revision: number };

/** Optional public roster paging uses the originating account's client; no profile/guardian lookup or field copying. */
function ExistingRosterChoice({ school, frame, isCurrent, selected, onChoose, disabled }: {
  school: SchoolTeam; frame: AccountFrame; isCurrent: () => boolean; selected: DirectoryPlayer | null;
  onChoose: (player: DirectoryPlayer | null) => void; disabled: boolean;
}) {
  const mounted = useRef(true);
  const generation = useRef(0);
  const flight = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const [query, setQuery] = useState('');
  const queryRef = useRef(query);
  queryRef.current = query;
  const [rows, setRows] = useState<DirectoryPlayer[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const offsetRef = useRef(nextOffset);
  offsetRef.current = nextOffset;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; }; }, []);
  const liveCurrent = useRef(isCurrent);
  liveCurrent.current = isCurrent;
  const load = useCallback(async (reset: boolean) => {
    if (!mounted.current || !expandedRef.current || disabledRef.current || !liveCurrent.current() || queryRef.current !== query || flight.current !== null) return;
    const offset = reset ? 0 : offsetRef.current;
    if (offset === null) return;
    const run = ++generation.current;
    flight.current = run;
    const actor = frame.ownerId ? offlineQueue.captureActor(frame.ownerId) : null;
    const current = () => mounted.current && expandedRef.current && liveCurrent.current() && generation.current === run && queryRef.current === query && (actor?.isCurrent() ?? true);
    setLoading(true); setError(false);
    if (reset) { setRows([]); setNextOffset(null); }
    try {
      if (!actor) throw new Error('Directory owner is unavailable');
      const client = await createOfflineActorClient(actor);
      if (!current()) return;
      const page = await listDirectoryRoster({ schoolId: school.id, schoolName: school.name, search: query, offset, limit: 20 }, client);
      if (!current()) return;
      setRows((previous) => reset ? page.items : [...new Map([...previous, ...page.items].map((row) => [row.id, row])).values()]);
      setNextOffset(page.nextOffset);
    } catch {
      if (current()) setError(true);
    } finally {
      if (flight.current === run) flight.current = null;
      if (current()) setLoading(false);
    }
  }, [frame, query, school.id, school.name]);
  useEffect(() => { if (expanded) void load(true); }, [expanded, load]);
  const renderedGeneration = generation.current;
  const canChoose = () => mounted.current && expandedRef.current && !disabledRef.current && liveCurrent.current()
    && queryRef.current === query && generation.current === renderedGeneration;
  return <View style={styles.rosterChoice}>
    <Pressable accessibilityLabel="Choose existing athlete (optional)" accessibilityRole="button" accessibilityState={{ expanded, disabled }} disabled={disabled} haptic="none"
      onPress={() => { if (!mounted.current || disabledRef.current || !liveCurrent.current()) return; generation.current += 1; flight.current = null; setLoading(false); expandedRef.current = !expandedRef.current; setExpanded(expandedRef.current); }} style={styles.rosterAction}>
      <Text style={styles.rosterActionText}>{selected ? `Selected: ${selected.name}` : 'Choose existing athlete (optional)'}</Text>
    </Pressable>
    <Text style={styles.rosterHint}>A choice requests school review; it does not link or verify you. No new choice keeps any existing claim.</Text>
    {expanded ? <>
      <TextInput accessibilityLabel="Search existing athletes" value={query} maxLength={100} editable={!disabled} placeholder="Search roster names" placeholderTextColor={colors.textMuted} style={styles.input}
        onChangeText={(value) => { if (!mounted.current || !expandedRef.current || disabledRef.current || !liveCurrent.current()) return; generation.current += 1; flight.current = null; queryRef.current = value; rowsRef.current = []; setQuery(value); setRows([]); setNextOffset(null); setError(false); setLoading(false); }} />
      <AnimatedButton accessibilityLabel="No new roster choice" accessibilityRole="radio" accessibilityState={{ selected: !selected }} disabled={disabled} haptic="none" onPress={() => { if (canChoose()) onChoose(null); }} contentStyle={styles.rosterAction}>
        <Text style={styles.rosterActionText}>No new roster choice (optional)</Text>
      </AnimatedButton>
      {loading ? <Text style={styles.rosterHint}>Loading existing athletes…</Text> : null}
      {rows.map((row) => <AnimatedButton key={row.id} accessibilityLabel={`Choose ${row.name}`} accessibilityRole="radio" accessibilityState={{ selected: selected?.id === row.id }} disabled={disabled} haptic="none" onPress={() => { const currentRow = rowsRef.current.find((item) => item.id === row.id); if (canChoose() && currentRow?.schoolName === school.name) onChoose(currentRow); }} contentStyle={[styles.rosterAction, selected?.id === row.id && styles.rosterSelected]}>
        <Text style={styles.rosterActionText}>{row.name}</Text>
        <Text style={styles.rosterHint}>{[row.team?.trim() || 'No team label recorded', row.jerseyNumber === null ? null : `#${row.jerseyNumber}`, row.position].filter(Boolean).join(' · ')}</Text>
      </AnimatedButton>)}
      {error ? <>
        <Text accessibilityLiveRegion="polite" style={styles.saveError}>Existing roster is unavailable. Please retry.</Text>
        <AnimatedButton accessibilityLabel="Retry existing roster" disabled={disabled || loading} haptic="none" onPress={() => void load(rows.length === 0)} contentStyle={styles.rosterAction}><Text style={styles.rosterActionText}>Retry</Text></AnimatedButton>
      </> : !loading && rows.length === 0 ? <Text style={styles.rosterHint}>No matching records on this school roster. You can continue without a new choice.</Text> : null}
      {!error && nextOffset !== null ? <AnimatedButton accessibilityLabel="Load more existing athletes" disabled={disabled || loading} haptic="none" onPress={() => void load(false)} contentStyle={styles.rosterAction}><Text style={styles.rosterActionText}>Load more existing athletes</Text></AnimatedButton> : null}
      {rows.length ? <Text style={styles.rosterHint}>Showing {rows.length} loaded records{nextOffset !== null ? '; more may be available' : ''}.</Text> : null}
    </> : null}
  </View>;
}

function fireMediumHaptic() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Simulator / web may not expose haptics.
  }
}

/**
 * @purpose Account Capability sheet: Fan/Athlete cards, existing school search plus optional bounded roster choice, and dual-role view toggle.
 * @param visible Opens the Reanimated bottom sheet.
 * @param onClose Dismiss after backdrop tap or a successful conversion.
 * @returns Modal bottom sheet over an `expo-blur` backdrop.
 * @sideEffects Existing school search and minimal public roster pages; `add_user_role`, profile fields and a pending `claim_athlete` request; Medium `impactAsync`; Aura toast; legal ack required before claiming (Varsity is later).
 */
export function RoleSwitcherModal({ visible, onClose }: RoleSwitcherModalProps) {
  const frame = useSheetFrame();
  const { height: windowHeight } = useWindowDimensions();
  const { live } = useAppRuntime();
  const classYears =
    live.catalog.classYears.length > 0 ? live.catalog.classYears : [...ATHLETE_CLASS_YEARS];
  const { activeRole, isAthlete, profile, user, isSessionCurrent, completeAthleteOnboarding, setActiveRole } = useAuth();
  // Preserve the initiating account and modal frame through awaits and delayed close animations.
  const mounted = useRef(true);
  const ownerId = user?.id ?? profile?.id ?? null;
  const authFrame = useRef({ ownerId, visible, guard: isSessionCurrent });
  if (authFrame.current.ownerId !== ownerId || authFrame.current.visible !== visible || authFrame.current.guard !== isSessionCurrent) {
    authFrame.current = { ownerId, visible, guard: isSessionCurrent };
  }
  const [storedSaveError, setStoredSaveError] = useState<{ frame: ChoiceFrame; message: string } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setStoredSaveError(null); }, [ownerId, visible, isSessionCurrent]);
  const { configs } = useSportConfigs();
  const sportOptions = (activeSportNames(configs).length > 0 ? activeSportNames(configs) : [...ATHLETE_SPORTS]).map(
    (item) => ({ id: item, label: item }),
  );
  const { showToast } = useCelebration();
  const { accepted: legalAccepted, accept: acceptLegal } = useLegalAck();
  const [legalOpen, setLegalOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [pendingOwners, setPendingOwners] = useState<Set<string | null>>(() => new Set());
  const [teamQuery, setTeamQuery] = useState('');
  const [team, setTeam] = useState<SchoolTeam | null>(null);
  const [sport, setSport] = useState<string | null>(null);
  const [jersey, setJersey] = useState('');
  const [position, setPosition] = useState('');
  const [classYear, setClassYear] = useState<string | null>(null);
  const choiceFrame = useRef<ChoiceFrame>({ account: authFrame.current, schoolId: null, schoolName: null, fullName: profile?.full_name ?? null, revision: 0 });
  if (choiceFrame.current.account !== authFrame.current || choiceFrame.current.schoolId !== (team?.id ?? null)
    || choiceFrame.current.schoolName !== (team?.name ?? null) || choiceFrame.current.fullName !== (profile?.full_name ?? null)) {
    choiceFrame.current = { account: authFrame.current, schoolId: team?.id ?? null, schoolName: team?.name ?? null, fullName: profile?.full_name ?? null, revision: choiceFrame.current.revision + 1 };
  }
  const [storedChoice, setStoredChoice] = useState<{ frame: ChoiceFrame; player: DirectoryPlayer | null } | null>(null);
  const selectedPlayer = storedChoice?.frame === choiceFrame.current ? storedChoice.player : null;
  const saveError = storedSaveError?.frame === choiceFrame.current ? storedSaveError.message : null;
  const saveFlights = useRef(new Map<string | null, ChoiceFrame>());
  const applying = pendingOwners.has(ownerId);
  const currentChoiceFrame = choiceFrame.current;
  const isChoiceCurrent = () => mounted.current && currentChoiceFrame === choiceFrame.current
    && currentChoiceFrame.account === authFrame.current && currentChoiceFrame.account.visible && (currentChoiceFrame.account.guard?.() ?? true);
  const choosePlayer = (player: DirectoryPlayer | null) => {
    if (isChoiceCurrent() && !saveFlights.current.has(ownerId)) setStoredChoice({ frame: currentChoiceFrame, player });
  };
  // A retained button must not adopt today's frame while sending a previous rendering's fields/choice.
  const renderedDraft = { team, sport, jersey, position, classYear, selectedPlayer };
  const currentDraft = useRef(renderedDraft);
  currentDraft.current = renderedDraft;
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
  // A saved school is not proof that the pending claim succeeded. Keep this attempt's retry reachable.
  const hasNewSchoolDraft = team && savedTeam && (team.id !== savedTeam.id || team.name !== savedTeam.name);
  const needsRoster = !savedTeam || Boolean(saveError) || applying || Boolean(hasNewSchoolDraft);

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
      translateY.value = withSpring(0, SPRING_SHEET);
      dim.value = withTiming(1, {
        duration: SHEET_BACKDROP_IN_MS,
        easing: Easing.out(Easing.cubic),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [dim, translateY, visible]);

  const finishClose = () => {
    setOpen(false);
    onClose();
  };

  const dismiss = (requestGuard?: unknown) => {
    if (!open || (saveFlights.current.has(ownerId) && typeof requestGuard !== 'function')) return;
    const closingFrame = authFrame.current;
    const closingChoiceFrame = choiceFrame.current;
    const finishRequest = () => {
      if (!mounted.current || closingFrame !== authFrame.current || closingChoiceFrame !== choiceFrame.current || !(closingFrame.guard?.() ?? true)) return;
      if (typeof requestGuard === 'function' && !requestGuard()) return;
      finishClose();
    };
    dim.value = withTiming(0, { duration: SHEET_BACKDROP_OUT_MS });
    translateY.value = withTiming(
      SHEET_OFF,
      { duration: SHEET_DISMISS_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishRequest)();
      },
    );
  };

  const onSelectView = (next: 'fan' | 'athlete') => {
    if (!dual || next === activeRole) return;
    fireMediumHaptic();
    void setActiveRole(next);
  };

  const onApply = async () => {
    if (!isChoiceCurrent() || currentDraft.current !== renderedDraft || saveFlights.current.has(ownerId)) return;
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
    const requestFrame = currentChoiceFrame.account;
    const requestChoiceFrame = currentChoiceFrame;
    const isCurrent = () => mounted.current && requestFrame === authFrame.current && requestChoiceFrame === choiceFrame.current && requestFrame.visible && (requestFrame.guard?.() ?? true);
    if (!isCurrent()) return;
    saveFlights.current.set(ownerId, requestChoiceFrame);
    fireMediumHaptic();
    setStoredSaveError(null);
    setPendingOwners((previous) => new Set(previous).add(ownerId));
    try {
      await completeAthleteOnboarding({
        team,
        sport,
        jersey: jersey.trim(),
        position: position.trim(),
        classYear: classYear ?? '',
      }, selectedPlayer?.id ?? null);
      if (!isCurrent()) return;
      showToast(isAthlete ? 'Roster saved 🏆' : 'School claimed 🏆 Get Varsity verified to unlock Player of the Week');
      if (isAthlete) dismiss(isCurrent);
      else setFunStep(true);
    } catch (error) {
      if (isCurrent()) setStoredSaveError({ frame: requestChoiceFrame, message: error instanceof Error && error.message.startsWith('Athlete claim is unavailable.')
        ? 'Athlete claim is unavailable. Your profile fields may be saved; retry the claim.'
        : "Couldn't save your roster. Please try again." });
    } finally {
      if (saveFlights.current.get(requestFrame.ownerId) === requestChoiceFrame) {
        saveFlights.current.delete(requestFrame.ownerId);
        if (mounted.current) setPendingOwners((previous) => { const next = new Set(previous); next.delete(requestFrame.ownerId); return next; });
      }
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
      <Animated.View style={[styles.sheet, frame.card, { maxHeight: windowHeight * 0.85 }, sheetStyle]}>
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={dismiss} />
        <KeyboardAvoidingView style={{ flexShrink: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
                <ExistingRosterChoice key={choiceFrame.current.revision} school={team} frame={authFrame.current} selected={selectedPlayer} disabled={applying}
                  isCurrent={isChoiceCurrent} onChoose={choosePlayer} />
                <Text style={styles.fieldLabel}>Sport</Text>
                <FilterPills
                  items={sportOptions}
                  value={sport}
                  onChange={(id) => { if (!saveFlights.current.has(ownerId)) setSport(id); }}
                  accessibilityLabel="Sport"
                />
                <Text style={styles.fieldLabel}>Roster number (optional)</Text>
                <TextInput
                  value={jersey}
                  editable={!applying}
                  onChangeText={(value) => { if (!saveFlights.current.has(ownerId)) setJersey(value.replace(/[^\d]/g, '').slice(0, 3)); }}
                  keyboardType="number-pad"
                  placeholder="7"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Roster number"
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Position (optional)</Text>
                <TextInput
                  value={position}
                  editable={!applying}
                  onChangeText={(value) => { if (!saveFlights.current.has(ownerId)) setPosition(value); }}
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
                  onChange={(id) => { if (!saveFlights.current.has(ownerId)) setClassYear(id); }}
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
            {applying && saveFlights.current.get(ownerId) !== choiceFrame.current ? <Text accessibilityLiveRegion="polite" style={styles.saveError}>An earlier roster save is finishing. Save this school after it settles.</Text> : null}
            {saveError ? <Text accessibilityLiveRegion="polite" style={styles.saveError}>{saveError}</Text> : null}
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
  rosterChoice: { gap: 8 },
  rosterAction: { minHeight: 44, borderRadius: MENU_METRICS.controlRadius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  rosterActionText: { ...TYPE.body, ...figtree('700'), color: colors.text },
  rosterHint: { ...TYPE.body, ...figtree('400'), color: colors.textMuted },
  rosterSelected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  saveError: { ...figtree('400'), color: colors.text, ...TYPE.body,  },
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
  blurb: { ...figtree('400'),
    color: colors.textMuted,
    ...TYPE.body,

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
    ...TYPE.body,
    ...figtree('800'),
  },
  cardBody: { ...figtree('400'),
    color: colors.textMuted,
    ...TYPE.body,

  },
  teamChip: {
    gap: 4,
    marginTop: 4,
  },
  teamChipTitle: {
    color: colors.text,
    ...TYPE.body,
    ...figtree('800'),
  },
  teamChipBadge: {
    color: colors.primary,
    ...TYPE.caption,
    ...figtree('800'),
  },
  onboard: {
    gap: 10,
  },
  onboardHint: {
    color: colors.textMuted,
    ...TYPE.body,

    ...figtree('600'),
  },
  fieldLabel: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('800'),
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
    ...TYPE.body,
    ...figtree('700'),
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
    ...TYPE.caption,
    ...figtree('800'),
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
    ...TYPE.caption,
    ...figtree('800'),
  },
  toggleLabel: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('800'),
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
  switchTabOn: { minHeight: 44,
    backgroundColor: 'transparent',
  },
  switchCopy: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('800'),
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
    ...TYPE.body,
    ...figtree('800'),
    textAlign: 'center',
  },
  busy: { minHeight: 44,
    opacity: 0.7,
  },
});
