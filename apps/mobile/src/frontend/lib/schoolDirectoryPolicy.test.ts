/** Source-policy regression: public browsing stays public while catalog mutations require the existing real-admin role. No SQL is applied. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const canonical = readFileSync(resolve(__dirname, '../../backend/db/schema.sql'), 'utf8');
function policy(sql: string) {
  const replacements = [...sql.matchAll(/create policy "Admin write schools and teams"\s+on public\.schools_and_teams for all\s+using \(([\s\S]*?)\)\s+with check \(([\s\S]*?)\);/gi)].map((match) => ({ at: match.index, using: match[1], check: match[2], dynamic: false }));
  // Complete canonical replay replaces the historical anon branch through this table-name loop.
  // Reading only the first literal CREATE POLICY produced a false alarm; include the actual template/arguments.
  for (const loop of sql.matchAll(/foreach t in array array\[([^\]]*)\] loop([\s\S]*?)end loop;/gi)) {
    if (!loop[1].includes("'schools_and_teams'")) continue;
    const template = loop[2].match(/create policy %I on public\.%I for all using \((.*?)\) with check \((.*?)\)'/);
    const argumentsMatch = loop[2].match(/'Admin write '\s*\|\|\s*replace\(t, '_', ' '\), t, '([^']+)', '([^']+)'/);
    if (!template || !argumentsMatch || !loop[2].includes('drop policy if exists %I')) throw new Error('Unknown dynamic catalog policy; review the full SQL before claiming access proof.');
    replacements.push({ at: loop.index, using: template[1].replace('%L', "'" + argumentsMatch[1] + "'"), check: template[2].replace('%L', "'" + argumentsMatch[2] + "'"), dynamic: true });
  }
  return replacements.sort((a, b) => a.at - b.at).at(-1);
}
function permits(expression: string, authRole: string, currentRole: string) {
  const reduced = expression.replace(/auth\.role\(\)/g, "'" + authRole + "'").replace(/public\.current_user_role\(\)/g, "'" + currentRole + "'");
  return reduced.split(/\s+or\s+/i).some((clause) => {
    const equality = clause.trim().match(/^'([^']*)'\s*=\s*'([^']*)'$/);
    if (!equality) throw new Error('Unsupported policy expression: extend the source-policy evaluator before claiming proof.');
    return equality[1] === equality[2];
  });
}
it.each([['anon', 'guest'], ['authenticated', 'fan'], ['authenticated', 'athlete'], ['authenticated', 'operator'], ['authenticated', 'booster']])('canonical catalog rejects %s/%s writes in both existing-row and new-row checks', (auth, role) => {
  const match = policy(canonical); expect(match).toBeTruthy();
  expect(permits(match!.using, auth, role)).toBe(false); expect(permits(match!.check, auth, role)).toBe(false);
});
it('retains legitimate admin mutation checks and public browsing through the final effective policy', () => {
  const match = policy(canonical)!;
  expect(match.dynamic).toBe(true);
  expect(permits(match.using, 'authenticated', 'admin')).toBe(true); expect(permits(match.check, 'authenticated', 'admin')).toBe(true);
  expect(canonical).toMatch(/grant select \(id, name, mascot, level, division, region, city, created_at, malo_frozen\)\s+on public\.schools_and_teams to anon, authenticated;/i);
  expect(canonical).toMatch(/on public\.schools_and_teams for select\s+using \(true\)/i);
  expect(canonical).toMatch(/grant execute on function public\.search_schools_and_teams\(text\) to anon, authenticated;/i);
});
it('demonstrates why a historical literal policy is insufficient evidence of effective access', () => {
  const beforeFinalReplacement = canonical.slice(0, canonical.indexOf("foreach t in array array['cheer_polls', 'schools_and_teams'"));
  expect(permits(policy(beforeFinalReplacement)!.using, 'anon', 'guest')).toBe(true);
  expect(permits(policy(canonical)!.using, 'anon', 'guest')).toBe(false);
});
