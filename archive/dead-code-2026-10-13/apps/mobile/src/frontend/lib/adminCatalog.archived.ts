// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/lib/adminCatalog.ts: fetchAdminMaloOriginBars, fetchAdminOpsInbox, fetchAdminTips.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/**
 * @purpose All-time Mālo totals by where the gift started, for the Expo Money desk.
 * @sideEffects `get_admin_malo_breakdown` (admin-only).
 */
export async function fetchAdminMaloOriginBars(): Promise<MaloOriginBar[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_admin_malo_breakdown');
  if (error || !data || typeof data !== 'object') return [];
  const rows = (data as { by_origin?: unknown }).by_origin;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const bag = row as Record<string, unknown>;
      const origin = typeof bag.origin === 'string' ? bag.origin : 'profile';
      const cents = Number(bag.cents);
      const count = Number(bag.count);
      return {
        label:
          origin === 'highlight'
            ? 'Highlight'
            : origin === 'qr'
              ? 'QR link'
              : origin === 'wishlist'
                ? 'Wishlist'
                : origin === 'live'
                  ? 'Live feed'
                  : 'Profile',
        cents: Number.isFinite(cents) ? Math.round(cents) : 0,
        count: Number.isFinite(count) ? Math.round(count) : 0,
      };
    })
    .filter((row): row is MaloOriginBar => Boolean(row));
}

/**
 * @purpose Mālo ledger for the Money tool.
 * @sideEffects `tips` SELECT.
 */
export async function fetchAdminTips(): Promise<TipLedgerEntry[]> {
  if (!isSupabaseConfigured) return [];
  const rich = await supabase
    .from('tips')
    .select('id, player_id, amount_cents, created_at, fan_id, reel_id, aura_points, origin, entry, wishlist_item_id, source_label')
    .order('created_at', { ascending: false })
    .limit(40);
  const { data, error } = rich.error
    ? await supabase
        .from('tips')
        .select('id, player_id, amount_cents, created_at, fan_id, reel_id, aura_points')
        .order('created_at', { ascending: false })
        .limit(40)
    : rich;
  if (error || !Array.isArray(data)) return [];
  return data as TipLedgerEntry[];
}

/**
 * @purpose Ops inbox for Overview: flags, verify queue, live board, Drip stock, queued payouts, new feedback.
 * @sideEffects Parallel SELECTs on flags, verification, games, shop_products, disbursements, app_feedback.
 */
export async function fetchAdminOpsInbox(): Promise<AdminOpsInbox> {
  const empty: AdminOpsInbox = {
    flags: 0,
    pendingVerify: 0,
    pendingTags: 0,
    liveGames: 0,
    parkedGames: 0,
    hiddenDrip: 0,
    lowStock: 0,
    queuedPayouts: 0,
    newFeedback: 0,
    items: [],
  };
  if (!isSupabaseConfigured) return empty;

  const [flags, verify, tags, games, drip, payouts, feedback] = await Promise.all([
    supabase.from('reels').select('id', { count: 'exact', head: true }).eq('is_flagged', true).eq('is_removed', false),
    supabase.from('verification_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('reels').select('id', { count: 'exact', head: true }).eq('tag_status', 'pending').eq('is_removed', false),
    supabase.from('games').select('id, is_active'),
    supabase.from('shop_products').select('id, is_active, inventory'),
    supabase.from('disbursements').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
    supabase.from('app_feedback').select('id', { count: 'exact', head: true }).eq('status', 'new'),
  ]);

  const gameRows = Array.isArray(games.data) ? games.data : [];
  const dripRows = Array.isArray(drip.data) ? drip.data : [];
  const liveGames = gameRows.filter((row) => row.is_active !== false).length;
  const parkedGames = gameRows.length - liveGames;
  const hiddenDrip = dripRows.filter((row) => row.is_active === false).length;
  const lowStock = dripRows.filter((row) => row.is_active !== false && asInt(row.inventory) > 0 && asInt(row.inventory) < 8).length;

  const inbox: AdminOpsInbox = {
    flags: flags.count ?? 0,
    pendingVerify: verify.count ?? 0,
    pendingTags: tags.count ?? 0,
    liveGames,
    parkedGames,
    hiddenDrip,
    lowStock,
    queuedPayouts: payouts.count ?? 0,
    newFeedback: feedback.count ?? 0,
    items: [],
  };
  const items: AdminOpsItem[] = [];
  if (inbox.newFeedback > 0) {
    items.push({
      href: '/admin/feedback',
      label: 'New suggestions',
      hint: 'Fan voice waiting on Feedback',
      count: inbox.newFeedback,
    });
  }
  if (inbox.flags > 0) {
    items.push({
      href: '/admin/moderation',
      label: 'Open flags',
      hint: 'User reports waiting on Moderation',
      count: inbox.flags,
    });
  }
  if (inbox.pendingVerify > 0) {
    items.push({
      href: '/admin/people',
      label: 'Verification queue',
      hint: 'Athletes waiting to be verified',
      count: inbox.pendingVerify,
    });
  }
  if (inbox.pendingTags > 0) {
    items.push({
      href: '/admin/spotlight',
      label: 'Pending player tags',
      hint: 'Fan clips waiting That’s them before they count for Spotlight',
      count: inbox.pendingTags,
    });
  }
  if (inbox.queuedPayouts > 0) {
    items.push({
      href: '/admin/money',
      label: 'Queued payouts',
      hint: 'Disbursements not marked paid',
      count: inbox.queuedPayouts,
    });
  }
  if (inbox.lowStock > 0) {
    items.push({
      href: '/admin/drip',
      label: 'Low Drip stock',
      hint: 'Active SKUs under 8 units',
      count: inbox.lowStock,
    });
  }
  if (inbox.liveGames === 0) {
    items.push({
      href: '/admin/publish',
      label: 'No live games',
      hint: 'Local match board is empty — go live from Publish',
      count: 0,
    });
  }
  if (inbox.parkedGames > 0 && inbox.liveGames === 0) {
    items.push({
      href: '/admin/publish',
      label: 'Parked matches',
      hint: 'Matches ready to go live on Local',
      count: inbox.parkedGames,
    });
  }
  inbox.items = items;
  return inbox;
}

