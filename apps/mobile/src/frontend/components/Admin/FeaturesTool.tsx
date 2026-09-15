import { StyleSheet, Text, View } from 'react-native';

import {
  AdminBtn,
  AdminEmpty,
  AdminPage,
  AdminPublishBar,
  AdminRow,
  AdminSectionTitle,
} from '@/components/Admin/AdminChrome';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { colors, radii } from '@/constants/theme';
import { APP_FLAG_GROUPS, getRuntimeFlag, setRuntimeFlag } from '@/lib/runtime';

/**
 * @purpose Draft fan-bar tabs, hype buttons, and boards. Publish to app is the ship step.
 * @sideEffects `patch_app_runtime_draft` on each toggle; `publish_app_runtime` from this desk or the sidebar.
 */
export function FeaturesTool() {
  const { draft, published, saveDraft } = useAppRuntime();

  return (
    <AdminPage
      title="Features"
      lede="Turn off a tab or a Mālo button for a campaign. That stays a draft until you hit Publish to app."
      saveMode="publish"
    >
      <AdminPublishBar />

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

      <AdminEmpty text="School names, player stats, captions, Drip prices, and scores save instantly on their own desks. Mālo amounts, exclusive dollars, class years, Local chips, booster tiers, and upload labels live on Catalogs." />
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
