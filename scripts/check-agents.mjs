/**
 * Checks that the specialist roster, agent files, and team documentation agree.
 * This reads local project metadata only; it never dispatches or deploys agents.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const fail = (message) => problems.push(message);
const registry = JSON.parse(fs.readFileSync(path.join(root, '.claude/agents/registry.json'), 'utf8'));
if (registry.version !== 1 || !Array.isArray(registry.agents)) {
  throw new Error('Agent registry must have version 1 and an agents array.');
}
const docs = ['docs/agents/TEAMS.md', 'docs/agents/TEAM_HIERARCHY.md'].map((file) => ({
  file, source: fs.readFileSync(path.join(root, file), 'utf8'),
}));
const allowedModels = new Set([
  'claude-fable-5-1-thinking-high',
  'claude-opus-5-5-medium',
  'claude-sonnet-5-5-high',
  'claude-sonnet-5-thinking-high',
  'composer-2.5-fast',
  'cursor-grok-4.6-high-fast',
  'gemini-3.8-flash-high',
  'gpt-5.6-sol-medium',
  'grok-4.7-medium',
]);
const calls = new Map();
const files = new Set();
for (const agent of registry.agents) {
  if (typeof agent.call !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(agent.call)) {
    fail(`Invalid call name: ${agent.call}`);
  }
  if (calls.has(agent.call)) fail(`Duplicate call: ${agent.call}`);
  calls.set(agent.call, agent);
  if (typeof agent.file !== 'string' || !/^\.claude\/agents\/[a-z0-9-]+\.md$/.test(agent.file)) {
    fail(`${agent.call}: invalid agent file`);
    continue;
  }
  if (files.has(agent.file)) fail(`Duplicate agent file: ${agent.file}`);
  files.add(agent.file);
  const absolute = path.join(root, agent.file);
  if (!fs.existsSync(absolute)) {
    fail(`${agent.call}: missing ${agent.file}`);
  } else {
    const source = fs.readFileSync(absolute, 'utf8');
    const metadata = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const name = metadata?.[1].match(/^name:\s*(\S+)\s*$/m)?.[1];
    if (name !== path.basename(agent.file, '.md')) fail(`${agent.call}: frontmatter name must match file`);
    if (!metadata?.[1].match(/^description:\s*\S/m)) fail(`${agent.call}: missing description`);
    if (!metadata?.[1].match(/^tools:\s*\S/m)) fail(`${agent.call}: missing tools`);
    const model = metadata?.[1].match(/^model:\s*(\S+)\s*$/m)?.[1];
    if (!allowedModels.has(model)) fail(`${agent.call}: model must be a connected Cursor model id`);
    if (agent.model !== model) fail(`${agent.call}: registry model does not match the agent file`);
    if (!metadata?.[1].match(/^force-default-model:\s*true\s*$/m)) fail(`${agent.call}: missing force-default-model`);
    if (!source.includes('docs/agents/EXPERT_STANDARDS.md')) fail(`${agent.call}: missing expert standard`);
    if (!source.includes('docs/STATE.md')) fail(`${agent.call}: missing current-state instruction`);
  }
  if (typeof agent.department !== 'string' || !agent.department.trim()) fail(`${agent.call}: missing department`);
  for (const key of ['owns', 'tasks']) {
    if (!Array.isArray(agent[key]) || agent[key].length === 0 || agent[key].some((value) => typeof value !== 'string' || !value.trim())) {
      fail(`${agent.call}: ${key} must be a nonempty string array`);
    }
  }
  for (const owned of Array.isArray(agent.owns) ? agent.owns : []) {
    if (typeof owned !== 'string') continue;
    const absoluteOwned = path.resolve(root, owned);
    if (!absoluteOwned.startsWith(`${root}${path.sep}`) || !fs.existsSync(absoluteOwned)) {
      fail(`${agent.call}: ownership path does not exist inside project: ${owned}`);
    }
  }
  for (const doc of docs) {
    if (!doc.source.includes(`\`${agent.call}\``)) fail(`${doc.file}: missing call ${agent.call}`);
    if (!doc.source.includes(agent.file)) fail(`${doc.file}: missing agent path ${agent.file}`);
  }
}
for (const agent of registry.agents) {
  const seen = new Set([agent.call]);
  let lead = agent.lead;
  while (lead !== 'FACILITATOR') {
    if (!calls.has(lead)) { fail(`${agent.call}: unknown lead ${lead}`); break; }
    if (seen.has(lead)) { fail(`${agent.call}: reporting cycle at ${lead}`); break; }
    seen.add(lead);
    lead = calls.get(lead).lead;
  }
}
for (const file of fs.readdirSync(path.join(root, '.claude/agents'))) {
  if (file.endsWith('.md') && !['README.md', 'OPERATING_CONTRACT.md'].includes(file) && !files.has(`.claude/agents/${file}`)) {
    fail(`Unregistered agent file: ${file}`);
  }
}
if (problems.length > 0) {
  console.error(`agents:check failed (${problems.length} issues):\n${problems.map((issue) => `- ${issue}`).join('\n')}`);
  process.exit(1);
}
console.log(`agents:check ok (${calls.size} agents; files, ownership paths, reporting graph, and team docs agree)`);
