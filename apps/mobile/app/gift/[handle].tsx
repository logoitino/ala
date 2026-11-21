/** Public QR landing (`/gift/[handle]`): a game-program header and Give stay with the chosen handle across delayed sign-in (UX-13). */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ShareQrModal } from '@/components/Profile/ShareQrModal';
import { SportField } from '@/components/Effects/SportField';
import { ScreenShell } from '@/components/ScreenShell';
import { MaloTipModal } from '@/components/TipSheetModal';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { JerseyBadge } from '@/components/UI/JerseyBadge';
import { colors, MENU_METRICS, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { maloAthleteCta } from '@/data/malo';
import { SHARE_FUND_CTA } from '@/data/share';
import { resolveGiftLink, type GiftLink } from '@/lib/giftLink';
import { userProfileHref } from '@/lib/navigation';
import { TYPE, figtree, DISPLAY_TEXT } from '@/theme/fonts';
import { FOCAL } from '@/theme/motion';

/** Position, school (only when the athlete shows it) and sport, skipping whatever the roster does not know. */
export function programLine(link: Extract<GiftLink, { status: 'found' }>): string {
  return [link.player.position, link.schoolVisible ? link.player.school_name : null, link.sport]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part && part !== '—')
    .join(' · ');
}

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
  const [attempt, setAttempt] = useState(0);
  const scope = useRef({ handle, attempt, epoch: 0, mounted: true });
  if (scope.current.handle !== handle || scope.current.attempt !== attempt) {
    scope.current = { handle, attempt, epoch: scope.current.epoch + 1, mounted: true };
  }
  const epoch = scope.current.epoch;
  const current = () => scope.current.mounted && scope.current.epoch === epoch;
  const [stored, setStored] = useState<{ epoch: number; value: GiftLink } | null>(null);
  const link = stored?.epoch === epoch ? stored.value : null;
  const [shareEpoch, setShareEpoch] = useState<number | null>(null);
  const [donateEpoch, setDonateEpoch] = useState<number | null>(null);

  useEffect(() => {
    scope.current.mounted = true;
    return () => { scope.current.mounted = false; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void resolveGiftLink(handle).then((next) => {
      if (!cancelled && current()) setStored({ epoch, value: next });
    }).catch(() => {
      if (!cancelled && current()) setStored({ epoch, value: { status: 'error', handle: handle ?? '', message: 'Please try again in a moment.' } });
    });
    return () => { cancelled = true; };
  }, [handle, attempt, epoch]);

  const found = link?.status === 'found' ? link : null;

  const donate = () => {
    if (!found || !current()) return;
    requireAuth({
      kind: 'malo',
      athleteName: found.name,
      athleteId: found.player.id,
      // A delayed Soft-Wall resume is an intent for this handle, never whichever athlete loads next.
      resume: () => { if (current()) setDonateEpoch(epoch); },
    });
  };

  return (
    <ScreenShell edges={['top', 'bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: SHARE_FUND_CTA, headerShown: true }} />
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        {!link ? (
          <ActivityIndicator accessibilityLabel="Loading athlete" color={FOCAL.jadeInk} />
        ) : link.status === 'found' ? (
          <>
            {/* UX-08: a game-program header — the athlete's surface, jersey patch, then who they play for. */}
            <View style={styles.program}>
              <SportField sport={link.sport} opacity={0.12} />
              {/* row-reverse: the patch draws on the left but screen readers hear the name first. */}
              <View style={styles.programRow}>
                <View style={styles.programId}>
                  <Text style={styles.kicker}>Give on Tapua'i</Text>
                  <Text accessibilityRole="header" style={styles.title}>Support {link.name}</Text>
                </View>
                <JerseyBadge number={link.player.jersey_number} size="md" />
              </View>
              {programLine(link) ? <Text style={styles.programLine}>{programLine(link)}</Text> : null}
            </View>
            <Text style={styles.body}>{`Send a gift to ${link.name} here, or pass this page on to family and friends.`}</Text>
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
              onPress={() => { if (current()) setShareEpoch(epoch); }}
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
      </ScrollView>
      {found ? (
        <>
          <MaloTipModal
            player={donateEpoch === epoch ? found.player : null}
            origin="qr"
            entry="qr_link"
            onClose={() => { if (current()) setDonateEpoch(null); }}
          />
          <ShareQrModal
            visible={shareEpoch === epoch}
            athleteName={found.name}
            username={found.username}
            playerId={found.player.id}
            onClose={() => { if (current()) setShareEpoch(null); }}
          />
        </>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    paddingBottom: 20,
    paddingHorizontal: 22,
    paddingTop: 24,
    gap: 12,
  },
  program: {
    overflow: 'hidden',
    borderRadius: MENU_METRICS.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    borderTopColor: FOCAL.jadeInk,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 10,
  },
  programRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  programId: {
    flex: 1,
    gap: 2,
  },
  programLine: {
    ...figtree('700'),
    ...TYPE.body,
    color: colors.textMuted,
  },
  kicker: {
    ...figtree('800'),
    ...TYPE.caption,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: FOCAL.goldInk,
  },
  title: {
    ...DISPLAY_TEXT,
    ...TYPE.display,
    color: colors.text,
    letterSpacing: -0.4,
  },
  body: {
    ...figtree('600'),
    ...TYPE.section,
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
    ...figtree('800'),
    ...TYPE.body,
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
    ...figtree('800'),
    ...TYPE.body,
  },
});
