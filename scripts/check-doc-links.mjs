#!/usr/bin/env node
/** Check local Markdown destinations after folder moves; archived reference code has its own layout. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root })
  .toString().split('\0').filter((file) => file.endsWith('.md') && !file.startsWith('archive/'));
const problems = [];
for (const file of new Set(files)) {
  if (!fs.existsSync(path.join(root, file))) continue;
  // Code samples contain illustrative paths rather than documentation navigation.
  const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, '');
  const destinations = [
    ...source.matchAll(/\]\((<[^>]+>|(?:[^()\s]|\([^()]*\))+)(?:\s+"[^"]*")?\)/g),
    ...source.matchAll(/^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm),
  ];
  for (const match of destinations) {
    const destination = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(destination)) continue;
    let target;
    try { target = decodeURIComponent(destination.split(/[?#]/)[0]); }
    catch { problems.push(`${file}: invalid URL encoding in ${destination}`); continue; }
    if (!target) continue;
    const absolute = target.startsWith('/') ? path.join(root, target) : path.resolve(root, path.dirname(file), target);
    if (!fs.existsSync(absolute)) problems.push(`${file}: missing ${destination}`);
  }
}
if (problems.length) {
  console.error(`docs:links failed:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  process.exit(1);
}
console.log(`docs:links ok (${new Set(files).size} active Markdown files; local file destinations only)`);
