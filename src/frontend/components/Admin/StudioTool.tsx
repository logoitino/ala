import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';

import {
  AdminBtn,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminPills,
  AdminRow,
} from '@/components/Admin/AdminChrome';
import { AuraTradingCard } from '@/components/Profile/AuraTradingCard';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { DEV_PERSONAS, type DevPersonaId } from '@/data/devPersonas';
import { ADMIN_PRODUCTION_SURFACES } from '@/lib/admin';
import { ROLE_LABELS, STUDIO_PREVIEW_ROLES } from '@/lib/roles';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Admin-only Studio: preview production roles and Aura personas without a Dev bar on Home.
 * @sideEffects `tapuai.studioUnlocked` / `tapuai.devRole` via `previewAsRole`; Expo Router into fan / operator / parent surfaces.
 */
export function StudioTool() {
  const router = useRouter();
  const { role, studioUnlocked, previewAsRole, lockStudio } = useAuth();
  const [personaId, setPersonaId] = useState<DevPersonaId>(DEV_PERSONAS[2]?.handle ?? 'marcus7');
  const persona = DEV_PERSONAS.find((item) => item.handle === personaId) ?? DEV_PERSONAS[0];

  return (
    <AdminPage
      title="Studio"
      lede="Preview the production app as Fan, Athlete, Operator, or Parent. Personas and role chips live here — never on Home."
    >
      <AdminPanel title="Preview as">
        <AdminPills
          label="Role"
          items={STUDIO_PREVIEW_ROLES.map((item) => ({ id: item, label: ROLE_LABELS[item] }))}
          value={role === 'admin' ? 'fan' : role}
          onChange={(id) => void previewAsRole(id)}
        />
        <Text style={styles.hint}>
          Guest, Fan, and Athlete open the production hub with no Studio chrome. Operator / Parent / Booster / Sponsor
          keep a one-line hatch back to this portal.
        </Text>
        <AdminBtn label="Open production as Fan" kind="primary" onPress={() => void previewAsRole('fan')} />
        <AdminBtn label="Open operator console" onPress={() => void previewAsRole('operator')} />
      </AdminPanel>

      <Text style={styles.section}>Production surfaces</Text>
      {ADMIN_PRODUCTION_SURFACES.map((item) => (
        <AdminRow key={item.href} title={item.label} meta={item.hint}>
          <AdminBtn
            label="Open"
            kind="primary"
            onPress={() => {
              const needsRole =
                item.href.startsWith('/operator')
                  ? 'operator'
                  : item.href.startsWith('/parent')
                    ? 'parent'
                    : item.href.startsWith('/booster')
                      ? 'booster'
                      : item.href.startsWith('/sponsor')
                        ? 'sponsor'
                        : null;
              if (needsRole) {
                void previewAsRole(needsRole);
                return;
              }
              router.push(item.href as Href);
            }}
          />
        </AdminRow>
      ))}

      <AdminPanel title="Aura personas">
        <Text style={styles.hint}>
          Flip every tier of the trading card here. Profile no longer ships these chips to fans.
        </Text>
        <AdminPills
          label="Tier"
          items={DEV_PERSONAS.map((item) => ({ id: item.handle, label: item.handle.replace(/_/g, ' ') }))}
          value={personaId}
          onChange={setPersonaId}
        />
        {persona ? (
          <View style={styles.cardWrap}>
            <AuraTradingCard
              name={persona.name}
              username={persona.handle}
              jersey={String(persona.jersey_number)}
              auraPoints={persona.aura_points}
              teamName={persona.school_name}
            />
          </View>
        ) : null}
      </AdminPanel>

      <AdminPanel title="Studio session">
        <AdminNotice
          text={
            studioUnlocked
              ? 'This device can open /admin even while you preview as Fan. Lock Studio to drop the hatch.'
              : 'Unlock happens from Access Restricted in Expo Go, or from a profiles.is_admin account.'
          }
        />
        {studioUnlocked ? (
          <AdminBtn label="Lock Studio on this device" kind="danger" onPress={() => void lockStudio()} />
        ) : null}
      </AdminPanel>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  section: {
    color: FOCAL.neonJade,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  cardWrap: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
});
