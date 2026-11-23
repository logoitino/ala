/**
 * Existing school/roster discovery (UX-17): bounded public identity pages, never demonstration data or account enumeration.
 * School/team text is an association for display, not a membership FK, consent record or verification decision.
 * @sideEffects Public SELECT of existing schools_and_teams/players columns; no writes, subscriptions or credential storage.
 */
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type DirectorySchool = { id: string; name: string; mascot: string | null; level: string | null; division: string | null; region: string | null; city: string | null };
export type DirectoryPlayer = { id: string; name: string; jerseyNumber: number | null; position: string | null; schoolName: string; team: string | null };
export type DirectoryPage<T> = { items: T[]; hasMore: boolean; nextOffset: number | null };
export type DirectoryPageOptions = { search?: string; offset?: number; limit?: number };
export type DirectoryRosterOptions = DirectoryPageOptions & { schoolId: string; schoolName: string; team?: string | null };

const SCHOOL_COLUMNS = 'id,name,mascot,level,division,region,city';
const ROSTER_COLUMNS = 'id,name,jersey_number,position,school_name,team';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable = () => new Error('School directory is unavailable. Please retry.');
function requireConfigured() { if (!isSupabaseConfigured) throw unavailable(); }
function requireId(id: string) { if (typeof id !== 'string' || !UUID.test(id)) throw unavailable(); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw unavailable();
  return value as Record<string, unknown>;
}
function nullableText(value: unknown): string | null {
  if (value === null || typeof value === 'string') return value;
  throw unavailable();
}
function schoolRow(value: unknown): DirectorySchool {
  const row = object(value);
  if (typeof row.id !== 'string' || !UUID.test(row.id) || typeof row.name !== 'string' || !row.name.trim()) throw unavailable();
  // Legacy catalog metadata can be NULL; keep the identity and explicit unknowns rather than inventing affiliations.
  return { id: row.id, name: row.name, mascot: nullableText(row.mascot), level: nullableText(row.level), division: nullableText(row.division), region: nullableText(row.region), city: nullableText(row.city) };
}
function rosterRow(value: unknown, schoolName: string, team?: string | null): DirectoryPlayer {
  const row = object(value);
  const position = nullableText(row.position); const rowTeam = nullableText(row.team);
  if (typeof row.id !== 'string' || !UUID.test(row.id) || typeof row.name !== 'string' || !row.name.trim()
    || (row.jersey_number !== null && (typeof row.jersey_number !== 'number' || !Number.isSafeInteger(row.jersey_number)))
    || row.school_name !== schoolName || (team !== undefined && rowTeam !== team)) throw unavailable();
  return { id: row.id, name: row.name, jerseyNumber: row.jersey_number as number | null, position, schoolName, team: rowTeam };
}
function pageOptions(options: DirectoryPageOptions) {
  const offset = options.offset ?? 0; const limit = options.limit ?? 20; const search = options.search ?? '';
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 40
    || !Number.isSafeInteger(offset + limit) || typeof search !== 'string' || search.length > 100) throw unavailable();
  return { offset, limit, search: search.trim() };
}
function pattern(search: string) { return '%' + search.replace(/[\\%_]/g, (character) => '\\' + character) + '%'; }
function page<T>(rows: T[], offset: number, limit: number): DirectoryPage<T> {
  // The extra row proves only that this filtered page has a continuation, not how many teams/accounts exist.
  const hasMore = rows.length > limit;
  return { items: rows.slice(0, limit), hasMore, nextOffset: hasMore ? offset + limit : null };
}

/** @purpose Read one current public catalog identity by UUID, preserving unavailable versus missing. */
export async function getDirectorySchool(schoolId: string, client: typeof supabase = supabase): Promise<DirectorySchool | null> {
  requireConfigured(); requireId(schoolId);
  const { data, error } = await client.from('schools_and_teams').select(SCHOOL_COLUMNS).eq('id', schoolId).maybeSingle();
  if (error) throw error;
  if (data === null) return null;
  const row = schoolRow(data);
  if (row.id !== schoolId) throw unavailable();
  return row;
}

/** @purpose Public catalog name search, ordered pages of at most 40 identities plus one continuation sentinel. */
export async function listDirectorySchools(options: DirectoryPageOptions = {}, client: typeof supabase = supabase): Promise<DirectoryPage<DirectorySchool>> {
  requireConfigured();
  const { search, offset, limit } = pageOptions(options);
  let query = client.from('schools_and_teams').select(SCHOOL_COLUMNS);
  if (search) query = query.ilike('name', pattern(search));
  const { data, error } = await query.order('name').order('id').range(offset, offset + limit);
  if (error) throw error;
  if (!Array.isArray(data) || data.length > limit + 1) throw unavailable();
  return page(data.map(schoolRow), offset, limit);
}

/**
 * @purpose Read a bounded roster page matching the exact current school name and optional raw team label.
 * @param options Canonical catalog UUID/name pair; team null matches SQL NULL, while omitted team reads all labels.
 * @returns Public roster identities only. Team groups/counts must describe loaded rows, not the entire directory.
 */
export async function listDirectoryRoster(options: DirectoryRosterOptions, client: typeof supabase = supabase): Promise<DirectoryPage<DirectoryPlayer>> {
  requireConfigured(); requireId(options.schoolId);
  const { search, offset, limit } = pageOptions(options);
  if (typeof options.schoolName !== 'string' || !options.schoolName.trim()
    || (options.team !== undefined && options.team !== null && typeof options.team !== 'string')) throw unavailable();
  const school = await getDirectorySchool(options.schoolId, client);
  if (!school || school.name !== options.schoolName) throw new Error('School association changed. Choose the current school and retry.');
  let query = client.from('players').select(ROSTER_COLUMNS).eq('school_name', school.name);
  if (options.team === null) query = query.is('team', null);
  else if (options.team !== undefined) query = query.eq('team', options.team);
  if (search) query = query.ilike('name', pattern(search));
  const { data, error } = await query.order('name').order('id').range(offset, offset + limit);
  if (error) throw error;
  if (!Array.isArray(data) || data.length > limit + 1) throw unavailable();
  return page(data.map((row) => rosterRow(row, school.name, options.team)), offset, limit);
}
