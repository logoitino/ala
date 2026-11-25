/** The first Highlights visit borrows the welcome art until a real public clip can take over. */
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/UI/BrandMark';
import { KitButton } from '@/components/UI/Kit';
import { colors } from '@/constants/theme';
import { figtree, TYPE } from '@/theme/fonts';

const WELCOME_ART = require('../../../../assets/welcome/welcome-football.jpg');

/** Decorative sample art, never presented as a thumbnail of a specific athlete. */
export function WelcomeHighlightsArt() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={WELCOME_ART} resizeMode="cover" style={styles.art} accessible={false} />
      <View style={styles.shade} />
    </View>
  );
}

export function WelcomeHighlightsStage({
  status,
  onRetry,
  bottomInset = 0,
}: {
  status: 'loading' | 'unavailable' | 'empty';
  onRetry: () => void;
  bottomInset?: number;
}) {
  return (
    <View style={styles.stage} testID="welcome-highlights-stage">
      <WelcomeHighlightsArt />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.copy, { paddingBottom: bottomInset + 24 }]} accessibilityLiveRegion="polite">
          <BrandMark dark size={28} />
          <Text accessibilityRole="header" style={styles.title}>
            {status === 'loading' ? 'Getting Highlights ready' : status === 'empty' ? 'No public Highlights yet' : 'Highlights couldn’t load'}
          </Text>
          <Text style={styles.body}>
            {status === 'loading' ? 'Big moments from athletes worth cheering for.' : 'Try loading Highlights again, or keep exploring Tapua’i.'}
          </Text>
          {status !== 'loading' ? <KitButton label="Retry Highlights" variant="light" size="md" onPress={onRetry} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: colors.videoSurface },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },
  art: { width: '100%', height: '100%' },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(14,19,21,0.68)' },
  copy: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 16, gap: 10 },
  title: { color: colors.onVideo, ...TYPE.title, ...figtree('800') },
  body: { color: colors.onVideoMuted, ...TYPE.body },
});
