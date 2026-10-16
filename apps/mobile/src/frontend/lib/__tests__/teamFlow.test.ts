/** The admin flow diagram must use actual ownership/references and expose missing or cyclic links. */
import { flowForSource, teamReportingChain } from '@tapuai/shared-types/admin/teamFlow';

const topology = {
  version: 1, basis: 'Static references, not hosted verification.',
  roles: [
    { id: 'CTO', lead: 'FACILITATOR', department: 'Leadership', paths: [] },
    { id: 'ENGINEERING', lead: 'CTO', department: 'Engineering', paths: ['apps/mobile'] },
    { id: 'ADMIN', lead: 'ENGINEERING', department: 'Engineering', paths: ['apps/mobile/src/frontend/components/Admin'] },
    { id: 'SUPPORT', lead: 'ENGINEERING', department: 'Engineering support', paths: ['apps/mobile/src/frontend/lib/feedback.ts'] },
  ],
  sources: [{ name: 'app_feedback', kind: 'table', owner: 'SUPPORT', purpose: 'User-reported issues', writers: ['apps/mobile/src/frontend/lib/feedback.ts'], readers: ['apps/mobile/src/frontend/components/Admin/FeedbackTool.tsx'], sqlWriters: [], sqlReaders: [], removers: [], triggers: [], screens: ['apps/mobile/app/(admin)/admin/feedback.tsx'] }],
  functions: [],
};

it('matches the most specific actual owner for each reference', () => {
  const flow = flowForSource(topology, 'app_feedback');
  expect(flow?.writers[0].team).toBe('SUPPORT');
  expect(flow?.readers[0].team).toBe('ADMIN');
  expect(flow?.owner).toBe('SUPPORT');
  expect(flow?.hostedVerified).toBe(false);
});

it('does not invent writers or readers when the map has none', () => {
  const flow = flowForSource({ ...topology, sources: [{ ...topology.sources[0], writers: [], readers: [] }] }, 'app_feedback');
  expect(flow?.writers).toEqual([]);
  expect(flow?.readers).toEqual([]);
  expect(flow?.gaps).toEqual(['No writer found in the source map', 'No reader found in the source map']);
  expect(flowForSource(topology, 'missing')).toBeNull();
});

it('records SQL writer/reader ownership from the same function map', () => {
  const flow = flowForSource({ ...topology, sources: [{ ...topology.sources[0], sqlReaders: ['read_feedback'] }], functions: [{ name: 'read_feedback', owner: 'ADMIN', callers: [], reads: ['app_feedback'], writes: [] }] }, 'app_feedback');
  expect(flow?.readers.find(ref => ref.reference === 'read_feedback')?.team).toBe('ADMIN');
});

it('shows a team reporting chain without looping or fabricating a missing leader', () => {
  expect(teamReportingChain(topology, 'SUPPORT')).toEqual({ roles: ['SUPPORT', 'ENGINEERING', 'CTO', 'FACILITATOR'], issue: null });
  expect(teamReportingChain({ ...topology, roles: [{ ...topology.roles[3], lead: 'SUPPORT' }] }, 'SUPPORT').issue).toBe('Reporting cycle detected');
  expect(teamReportingChain(topology, 'MISSING').issue).toBe('Unregistered team');
});
