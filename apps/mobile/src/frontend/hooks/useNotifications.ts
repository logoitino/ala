/**
 * Recipient notification settings and bounded inbox. A complete Auth/view lifetime owns every
 * request and displayed value, so returning to the same user never revives outgoing work.
 * @sideEffects Only lib/notifications RPCs and fixed safe failure observations; no email sends.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { NOTIFICATION_CATEGORY_IDS, type NotificationPreferences, type NotificationAvailability,
  type NotificationInboxPage, type NotificationChannel, type NotificationCategoryId } from '@tapuai/shared-types/notifications';
import { useAuth } from '@/context/AuthContext';
import { fetchNotificationPreferences, fetchNotificationAvailability, saveNotificationPreferences, fetchNotificationInbox,
  setNotificationRead, setNotificationArchived, markAllNotificationsRead, notificationErrorText } from '@/lib/notifications';
import { TelemetryManager } from '@/services/TelemetryManager';

const alwaysCurrent = () => true;
type Lifetime = { id: string; enabled: boolean; guard: () => boolean; active: boolean; flight: boolean; generation: number; current: () => boolean };

/** Keep the captured provider guard and an identity epoch even when A→B→A is batched. */
function useRecipientLifetime(enabled: boolean): Lifetime {
  const { user, isGuest, isSessionCurrent } = useAuth();
  const id = user?.id ?? ''; const allowed = enabled && Boolean(id) && !isGuest;
  const guard = isSessionCurrent ?? alwaysCurrent;
  const ref = useRef<Lifetime | null>(null);
  if (!ref.current || ref.current.id !== id || ref.current.enabled !== allowed || ref.current.guard !== guard) {
    const next: Lifetime = { id, enabled: allowed, guard, active: false, flight: false, generation: 0, current: () => false };
    next.current = () => next.enabled && next.active && ref.current === next && next.guard();
    ref.current = next;
  }
  const life = ref.current;
  useEffect(() => { life.generation++; life.active = true; return () => { life.generation++; life.active = false; life.flight = false; }; }, [life]);
  return life;
}

/** Async work cannot regain authority when React replays an effect on the same lifetime. */
function captureOperation(life: Lifetime) {
  const generation = life.generation;
  return () => life.current() && life.generation === generation;
}

type SettingsState = { owner: Lifetime; preferences: NotificationPreferences | null; draft: NotificationPreferences | null;
  availability: NotificationAvailability | null; loading: boolean; busy: boolean; error: string | null; notice: string | null; conflicted: boolean };

/** @purpose Confirmed settings and explicit revisioned saves; unavailable services never supply defaults. */
export function useNotificationSettings(visible: boolean) {
  const life = useRecipientLifetime(visible);
  const [state, setState] = useState<SettingsState | null>(null);
  const shown = state?.owner === life && life.current() ? state : null;
  const dirty = Boolean(shown?.draft && JSON.stringify(shown.draft) !== JSON.stringify(shown.preferences));
  const reload = useCallback(async () => {
    if (!life.current() || life.flight) return;
    life.flight = true; const current = captureOperation(life);
    setState({ owner: life, preferences: null, draft: null, availability: null, loading: true, busy: true, error: null, notice: null, conflicted: false });
    try {
      const [preferences, availability] = await Promise.all([fetchNotificationPreferences(), fetchNotificationAvailability()]);
      if (!current()) return;
      setState({ owner: life, preferences, draft: preferences, availability, loading: false, busy: true, error: null, notice: null, conflicted: false });
    } catch (error) {
      if (current()) {
        setState(current => current?.owner === life ? { ...current, loading: false, error: notificationErrorText(error) } : current);
        TelemetryManager.getInstance().trackIssue('notifications.settings_load_failed', 'profile');
      }
    } finally {
      if (current()) { life.flight = false; setState(current => current?.owner === life ? { ...current, busy: false } : current); }
    }
  }, [life]);
  useEffect(() => { void reload(); }, [reload]);

  const setChannelEnabled = (channel: NotificationChannel, value: boolean) => {
    if (!life.current() || life.flight || !['email', 'inApp'].includes(channel) || typeof value !== 'boolean') return;
    setState(current => current?.owner === life && current.draft
      ? { ...current, notice: null, draft: { ...current.draft, [channel === 'email' ? 'emailEnabled' : 'inAppEnabled']: value } } : current);
  };
  const setCategory = (id: NotificationCategoryId, channel: NotificationChannel, value: boolean) => {
    if (!life.current() || life.flight || !NOTIFICATION_CATEGORY_IDS.includes(id) || !['email', 'inApp'].includes(channel) || typeof value !== 'boolean') return;
    setState(current => current?.owner === life && current.draft ? { ...current, notice: null, draft: { ...current.draft,
      categories: { ...current.draft.categories, [id]: { ...current.draft.categories[id], [channel]: value } } } } : current);
  };
  const save = async () => {
    if (!life.current() || life.flight || !shown?.draft || !dirty || shown.conflicted) return;
    life.flight = true; const current = captureOperation(life); const draft = shown.draft;
    setState(current => current?.owner === life ? { ...current, busy: true, error: null, notice: null } : current);
    try {
      const saved = await saveNotificationPreferences(draft, life.id);
      if (!current()) return;
      setState(current => current?.owner === life ? { ...current, preferences: saved, draft: saved, notice: 'Notification preferences saved.', conflicted: false } : current);
    } catch (error) {
      if (current()) {
        const conflict = typeof error === 'object' && error !== null && 'code' in error && error.code === 'conflict';
        setState(current => current?.owner === life ? { ...current, error: notificationErrorText(error), conflicted: conflict } : current);
        TelemetryManager.getInstance().trackIssue('notifications.settings_save_failed', 'profile');
      }
    } finally {
      if (current()) { life.flight = false; setState(current => current?.owner === life ? { ...current, busy: false } : current); }
    }
  };
  return { preferences: shown?.preferences ?? null, draft: shown?.draft ?? null, availability: shown?.availability ?? null,
    loading: shown?.loading ?? (life.enabled && life.guard()), busy: shown?.busy ?? false, error: shown?.error ?? null,
    notice: shown?.notice ?? null, conflicted: shown?.conflicted ?? false, dirty, reload, save, setChannelEnabled, setCategory };
}

