// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/components/Admin/AdminChrome.tsx: AdminBusy.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

export function AdminBusy() {
  return (
    <View style={styles.busy}>
      <ActivityIndicator color={FOCAL.jadeInk} />
    </View>
  );
}

