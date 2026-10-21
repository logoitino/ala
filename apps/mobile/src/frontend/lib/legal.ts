/**
 * Reads and stamps the Terms / NIL / minor-safety acknowledgement on a profile. Required before payouts and
 * athlete verification. The wording itself comes from counsel, not from this file.
 * Signed-in acceptance requires a confirmed current server record; a device cache cannot waive it.
 * @sideEffects `profiles.legal_*` read and write.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { LEGAL_TERMS_VERSION } from '@/data/legal';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const STORAGE_PREFIX = 'tapuai.legalAck.';

export type LegalAckRecord = {
  version: string;
  acceptedAt: string;
};

function storageKey(userId: string | null | undefined) {
  return `${STORAGE_PREFIX}${userId || 'guest'}.${LEGAL_TERMS_VERSION}`;
}

function parseRecord(raw: string | null): LegalAckRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LegalAckRecord>;
    if (parsed.version !== LEGAL_TERMS_VERSION) return null;
    if (typeof parsed.acceptedAt !== 'string' || !parsed.acceptedAt) return null;
    return { version: parsed.version, acceptedAt: parsed.acceptedAt };
  } catch {
    return null;
  }
}

/**
 * @purpose Read whether this account already acknowledged the current Terms / NIL / minor-safety version.
 * @param userId Supabase `auth.uid()`, or null for a guest browse key.
 * @param remoteAcceptedAt `profiles.legal_terms_accepted_at` when the profile row is loaded.
 * @returns True for a current remote acknowledgment on configured signed-in accounts; local records serve guest/unconfigured use.
 * @sideEffects AsyncStorage GET.
 */
export async function hasLegalAck(
  userId: string | null | undefined,
  remoteAcceptedAt?: string | null,
  remoteVersion?: string | null,
): Promise<boolean> {
  if (userId && userId !== 'guest' && isSupabaseConfigured) {
    return Boolean(remoteAcceptedAt && Number.isFinite(Date.parse(remoteAcceptedAt)) && remoteVersion === LEGAL_TERMS_VERSION);
  }
  if (remoteAcceptedAt && (!remoteVersion || remoteVersion === LEGAL_TERMS_VERSION)) return true;
  const local = parseRecord(await AsyncStorage.getItem(storageKey(userId)));
  return Boolean(local);
}

/**
 * @purpose Stamp Terms / NIL / minor-safety acknowledgement for payouts and athlete verification.
 * @param userId Signed-in user id when available.
 * @returns ISO timestamp after a confirmed signed-in server update, or a saved guest/unconfigured local record.
 * @sideEffects `profiles` UPDATE/readback before best-effort signed cache; required local SET for guests/unconfigured use.
 */
export async function recordLegalAck(userId: string | null | undefined): Promise<string> {
  const acceptedAt = new Date().toISOString();
  const record: LegalAckRecord = { version: LEGAL_TERMS_VERSION, acceptedAt };
  if (userId && userId !== 'guest' && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('profiles').update({
        legal_terms_accepted_at: acceptedAt, legal_terms_version: LEGAL_TERMS_VERSION,
      }).eq('user_id', userId).select('user_id,legal_terms_accepted_at,legal_terms_version').maybeSingle();
      if (error || !data || data.user_id !== userId || data.legal_terms_version !== LEGAL_TERMS_VERSION ||
        !data.legal_terms_accepted_at || Date.parse(data.legal_terms_accepted_at) !== Date.parse(acceptedAt)) {
        throw new Error('Could not save Terms acknowledgment. Please try again.');
      }
    } catch {
      // Failed or unknown writes must never become a bank-readiness cache or expose provider diagnostics.
      throw new Error('Could not save Terms acknowledgment. Please try again.');
    }
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(record)).catch(() => undefined);
  } else {
    try { await AsyncStorage.setItem(storageKey(userId), JSON.stringify(record)); }
    catch { throw new Error('Could not save Terms acknowledgment. Please try again.'); }
  }
  return acceptedAt;
}
