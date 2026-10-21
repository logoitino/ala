/**
 * Which playing surface to draw behind an athlete or game (UX-08 sport field lines).
 * Matching is by keyword so sports an admin adds on /admin/sports still get a surface; anything
 * unrecognised gets a generic field (outline, halfway line, centre circle) rather than a wrong sport's markings.
 */

export type SportFieldKind =
  | 'gridiron'
  | 'rugby'
  | 'court'
  | 'volleyball'
  | 'tennis'
  | 'pitch'
  | 'diamond'
  | 'track'
  | 'mat'
  | 'rink'
  | 'field';

// Order matters: more specific names first ("Football (Soccer)" is a pitch, "field hockey" is not a rink).
const RULES: Array<[RegExp, SportFieldKind]> = [
  [/field hockey|soccer|lacrosse|futsal/, 'pitch'],
  [/football|gridiron/, 'gridiron'],
  [/rugby/, 'rugby'],
  [/hockey/, 'rink'],
  [/basketball/, 'court'],
  [/volleyball/, 'volleyball'],
  [/tennis|pickleball|badminton/, 'tennis'],
  [/baseball|softball/, 'diamond'],
  [/track|cross country|running|relay/, 'track'],
  [/wrestling|judo|jiu|grappling/, 'mat'],
];

/**
 * @purpose Pick the playing surface for a sport name from the catalog, a profile or a game.
 * @param sport Any sport label (`ATHLETE_SPORTS`, `profiles.athlete_sport`, `games.sport`, admin playbooks).
 * @returns The surface to draw; `field` when the sport is missing or not recognised.
 */
export function sportFieldKind(sport: string | null | undefined): SportFieldKind {
  const name = (sport ?? '').trim().toLowerCase();
  if (!name) return 'field';
  for (const [pattern, kind] of RULES) if (pattern.test(name)) return kind;
  return 'field';
}
