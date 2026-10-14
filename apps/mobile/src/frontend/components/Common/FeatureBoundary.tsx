/**
 * DETECT-02 feature render containment. Navigation outside the boundary remains usable;
 * private error details never enter its fallback or capture. No automatic render retry,
 * and money/access features stay failed until the owner explicitly replaces their scope.
 */
import React, { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SUPPORT_FEATURES, type SupportFeature } from '@tapuai/shared-types/admin/engineeringSupport';
import { colors, MENU_METRICS, space } from '@/constants/theme';
import { supportSignals, type ClientSupportCapture } from '@/services/SupportSignalManager';

export type FeatureBoundaryProps = {
  feature: SupportFeature; children: ReactNode; resetKey?: string | number;
  onCapture?: (event: ClientSupportCapture) => void; onRecovered?: (feature: SupportFeature) => void;
};
type State = { feature: SupportFeature; resetKey?: string | number; failed: boolean; attempts: number; recovering: boolean };
const allowsRenderRetry = (feature: SupportFeature) => SUPPORT_FEATURES[feature]?.sensitivity === 'general';

/** The effect only runs after all boundary children commit; a second crash never reports success. */
function RecoveryCommit({ onCommit }: { onCommit: () => void }) {
  useEffect(onCommit, [onCommit]);
  return null;
}

/**
 * @purpose Contain a feature render failure with a plain, accessible fallback. Generic features allow
 * one user-requested retry; protected features never retry/remount from a reset-key update.
 * @sideEffects Fixed-code support capture on caught failure and verified child recovery.
 */
export class FeatureBoundary extends React.Component<FeatureBoundaryProps, State> {
  constructor(props: FeatureBoundaryProps) {
    super(props);
    this.state = { feature: props.feature, resetKey: props.resetKey, failed: false, attempts: 0, recovering: false };
  }

  static getDerivedStateFromError(): Partial<State> { return { failed: true, recovering: false }; }

  static getDerivedStateFromProps(props: FeatureBoundaryProps, state: State): Partial<State> | null {
    if (props.feature === state.feature && props.resetKey === state.resetKey) return null;
    const reset = state.failed && allowsRenderRetry(props.feature) && (props.feature !== state.feature || allowsRenderRetry(state.feature));
    return { feature: props.feature, resetKey: props.resetKey, ...(reset ? { failed: false, attempts: 0, recovering: true } : {}) };
  }

  componentDidCatch(): void { this.capture('render_failure'); }

  private capture(code: 'render_failure' | 'recovery_succeeded'): void {
    try { (this.props.onCapture ?? ((event) => { supportSignals.capture(event); }))({ feature: this.props.feature, code }); }
    catch { /* Sensor failure must not replace the contained feature failure. Its owner monitors delivery status. */ }
  }
  private retry = (): void => {
    if (!allowsRenderRetry(this.props.feature) || this.state.attempts >= 1) return;
    this.setState((state) => ({ failed: false, attempts: state.attempts + 1, recovering: true }));
  };
  private recoveryCommitted = (): void => {
    if (!this.state.recovering || this.state.failed) return;
    this.setState({ recovering: false });
    this.capture('recovery_succeeded');
    try { this.props.onRecovered?.(this.props.feature); }
    catch { /* Recovery notification is optional; the successfully rendered feature remains usable. */ }
  };

  render(): ReactNode {
    if (!this.state.failed) return <>{this.props.children}{this.state.recovering && <RecoveryCommit onCommit={this.recoveryCommitted} />}</>;
    return (
      <View style={styles.fallback} accessibilityLiveRegion="polite">
        <Text accessibilityRole="header" style={styles.heading}>This part of the app is unavailable.</Text>
        <Text style={styles.copy}>You can continue using the rest of the app.</Text>
        {allowsRenderRetry(this.props.feature) && this.state.attempts < 1 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Try again" onPress={this.retry} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fallback: { padding: space.lg, gap: space.sm, backgroundColor: colors.surface, borderRadius: MENU_METRICS.cardRadius },
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  copy: { color: colors.textMuted, fontSize: 16, lineHeight: 23 },
  retry: { minHeight: MENU_METRICS.touchTarget, paddingHorizontal: space.md, paddingVertical: space.sm, alignSelf: 'flex-start', justifyContent: 'center', borderRadius: MENU_METRICS.controlRadius, backgroundColor: colors.accentSoft },
  retryText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
