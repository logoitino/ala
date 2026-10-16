#!/usr/bin/env node
/**
 * VERIFY-02 (owner 2026-10-14): an earner's Social Security number goes to Stripe only; Tapua'i never stores or asks
 * for one. Fails when code adds an SSN / tax-id field, column or input (ssn, social_security…, socialSecurity…, tax_id…,
 * taxId…), or contains an SSN-shaped literal (123-45-6789). A line that must hold a fake number to test the guards
 * themselves carries `no-ssn-check:` on that line or the line above. Reports paths and lines, never the matched text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['apps/mobile/src', 'apps/mobile/app', 'apps/admin-portal/app', 'apps/admin-portal/components', 'apps/admin-portal/lib',
  'packages/shared-types', 'supabase/functions', 'supabase/migrations'];
const exts = new Set(['.ts', '.tsx', '.js', '.mjs', '.sql']);
const FIELD = /(?<!no-)\b(ssn|ssn_last_?4|social_security\w*|socialSecurity\w*|tax_id\w*|taxId\w*)\b/;
const SHAPE = /\b\d{3}-\d{2}-\d{4}\b/;
const problems = [];

function scan(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      if (!['node_modules', '.next', '.expo'].includes(entry)) scan(path.join(target, entry));
    }
    return;
  }
  if (!exts.has(path.extname(target))) return;
  const lines = fs.readFileSync(target, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (line.includes('no-ssn-check:') || (index > 0 && lines[index - 1].includes('no-ssn-check:'))) return;
    if (FIELD.test(line) || SHAPE.test(line)) problems.push(`${path.relative(root, target)}:${index + 1}`);
  });
}

for (const target of targets) scan(path.join(root, target));
if (problems.length) {
  console.error(`security:no-ssn failed: an SSN or tax-id field, or an SSN-shaped number, appears in code. SSNs go to Stripe only (docs/engineering/design/PAYEE_VERIFICATION_PLAN.md):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('security:no-ssn ok');
