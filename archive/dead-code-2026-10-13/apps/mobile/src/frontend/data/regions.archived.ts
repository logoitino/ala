// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/data/regions.ts: regionForZip.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

export function regionForZip(zip: string): UtahRegion | null {
  const needle = zip.trim();
  if (needle.length < 5) return null;
  return (
    UTAH_REGIONS.find((region) => region.zipPrefixes.some((prefix) => needle.startsWith(prefix))) ??
    null
  );
}

