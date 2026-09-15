import { Redirect, type Href } from 'expo-router';
import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';
import { ROLE_HOME, canAccessRole } from '@/lib/roles';
import type { UserRole } from '@/types/database';

type RoleGateProps = {
  allow: UserRole[];
  children: ReactNode;
};

/**
 * @purpose Redirect when the active Studio preview role (or dual `roles`) is not in `allow`.
 * @param allow Roles that may render this layout. Dual Fan/Athlete users pass athlete HQ while Fan View is on.
 * @sideEffects Expo Router `Redirect` to `ROLE_HOME[role]`.
 */
export function RoleGate({ allow, children }: RoleGateProps) {
  const { role, roles, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.deepGreen} />
      </View>
    );
  }

  if (!canAccessRole(role, allow, roles)) {
    return <Redirect href={ROLE_HOME[role] as Href} />;
  }

  return children;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
