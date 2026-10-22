/**
 * Athlete records on the Athletes desk (DATA-01 F1 and F4): the career stat line and game log that
 * profiles show — which nothing in the app used to write — and the custodial terms (handover age,
 * corrected birth date) that were SQL-Editor only. Shown under "Edit athlete" for the selected athlete.
 * @sideEffects Admin RPCs through `lib/adminControls`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

import { AdminBtn, AdminEmpty, AdminField, AdminFieldRow, AdminNotice, AdminPanel, AdminRow } from '@/components/Admin/AdminChrome';
import { useAdminAction } from '@/hooks/useAdminAction';
import { addGameLog, classifyGameLogSport, fetchAthleteRecords, removeGameLog, saveCareerStats, setCustodialTerms, type AthleteRecords } from '@/lib/adminControls';

const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);
const today = () => new Date().toISOString().slice(0, 10);

/** @purpose Edit one athlete's career stats, game log and custodial terms. */
export function AthleteRecordsPanel({ playerId, name, defaultSport = 'Football' }: { playerId: string; name: string; defaultSport?: string }) {
  const [records, setRecords] = useState<AthleteRecords>({ career: null, logs: [] });
  const [sport, setSport] = useState(defaultSport);
  const [repairSport, setRepairSport] = useState(defaultSport);
  const loadedSport = useRef(defaultSport);
  const [games, setGames] = useState('0');
  const [scoring, setScoring] = useState('0');
  const [volume, setVolume] = useState('0');
  const [mvp, setMvp] = useState('0');
  const [logDate, setLogDate] = useState(today);
  const [opponent, setOpponent] = useState('');
  const [statLine, setStatLine] = useState('');
  const [logScoring, setLogScoring] = useState('0');
  const [logVolume, setLogVolume] = useState('0');
  const [handoverAge, setHandoverAge] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Discards a slow response from an earlier load; the desk also remounts this panel per athlete (key).
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    let next: AthleteRecords;
    try {
      next = await fetchAthleteRecords(playerId, loadedSport.current);
    } catch (caught) {
      if (mine !== generation.current) return;
      setLoaded(false);
      setLoadError(caught instanceof Error ? caught.message : 'Could not read this athlete\'s stats.');
      return;
    }
    if (mine !== generation.current) return;
    setLoadError(null);
    setLoaded(true);
    setRecords(next);
    setSport(loadedSport.current);
    setGames(String(next.career?.gamesPlayed ?? 0));
    setScoring(String(next.career?.scoringValue ?? 0));
    setVolume(String(next.career?.volumeValue ?? 0));
    setMvp(String(next.career?.mvpBadges ?? 0));
  }, [playerId, defaultSport]);
  useEffect(() => { loadedSport.current = defaultSport; setSport(defaultSport); setLoaded(false); void load();
    return () => { generation.current += 1; };
  }, [load, defaultSport]);
  const { busy, message, run } = useAdminAction(load);

  const saveCareer = () => run('career', async () => {
    const values = [games, scoring, volume, mvp].map(whole);
    if (values.some((value) => value == null)) throw new Error('Stats are whole numbers, 0 or more.');
    await saveCareerStats({ playerId, sport: loadedSport.current, gamesPlayed: values[0]!, scoringValue: values[1]!, volumeValue: values[2]!, mvpBadges: values[3]! });
    return `Career stats saved for ${name}.`;
  });
  const addLog = () => run('log', async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) throw new Error('Enter the game date as YYYY-MM-DD.');
    const s = whole(logScoring);
    const v = whole(logVolume);
    if (s == null || v == null) throw new Error('Game stats are whole numbers, 0 or more.');
    await addGameLog({ playerId, sport: loadedSport.current, playedOn: logDate, opponent: opponent.trim(), statLine: statLine.trim(), scoringValue: s, volumeValue: v });
    setOpponent(''); setStatLine(''); setLogScoring('0'); setLogVolume('0');
    return 'Game line added.';
  });
  const saveTerms = () => run('terms', async () => {
    const age = handoverAge.trim() ? whole(handoverAge) : null;
    if (handoverAge.trim() && (age == null || age < 18 || age > 21)) throw new Error('Handover age is 18 to 21 (counsel confirms per state).');
    if (birthDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim())) throw new Error('Enter the birth date as YYYY-MM-DD.');
    if (age == null && !birthDate.trim()) throw new Error('Enter a handover age, a corrected birth date, or both.');
    await setCustodialTerms({ playerId, handoverAge: age, birthDate: birthDate.trim() || null });
    setHandoverAge(''); setBirthDate('');
    return 'Custodial terms updated.';
  });

  return (
    <>
      <AdminPanel title={`Stats · ${name}`}>
        <Text style={{ fontSize: 13 }}>Profiles show this career line and the game log. Until the game-day stat line exists (Wave 3), admins enter them here.</Text>
        {loadError ? <AdminNotice tone="danger" text={`${loadError} Saving is off until the stats are read.`} /> : null}
        <AdminFieldRow>
          <AdminField editable={busy == null} label="Sport" value={sport} onChangeText={(text) => { generation.current += 1; setLoaded(false); setSport(text); }} autoCapitalize="words" />
          <AdminField editable={busy == null} label="Games played" value={games} onChangeText={setGames} keyboardType="number-pad" />
          <AdminField editable={busy == null} label="Scoring total" value={scoring} onChangeText={setScoring} keyboardType="number-pad" />
          <AdminField editable={busy == null} label="Volume total" value={volume} onChangeText={setVolume} keyboardType="number-pad" />
          <AdminField editable={busy == null} label="MVP badges" value={mvp} onChangeText={setMvp} keyboardType="number-pad" />
        </AdminFieldRow>
        <AdminBtn label="Load selected sport" disabled={busy != null || !sport.trim()} onPress={() => { loadedSport.current = sport.trim(); setLoaded(false); void load(); }} />
        <AdminBtn kind="primary" label={busy === 'career' ? 'Saving…' : 'Save career stats'} disabled={busy != null || !loaded} onPress={() => { void saveCareer(); }} />
        <AdminFieldRow>
          <AdminField editable={busy == null} label="Game date (YYYY-MM-DD)" value={logDate} onChangeText={setLogDate} />
          <AdminField editable={busy == null} label="Opponent" value={opponent} onChangeText={setOpponent} autoCapitalize="words" />
          <AdminField editable={busy == null} label="Stat line" value={statLine} onChangeText={setStatLine} autoCapitalize="sentences" placeholder="2 tries, 9 tackles" />
          <AdminField editable={busy == null} label="Scoring" value={logScoring} onChangeText={setLogScoring} keyboardType="number-pad" />
          <AdminField editable={busy == null} label="Volume" value={logVolume} onChangeText={setLogVolume} keyboardType="number-pad" />
        </AdminFieldRow>
        <AdminBtn label={busy === 'log' ? 'Adding…' : 'Add game line'} disabled={busy != null || !loaded} onPress={() => { void addLog(); }} />
        <AdminField editable={busy == null} label="Correct game line sport" value={repairSport} onChangeText={setRepairSport} />
        {(records.unassignedLogs ?? []).map(log => (
          <AdminRow key={log.id} title={`${log.playedOn} · Unassigned sport`} meta={`${log.opponentSchool || 'Opponent not set'} · ${log.statLine || 'No stat line'} · scoring ${log.scoringValue} · volume ${log.volumeValue}`}>
            <AdminBtn label={`Assign sport to ${log.id}`} disabled={busy != null || !loaded || !repairSport.trim()} onPress={() => { void run(log.id, async () => { await classifyGameLogSport(log.id, playerId, repairSport.trim(), null); return 'Original game line assigned.'; }); }} />
          </AdminRow>
        ))}
        {records.logs.length === 0 ? <AdminEmpty text="No game lines yet." /> : null}
        {records.logs.map((log) => (
          <AdminRow key={log.id} title={`${log.playedOn} · ${log.opponentSchool || 'Opponent not set'}`} meta={`${log.statLine || 'No stat line'} · scoring ${log.scoringValue} · volume ${log.volumeValue}`}>
            <AdminBtn label={`Change sport for ${log.id}`} disabled={busy != null || !loaded || !repairSport.trim() || repairSport.trim() === loadedSport.current} onPress={() => { void run(log.id, async () => { await classifyGameLogSport(log.id, playerId, repairSport.trim(), loadedSport.current); return 'Original game line corrected.'; }); }} />
            <AdminBtn kind="danger" label={busy === log.id ? 'Removing…' : 'Remove'} disabled={busy != null} onPress={() => { void run(log.id, async () => { await removeGameLog(log.id); return 'Game line removed.'; }); }} />
          </AdminRow>
        ))}
      </AdminPanel>
      <AdminPanel title={`Custodial terms · ${name}`}>
        <Text style={{ fontSize: 13 }}>When money control passes from the guardian to the athlete. Change only on counsel's advice or a documented birth-date correction.</Text>
        <AdminFieldRow>
          <AdminField editable={busy == null} label="Handover age (18–21)" value={handoverAge} onChangeText={setHandoverAge} keyboardType="number-pad" />
          <AdminField editable={busy == null} label="Corrected birth date (YYYY-MM-DD)" value={birthDate} onChangeText={setBirthDate} />
        </AdminFieldRow>
        <AdminBtn label={busy === 'terms' ? 'Saving…' : 'Update custodial terms'} disabled={busy != null} onPress={() => { void saveTerms(); }} />
      </AdminPanel>
      <AdminNotice text={message?.text ?? null} tone={message?.tone} />
    </>
  );
}
