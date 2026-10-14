/** Shared team-flow projection from the Data Governance generator, never live-delivery proof. */
export interface TeamTopology {
  version: number; basis: string;
  roles: { id: string; lead: string | null; department: string; paths: string[] }[];
  sources: { name: string; kind: string; owner: string | null; purpose: string | null; writers: string[]; readers: string[]; sqlWriters: string[]; sqlReaders: string[]; removers: string[]; triggers: string[]; screens: string[] }[];
  functions: { name: string; owner: string | null; callers: string[]; reads: string[]; writes: string[] }[];
}

export function flowForSource(topology: TeamTopology, name: string) {
  const source = topology.sources.find(item => item.name === name);
  if (!source) return null;
  const referenceOwner = (reference: string) => {
    const fn = topology.functions.find(item => item.name === reference);
    if (fn) return fn.owner;
    const path = reference.split(/#|::/)[0];
    return topology.roles.flatMap(role => role.paths.map(prefix => ({ prefix, team: role.id })))
      .filter(item => path === item.prefix || path.startsWith(`${item.prefix}/`))
      .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.team ?? null;
  };
  const project = (references: string[]) => [...new Set(references)].map(reference => ({ reference, team: referenceOwner(reference) }));
  const writers = project([...source.writers, ...source.sqlWriters]);
  const readers = project([...source.readers, ...source.sqlReaders]);
  const gaps: string[] = [];
  if (!writers.length) gaps.push('No writer found in the source map');
  if (!readers.length) gaps.push('No reader found in the source map');
  if ([...writers, ...readers].some(item => !item.team)) gaps.push('Some references have no registered owner');
  return { source: source.name, owner: source.owner, purpose: source.purpose, writers, readers, screens: source.screens, triggers: source.triggers, gaps, hostedVerified: false as const };
}

export function teamReportingChain(topology: TeamTopology, team: string) {
  const roles: string[] = [];
  let current: string | null = team;
  while (current) {
    if (roles.includes(current)) return { roles, issue: 'Reporting cycle detected' };
    const role = topology.roles.find(item => item.id === current);
    if (!role) {
      if (current === 'FACILITATOR' && roles.length) return { roles: [...roles, current], issue: null };
      return { roles, issue: 'Unregistered team' };
    }
    roles.push(current);
    current = role.lead;
  }
  return { roles, issue: null };
}
