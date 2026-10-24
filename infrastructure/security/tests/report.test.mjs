/** Adversarial source/report fixtures verify accountable coverage and privacy without hosted security claims. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { inspectSecurity, updateSecurityReport, renderSecurityReport, GUARDS, OPERATIONS } from '../report.mjs';
import { securityReviewers } from '../routing.mjs';
import { refreshMap } from '../../exit/sync.mjs';

const security = ['INFRA_SECURITY','SUPPLY_CHAIN_SECURITY','RECOVERY_SECURITY','RLS_SECURITY','SESSION_SECURITY','THREAT_DETECTION'];
async function fixture(run) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tapuai-security-report-')));
  const put = async (file,value) => { await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true}); await fs.writeFile(path.join(root,file),typeof value==='string'?value:JSON.stringify(value)); };
  const registry = {version:1,agents:[...security.map(call=>({call,department:'Security',lead:'SECURITY',file:`.claude/agents/${call.toLowerCase().replaceAll('_','-')}.md`})),{call:'SECURITY',department:'Security',lead:'CTO',file:'.claude/agents/security.md'},{call:'CTO',department:'Office of the CTO',lead:'FACILITATOR',file:'.claude/agents/cto.md'},{call:'EXIT_CLOUD',department:'Engineering',lead:'CTO',file:'.claude/agents/exit-cloud.md'},{call:'INFRASTRUCTURE',department:'Engineering',lead:'CTO',file:'.claude/agents/infrastructure.md'}]};
  const controls={schemaVersion:1,serviceReviewers:{fixture:['INFRA_SECURITY']},componentReviewers:{network:['INFRA_SECURITY']},guards:Object.keys(GUARDS).map(id=>({id,evidence:[`scripts/${id}.mjs`]})),operationalReviewers:Object.fromEntries(Object.keys(OPERATIONS).map(id=>[id,['INFRA_SECURITY']]))};
  const config={services:[{id:'fixture'}]};
  const mapping={components:[{id:'network',owner:'EXIT_CLOUD',with:['INFRA_SECURITY']}]};
  try {
    await put('.claude/agents/registry.json',registry);
    for(const role of registry.agents)await put(role.file,'<!-- Synthetic role source. -->\n');
    await put('docs/engineering/infrastructure.json',config);
    await put('docs/engineering/exit/exit-map.json',mapping);
    await put('infrastructure/security/controls.json',controls);
    await put('package.json',{scripts:{...Object.fromEntries(Object.values(GUARDS).map(command=>[command,'node scripts/fixture.mjs'])),'security:infra:test':'node --test infrastructure/security/tests/*.test.mjs','security:infra:check':'node infrastructure/security/report.mjs --check',check:[...Object.values(GUARDS),'security:infra:test','security:infra:check'].map(s=>`pnpm ${s}`).join(' && ')}});
    for(const guard of controls.guards)await put(guard.evidence[0],'// Synthetic bounded source guard.\n');
    await put('apps/mobile/src/backend/db/schema.sql','create table public.fixture(id int);');
    await put('apps/mobile/src/frontend/lib/fixture.ts','export const amount=1;');
    await run({root,put,registry,controls,config,mapping});
  }finally{await fs.rm(root,{recursive:true,force:true});}
}

test('complete local governance stays explicitly unaccepted operationally',()=>fixture(async({root})=>{
  const report=inspectSecurity(root);
  assert.equal(report.structuralStatus,'current');assert.deepEqual(report.issues,[]);
  assert.equal(report.operationalAcceptance,false);assert.equal(report.readyToCutOver,false);assert.equal(report.providerContacted,false);
  assert.equal(report.securityStatus,'not-established');
  assert.ok(report.localGuards.every(g=>g.status==='source-linked'&&g.executed===false));
  assert.ok(report.operations.every(o=>o.status==='not-verified'));
}));

test('new service and exit component require explicit Security partners',()=>fixture(async({root,put,config,mapping})=>{
  config.services.push({id:'new-provider'});mapping.components.push({id:'new-edge',owner:'EXIT_CLOUD',with:[]});
  await put('docs/engineering/infrastructure.json',config);await put('docs/engineering/exit/exit-map.json',mapping);
  const report=inspectSecurity(root);
  assert.equal(report.structuralStatus,'needs-attention');
  assert.ok(report.issues.includes('uncovered-service:new-provider'));assert.ok(report.issues.includes('uncovered-component:new-edge'));
}));

test('Security reporting or counterpart removal cannot remain current',()=>fixture(async({root,put,registry,mapping})=>{
  registry.agents.find(a=>a.call==='RECOVERY_SECURITY').lead='EXIT_CLOUD';mapping.components[0].with=[];
  await put('.claude/agents/registry.json',registry);await put('docs/engineering/exit/exit-map.json',mapping);
  const report=inspectSecurity(root);
  assert.ok(report.issues.includes('invalid-security-role:RECOVERY_SECURITY'));assert.ok(report.issues.includes('component-reviewer-not-routed:network:INFRA_SECURITY'));
}));

test('missing operational coverage or regression guard fails local governance',()=>fixture(async({root,put,controls})=>{
  delete controls.operationalReviewers['secret-custody'];controls.guards.shift();
  await put('infrastructure/security/controls.json',controls);
  const report=inspectSecurity(root);assert.ok(report.issues.includes('missing-operation:secret-custody'));assert.ok(report.issues.includes('missing-guard:client-boundary'));
}));

test('unavailable evidence and full-check removal are explicit',()=>fixture(async({root,put})=>{
  await fs.unlink(path.join(root,'scripts/client-boundary.mjs'));
  const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));pkg.scripts.check='pnpm security:infra:test';await put('package.json',pkg);
  const report=inspectSecurity(root);assert.ok(report.issues.includes('missing-evidence:client-boundary'));assert.ok(report.issues.includes('guard-not-in-full-check:client-boundary'));
}));

for (const missing of ['configuration', 'command', 'full-check inclusion', 'evidence']) {
  test(`only the guard missing ${missing} needs attention in JSON and Markdown`, () => fixture(async ({ root, put, controls }) => {
    const id = 'client-boundary';
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    if (missing === 'configuration') {
      controls.guards = controls.guards.filter(guard => guard.id !== id);
      await put('infrastructure/security/controls.json', controls);
    } else if (missing === 'command') {
      delete pkg.scripts[GUARDS[id]];
      await put('package.json', pkg);
    } else if (missing === 'full-check inclusion') {
      pkg.scripts.check = pkg.scripts.check.split(' && ').filter(command => command !== `pnpm ${GUARDS[id]}`).join(' && ');
      await put('package.json', pkg);
    } else {
      await fs.unlink(path.join(root, `scripts/${id}.mjs`));
    }

    const report = inspectSecurity(root);
    assert.equal(report.structuralStatus, 'needs-attention');
    assert.equal(report.localGuards.find(guard => guard.id === id).status, 'needs-attention');
    assert.ok(report.localGuards.filter(guard => guard.id !== id).every(guard => guard.status === 'source-linked'));
    assert.ok(report.localGuards.every(guard => guard.executed === false));
    assert.equal(report.operationalAcceptance, false);
    assert.equal(report.readyToCutOver, false);
    assert.equal(report.providerContacted, false);
    assert.equal(report.securityStatus, 'not-established');
    assert.ok(report.operations.every(operation => operation.status === 'not-verified'));

    const markdown = renderSecurityReport(report);
    assert.match(markdown, /\| Guard \| Command \| Status \| Source evidence \|/);
    assert.match(markdown, /\| `client-boundary` \| `pnpm security:client-keys` \| needs-attention \|/);
    assert.doesNotMatch(markdown, /Every entry is \*\*source-linked/);
    assert.equal(renderSecurityReport(inspectSecurity(root)), markdown);
    await updateSecurityReport(root);
    assert.equal((await updateSecurityReport(root, { check: true })).current, true);
    assert.equal(await fs.readFile(path.join(root, 'docs/engineering/exit/INFRASTRUCTURE_SECURITY_REPORT.md'), 'utf8'), markdown);
  }));
}

test('unchanged names and Security role/config bodies invalidate a generated report',()=>fixture(async({root,put})=>{
  await updateSecurityReport(root);
  assert.equal((await updateSecurityReport(root,{check:true})).current,true);
  const original=inspectSecurity(root).source.boundHash;
  await put('apps/mobile/src/frontend/lib/fixture.ts','export const amount=2;');
  assert.notEqual(inspectSecurity(root).source.boundHash,original);
  assert.equal((await updateSecurityReport(root,{check:true})).current,false);
  await updateSecurityReport(root);const next=inspectSecurity(root).source.boundHash;
  await put('.claude/agents/infra-security.md','<!-- Revised synthetic role source. -->\n');assert.notEqual(inspectSecurity(root).source.boundHash,next);
}));

test('private env and Terraform data never enter report or change safe hash',()=>fixture(async({root,put})=>{
  const original=inspectSecurity(root);
  for(const file of ['apps/mobile/.env.local','infrastructure/terraform/operator.tfvars','infrastructure/terraform/terraform.tfstate','infrastructure/backup/credentials.json'])await put(file,'SYNTHETIC_PRIVATE_DO_NOT_READ');
  const current=inspectSecurity(root);assert.equal(current.source.boundHash,original.source.boundHash);assert.ok(!JSON.stringify(current).includes('SYNTHETIC_PRIVATE_DO_NOT_READ'));
}));

test('evidence links and private/traversal paths are refused',()=>fixture(async({root,put,controls})=>{
  await fs.symlink(path.join(root,'package.json'),path.join(root,'scripts/linked.mjs'));
  assert.throws(()=>inspectSecurity(root),/symlink/i);
  await fs.unlink(path.join(root,'scripts/linked.mjs'));
  for(const file of ['../outside.json','apps/mobile/.env.local','infrastructure/backup/credentials.json']){
    controls.guards[0].evidence=[file];await put('infrastructure/security/controls.json',controls);assert.throws(()=>inspectSecurity(root),/unsafe-evidence-path/);
  }
}));

test('automatic report refresh is atomic/no-op and never records reviewer acceptance',()=>fixture(async({root})=>{
  const first=await updateSecurityReport(root);assert.equal(first.changed,true);
  const target=path.join(root,'docs/engineering/exit/INFRASTRUCTURE_SECURITY_REPORT.md');const before=await fs.stat(target);
  const next=await updateSecurityReport(root);assert.equal(next.changed,false);assert.equal((await fs.stat(target)).mtimeMs,before.mtimeMs);
  assert.equal(next.report.operationalAcceptance,false);
  await fs.unlink(target);await fs.symlink(path.join(root,'package.json'),target);await assert.rejects(updateSecurityReport(root),/symlink/i);
}));

test('routed source, auth, backup and unknown changes reach independent Security domains',()=>{
  for(const area of ['sourceFingerprints','toolkit','future-area'])for(const role of ['INFRA_SECURITY','SUPPLY_CHAIN_SECURITY','RECOVERY_SECURITY'])assert.ok(securityReviewers(area).includes(role));
  assert.ok(securityReviewers('authMethods').includes('SESSION_SECURITY'));
  assert.ok(securityReviewers('policies').includes('RLS_SECURITY'));
  assert.ok(securityReviewers('buckets').includes('RECOVERY_SECURITY'));
});

test('source refresh invokes Security bookkeeping and preserves unaccepted reviews',()=>fixture(async({root,put})=>{
  await put('scripts/exit-map.mjs','// Synthetic exit writer.\n');
  await put('infrastructure/security/report.mjs',`// Synthetic bounded report writer.\nimport fs from 'node:fs';fs.writeFileSync('docs/engineering/refresh-receipt.md','operationalAcceptance=false');`);
  assert.deepEqual(await refreshMap(root),{outcome:'passed'});
  assert.equal(await fs.readFile(path.join(root,'docs/engineering/refresh-receipt.md'),'utf8'),'operationalAcceptance=false');
  assert.equal(await fs.stat(path.join(root,'docs/agents/EXIT_CHANGE_LOG.md')).catch(()=>null),null);
}));

test('source refresh exposes coverage gaps and rejects hard Security writer failures',()=>fixture(async({root,put})=>{
  await put('scripts/exit-map.mjs','// Synthetic exit writer.\n');
  await put('infrastructure/security/report.mjs',`// Synthetic semantic failure.\nconsole.error('security:infra wrote docs/engineering/exit/INFRASTRUCTURE_SECURITY_REPORT.md with problems: uncovered-service:fixture');process.exit(1);`);
  assert.equal((await refreshMap(root)).outcome,'failed');
  await put('infrastructure/security/report.mjs',`// Synthetic hard refusal.\nconsole.error('security:infra refused invalid, unsafe or changed local inputs');process.exit(2);`);
  await assert.rejects(refreshMap(root));
}));

test('actual report CLI preserves read-only JSON, stale checks, draft failure markers and safe refusals', () => fixture(async ({ root, put, controls }) => {
  // Relocate the real CLI to synthetic inputs while importing the actual inventory and atomic writer.
  const source = await fs.readFile(new URL('../report.mjs', import.meta.url), 'utf8');
  const relocated = source
    .replace("'../../scripts/exit-inventory.mjs'", JSON.stringify(new URL('../../../scripts/exit-inventory.mjs', import.meta.url).href))
    .replace("'../../scripts/exit-map-output.mjs'", JSON.stringify(new URL('../../../scripts/exit-map-output.mjs', import.meta.url).href));
  await put('infrastructure/security/report.mjs', relocated);
  const run = (...args) => {
    const result = spawnSync(process.execPath, ['infrastructure/security/report.mjs', ...args], {
      cwd: root, env: {}, encoding: 'utf8', timeout: 10_000, maxBuffer: 512 * 1024,
    });
    assert.ifError(result.error);
    return result;
  };
  const output = path.join(root, 'docs/engineering/exit/INFRASTRUCTURE_SECURITY_REPORT.md');

  const json = run('--json');
  assert.equal(json.status, 0);
  assert.equal(JSON.parse(json.stdout).structuralStatus, 'current');
  assert.equal(await fs.stat(output).catch(() => null), null);
  const stale = run('--check');
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /security:infra report is stale; run pnpm security:infra/);
  assert.equal(await fs.stat(output).catch(() => null), null);
  assert.equal(run('--write').status, 0);
  assert.equal(run('--check').status, 0);

  controls.guards = controls.guards.filter(guard => guard.id !== 'client-boundary');
  await put('infrastructure/security/controls.json', controls);
  const draft = run('--write');
  assert.equal(draft.status, 1);
  assert.match(draft.stderr, /^security:infra wrote docs\/engineering\/exit\/INFRASTRUCTURE_SECURITY_REPORT\.md with problems: missing-guard:client-boundary\s*$/);
  assert.match(await fs.readFile(output, 'utf8'), /\| `client-boundary` \| `pnpm security:client-keys` \| needs-attention \|/);
  const failedCheck = run('--check');
  assert.equal(failedCheck.status, 1);
  assert.match(failedCheck.stderr, /security:infra coverage failed: missing-guard:client-boundary/);
  const failedJson = run('--json');
  assert.equal(failedJson.status, 1);
  assert.equal(JSON.parse(failedJson.stdout).localGuards.find(guard => guard.id === 'client-boundary').status, 'needs-attention');

  const invalid = run('--json', '--write');
  assert.equal(invalid.status, 2);
  assert.equal(invalid.stdout, '');
  assert.equal(invalid.stderr.trim(), 'security:infra refused invalid, unsafe or changed local inputs');
}));
