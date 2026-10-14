// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/lib/runtime.ts: getRuntimePathValue.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

export function getRuntimePathValue(config: AppRuntimeConfig, path: string): unknown {
  const [group, key] = path.split('.') as [string, string];
  if (!group || !key) return undefined;
  const bag = (config as unknown as Record<string, Record<string, unknown>>)[group];
  return bag ? bag[key] : undefined;
}

