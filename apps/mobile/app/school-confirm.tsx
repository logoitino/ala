import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenShell } from '@/components/ScreenShell';
import { SchoolConfirmRow } from '@/components/Verification/SchoolConfirmRow';
import { colors, radii } from '@/constants/theme';
import {
  confirmAthlete,
  fetchConfirmationQueue,
  type ConfirmResult,
  type ConfirmationQueue,
} from '@/lib/schoolConfirm';

/**
 * @purpose School confirmation form (`alasports://school-confirm?t=TOKEN`). An athletic director or
 * coach meets each student in person, types the code on the student's phone, ticks "on my roster"
 * and signs. No Tapua'i account needed — the per-staff link is the credential.
 * @sideEffects `get_school_confirmation_queue`; `school_confirm_athlete` per student.
 */
export default function SchoolConfirmScreen() {
  const { t: raw } = useLocalSearchParams<{ t?: string | string[] }>();
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  // A staff link is the credential. Changing it remounts all queue/signature/decision state together.
  return <SchoolConfirmBody key={token} token={token} />;
}

function SchoolConfirmBody({ token }: { token: string }) {
  const [queue, setQueue] = useState<ConfirmationQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState('');
  const [done, setDone] = useState<{ name: string; approved: boolean }[]>([]);
  const active = useRef(true);
  const revision = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; ++revision.current; }; }, []);

  const load = useCallback(async () => {
    const request = ++revision.current;
    setLoading(true);
    try {
      const next = await fetchConfirmationQueue(token);
      if (active.current && revision.current === request) { setQueue(next); setError(null); }
    } catch (err) {
      if (active.current && revision.current === request) setError(err instanceof Error ? err.message : 'Could not open this link.');
    } finally {
      if (active.current && revision.current === request) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (requestId: string, name: string, approve: boolean, meetCode: string): Promise<ConfirmResult> => {
    const result = await confirmAthlete({ token, requestId, approve, meetCode, signature });
    if (result.ok && active.current) {
      setDone((prev) => [{ name, approved: result.status === 'approved' }, ...prev]);
      setQueue((prev) => (prev ? { ...prev, requests: prev.requests.filter((r) => r.id !== requestId) } : prev));
    }
    return result;
  };

  const role = queue?.staffRole === 'coach' ? 'Coach' : 'Athletic director';

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Confirm athletes' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading && Boolean(queue)} onRefresh={() => void load()} />}
      >
        {loading && !queue ? (
          <ActivityIndicator color={colors.deepGreen} />
        ) : error ? (
          <View style={styles.panel}>
            <Text style={styles.title}>This link isn’t working</Text>
            <Text style={styles.body}>{error}</Text>
          </View>
        ) : queue ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.kicker}>
                {role}
                {queue.sport ? ` · ${queue.sport}` : ''}
              </Text>
              <Text style={styles.title}>{queue.schoolName ?? 'Your school'}</Text>
              <Text style={styles.body}>
                Only confirm a student you have met in person who is on your team. Ask them to open Tapua’i →
                Activity → “Show my school code” and read you the 6 digits.
              </Text>
              <Text style={styles.label}>Sign with your full name</Text>
              <TextInput
                accessibilityLabel="Your full name"
                autoCapitalize="words"
                autoComplete="name"
                placeholder={queue.confirmerName}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={signature}
                onChangeText={setSignature}
              />
            </View>

            {queue.requests.length === 0 ? (
              <Text style={styles.empty}>No students are waiting right now. Pull down to refresh.</Text>
            ) : (
              queue.requests.map((request) => (
                <SchoolConfirmRow
                  key={request.id}
                  request={request}
                  signature={signature}
                  onDecide={(approve, code) => decide(request.id, request.fullName, approve, code)}
                />
              ))
            )}

            {done.map((item, index) => (
              <Text key={`${item.name}-${index}`} style={styles.done}>
                {item.approved ? `✓ ${item.name} is verified` : `${item.name} marked not on your roster`}
              </Text>
            ))}
          </>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  done: {
    color: colors.deepGreen,
    fontSize: 14,
    fontWeight: '700',
  },
});
