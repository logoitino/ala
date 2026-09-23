import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync('apps/mobile/src/backend/db/schema.sql', 'utf8');
const chunks = [];
let buf = '';
let i = 0;

while (i < sql.length) {
  const ch = sql[i];
  const next = sql[i + 1];

  // line comment
  if (ch === '-' && next === '-') {
    const end = sql.indexOf('\n', i);
    const slice = end === -1 ? sql.slice(i) : sql.slice(i, end + 1);
    buf += slice;
    i += slice.length;
    continue;
  }

  // block comment
  if (ch === '/' && next === '*') {
    const end = sql.indexOf('*/', i + 2);
    const slice = end === -1 ? sql.slice(i) : sql.slice(i, end + 2);
    buf += slice;
    i += slice.length;
    continue;
  }

  if (ch === "'") {
    buf += ch;
    i += 1;
    while (i < sql.length) {
      if (sql[i] === "'" && sql[i + 1] === "'") {
        buf += "''";
        i += 2;
        continue;
      }
      buf += sql[i];
      if (sql[i] === "'") {
        i += 1;
        break;
      }
      i += 1;
    }
    continue;
  }

  if (ch === '$') {
    const m = sql.slice(i).match(/^\$([a-zA-Z_]*)\$/);
    if (m) {
      const tag = m[0];
      buf += tag;
      i += tag.length;
      const end = sql.indexOf(tag, i);
      if (end === -1) {
        buf += sql.slice(i);
        break;
      }
      buf += sql.slice(i, end + tag.length);
      i = end + tag.length;
      continue;
    }
  }

  buf += ch;
  if (ch === ';') {
    const stmt = buf.trim();
    if (stmt) chunks.push(stmt);
    buf = '';
  }
  i += 1;
}
if (buf.trim()) chunks.push(buf.trim());

// Sanity: no CREATE FUNCTION / DO should be split mid-body
for (const [idx, stmt] of chunks.entries()) {
  const opens = (stmt.match(/\$[a-zA-Z_]*\$/g) || []).length;
  if (opens % 2 !== 0) {
    console.error('Unbalanced dollar quotes in statement', idx, 'opens', opens);
    console.error(stmt.slice(0, 120), '...');
    console.error(stmt.slice(-120));
    process.exit(1);
  }
}

const batches = [];
let cur = '';
const LIMIT = 70_000;
for (const s of chunks) {
  if (s.length > LIMIT) {
    if (cur) {
      batches.push(cur);
      cur = '';
    }
    batches.push(s);
    continue;
  }
  if (cur.length + s.length + 2 > LIMIT && cur) {
    batches.push(cur);
    cur = s;
  } else {
    cur = cur ? `${cur}\n${s}` : s;
  }
}
if (cur) batches.push(cur);

const outDir = '/tmp/tapuai-schema-batches';
fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, file));
for (const [idx, batch] of batches.entries()) {
  fs.writeFileSync(path.join(outDir, `${String(idx).padStart(2, '0')}.sql`), batch);
}

console.log(
  JSON.stringify({
    statements: chunks.length,
    batches: batches.length,
    sizes: batches.map((b) => b.length),
  }),
);
