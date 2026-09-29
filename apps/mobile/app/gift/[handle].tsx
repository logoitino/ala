import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ShareQrModal } from '@/components/Profile/ShareQrModal';
import { ScreenShell } from '@/components/ScreenShell';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { SHARE_FUND_CTA, formatGiftUrl, shareQrSubtitle } from '@/data/share';
import { userProfileHref } from '@/lib/navigation';
import { lookupPlayerByHandle } from '@/lib/share';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Public gift landing for family QR scans (`https://tapuai.app/gift/{handle}` / Expo `/gift/[handle]`).
 * @sideEffects `profiles` lookup by username; optional jump to `/user/[id]`.
 */
export default function GiftHandleScreen() {
  const router = useRouter();
  const { handle: raw } = useLocalSearchParams<{ handle: string }>();
  const handle = Array.isArray(raw) ? raw[0] : raw;
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [name, setName] = useState(handle || 'this athlete');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [username, setUsername] = useState(handle || 'athlete');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!handle) {
        setLoading(false);
        return;
      }
      const hit = await lookupPlayerByHandle(handle);
      if (cancelled || !hit) {
        setLoading(false);
        return;
      }
      setName(hit.name);
      setPlayerId(hit.playerId);
      setUsername(hit.username);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return (
    <ScreenShell edges={['top', 'bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: SHARE_FUND_CTA, headerShown: true }} />
      <View style={styles.wrap}>
        {loading ? (
          <ActivityIndicator color={FOCAL.jadeInk} />
        ) : (
          <>
            <Text style={styles.kicker}>Donate on Tapua'i</Text>
            <Text style={styles.title}>Support {name}</Text>
            <Text style={styles.body}>{shareQrSubtitle(name)}</Text>
            <Text style={styles.url}>{formatGiftUrl(username)}</Text>
            {playerId ? (
              <AnimatedButton
                accessibilityLabel={`Open ${name} on Tapua'i`}
                haptic="medium"
                onPress={() => router.push(userProfileHref(playerId, 'qr'))}
                contentStyle={styles.primary}
              >
                <Text style={styles.primaryLabel}>Open athlete profile</Text>
              </AnimatedButton>
            ) : null}
            <AnimatedButton
              accessibilityLabel={SHARE_FUND_CTA}
              haptic="selection"
              onPress={() => setShareOpen(true)}
              contentStyle={styles.secondary}
            >
              <Text style={styles.secondaryLabel}>{SHARE_FUND_CTA}</Text>
            </AnimatedButton>
          </>
        )}
      </View>
      <ShareQrModal visible={shareOpen} athleteName={name} username={username} onClose={() => setShareOpen(false)} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    gap: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: FOCAL.goldInk,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: colors.textMuted,
  },
  url: {
    fontSize: 13,
    fontWeight: '700',
    color: FOCAL.jadeInk,
  },
  primary: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: FOCAL.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  secondary: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: FOCAL.neonJade,
    backgroundColor: FOCAL.mistJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: FOCAL.jadeInk,
    fontSize: 15,
    fontWeight: '800',
  },
});
