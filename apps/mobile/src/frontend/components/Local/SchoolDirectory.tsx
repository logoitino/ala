/**
 * Current school/team roster discovery (UX-17). Loaded-page counts and missing labels stay honest;
 * scope-bound reads/actions preserve Back context while refusing stale searches, schools and account lifetimes.
 * @sideEffects Bounded public directory reads and existing exact-roster profile navigation; no identity writes.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { KitButton } from '@/components/UI/Kit';
import { colors, KIT, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { listDirectoryRoster, listDirectorySchools, type DirectoryPage, type DirectoryPlayer, type DirectorySchool } from '@/lib/schoolDirectory';
import { userProfileHref } from '@/lib/navigation';
import { DISPLAY_TEXT, TYPE, figtree } from '@/theme/fonts';

type Kind = 'schools' | 'teams' | 'roster';
type Stored<T> = DirectoryPage<T> & { key: string; error: string | null; retryOffset: number; retryAppend: boolean; repairSchool: boolean };
type Frame = { key: string; kind: Kind; school: DirectorySchool | null; team: string | undefined; search: string; owner: number; guard: (() => boolean) | undefined };
function blank<T>(): Stored<T> { return { key: '', items: [], hasMore: false, nextOffset: null, error: null, retryOffset: 0, retryAppend: false, repairSchool: false }; }
function frameKey(owner: number, kind: Kind, school: DirectorySchool | null, team: string | undefined, search: string) { return JSON.stringify([owner, kind, school?.id, school?.name, team, search]); }
function accept<T extends { id: string }>(previous: Stored<T>, result: DirectoryPage<T>, key: string, append: boolean): Stored<T> {
  const rows = new Map((append && previous.key === key ? previous.items : []).map(row => [row.id, row]));
  result.items.forEach(row => rows.set(row.id, row));
  return { ...result, items: [...rows.values()], key, error: null, retryOffset: 0, retryAppend: false, repairSchool: false };
}

export function SchoolDirectory() {
  const router = useRouter(); const { user, isSessionCurrent } = useAuth();
  const owner = useRef({ userId: user?.id, guard: isSessionCurrent, generation: 0 });
  if (owner.current.userId !== user?.id || owner.current.guard !== isSessionCurrent) owner.current = { userId: user?.id, guard: isSessionCurrent, generation: owner.current.generation + 1 };
  const [school, setSchool] = useState<DirectorySchool | null>(null);
  const [team, setTeam] = useState<string | undefined>();
  const [schoolDraft, setSchoolDraft] = useState(''); const [schoolSearch, setSchoolSearch] = useState('');
  const [rosterDraft, setRosterDraft] = useState(''); const [rosterSearch, setRosterSearch] = useState('');
  const [schools, setSchools] = useState<Stored<DirectorySchool>>(() => blank());
  const [teams, setTeams] = useState<Stored<DirectoryPlayer>>(() => blank());
  const [roster, setRoster] = useState<Stored<DirectoryPlayer>>(() => blank());
  const [pending, setPending] = useState<{ key: string; request: number } | null>(null);
  const kind: Kind = !school ? 'schools' : team === undefined ? 'teams' : 'roster';
  const search = kind === 'schools' ? schoolSearch : kind === 'roster' ? rosterSearch : '';
  const key = frameKey(owner.current.generation, kind, school, team, search);
  const frame = useRef<Frame>({ key, kind, school, team, search, owner: owner.current.generation, guard: isSessionCurrent });
  frame.current = { key, kind, school, team, search, owner: owner.current.generation, guard: isSessionCurrent };
  const pages = useRef({ schools, teams, roster }); pages.current = { schools, teams, roster };
  const mounted = useRef(false); const generation = useRef(0); const flight = useRef<{ key: string; request: number } | null>(null);
  const stored = kind === 'schools' ? schools : kind === 'teams' ? teams : roster;
  const current = stored.key === key ? stored : blank<DirectorySchool | DirectoryPlayer>();
  const busy = pending?.key === key;
  const activeRows = useRef(current.items); activeRows.current = current.items;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; flight.current = null; }; }, []);
  const load = useCallback(async (offset = 0, append = false) => {
    const captured = frame.current;
    if (!mounted.current || (captured.guard && !captured.guard()) || flight.current?.key === captured.key) return;
    const request = ++generation.current;
    flight.current = { key: captured.key, request }; setPending(flight.current);
    const valid = () => mounted.current && generation.current === request && frame.current.key === captured.key
      && owner.current.generation === captured.owner && (!captured.guard || captured.guard());
    try {
      if (captured.kind === 'schools') {
        const result = await listDirectorySchools({ search: captured.search, offset, limit: 20 });
        if (valid()) setSchools(previous => accept(previous, result, captured.key, append));
      } else if (captured.school) {
        const options = { schoolId: captured.school.id, schoolName: captured.school.name, offset, limit: 20 };
        const result = await listDirectoryRoster(captured.kind === 'roster' ? { ...options, team: captured.team, search: captured.search } : options);
        if (valid()) {
          if (captured.kind === 'teams') setTeams(previous => accept(previous, result, captured.key, append));
          else setRoster(previous => accept(previous, result, captured.key, append));
        }
      }
    } catch (error) {
      if (!valid()) return;
      // Provider details are not user copy. Retain a prior page and the precise failed paging operation for Retry.
      const associationChanged = captured.kind !== 'schools' && error instanceof Error && error.message.startsWith('School association changed.');
      // A renamed/missing catalog identity needs a fresh choice, not repeated requests against its stale label.
      const failed = <T,>(previous: Stored<T>): Stored<T> => ({ ...(!associationChanged && previous.key === captured.key ? previous : blank<T>()), key: captured.key,
        error: associationChanged ? 'School details changed. Choose the school again to refresh its roster.' : captured.kind === 'schools' ? 'Schools are unavailable. Please retry.' : 'Roster is unavailable. Please retry.',
        retryOffset: offset, retryAppend: append, repairSchool: associationChanged });
      if (captured.kind === 'schools') setSchools(failed); else if (captured.kind === 'teams') setTeams(failed); else setRoster(failed);
    } finally {
      if (valid()) { flight.current = null; setPending(null); }
    }
  }, []);
  useEffect(() => {
    // Cached pages are reused only for this school/search/account lifetime, keeping Back useful without stale publication.
    generation.current += 1; flight.current = null; setPending(null);
    if (pages.current[frame.current.kind].key !== frame.current.key) void load();
  }, [key, load]);

  const validAction = () => mounted.current && frame.current.key === key && owner.current.generation === frame.current.owner && (!isSessionCurrent || isSessionCurrent());
  const changeFrame = (nextSchool: DirectorySchool | null, nextTeam: string | undefined, nextSearch: string) => {
    generation.current += 1; flight.current = null; setPending(null);
    const nextKind: Kind = !nextSchool ? 'schools' : nextTeam === undefined ? 'teams' : 'roster';
    frame.current = { ...frame.current, key: frameKey(owner.current.generation, nextKind, nextSchool, nextTeam, nextSearch), kind: nextKind, school: nextSchool, team: nextTeam, search: nextSearch };
  };
  const chooseSchool = (row: DirectorySchool) => {
    if (!validAction() || !activeRows.current.some(item => item.id === row.id && item.name === row.name)) return;
    changeFrame(row, undefined, ''); setSchool(row); setTeam(undefined); setRosterDraft(''); setRosterSearch('');
  };
  const chooseTeam = (label: string) => {
    if (!validAction() || !school || !(activeRows.current as DirectoryPlayer[]).some(row => row.team === label)) return;
    changeFrame(school, label, ''); setTeam(label); setRosterDraft(''); setRosterSearch('');
  };
  const returnToSchools = (refresh = false) => {
    changeFrame(null, undefined, schoolSearch); if (refresh) setSchools(blank()); setSchool(null); setTeam(undefined);
  };
  const goBack = () => {
    if (!validAction()) return;
    if (!school) { router.back(); return; }
    if (current.repairSchool) { returnToSchools(true); return; }
    if (team !== undefined) { changeFrame(school, undefined, ''); setTeam(undefined); }
    else returnToSchools();
  };
  const submitSearch = () => {
    if (!validAction()) return;
    const next = (kind === 'schools' ? schoolDraft : rosterDraft).trim();
    if (next === search) { void load(); return; }
    changeFrame(school, team, next);
    if (kind === 'schools') setSchoolSearch(next); else setRosterSearch(next);
  };
  const openPlayer = (row: DirectoryPlayer) => {
    if (validAction() && activeRows.current.some(item => item.id === row.id)) router.push(userProfileHref(row.id));
  };
  const rosterRows = kind === 'schools' ? [] : current.items as DirectoryPlayer[];
  const groups = [...new Set(rosterRows.map(row => row.team).filter((label): label is string => typeof label === 'string' && Boolean(label.trim())))];
  const unassigned = rosterRows.filter(row => !row.team?.trim());
  const playerRow = (row: DirectoryPlayer) => (
    <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={'Open roster entry ' + row.name} onPress={() => openPlayer(row)} style={styles.row}>
      <View style={styles.rowText}><Text style={styles.rowTitle}>{row.name}</Text><Text style={styles.caption}>{[row.jerseyNumber === null ? null : '#' + row.jerseyNumber, row.position?.trim() || null].filter(Boolean).join(' · ') || 'Roster entry'}</Text></View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <KitButton label={!school ? 'Back to Local' : team === undefined ? 'Back to schools' : 'Back to teams'} onPress={goBack} variant="ghost" size="sm" style={styles.back} icon={<Ionicons name="arrow-back" size={18} color={colors.primary} />} />
      <Text style={styles.caption}>{!school ? 'Local' : 'Schools · ' + school.name + (team === undefined ? '' : ' · ' + team)}</Text>
      <Text style={styles.title}>{!school ? 'Schools and teams' : team === undefined ? school.name : team}</Text>
      <Text style={styles.body}>{!school ? 'Find a school, then browse its current roster.' : team === undefined ? 'Choose a team from the roster records loaded here.' : school.name + ' · Current roster entries'}</Text>
      {kind !== 'teams' && <View style={styles.searchRow}>
        <TextInput accessibilityLabel={kind === 'schools' ? 'Search school names' : 'Search roster names'} placeholder={kind === 'schools' ? 'School name' : 'Roster name'} value={kind === 'schools' ? schoolDraft : rosterDraft}
          onChangeText={kind === 'schools' ? setSchoolDraft : setRosterDraft} onSubmitEditing={submitSearch} maxLength={100} autoCorrect={false} returnKeyType="search" style={styles.input} />
        <KitButton label="Search" accessibilityLabel="Search directory" onPress={submitSearch} size="sm" />
      </View>}
      <View style={styles.tools}><KitButton label="Refresh" accessibilityLabel="Refresh directory" onPress={() => { if (validAction()) void load(); }} variant="ghost" size="sm" disabled={busy} icon={<Ionicons name="refresh" size={18} color={colors.primary} />} />
        {current.items.length > 0 && <Text style={styles.caption}>{current.items.length + (kind === 'schools' ? ' schools loaded' : ' roster entries loaded')}</Text>}
      </View>
      {busy && <View style={styles.loading} accessibilityLiveRegion="polite"><ActivityIndicator color={colors.primary} /><Text style={styles.body}>{current.items.length ? 'Loading records…' : kind === 'schools' ? 'Loading schools…' : 'Loading roster…'}</Text></View>}
      {kind === 'schools' && current.items.length > 0 && <View style={styles.list}>{(current.items as DirectorySchool[]).map(row => (
        <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={'Browse ' + row.name} onPress={() => chooseSchool(row)} style={styles.row}>
          <Ionicons name="school-outline" size={18} color={colors.primary} /><View style={styles.rowText}><Text style={styles.rowTitle}>{row.name}</Text><Text style={styles.caption}>{[row.city, row.region, row.division].filter(value => value?.trim()).join(' · ') || 'School details not recorded'}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}</View>}
      {kind === 'teams' && <>
        {current.items.length > 0 && current.hasMore && <Text style={styles.caption}>More records may contain other teams. Load more to continue browsing.</Text>}
        {groups.length > 0 && <View style={styles.list}>{groups.map(label => <Pressable key={label} accessibilityRole="button" accessibilityLabel={'Browse team ' + label} onPress={() => chooseTeam(label)} style={styles.row}>
          <Ionicons name="people-outline" size={18} color={colors.primary} /><View style={styles.rowText}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.caption}>{rosterRows.filter(row => row.team === label).length + ' in loaded roster'}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>)}</View>}
        {unassigned.length > 0 && <><Text style={styles.section}>Team not recorded</Text><View style={styles.list}>{unassigned.map(playerRow)}</View></>}
      </>}
      {kind === 'roster' && rosterRows.length > 0 && <View style={styles.list}>{rosterRows.map(playerRow)}</View>}
      {current.error && <View style={styles.message}><Text style={styles.body} accessibilityRole="alert">{current.error}</Text>{current.repairSchool
        ? <KitButton label="Choose school again" onPress={() => { if (validAction()) returnToSchools(true); }} variant="secondary" size="sm" />
        : <KitButton label="Retry" accessibilityLabel="Retry directory read" onPress={() => { if (validAction()) void load(current.retryOffset, current.retryAppend); }} variant="secondary" size="sm" disabled={busy} />}</View>}
      {!busy && !current.error && stored.key === key && current.items.length === 0 && <View style={styles.message}><Text style={styles.section}>{kind === 'schools' ? 'No schools found' : 'No matching roster entries'}</Text><Text style={styles.body}>{kind === 'schools' ? 'Try another school name or clear the search.' : 'Try another name. School or team labels may still need updating.'}</Text></View>}
      {current.hasMore && <KitButton label="Load more" accessibilityLabel="Load more directory records" onPress={() => { if (validAction() && current.nextOffset !== null) void load(current.nextOffset, true); }} variant="secondary" disabled={busy} />}
      <Text style={styles.caption}>Roster entries do not confirm account ownership or verification.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }, content: { flexGrow: 1, padding: 16, gap: 12 }, back: { alignSelf: 'flex-start', maxWidth: '100%' },
  title: { ...TYPE.title, ...DISPLAY_TEXT, color: colors.text }, body: { ...TYPE.body, ...figtree('400'), color: colors.text },
  caption: { ...TYPE.caption, ...figtree('400'), color: colors.textMuted, flexShrink: 1 }, section: { ...TYPE.section, ...figtree('700'), color: colors.text },
  searchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, input: { ...TYPE.body, ...figtree('400'), color: colors.text, flexGrow: 1, flexBasis: 160, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: KIT.controlRadius, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface },
  tools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  list: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, overflow: 'hidden' }, row: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 10, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowText: { flex: 1, minWidth: 0, gap: 3 }, rowTitle: { ...TYPE.body, ...figtree('700'), color: colors.text }, message: { padding: 14, gap: 10, borderRadius: radii.md, backgroundColor: colors.surface },
});
