/** Web settings expose the existing Highlights preferences only when their card is opened. */
import { HighlightsFeedSettingsSheet } from '@/components/Profile/HighlightsFeedSettingsSheet';
import { useAuth } from '@/context/AuthContext';
import { useFeedPrefs } from '@/hooks/useFeedPrefs';
import { useRoster } from '@/hooks/useRoster';
import { SPORT_CONFIG_SEEDS } from '@/data/sports';

export function DesktopHighlightsSettings({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const prefs = useFeedPrefs();
  const { players } = useRoster();
  const schools = Array.from(new Set([
    profile?.team?.name?.trim() || '',
    ...players.map(player => player.school_name?.trim() || ''),
  ].filter(Boolean))).slice(0, 24);
  return <HighlightsFeedSettingsSheet visible onClose={onClose} prefs={prefs.prefs}
    sportOptions={SPORT_CONFIG_SEEDS.filter(row => row.isActive).map(row => row.sport)}
    schoolOptions={schools} busy={prefs.loading} error={prefs.error}
    onSave={prefs.save} onTogglePersonalization={prefs.setPersonalizationOn} />;
}
