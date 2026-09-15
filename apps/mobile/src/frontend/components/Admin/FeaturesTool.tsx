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

/**
 * @purpose Draft fan-bar tabs, hype buttons, and boards. Publish to app is the ship step. Soft-Wall auth gates are code-owned; Features pauses the underlying Mālo / Crew / Wishlist / Operator controls.
 * @sideEffects `patch_app_runtime_draft` on each toggle; `publish_app_runtime` from this desk or the sidebar.
 */
export function FeaturesTool() {
  const { draft, published, saveDraft } = useAppRuntime();
  const operatorLive = getRuntimeFlag(published, 'layouts.operatorConsole');
  const operatorDraft = getRuntimeFlag(draft, 'layouts.operatorConsole');

  return (
    <AdminPage
      title="Features"
      lede="Turn off a tab or a Mālo button for a campaign. That stays a draft until you hit Publish to app."
      saveMode="publish"
    >
      <AdminPublishBar />

      <View style={styles.group}>
        <AdminSectionTitle>Soft-Wall auth</AdminSectionTitle>
        <Text style={styles.body}>
          Guests browse Highlights, trading cards, and Locker Room without an account. Mālo, Join Crew, and Chip In open
          SoftWallModal (Apple / Google / Magic Link) then resume. Coverage → Soft-Wall auth tracks wall opens.
        </Text>
        {SOFT_WALL_GATES.map((gate) => {
          const path = gate.flagPath as AppRuntimeFlagPath | undefined;
          const live = path ? getRuntimeFlag(published, path) : true;
          return (
            <AdminRow
              key={gate.id}
              title={gate.label}
              meta={`${gate.hint}${live ? ' · control live' : ' · control paused in Features'}`}
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

      <AdminEmpty text="School names, player stats, captions, Drip prices, and scores save instantly on their own desks. Mālo amounts, exclusive dollars, class years, Local chips, booster tiers, and upload labels live on Catalogs. Soft-Wall gates stay in code; pause Mālo / Crew / Wishlist / Operator here." />
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
});
