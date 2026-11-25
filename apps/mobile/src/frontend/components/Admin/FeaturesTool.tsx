/** Features owns drafted app flags and separate notification controls. MONEY-TIPS-01 extras stay OFF until Publish; this desk grants no payment or migration readiness. */
import { type Href, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  AdminBtn,
  AdminEmpty,
  AdminNotice,
  AdminPage,
  AdminPublishBar,
  AdminRow,
  AdminSectionTitle,
} from '@/components/Admin/AdminChrome';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { colors, radii } from '@/constants/theme';
import { APP_FLAG_GROUPS, getRuntimeFlag, setRuntimeFlag, type AppRuntimeFlagPath } from '@/lib/runtime';
import { SOFT_WALL_AUTH_PROVIDERS, SOFT_WALL_GATES } from '@tapuai/shared-types';
import { NotificationAdminPanel } from './Notifications/NotificationAdminPanel';

/**
 * GUEST-ACCESS-01 reports account gating; security rules have no permissive feature toggle.
 * @purpose Draft fan-bar tabs, hype buttons, and boards. Publish to app is the ship step. Soft-Wall auth gates are code-owned; Features pauses the underlying Mālo / Crew / Wishlist / Operator controls.
 * @sideEffects `patch_app_runtime_draft` on each toggle; `publish_app_runtime` from this desk or the sidebar.
 */
export function FeaturesTool() {
  const router = useRouter();
  const { draft, published, saveDraft } = useAppRuntime();
  const operatorLive = getRuntimeFlag(published, 'layouts.operatorConsole');
  const operatorDraft = getRuntimeFlag(draft, 'layouts.operatorConsole');
  const monetizationLive = getRuntimeFlag(published, 'buttons.MONETIZATION_TIPS_ENABLED');
  const monetizationDraft = getRuntimeFlag(draft, 'buttons.MONETIZATION_TIPS_ENABLED');

  return (
    <AdminPage
      title="Features"
      lede="Layout and Give controls stay a draft until Publish to app. Notification controls save separately when confirmed. The web portal shows app state read-only; all changes happen here."
      saveMode="publish"
    >
      <AdminPublishBar />
      <NotificationAdminPanel />

      <View style={styles.group}>
        <AdminSectionTitle>Optional checkout controls</AdminSectionTitle>
        <AdminNotice
          tone={monetizationLive || monetizationDraft ? 'warn' : 'ok'}
          text={monetizationLive
            ? "Tip Tapua'i (optional) and processing-fee coverage are ON in the published configuration."
            : monetizationDraft
              ? "Tip Tapua'i (optional) and processing-fee coverage are draft ON, live OFF. Publish is required."
              : "Tip Tapua'i (optional) and processing-fee coverage are OFF (default)."}
        />
        <Text style={styles.body}>
          This flag controls optional tips and processing-fee coverage only. After the MONEY-TIPS-01 migration,
          the gift platform share is always zero; turning this flag OFF does not restore the old 90 / 10 model.
          Verify the migration and trusted server enforcement before Publish. Stripe remains in test mode and
          payouts stay blocked. Actual Stripe processing costs are not measured here.
        </Text>
        <View style={styles.linkRow}>
          <AdminBtn label="Open Money" onPress={() => router.push('/admin/money' as Href)} />
          <AdminBtn label="Open Books" onPress={() => router.push('/admin/books' as Href)} />
        </View>
      </View>

      <View style={styles.group}>
        <AdminSectionTitle>Soft-Wall auth</AdminSectionTitle>
        <Text style={styles.body}>
          Guests receive a three-Highlight preview on web and phone. Profiles, search, rosters and other sections require a registered account. Sign-in resumes the intended destination after age confirmation. Coverage tracks account prompts, not server enforcement.
        </Text>
        <AdminNotice text="Guest data source: guest_highlights_preview only. Apply the reviewed GUEST-ACCESS-01 migration and API guard before hosted security acceptance. Missing preview shows a retry, never a full-feed fallback. Access rules cannot be disabled through a fan feature flag." />
        {SOFT_WALL_GATES.map((gate) => {
          const path = gate.flagPath as AppRuntimeFlagPath | undefined;
          const live = path ? getRuntimeFlag(published, path) : true;
          return (
            <AdminRow
              key={gate.id}
              title={gate.label}
              meta={`${gate.hint}${path ? live ? ' · control live' : ' · control paused in Features' : ' · account policy in code'}`}
            />
          );
        })}
        <AdminNotice
          text={`Providers: ${SOFT_WALL_AUTH_PROVIDERS.map((p) => p.label).join(' · ')}. Redirect ${SOFT_WALL_AUTH_PROVIDERS[0]?.redirect ?? 'alasports://auth/callback'}.`}
          tone="ok"
        />
        <AdminNotice
          text={
            operatorLive
              ? 'Operator console is LIVE. Flip Operator console Off + Publish to pause sideline monetization.'
              : operatorDraft
                ? 'Operator console draft ON, live OFF — Publish to open /operator.'
                : 'Operator console paused (default). Flip Operator console On + Publish when you want sideline ops.'
          }
          tone={operatorLive ? 'warn' : 'ok'}
        />
        <View style={styles.linkRow}>
          <AdminBtn label="Open Coverage" onPress={() => router.push('/admin/coverage' as Href)} />
          <AdminBtn label="Open People" onPress={() => router.push('/admin/people' as Href)} />
        </View>
      </View>

      {APP_FLAG_GROUPS.map((group) => (
        <View key={group.id} style={styles.group}>
          <AdminSectionTitle>{group.label}</AdminSectionTitle>
          <Text style={styles.body}>{group.hint}</Text>
          {group.flags.map((flag) => {
            const on = getRuntimeFlag(draft, flag.path);
            const live = getRuntimeFlag(published, flag.path);
            return (
              <AdminRow
                key={flag.path}
                title={flag.label}
                meta={`${flag.hint}${on !== live ? (on ? ' · draft ON, live OFF' : ' · draft OFF, live ON') : live ? ' · live' : ' · live off'}`}
              >
                <AdminBtn
                  label={on ? 'On' : 'Off'}
                  kind={on ? 'primary' : 'danger'}
                  onPress={() => void saveDraft(setRuntimeFlag(draft, flag.path, !on))}
                />
              </AdminRow>
            );
          })}
        </View>
      ))}

      <AdminEmpty text="School names, player stats, captions, Drip prices, and scores save instantly on their own desks. Gift amounts, exclusive dollars, class years, Local chips, booster tiers, and upload labels live on Catalogs. Soft-Wall gates stay in code; pause Give / Crew / Wishlist / Operator here." />
      <View style={styles.linkRow}>
        <AdminBtn label="Open Catalogs" onPress={() => router.push('/admin/catalog' as Href)} />
        <AdminBtn label="Open Look" onPress={() => router.push('/admin/look' as Href)} />
        <AdminBtn label="Open Publish" onPress={() => router.push('/admin/publish' as Href)} />
      </View>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
