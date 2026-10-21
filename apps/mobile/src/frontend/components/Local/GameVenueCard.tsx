/**
 * LOCAL-02: public game destination and arrival instructions below the match scoreboard.
 * The Games desk owns corrections. Unknown addresses stay readable; external-map failures never hide the address.
 * @sideEffects Explicit map handoff via gameVenue; fixed telemetry codes only, with no game/address/provider text.
 */
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { gameDirectionsUrl, openGameDirections } from '@/lib/gameVenue';
import { TelemetryManager } from '@/services/TelemetryManager';
import type { Game } from '@/types/database';

/** @purpose Present the actual game venue without inferring the home campus or requesting a fan's location. */
export function GameVenueCard({ game }: { game: Game }) {
  const address = game.venue_address?.trim() ?? '';
  const school = game.venue_school?.trim();
  const note = game.venue_notes?.trim();
  const venueKey = `${game.id}:${address}`;
  const currentVenue = useRef(venueKey);
  currentVenue.current = venueKey;
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canNavigate = gameDirectionsUrl(address, Platform.OS) !== null;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setError(null); }, [venueKey]);

  const directions = async () => {
    if (inFlight.current || !canNavigate) return;
    inFlight.current = true;
    setOpening(true);
    setError(null);
    const requestedVenue = venueKey;
    TelemetryManager.getInstance().trackFeature('local_directions', 'local');
    try {
      await openGameDirections(address);
    } catch {
      TelemetryManager.getInstance().trackIssue('local_directions_open_failed', 'local');
      // A late map failure belongs to the tapped venue, not the next match or a corrected address.
      if (mounted.current && currentVenue.current === requestedVenue) {
        setError('Couldn’t open maps. Copy the address above or try again.');
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setOpening(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Where to watch</Text>
      <Text style={styles.venue}>{game.venue?.trim() || 'Venue TBA'}</Text>
      {school ? <Text style={styles.school}>{school}</Text> : null}
      <Text selectable style={styles.address}>{address || 'Address TBA'}</Text>
      {note ? <View style={styles.arrival}><Text style={styles.noteLabel}>Arrival note</Text><Text style={styles.note}>{note}</Text></View> : null}
      {canNavigate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={opening ? 'Opening maps…' : 'Get directions'}
          accessibilityHint={`Opens ${Platform.OS === 'ios' ? 'Apple Maps' : 'Google Maps'} for this game's venue.`}
          accessibilityState={{ disabled: opening, busy: opening }}
          disabled={opening}
          onPress={() => void directions()}
          style={({ pressed }) => [styles.button, (pressed || opening) && styles.dimmed]}
        >
          <Text style={styles.buttonLabel}>{opening ? 'Opening maps…' : 'Get directions'}</Text>
        </Pressable>
      ) : <Text style={styles.hint}>Directions will appear when the venue address is available.</Text>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: 16, gap: 8 },
  heading: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  venue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  school: { color: colors.text, fontSize: 14, fontWeight: '600' },
  address: { color: colors.text, fontSize: 14, lineHeight: 21 },
  arrival: { gap: 3, marginTop: 4 },
  noteLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  note: { color: colors.text, fontSize: 14, lineHeight: 21 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  button: { alignSelf: 'flex-start', minHeight: 44, minWidth: 44, paddingHorizontal: 16, paddingVertical: 12, marginTop: 4, borderRadius: radii.md, backgroundColor: colors.deepGreen, justifyContent: 'center' },
  buttonLabel: { color: colors.onAccent, fontSize: 14, fontWeight: '700' },
  dimmed: { opacity: 0.6 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
