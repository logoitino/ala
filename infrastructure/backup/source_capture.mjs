/** Source capture for full backups: reuses capsule policy and writes only to external private staging. */
import { createCapsule, verifyCapsule } from '../../scripts/recovery-capsule.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const [command, destination] = process.argv.slice(2);
try {
  if (command === 'capture' && destination) {
    console.log(JSON.stringify(await createCapsule(root, { outputDirectory: path.resolve(destination) })));
  } else if (command === 'verify' && destination) {
    const result = await verifyCapsule(path.resolve(destination));
    console.log(JSON.stringify({ integrity: 'passed', treeHash: result.manifest.treeHash }));
  } else throw new Error('Usage: source_capture.mjs capture DIRECTORY | verify CAPSULE');
} catch (error) { console.error(error.message); process.exitCode = 1; }