type InboxState = { owner: Lifetime; page: NotificationInboxPage | null; archived: boolean;
  loading: boolean; busy: boolean; error: string | null; notice: string | null };

/** @purpose One server-owned inbox page, separate read/archive state and account-bound mark-all snapshots. */
export function useNotificationInbox(enabled = true) {
  const life = useRecipientLifetime(enabled);
  const [state, setState] = useState<InboxState | null>(null);
  const shown = state?.owner === life && life.current() ? state : null;
  // Retained callbacks must use the current page, not a removed row from a previous page/view.
  const latest = useRef<InboxState | null>(null); latest.current = shown;
  const fetchPage = async (archived: boolean, cursor: string | null, current: () => boolean) => {
    if (!current()) return;
    const page = await fetchNotificationInbox({ archived, cursor });
    if (current()) setState(current => current?.owner === life ? { ...current, page, archived, loading: false } : current);
  };
  const run = async (work: (current: () => boolean) => Promise<void>, options: { archived?: boolean; reset?: boolean } = {}) => {
    if (!life.current() || life.flight) return;
    life.flight = true; const current = captureOperation(life);
    setState(current => ({ owner: life, page: options.reset ? null : current?.owner === life ? current.page : null,
      archived: options.archived ?? (current?.owner === life ? current.archived : false), loading: options.reset ?? false,
      busy: true, error: null, notice: null }));
    try { await work(current); }
    catch (error) {
      if (current()) {
        setState(current => current?.owner === life ? { ...current, loading: false, error: notificationErrorText(error) } : current);
        TelemetryManager.getInstance().trackIssue('notifications.inbox_action_failed', 'activity');
      }
    } finally {
      if (current()) { life.flight = false; setState(current => current?.owner === life ? { ...current, busy: false, loading: false } : current); }
    }
  };
  const reload = () => run(current => fetchPage(latest.current?.archived ?? false, null, current), { reset: true });
  useEffect(() => {
    // The lifetime owns initialization; state/page changes do not repeatedly refetch.
    if (!life.current()) return;
    void run(current => fetchPage(false, null, current), { archived: false, reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [life]);
  const nextPage = () => {
    const page = latest.current; if (!page?.page?.nextCursor) return Promise.resolve();
    return run(current => fetchPage(page.archived, page.page!.nextCursor, current));
  };
  const showArchived = (archived: boolean) => run(current => fetchPage(archived, null, current), { archived, reset: true });
  const mutate = (work: () => Promise<void>, notice: string) => {
    const archived = latest.current?.archived ?? false;
    return run(async current => {
      await work();
      if (!current()) return;
      // A successful write is not a successful refresh. Discard stale counts before refetch.
      setState(current => current?.owner === life ? { ...current, page: null, loading: true } : current);
      await fetchPage(archived, null, current);
      if (current()) setState(current => current?.owner === life ? { ...current, notice } : current);
    });
  };
  const ownsItem = (id: string) => life.current() && latest.current?.page?.items.some(item => item.id === id);
  const setRead = (id: string, read: boolean) => ownsItem(id)
    ? mutate(() => setNotificationRead(id, read), read ? 'Notification marked read.' : 'Notification marked unread.') : Promise.resolve();
  const setArchived = (id: string, archived: boolean) => ownsItem(id)
    ? mutate(() => setNotificationArchived(id, archived), archived ? 'Notification archived.' : 'Notification restored.') : Promise.resolve();
  const markAllRead = () => {
    const cutoff = latest.current?.page?.cutoff;
    // Archived pages share the active-inbox count/cutoff; never mark unseen active rows here.
    return life.current() && !latest.current?.archived && cutoff
      ? mutate(async () => { await markAllNotificationsRead(cutoff); }, 'Notifications in the reviewed snapshot marked read.') : Promise.resolve();
  };
  const openItem = (id: string, navigate: (href: string) => void) => {
    if (!life.current()) return;
    const item = latest.current?.page?.items.find(row => row.id === id);
    if (item?.href && ['/profile', '/activity', '/receipts'].includes(item.href)) navigate(item.href);
  };
  return { page: shown?.page ?? null, archived: shown?.archived ?? false, loading: shown?.loading ?? (life.enabled && life.guard()),
    busy: shown?.busy ?? false, error: shown?.error ?? null, notice: shown?.notice ?? null,
    reload, nextPage, showArchived, setRead, setArchived, markAllRead, openItem };
}
