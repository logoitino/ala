/** My sports keeps independent credentials and one manually chosen primary in a revision-checked draft.
 * Back and failed saves retain edits; only the SDK's confirmed atomic snapshot acknowledges a save.
 * @sideEffects School directory search, participation save RPC and guarded Auth profile refresh. */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { colors, MENU_METRICS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { SchoolTeam } from '@/data/teams';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { useStoredSportChoices } from '@/hooks/useStoredSportChoices';
import { saveAthleteSports, type AthleteSportEntry, type AthleteSportsSnapshot } from '@/lib/athleteSports';
import { searchSchoolsAndTeams } from '@/lib/teams';

type Props = { visible: boolean; profileId: string; snapshot: AthleteSportsSnapshot | null; onClose: () => void;
  onSaved: (snapshot: AthleteSportsSnapshot) => void; onReload?: () => void };
const clone = (snapshot: AthleteSportsSnapshot) => ({ ...snapshot, sports: snapshot.sports.map(entry => ({ ...entry })) });

/** @purpose Athlete account sheet for selected sports, per-sport credentials and explicit primary replacement. */
export function MySportsModal(props: Props) {
  const { user, isSessionCurrent } = useAuth();
  const lifetime = useRef({ guard: isSessionCurrent, generation: 0 });
  if (lifetime.current.guard !== isSessionCurrent) lifetime.current = { guard: isSessionCurrent, generation: lifetime.current.generation + 1 };
  // A new account must never inherit the previous account's retained draft, even for an identical subject URL.
  return <MySportsDraft key={`${user?.id ?? 'guest'}:${props.profileId}:${lifetime.current.generation}`} {...props} />;
}
function MySportsDraft({ visible, profileId, snapshot, onClose, onSaved, onReload }: Props) {
  const frame = useSheetFrame();
  const { user, refreshProfile, isSessionCurrent } = useAuth();
  const { sportNames, status: catalogStatus, reload: reloadSportChoices } = useStoredSportChoices(visible);
  const [draft, setDraft] = useState<AthleteSportsSnapshot | null>(() => snapshot?.profileId === profileId ? clone(snapshot) : null);
  const [adding, setAdding] = useState(false);
  const [schoolSport, setSchoolSport] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [schools, setSchools] = useState<SchoolTeam[]>([]);
  const [searchError, setSearchError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const lock = useRef(false);
  const owner = useRef(user?.id); owner.current = user?.id;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!draft && snapshot?.profileId === profileId) setDraft(clone(snapshot));
  }, [draft, profileId, snapshot]);
  useEffect(() => {
    let active = true;
    setSchools([]); setSearchError(false);
    if (schoolSport && query.trim()) void searchSchoolsAndTeams(query).then(rows => {
      if (active) setSchools(rows);
    }, () => { if (active) setSearchError(true); });
    return () => { active = false; };
  }, [query, schoolSport]);
  const patch = (sport: string, fields: Partial<AthleteSportEntry>) => {
    if (lock.current) return;
    setDraft(current => current ? { ...current, sports: current.sports.map(entry => entry.sport === sport ? { ...entry, ...fields } : entry) } : current);
  };
  const back = () => {
    if (lock.current) return;
    if (schoolSport) { setSchoolSport(null); setQuery(''); }
    else if (adding) setAdding(false);
    else onClose();
  };
  const save = async () => {
    if (lock.current || !draft || !snapshot) return;
    if (catalogStatus !== 'ready' || draft.sports.some(entry => !snapshot.sports.some(saved => saved.sport === entry.sport) && !sportNames.includes(entry.sport))) return;
    if (!draft.primarySport || !draft.sports.some(entry => entry.sport === draft.primarySport)) {
      setError('Choose a primary sport before saving.'); return;
    }
    const account = user?.id;
    if (!account || (isSessionCurrent && !isSessionCurrent())) return;
    const valid = () => mounted.current && owner.current === account && (!isSessionCurrent || isSessionCurrent());
    lock.current = true; setSaving(true); setError(null);
    try {
      const confirmed = await saveAthleteSports(profileId, draft.primarySport, draft.sports.map(entry => ({ ...entry,
        position: entry.position.trim(), jersey: entry.jersey.trim(), teamName: entry.teamName?.trim() || null })), draft.revision);
      if (!valid()) return;
      setDraft(clone(confirmed));
      onSaved(confirmed);
      // This refresh updates the primary field artwork; it is not the save's success proof.
      try { await refreshProfile(); }
      catch {
        if (valid()) setError('Sports saved. The profile refresh is unavailable right now. Your confirmed sports are retained.');
        return;
      }
      if (!valid()) return;
      onClose();
    } catch {
      if (valid()) setError('Could not confirm your sports. Your draft is still here. Reload the latest sports before saving again.');
    } finally {
      if (valid()) { lock.current = false; setSaving(false); }
    }
  };
  if (!visible) return null;
  const available = snapshot?.profileId === profileId;
  const blockedNewSport = draft?.sports.some(entry => !snapshot?.sports.some(saved => saved.sport === entry.sport) && !sportNames.includes(entry.sport));
  const catalogNotice = catalogStatus === 'loading' ? 'Loading sport choices. Your draft stays here.' : catalogStatus === 'unavailable' ? 'Sport choices are unavailable right now. Your draft stays here. Reload sport choices to try again.'
    : blockedNewSport ? 'A new sport in your draft is no longer available. Keep the draft or remove that sport before saving.'
      : sportNames.length === 0 ? 'No active sports are available to add. Existing sport details stay here.' : null;
  return <Modal visible transparent animationType="slide" onRequestClose={back}>
    <View style={styles.root}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={frame.dock}>
      <View style={[styles.sheet, frame.card]}><MenuBackdrop accent="jade" />
        <View style={styles.heading}><Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={saving} onPress={back} style={styles.button}><Text style={styles.link}>Back</Text></Pressable>
          <Text accessibilityRole="header" style={styles.title}>{schoolSport ? `${schoolSport} school / team` : adding ? 'Add a sport' : 'My sports'}</Text></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          {!available ? <Text accessibilityRole="alert" style={styles.error}>Sports editing is unavailable right now. Your existing profile and any draft stay here.</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {catalogNotice ? <Text accessibilityRole="alert" style={styles.error}>{catalogNotice}</Text> : null}
          {catalogNotice ? <Pressable accessibilityRole="button" accessibilityLabel="Reload sport choices" disabled={saving || catalogStatus === 'loading'} onPress={reloadSportChoices} style={styles.button}><Text style={styles.link}>Reload sport choices</Text></Pressable> : null}
          {schoolSport ? <>
            <TextInput accessibilityLabel="Search schools and teams" value={query} onChangeText={setQuery} placeholder="School or team name" style={styles.input} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${schoolSport} school`} onPress={() => { patch(schoolSport, { schoolId: null, teamName: null }); setSchoolSport(null); }} style={styles.button}><Text style={styles.link}>No school / team</Text></Pressable>
            {schools.map(team => <Pressable key={team.id} accessibilityRole="button" accessibilityLabel={`Choose ${team.name}`} style={styles.button} onPress={() => {
              patch(schoolSport, { schoolId: team.id, teamName: team.name }); setSchoolSport(null); setQuery('');
            }}><Text style={styles.label}>{team.name}</Text></Pressable>)}
            {searchError ? <Text style={styles.error}>School search is unavailable. Try again.</Text> : null}
          </> : adding ? sportNames.filter(sport => !draft?.sports.some(entry => entry.sport.toLowerCase() === sport.toLowerCase())).map(sport =>
            <Pressable key={sport} accessibilityRole="button" accessibilityLabel={`Add ${sport}`} style={styles.button} onPress={() => {
              setDraft(current => current && current.sports.length < 16 ? { ...current, sports: [...current.sports, { sport, schoolId: null, teamName: null, position: '', jersey: '' }] } : current);
              setAdding(false);
            }}><Text style={styles.label}>{sport}</Text></Pressable>) : <>
            <Text style={styles.hint}>Choose one primary sport for your default field artwork. School, position and jersey are separate for each sport. Class year and physicals stay shared.</Text>
            {draft?.sports.map(entry => <View key={entry.sport} style={styles.entry}>
              <Text style={styles.label}>{entry.sport}</Text>
              <View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel={`Make ${entry.sport} primary`} accessibilityState={{ selected: draft.primarySport === entry.sport }} disabled={saving || !available}
                onPress={() => setDraft(current => current ? { ...current, primarySport: entry.sport } : current)} style={styles.button}>
                <Text style={styles.link}>{draft.primarySport === entry.sport ? 'Primary' : 'Make primary'}</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${entry.sport}`} disabled={saving || !available} style={styles.button} onPress={() => setDraft(current => current ? { ...current,
                  primarySport: current.primarySport === entry.sport ? null : current.primarySport, sports: current.sports.filter(row => row.sport !== entry.sport) } : current)}><Text style={styles.link}>Remove</Text></Pressable></View>
              <Pressable accessibilityRole="button" accessibilityLabel={`${entry.sport} school / team`} disabled={saving || !available} style={styles.button} onPress={() => { setSchoolSport(entry.sport); setQuery(''); }}><Text style={styles.label}>{entry.teamName || 'Choose school / team (optional)'}</Text></Pressable>
              <Text style={styles.hint}>Position</Text><TextInput accessibilityLabel={`${entry.sport} position`} value={entry.position} maxLength={80} editable={!saving && available} onChangeText={position => patch(entry.sport, { position })} style={styles.input} />
              <Text style={styles.hint}>Jersey</Text><TextInput accessibilityLabel={`${entry.sport} jersey`} value={entry.jersey} maxLength={12} editable={!saving && available} onChangeText={jersey => patch(entry.sport, { jersey })} style={styles.input} />
            </View>)}
            {available && catalogStatus === 'ready' && sportNames.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Add another sport" disabled={saving || (draft?.sports.length ?? 0) >= 16} onPress={() => setAdding(true)} style={styles.button}><Text style={styles.link}>Add another sport</Text></Pressable> : null}
          </>}
        </ScrollView>
        {!adding && !schoolSport ? <View style={styles.footer}>
          {onReload ? <Pressable accessibilityRole="button" accessibilityLabel="Reload latest sports" disabled={saving} style={styles.button} onPress={() => { onReload(); }}><Text style={styles.link}>Reload latest sports</Text></Pressable> : null}
          {snapshot && draft && snapshot.revision !== draft.revision ? <Pressable accessibilityRole="button" accessibilityLabel="Replace draft with latest sports" disabled={saving} style={styles.button}
            onPress={() => { setDraft(clone(snapshot)); setError(null); }}><Text style={styles.link}>Use latest sports (replaces draft)</Text></Pressable> : null}
          {available ? <Pressable accessibilityRole="button" accessibilityLabel="Save sports" disabled={saving || catalogStatus !== 'ready' || blockedNewSport} style={[styles.button, styles.save]} onPress={() => void save()}>{saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.saveLabel}>Save sports</Text>}</Pressable> : null}
        </View> : null}
      </View></KeyboardAvoidingView></View>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  sheet: { backgroundColor: colors.surface, borderRadius: MENU_METRICS.sheetRadius, overflow: 'hidden', maxHeight: '78%' },
  heading: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  body: { padding: 14, gap: 10 }, entry: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  button: { minHeight: 44, padding: 10, justifyContent: 'center', borderRadius: 12 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' }, link: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 }, error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.text },
  footer: { padding: 10, gap: 6 }, save: { backgroundColor: colors.primary, alignItems: 'center' }, saveLabel: { color: colors.onAccent, fontSize: 14, fontWeight: '800' },
});
