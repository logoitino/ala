#!/usr/bin/env node
/** Share CI's client credential check locally; report paths and lines without echoing matched secrets. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directories = ['apps/mobile/src/frontend', 'apps/admin-portal/app', 'apps/admin-portal/components', 'apps/admin-portal/lib'];
const problems = [];
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', '.expo'].includes(entry.name)) scan(absolute);
    } else if (entry.isFile()) {
      fs.readFileSync(absolute, 'utf8').split('\n').forEach((line, index) => {
        if (/sk_test_|sk_live_|service_role/.test(line)) problems.push(`${path.relative(root, absolute)}:${index + 1}`);
      });
    }
  }
}
for (const directory of directories) scan(path.join(root, directory));
if (problems.length) {
  console.error(`security:client-keys failed: backend credential markers in client-facing files:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('security:client-keys ok');
