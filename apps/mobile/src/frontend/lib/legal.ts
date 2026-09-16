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
 * @returns True when local or remote ack matches `LEGAL_TERMS_VERSION`.
 * @sideEffects AsyncStorage GET.
 */
export async function hasLegalAck(
  userId: string | null | undefined,
  remoteAcceptedAt?: string | null,
  remoteVersion?: string | null,
): Promise<boolean> {
  if (remoteAcceptedAt && (!remoteVersion || remoteVersion === LEGAL_TERMS_VERSION)) return true;
  const local = parseRecord(await AsyncStorage.getItem(storageKey(userId)));
  return Boolean(local);
}

/**
 * @purpose Stamp Terms / NIL / minor-safety acknowledgement for payouts and athlete verification.
 * @param userId Signed-in user id when available.
 * @returns ISO timestamp written locally (and on `profiles` when the session exists).
 * @sideEffects AsyncStorage SET; optional `profiles` UPDATE (`legal_terms_accepted_at`, `legal_terms_version`).
 */
export async function recordLegalAck(userId: string | null | undefined): Promise<string> {
  const acceptedAt = new Date().toISOString();
  const record: LegalAckRecord = { version: LEGAL_TERMS_VERSION, acceptedAt };
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(record));
  if (userId && userId !== 'guest' && isSupabaseConfigured) {
    const { error } = await supabase
      .from('profiles')
      .update({
        legal_terms_accepted_at: acceptedAt,
        legal_terms_version: LEGAL_TERMS_VERSION,
      })
      .eq('user_id', userId);
    if (error && __DEV__) {
      console.warn('[legal] profiles update skipped', error.message);
    }
  }
  return acceptedAt;
}
