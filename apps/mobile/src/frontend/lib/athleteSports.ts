/** Profile-owned sport participation uses atomic revision checks; privacy denial returns null and unavailable
 * source never causes a lossy single-sport retry. Confirmations are validated before any caller replaces its draft. */
import { callRpc } from '@/lib/rpc';
import { telemetry } from '@/services/TelemetryManager';
export type AthleteSportEntry = { sport: string; schoolId: string | null; teamName: string | null; position: string; jersey: string };
export type AthleteSportsSnapshot = { profileId: string; primarySport: string | null; revision: number; sports: AthleteSportEntry[] };
export type AdminAthleteSportsProfile = AthleteSportsSnapshot & { fullName: string; username: string | null; playerId: string | null };
const invalid = () => new Error('Could not confirm this athlete’s sports. Reload before saving.');
const nullableText = (v: unknown): v is string | null => v === null || typeof v === 'string';
function snapshot(raw: unknown): AthleteSportsSnapshot {
  if (!raw || typeof raw !== 'object') throw invalid();
  const r = raw as Record<string, unknown>;
  if (typeof r.profile_id !== 'string' || !r.profile_id || !nullableText(r.primary_sport)
    || !Number.isSafeInteger(r.revision) || Number(r.revision) < 0 || !Array.isArray(r.sports) || r.sports.length > 16) throw invalid();
  const sports: AthleteSportEntry[] = r.sports.map((rawEntry: unknown) => {
    if (!rawEntry || typeof rawEntry !== 'object') throw invalid();
    const e = rawEntry as Record<string, unknown>;
    if (typeof e.sport !== 'string' || !e.sport.trim() || !nullableText(e.school_id) || !nullableText(e.team_name)
      || typeof e.position !== 'string' || typeof e.jersey !== 'string') throw invalid();
    return { sport:e.sport, schoolId:e.school_id, teamName:e.team_name, position:e.position, jersey:e.jersey };
  });
  if (new Set(sports.map(e => e.sport.toLowerCase())).size !== sports.length
    || (r.primary_sport === null ? sports.length > 0 : !sports.some(e => e.sport === r.primary_sport))) throw invalid();
  return { profileId:r.profile_id, primarySport:r.primary_sport, revision:Number(r.revision), sports };
}
/** Failure observation uses the existing bounded issue queue and never includes identity or caller text. */
async function observed<T>(code: string, work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    const fixed = error instanceof Error && error.message.includes('ATHLETE_SPORTS_REVISION_CONFLICT')
      ? 'athlete_sports_revision_conflict' : code;
    try { telemetry.trackIssue(fixed, 'profile'); } catch { /* Observation failure must preserve the original error. */ }
    throw error;
  }
}
function normalizedEntry(entry: AthleteSportEntry): AthleteSportEntry {
  return { sport:entry.sport.trim().toLowerCase(), schoolId:entry.schoolId || null,
    teamName:entry.teamName?.trim() || null, position:entry.position.trim(), jersey:entry.jersey.trim() };
}
function sameEntries(a: AthleteSportEntry[], b: AthleteSportEntry[]): boolean {
  const encode = (entries: AthleteSportEntry[]) => JSON.stringify(entries.map(normalizedEntry).sort((x,y) => x.sport.localeCompare(y.sport)));
  return encode(a) === encode(b);
}
/** Read only the scope authorized by the server. Missing source throws the shared unavailable message. */
export async function fetchAthleteSports(profileId?: string | null): Promise<AthleteSportsSnapshot | null> {
  return observed('athlete_sports_read_failed', async () => {
    const raw = await callRpc('get_athlete_sports', { p_profile_id:profileId ?? null });
    if(raw===null)return null;
    const result=snapshot(raw);
    if(profileId && result.profileId!==profileId)throw invalid();
    return result;
  });
}
/** Replace the complete list only when its revision still matches, accepting only a fresh confirmed snapshot. */
export async function saveAthleteSports(profileId: string, primarySport: string, sports: AthleteSportEntry[], expectedRevision: number): Promise<AthleteSportsSnapshot> {
  if (!profileId || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || sports.length < 1 || sports.length > 16
    || !sports.some(e => e.sport.trim().toLowerCase() === primarySport.trim().toLowerCase()) || new Set(sports.map(e => e.sport.trim().toLowerCase())).size !== sports.length) throw invalid();
  return observed('athlete_sports_save_failed', async () => {
  const result = snapshot(await callRpc('set_athlete_sports', { p_profile_id:profileId, p_primary_sport:primarySport,
    p_sports:sports.map(e => ({sport:e.sport, school_id:e.schoolId, team_name:e.teamName, position:e.position, jersey:e.jersey})), p_expected_revision:expectedRevision }));
  if (result.profileId !== profileId || result.revision !== expectedRevision + 1 || result.sports.length === 0
    || result.primarySport?.trim().toLowerCase() !== primarySport.trim().toLowerCase() || !sameEntries(result.sports, sports)) throw invalid();
  return result;
  });
}
/** Protected bounded search includes unverified athletes without requiring a roster/player association. */
export async function fetchAdminAthleteSports(query: string): Promise<AdminAthleteSportsProfile[]> {
  return observed('athlete_sports_admin_read_failed', async () => {
  const raw = await callRpc('admin_list_athlete_sports', { p_search:query.trim().slice(0, 100), p_limit:40 });
  if (!Array.isArray(raw) || raw.length > 40) throw invalid();
  return raw.map(r => {
    if (typeof r.full_name !== 'string' || !nullableText(r.username) || !nullableText(r.player_id)) throw invalid();
    return {...snapshot(r), fullName:r.full_name, username:r.username, playerId:r.player_id};
  });
  });
}

export type AdminHighlightSport = { id:string; sport:string|null };
function highlightSnapshot(raw:unknown,id:string,expectedSport?:string|null):AdminHighlightSport {
 if(!raw || typeof raw!=='object')throw invalid();
 const row=raw as Record<string,unknown>;
 if(row.id!==id || !nullableText(row.sport) || (expectedSport!==undefined && row.sport!==expectedSport))throw invalid();
 return {id,sport:row.sport};
}
/** Read a single protected Highlight annotation for correction, without requesting unrelated clip fields. */
export async function fetchAdminHighlightSport(id:string):Promise<AdminHighlightSport> {
 return observed('athlete_sports_admin_read_failed',async()=>highlightSnapshot(await callRpc('admin_get_highlight_sport',{p_reel_id:id}),id));
}
/** Correct one recorded annotation only if the original annotation still matches, including legacy null. */
export async function saveAdminHighlightSport(id:string,sport:string|null,expectedSport:string|null):Promise<AdminHighlightSport> {
 const next=sport?.trim()||null;
 return observed('athlete_sports_save_failed',async()=>highlightSnapshot(await callRpc('admin_set_highlight_sport',{p_reel_id:id,p_sport:next,p_expected_sport:expectedSport}),id,next));
}
