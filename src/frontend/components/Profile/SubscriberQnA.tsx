import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { SubscriberCrest } from '@/components/Profile/SubscriberCrest';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import { EXCLUSIVE_REQUEST_TOAST } from '@/data/exclusive';
import { displayValue } from '@/data/players';
import { useSubscriberRequests } from '@/hooks/useSubscriberRequests';

const NEON_JADE = '#00E676';

type SubscriberQnAProps = {
  athleteId: string;
  athleteName?: string | null;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

/**
 * @purpose Direct shoutout / Q&A box for exclusive subscribers on `/athlete/[id]`.
 * @param athleteId Target `players.id` stored as `subscriber_requests.athlete_id`.
 * @param athleteName Used in the placeholder as `@Handle`.
 * @returns Composer plus a comment list; each row shows a Subscriber Crest on the avatar.
 * @sideEffects Inserts `subscriber_requests`; success toast "Request sent to athlete! ⚡".
 */
export function SubscriberQnA({ athleteId, athleteName }: SubscriberQnAProps) {
  const { user, profile } = useAuth();
  const celebration = useOptionalCelebration();
  const { items, submitting, submit } = useSubscriberRequests(athleteId);
  const [draft, setDraft] = useState('');

  const handle = displayValue(athleteName, 'Athlete').trim().split(/\s+/)[0] || 'Athlete';
  const placeholder = `Drop a question or request a shoutout for @${handle}`;
  const authorName = displayValue(profile?.full_name, user?.email?.split('@')[0] ?? 'You');

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;

    if (!user?.id) {
      Alert.alert('Sign in required', 'Sign in to send a shoutout or question.');
      return;
    }

    const error = await submit(body);
    if (error) {
      Alert.alert('Couldn’t send request', error);
      return;
    }

    setDraft('');
    celebration?.showToast(EXCLUSIVE_REQUEST_TOAST);
  }, [celebration, draft, submit, user?.id]);

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.kicker}>Direct request</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        editable={!submitting}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        multiline
        maxLength={280}
        textAlignVertical="top"
      />
      <AnimatedButton
        accessibilityLabel="Send request"
        accessibilityState={{ disabled: submitting || !draft.trim() }}
        disabled={submitting || !draft.trim()}
        haptic="medium"
        onPress={() => void send()}
        contentStyle={[styles.send, (!draft.trim() || submitting) && styles.sendOff]}
      >
        <Text style={styles.sendLabel}>{submitting ? 'Sending…' : 'Send ⚡'}</Text>
      </AnimatedButton>

      {items.length > 0 ? (
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.comment}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.initials}>
                    {initialsFor(item.subscriber_id === user?.id ? authorName : 'Subscriber')}
                  </Text>
                </View>
                <View style={styles.crest}>
                  <SubscriberCrest size={9} />
                </View>
              </View>
              <View style={styles.commentCopy}>
                <Text style={styles.commentAuthor}>
                  {item.subscriber_id === user?.id ? authorName : 'Subscriber'}
                </Text>
                <Text style={styles.commentBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: NEON_JADE,
    padding: 14,
    gap: 10,
  },
  kicker: {
    color: NEON_JADE,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 88,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  send: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: NEON_JADE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: {
    opacity: 0.45,
  },
  sendLabel: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '800',
  },
  list: {
    gap: 10,
    paddingTop: 4,
  },
  comment: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  avatarWrap: {
    width: 36,
    height: 36,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#101618',
    borderWidth: 1,
    borderColor: NEON_JADE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crest: {
    position: 'absolute',
    right: -4,
    top: -4,
  },
  initials: {
    color: NEON_JADE,
    fontSize: 11,
    fontWeight: '800',
  },
  commentCopy: {
    flex: 1,
    gap: 2,
  },
  commentAuthor: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  commentBody: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
