/** Unattended derived-map writes reject links, replace atomically and leave identical source bytes untouched. */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function writeExitMap(root, relative, value) {
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Exit map output symlink is forbidden'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let mode = 0o644;
  try {
    const fd = fs.openSync(current, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const info = fs.fstatSync(fd);
      if (!info.isFile()) throw new Error('Exit map output must be a regular file');
      mode = info.mode & 0o777;
      if (fs.readFileSync(fd, 'utf8') === value) return false;
    } finally { fs.closeSync(fd); }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = path.join(path.dirname(current), '.exit-map-' + randomUUID() + '.tmp');
  try {
    fs.writeFileSync(temporary, value, { flag:'wx', mode });
    fs.renameSync(temporary, current);
  } finally { fs.rmSync(temporary, { force:true }); }
  return true;
}
