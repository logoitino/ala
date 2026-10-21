import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ShareQrModal } from '@/components/Profile/ShareQrModal';
import { ScreenShell } from '@/components/ScreenShell';
import { MaloTipModal } from '@/components/TipSheetModal';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { maloAthleteCta } from '@/data/malo';
import { SHARE_FUND_CTA } from '@/data/share';
import { resolveGiftLink, type GiftLink } from '@/lib/giftLink';
import { userProfileHref } from '@/lib/navigation';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Public gift landing for family QR scans (`https://tapuai.app/gift/{handle}` / Expo `/gift/[handle]`):
 * donate straight from the scan, open the athlete profile, or pass the QR on.
 * The handle is a username or an athlete id (`lib/giftLink`). An unknown handle says so instead of offering a dead link.
 * @sideEffects `get_public_profiles` + `players` lookup; donate sheet tagged `origin=qr` / `entry=qr_link` behind the soft wall.
 */
export default function GiftHandleScreen() {
  const router = useRouter();
  const { live } = useAppRuntime();
  const { requireAuth } = useSoftWall();
  const { handle: raw } = useLocalSearchParams<{ handle: string }>();
  const handle = Array.isArray(raw) ? raw[0] : raw;
  const [link, setLink] = useState<GiftLink | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLink(null);
    void resolveGiftLink(handle).then((next) => {
      if (!cancelled) setLink(next);
    });
    return () => {
      cancelled = true;
    };
  }, [handle, attempt]);

  const found = link?.status === 'found' ? link : null;

  const donate = () => {
    if (!found) return;
    requireAuth({
      kind: 'malo',
      athleteName: found.name,
      athleteId: found.player.id,
      resume: () => setDonateOpen(true),
    });
  };

  return (
    <ScreenShell edges={['top', 'bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: SHARE_FUND_CTA, headerShown: true }} />
      <View style={styles.wrap}>
        {!link ? (
          <ActivityIndicator accessibilityLabel="Loading athlete" color={FOCAL.jadeInk} />
        ) : link.status === 'found' ? (
          <>
            <Text style={styles.kicker}>Donate on Tapua'i</Text>
            <Text accessibilityRole="header" style={styles.title}>Support {link.name}</Text>
            <Text style={styles.body}>{`Donate to ${link.name} here, or pass this page on to family and friends.`}</Text>
            {live.buttons.malo ? (
              <AnimatedButton
                accessibilityLabel={maloAthleteCta(link.name)}
                haptic="medium"
                onPress={donate}
                contentStyle={styles.primary}
              >
                <Text style={styles.primaryLabel}>{maloAthleteCta(link.name)}</Text>
              </AnimatedButton>
            ) : null}
            <AnimatedButton
              accessibilityLabel={`Open ${link.name} on Tapua'i`}
              haptic="selection"
              onPress={() => router.push(userProfileHref(link.player.id, 'qr'))}
              contentStyle={styles.secondary}
            >
              <Text style={styles.secondaryLabel}>See {link.name}'s profile</Text>
            </AnimatedButton>
            <AnimatedButton
              accessibilityLabel={SHARE_FUND_CTA}
              haptic="selection"
              onPress={() => setShareOpen(true)}
              contentStyle={styles.secondary}
            >
              <Text style={styles.secondaryLabel}>{SHARE_FUND_CTA}</Text>
            </AnimatedButton>
          </>
        ) : link.status === 'not_found' ? (
          <>
            <Text accessibilityRole="header" style={styles.title}>We couldn't find this athlete</Text>
            <Text style={styles.body}>Check the link with the family who shared it. The athlete may have changed their username.</Text>
            <AnimatedButton accessibilityLabel="Go to Home" haptic="selection" onPress={() => router.replace('/')} contentStyle={styles.secondary}>
              <Text style={styles.secondaryLabel}>Go to Home</Text>
            </AnimatedButton>
          </>
        ) : (
          <>
            <Text accessibilityRole="header" style={styles.title}>Couldn't load this athlete</Text>
            <Text style={styles.body}>{link.message}</Text>
            <AnimatedButton accessibilityLabel="Try again" haptic="selection" onPress={() => setAttempt((n) => n + 1)} contentStyle={styles.primary}>
              <Text style={styles.primaryLabel}>Try again</Text>
            </AnimatedButton>
          </>
        )}
      </View>
      {found ? (
        <>
          <MaloTipModal
            player={donateOpen ? found.player : null}
            origin="qr"
            entry="qr_link"
            onClose={() => setDonateOpen(false)}
          />
          <ShareQrModal
            visible={shareOpen}
            athleteName={found.name}
            username={found.username}
            playerId={found.player.id}
            onClose={() => setShareOpen(false)}
          />
        </>
      ) : null}
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
