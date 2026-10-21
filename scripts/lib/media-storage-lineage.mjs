/**
 * Source lineage for MediaStorageAdapter calls. Literal/constant targets and the canonical public
 * bucket set remain visible after SDK transport extraction. This is bounded pattern matching, not RLS proof.
 */
export function mediaStorageUses(text, bucketNames, bucketConstants) {
  const set = text.match(/\bconst\s+PUBLIC_BUCKETS\s*=\s*new\s+Set\s*\(\s*\[([^\]]*)\]/);
  const publicBuckets = set ? [...set[1].matchAll(/['"`](\w+)['"`]/g)].map(m => m[1]).filter(name => bucketNames.includes(name)) : [];
  const fileConstants = [...bucketConstants.entries()].filter(([name]) => new RegExp(`\\b${name}\\b`).test(text)).map(([, bucket]) => bucket);
  const uses = [];
  for (const m of text.matchAll(/\bstorage\s*\.\s*(upload|publicUrl|sign|list|remove)\(\s*(?:['"`](\w+)['"`]|([A-Za-z_]\w*))/g)) {
    const bucket = m[2] ?? bucketConstants.get(m[3]);
    // A public builder guarded by PUBLIC_BUCKETS reads that set; unrelated private literals are not candidates.
    const candidates = bucket ? [bucket] : m[1] === 'publicUrl' && publicBuckets.length ? publicBuckets : fileConstants;
    for (const name of new Set(candidates)) if (bucketNames.includes(name)) {
      uses.push({ bucket: name, operation: m[1], writer: ['upload', 'remove'].includes(m[1]), index: m.index });
    }
  }
  return uses;
}
