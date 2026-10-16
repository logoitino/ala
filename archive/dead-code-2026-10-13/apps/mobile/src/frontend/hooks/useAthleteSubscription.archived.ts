// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/hooks/useAthleteSubscription.ts: useHasSubscriberPass.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/**
 * @purpose Whether the signed-in fan holds any active exclusive pass (Subscriber Crest on Profile).
 * @returns `true` when `subscriptions` has an active row for the current user, else local cache.
 * @sideEffects `subscriptions` select; AsyncStorage `tapuai.exclusiveSub` fallback.
 */
export function useHasSubscriberPass() {
  const { user } = useAuth();
  const [active, setActive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      if (user?.id && isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('subscriber_id', user.id)
          .eq('status', 'active')
          .limit(1);

        if (!error && data && data.length > 0) {
          setActive(true);
          return;
        }
      }

      const local = await AsyncStorage.getItem('tapuai.exclusiveSub');
      setActive(local === '1');
    } catch {
      setActive(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return active;
}

