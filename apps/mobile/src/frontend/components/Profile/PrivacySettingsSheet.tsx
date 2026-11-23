/** Privacy drafts, codes, writes and delayed callbacks belong to one visible Auth lifetime. UX-13 readable shared type preserves every action and required notice.
 * Profile → Privacy (PRIV-01, MINOR-01): public or private account, who sees each profile item, hide from search, who
 * can send friend requests, how tags are reviewed, blocked accounts, and the minor-account pieces: birth month and
 * year, and for 13–17 the parent or guardian link (invite code, confirm, unlink), the consent status, requests waiting
 * for the guardian (under 16) and "What your guardian sees". Adults can open the guardian panel to link a teen. The
 * database enforces every rule; this sheet explains them.
 * QUIZ-05: athletes get a "Fun facts" audience (same control as the other items) when the server has it; for 13–15
 * "Everyone" is not offered because the server caps fun facts at friends.
 * @sideEffects `get_my_privacy`, `set_my_privacy`, `list_my_blocks`, `unblock_user` (lib/privacy) and the guardian
 *   functions in lib/minors; `set_my_birth_month` through AuthContext.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { BirthMonthField, type BirthDraft } from '@/components/Auth/BirthMonthField';
import { GuardianSupervisionPanel } from '@/components/Custodial/GuardianSupervisionPanel';
import { SupervisionSummary } from '@/components/Custodial/SupervisionSummary';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { colors } from '@/constants/theme';
import { createOfflineActorClient } from '@/lib/offlineActor';
import { offlineQueue } from '@/services/OfflineQueue';
import { useAuth } from '@/context/AuthContext';
import {
  APPROVAL_LABEL,
  BAND_LABEL,
  birthInputError,
  cancelApprovalRequest,
  createGuardianInvite,
  endGuardianLink,
  fetchMyPrivacyStatus,
  fetchMySupervision,
  isMinorBand,
  respondGuardianLink,
  saveMyPrivacyStatus,
  type MinorStatus,
  type Supervision,
} from '@/lib/minors';
import {
  ALWAYS_PUBLIC_NOTE,
  AUDIENCE_LABEL,
  PRIVACY_ITEMS,
  fetchMyBlocks,
  unblockUser,
  type Audience,
  type BlockedRow,
  type PrivacySettings,
} from '@/lib/privacy';
import { TYPE, figtree } from '@/theme/fonts';

const AUDIENCES: Audience[] = ['everyone', 'friends', 'only_me'];

type Choice<T extends string> = { value: T; label: string };

/** @purpose A row of mutually exclusive choices; `disabled` greys out options the rules do not allow yet. */
function Choices<T extends string>({ label, value, options, onChange, disabled, locked }: {
  label: string;
  value: T;
  options: Choice<T>[];
  onChange: (next: T) => void;
  disabled?: (option: T) => boolean;
  locked?: boolean;
}) {
  return (
    <View style={styles.choiceRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const on = option.value === value;
        const off = Boolean(locked) || (disabled?.(option.value) ?? false);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${option.label}`}
            accessibilityState={{ selected: on, disabled: off }}
            disabled={off}
            haptic="selection"
            onPress={() => onChange(option.value)}
            style={[styles.choice, on && styles.choiceOn, off && styles.choiceOff]}
          >
            <Text style={[styles.choiceLabel, on && styles.choiceLabelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const message = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

/** @purpose The Privacy sheet opened from Edit profile. */
export function PrivacySettingsSheet(props: { visible: boolean; onClose: () => void }) {
  const { user, isSessionCurrent } = useAuth();
  const lifetime = useRef({ owner: user?.id, guard: isSessionCurrent, visible: props.visible, generation: 0 });
  if (lifetime.current.owner !== user?.id || lifetime.current.guard !== isSessionCurrent || lifetime.current.visible !== props.visible)
    lifetime.current = { owner: user?.id, guard: isSessionCurrent, visible: props.visible, generation: lifetime.current.generation + 1 };
  // Key the whole private draft: incoming accounts never inherit settings, codes or nested guardian panels.
  if (isSessionCurrent && !isSessionCurrent()) return null;
  return <OwnedPrivacySettingsSheet key={lifetime.current.generation} {...props} />;
}
function OwnedPrivacySettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { recordBirthMonth, isAthlete, user, isSessionCurrent } = useAuth();
  const mounted = useRef(true), flight = useRef(false), read = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ++read.current; }; }, []);
  const current = useCallback(() => mounted.current && visible && (isSessionCurrent?.() ?? true), [visible, isSessionCurrent]);
  const capture = () => {
    const captured = user?.id ? offlineQueue.captureActor(user.id) : null;
    return captured ? { userId: captured.userId, isCurrent: () => current() && captured.isCurrent() } : null;
  };
  const dismiss = () => { if (current()) onClose(); };
  const [loading, setLoading] = useState(Boolean(visible));
  const [saved, setSaved] = useState<PrivacySettings | null>(null);
  const [draft, setDraft] = useState<PrivacySettings | null>(null);
  const [minor, setMinor] = useState<MinorStatus | null>(null);
  const [blocks, setBlocks] = useState<BlockedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [birth, setBirth] = useState<BirthDraft>({ year: null, month: null });
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [mirror, setMirror] = useState<Supervision | null>(null);
  const [guardianOpen, setGuardianOpen] = useState(false);

  const load = useCallback(async () => {
    if (!current()) return;
    const actor = capture(), request = ++read.current;
    const accepted = () => current() && request === read.current && Boolean(actor?.isCurrent());
    setError(null); setLoading(true);
    try {
      if (!actor) throw new Error('Your account changed. Reopen Privacy settings.');
      const client = await createOfflineActorClient(actor);
      if (!accepted()) return;
      const [status, blocked] = await Promise.all([fetchMyPrivacyStatus(client), fetchMyBlocks(client)]);
      if (!accepted()) return;
      setSaved(status.settings); setDraft(status.settings); setMinor(status.minor); setBlocks(blocked);
    } catch (caught) {
      if (current() && request === read.current) setError(message(caught, 'Could not load your privacy settings.'));
    } finally { if (current() && request === read.current) setLoading(false); }
  }, [current, user?.id]);
  useEffect(() => {
    if (visible) {
      setNotice(null);
      setInvite(null);
      setMirror(null);
      void load();
    }
  }, [visible, load]);

  const band = minor?.ageBand ?? 'unknown';
  const teen = isMinorBand(band);
  const under16 = band === 'teen_13_15';
  const firstGuardian = minor?.guardians[0]?.firstName ?? 'your guardian';

  // A synchronous flight excludes same-render duplicates, and bound requests cannot adopt another account.
  const act = async (work: (client: Awaited<ReturnType<typeof createOfflineActorClient>>) => Promise<string | void>, fallback: string) => {
    if (!current() || flight.current || loading || error) return;
    const actor = capture();
    if (!actor) return;
    flight.current = true; ++read.current;
    setBusy(true); setNotice(null);
    try {
      const client = await createOfflineActorClient(actor);
      if (!actor.isCurrent()) return;
      const done = await work(client);
      if (current() && actor.isCurrent() && done) setNotice(done);
    } catch (caught) {
      if (current() && actor.isCurrent()) setNotice(message(caught, fallback));
    } finally { flight.current = false; if (current()) setBusy(false); }
  };

  const save = () => act(async (client) => {
    if (!draft) return;
    const next = await saveMyPrivacyStatus(draft, client);
    if (!current()) return;
    setSaved(next.settings);
    setDraft(next.settings);
    setMinor(next.minor);
    if (next.heldForApproval.length) {
      return `Sent to ${firstGuardian} to approve: ${next.heldForApproval.map((key) => APPROVAL_LABEL[key].toLowerCase()).join(' and ')}. Everything else is saved.`;
    }
    return 'Privacy saved.';
  }, 'Could not save your privacy settings.');

  const saveBirth = () => act(async () => {
    if (!birth.year || !birth.month) return;
    const outcome = await recordBirthMonth(birth.year, birth.month);
    if (!current()) return;
    if (outcome === 'blocked') {
      dismiss();
      return;
    }
    await load();
    return 'Saved.';
  }, 'Could not save your birth month and year.');

  const makeInvite = () => act(async (client) => {
    const next = await createGuardianInvite(client);
    if (current()) setInvite(next);
  }, 'Could not make a code.');

  const shareInvite = () => act(async () => {
    if (!invite || !current()) return;
    await Share.share({ message: `My Tapua'i guardian code is ${invite.code}. Open Tapua'i, then Profile → Privacy → Link a teen. It works for 48 hours.` });
  }, 'Could not share the code.');

  const answerLink = (linkId: string, accept: boolean) => act(async (client) => {
    const next = await respondGuardianLink(linkId, accept, client);
    if (!current()) return;
    if (next) setMinor(next);
    await load();
    return accept ? 'Linked.' : 'Declined.';
  }, 'That did not work.');

  const unlink = (linkId: string, name: string) => {
    if (!current() || flight.current) return;
    Alert.alert(`Unlink ${name}?`, 'Their consent ends with the link: a public profile goes private and payouts wait. They will see that you unlinked.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unlink', style: 'destructive', onPress: () => void act(async (client) => { await endGuardianLink(linkId, client); if (!current()) return; await load(); return 'Unlinked.'; }, 'That did not work.') },
    ]);
  };

  const cancelRequest = (id: string) => act(async (client) => {
    await cancelApprovalRequest(id, client);
    if (!current()) return;
    await load();
    return 'Request cancelled.';
  }, 'That did not work.');

  const showMirror = () => act(async (client) => {
    const next = await fetchMySupervision(client);
    if (current()) setMirror(next);
  }, 'Could not load the summary.');

  const unblock = (row: BlockedRow) => act(async (client) => {
    await unblockUser(row.profileId, client);
    if (current()) setBlocks(previous => previous.filter(item => item.profileId !== row.profileId));
  }, 'Could not unblock.');

  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const publicBlocked = teen && !minor?.hasPublicConsent && (saved?.accountPrivate ?? true);
  const requestOptions: Choice<PrivacySettings['friendRequestsFrom']>[] = teen
    ? [{ value: 'teens', label: 'Only other teens' }, { value: 'everyone', label: 'Anyone' }, { value: 'nobody', label: 'Nobody' }]
    : [
        { value: 'everyone', label: 'Anyone can send' },
        ...(saved?.friendRequestsFrom === 'teens' ? [{ value: 'teens' as const, label: 'Only teens' }] : []),
        { value: 'nobody', label: 'Nobody' },
      ];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={dismiss}>
      <View style={styles.root}>
        <View style={styles.sheet}>
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={dismiss} />
          <Text style={styles.kicker}>Account</Text>
          <Text style={styles.title}>Privacy</Text>
          {error ? <View><Text style={styles.error} accessibilityRole="alert">{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry privacy" disabled={loading || busy} onPress={() => void load()} style={styles.choice}><Text style={styles.choiceLabel}>Retry</Text></Pressable></View> : null}
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          {draft && !loading && !error ? (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {minor?.needsBirth ? (
                <View style={styles.box}>
                  <Text style={styles.section}>Your age</Text>
                  <BirthMonthField value={birth} onChange={setBirth} disabled={busy} />
                  <AnimatedButton
                    accessibilityLabel="Save birth month and year"
                    disabled={busy || Boolean(birthInputError(birth.year, birth.month))}
                    haptic="selection"
                    onPress={() => void saveBirth()}
                    contentStyle={[styles.small, (busy || Boolean(birthInputError(birth.year, birth.month))) && styles.saveOff]}
                  >
                    <Text style={styles.smallLabel}>Save</Text>
                  </AnimatedButton>
                </View>
              ) : minor ? (
                <Text style={styles.hint}>{`Age: ${BAND_LABEL[band]}. To correct it to an older age, contact support.`}</Text>
              ) : null}

              <Text style={styles.section}>Account</Text>
              <Choices
                locked={busy}
                label="Account"
                value={draft.accountPrivate ? 'private' : 'public'}
                options={[{ value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }]}
                onChange={(next) => setDraft({ ...draft, accountPrivate: next === 'private' })}
                disabled={(option) => option === 'public' && publicBlocked}
              />
              <Text style={styles.hint}>
                {draft.accountPrivate
                  ? 'Only friends see what you share with "Everyone". '
                  : 'Anyone can see what you share with "Everyone". '}
                {ALWAYS_PUBLIC_NOTE}
              </Text>
              {publicBlocked ? <Text style={styles.hint}>A parent or guardian signs the consent before a teen profile can be public.</Text> : null}
              {teen && under16 && !publicBlocked ? <Text style={styles.hint}>{`Going public is sent to ${firstGuardian} to approve.`}</Text> : null}

              <Text style={styles.section}>Who sees each part of your profile</Text>
              {PRIVACY_ITEMS.map((item) => (
                <View key={item.key} style={styles.item}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.hint}>{item.hint}</Text>
                  <Choices
                locked={busy}
                    label={item.label}
                    value={draft.audience[item.key]}
                    options={AUDIENCES.map((value) => ({ value, label: AUDIENCE_LABEL[value] }))}
                    onChange={(next) => setDraft({ ...draft, audience: { ...draft.audience, [item.key]: next } })}
                  />
                </View>
              ))}
              {isAthlete && draft.funFacts ? (
                <View style={styles.item}>
                  <Text style={styles.itemLabel}>Fun facts</Text>
                  <Text style={styles.hint}>
                    {under16 ? 'Trivia fun facts you share. Under 16, fun facts go to friends at most.' : 'Trivia fun facts you share.'}
                  </Text>
                  <Choices
                locked={busy}
                    label="Fun facts"
                    value={under16 && draft.funFacts === 'everyone' ? 'friends' : draft.funFacts}
                    options={AUDIENCES.map((value) => ({ value, label: AUDIENCE_LABEL[value] }))}
                    onChange={(next) => setDraft({ ...draft, funFacts: next })}
                    disabled={(option) => under16 && option === 'everyone'}
                  />
                </View>
              ) : null}

              <Text style={styles.section}>Finding you</Text>
              <Choices
                locked={busy}
                label="Search"
                value={draft.hideFromSearch ? 'hidden' : 'shown'}
                options={[{ value: 'shown', label: 'Show me in search' }, { value: 'hidden', label: 'Hide me from search' }]}
                onChange={(next) => setDraft({ ...draft, hideFromSearch: next === 'hidden' })}
              />
              <Text style={styles.hint}>Hidden people are still reachable from a clip they are tagged in.</Text>
              <Choices
                locked={busy}
                label="Friend requests"
                value={draft.friendRequestsFrom}
                options={requestOptions}
                onChange={(next) => setDraft({ ...draft, friendRequestsFrom: next })}
                disabled={(option) => band === 'not_given' && option !== 'nobody'}
              />
              {teen && under16 ? <Text style={styles.hint}>{`Requests from anyone, including adults, are sent to ${firstGuardian} to approve.`}</Text> : null}
              {band === 'not_given' ? <Text style={styles.hint}>Add your birth month and year to start taking friend requests.</Text> : null}

              <Text style={styles.section}>Tags</Text>
              <Choices
                locked={busy}
                label="Tag review"
                value={draft.tagReview}
                options={[{ value: 'review_all', label: 'Review every tag' }, { value: 'auto_friends', label: 'Auto-approve friends' }]}
                onChange={(next) => setDraft({ ...draft, tagReview: next })}
              />
              <Text style={styles.hint}>A clip you are tagged in shows on your profile, counts for Spotlight and takes gifts once the tag is approved.</Text>

              {teen && minor ? (
                <View style={styles.box}>
                  <Text style={styles.section}>Parent or guardian</Text>
                  <Text style={styles.hint}>A linked parent or guardian sees your settings, safety counts and changes, never who your friends are. You see exactly what they see, and you can unlink at any time.</Text>
                  {minor.pendingLinks.map((link) => (
                    <View key={link.linkId} style={styles.item}>
                      <Text style={styles.itemLabel}>{`Is ${link.firstName}${link.username ? ` (@${link.username})` : ''} your parent or guardian?`}</Text>
                      <View style={styles.choiceRow}>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Yes, ${link.firstName} is my parent or guardian`} disabled={busy} haptic="selection" onPress={() => void answerLink(link.linkId, true)} style={[styles.choice, styles.choiceOn]}>
                          <Text style={[styles.choiceLabel, styles.choiceLabelOn]}>Yes</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel={`No, ${link.firstName} is not my parent or guardian`} disabled={busy} haptic="selection" onPress={() => void answerLink(link.linkId, false)} style={styles.choice}>
                          <Text style={styles.choiceLabel}>No</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                  {minor.guardians.map((guardian) => (
                    <View key={guardian.linkId} style={styles.blockRow}>
                      <View style={styles.grow}>
                        <Text style={styles.itemLabel}>{guardian.firstName}</Text>
                        <Text style={styles.hint}>
                          {guardian.consent
                            ? `Consent: ${[guardian.consent.allowsPublicProfile ? 'public profile' : null, guardian.consent.allowsDonations ? 'payouts' : null].filter(Boolean).join(', ') || 'nothing extra'}`
                            : 'No consent signed yet'}
                        </Text>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Unlink ${guardian.firstName}`} disabled={busy} haptic="selection" onPress={() => unlink(guardian.linkId, guardian.firstName)} style={styles.choice}>
                        <Text style={styles.choiceLabel}>Unlink</Text>
                      </Pressable>
                    </View>
                  ))}
                  {minor.pendingApprovals.map((request) => (
                    <View key={request.id} style={styles.blockRow}>
                      <Text style={[styles.itemLabel, styles.grow]}>{`Waiting for approval: ${APPROVAL_LABEL[request.changeKey]}`}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Cancel request: ${APPROVAL_LABEL[request.changeKey]}`} disabled={busy} haptic="selection" onPress={() => void cancelRequest(request.id)} style={styles.choice}>
                        <Text style={styles.choiceLabel}>Cancel</Text>
                      </Pressable>
                    </View>
                  ))}
                  {minor.guardians.length + minor.pendingLinks.length < 2 && minor.linksEnabled ? (
                    invite ? (
                      <View style={styles.item}>
                        <Text style={styles.code} accessibilityLabel={`Guardian code ${invite.code.split('').join(' ')}`}>{invite.code}</Text>
                        <Text style={styles.hint}>Share this only with your parent or legal guardian. It works once, for 48 hours.</Text>
                        <AnimatedButton accessibilityLabel="Share the code" disabled={busy} haptic="selection" onPress={shareInvite} contentStyle={styles.small}>
                          <Text style={styles.smallLabel}>Share</Text>
                        </AnimatedButton>
                      </View>
                    ) : (
                      <AnimatedButton accessibilityLabel="Invite a parent or guardian" disabled={busy} haptic="selection" onPress={() => void makeInvite()} contentStyle={styles.small}>
                        <Text style={styles.smallLabel}>Invite a parent or guardian</Text>
                      </AnimatedButton>
                    )
                  ) : null}
                  {mirror ? <SupervisionSummary data={mirror} /> : (
                    <Pressable accessibilityRole="button" accessibilityLabel="What your guardian sees" disabled={busy} haptic="selection" onPress={() => void showMirror()} style={styles.choice}>
                      <Text style={styles.choiceLabel}>What your guardian sees</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}

              {band === 'adult' ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Parent or guardian: link a teen" disabled={busy} haptic="selection" onPress={() => setGuardianOpen(true)} style={styles.choice}>
                  <Text style={styles.choiceLabel}>Parent or guardian? Link a teen</Text>
                </Pressable>
              ) : null}

              <Text style={styles.section}>Blocked accounts</Text>
              {blocks.length === 0 ? <Text style={styles.hint}>You haven&apos;t blocked anyone.</Text> : null}
              {blocks.map((row) => (
                <View key={row.profileId} style={styles.blockRow}>
                  <Text style={styles.itemLabel}>{row.name}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Unblock ${row.name}`} disabled={busy} haptic="selection" onPress={() => void unblock(row)} style={styles.choice}>
                    <Text style={styles.choiceLabel}>Unblock</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}
          {notice ? <Text style={styles.notice} accessibilityRole="alert">{notice}</Text> : null}
          <AnimatedButton
            accessibilityLabel="Save privacy"
            disabled={!draft || !changed || busy || loading || Boolean(error)}
            haptic="medium"
            onPress={() => void save()}
            contentStyle={[styles.save, (!draft || !changed || busy) && styles.saveOff]}
          >
            <Text style={styles.saveLabel}>{busy ? 'Saving…' : 'Save privacy'}</Text>
          </AnimatedButton>
        </View>
      </View>
      <Modal visible={visible && guardianOpen} animationType="fade" transparent onRequestClose={() => setGuardianOpen(false)}>
        <View style={styles.root}>
          <View style={styles.sheet}>
            <SheetHandle onDismiss={() => setGuardianOpen(false)} />
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <GuardianSupervisionPanel />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '92%', padding: 16, paddingBottom: 22, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.surface, overflow: 'hidden', gap: 6 },
  kicker: { ...TYPE.caption, ...figtree('800'), letterSpacing: 1.2, color: colors.textMuted, textTransform: 'uppercase' },
  title: { ...TYPE.title, ...figtree('800'), color: colors.text },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: 6, paddingBottom: 10 },
  section: { marginTop: 10, ...TYPE.body, ...figtree('800'), color: colors.text },
  box: { gap: 6, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  item: { gap: 4, marginTop: 2 },
  itemLabel: { ...TYPE.body, ...figtree('700'), color: colors.text },
  hint: { ...figtree('400'), ...TYPE.caption, color: colors.textMuted,  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { minHeight: 44, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignSelf: 'flex-start' },
  choiceOn: { minHeight: 44, backgroundColor: colors.text, borderColor: colors.text },
  choiceOff: { minHeight: 44, opacity: 0.4 },
  choiceLabel: { ...TYPE.caption, ...figtree('700'), color: colors.text },
  choiceLabelOn: { color: colors.onAccent },
  blockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  grow: { flex: 1 },
  code: { ...TYPE.title, ...figtree('800'), letterSpacing: 4, color: colors.text },
  small: { minHeight: 44, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary },
  smallLabel: { ...TYPE.body, ...figtree('800'), color: colors.onAccent },
  error: { ...figtree('400'), ...TYPE.caption, color: colors.danger },
  notice: { ...figtree('400'), ...TYPE.caption, color: colors.text },
  save: { minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  saveOff: { minHeight: 44, opacity: 0.5 },
  saveLabel: { ...TYPE.body, ...figtree('800'), color: colors.onAccent },
});
