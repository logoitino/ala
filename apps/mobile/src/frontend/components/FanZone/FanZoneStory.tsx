/** FUN-01 explicitly curated authorized free story; no substitute athlete or new Donate behavior. */
import { useEffect, useMemo, useState } from 'react';
import { AppState, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { FanZoneStory as Story } from '@shared/fanZone';
import { userProfileHref } from '@/lib/navigation';
import { FanButton, FanPanel, fanStyles } from './FanZoneChrome';
/** @sideEffects Explicit public free-story player and navigation into the existing athlete profile/Donate flow. */
export function FanZoneStory({ story, open, onOpen, onClose }: {
    story: Story | null;
    open: boolean;
    onOpen: () => void;
    onClose: () => void;
}) {
    const router = useRouter();
    return <FanPanel title="Meet an athlete">
 {story ? <><Text style={fanStyles.copy}>{story.title}</Text><FanButton label={open ? 'Close athlete story' : 'Watch curated story'} onPress={open ? onClose : onOpen}/>
 {open ? <StoryPlayer key={`${story.id}:${story.video_url}`} url={story.video_url} onClose={onClose}/> : null}
 {story.player_id ? <FanButton label="Athlete profile & Donate" onPress={() => { onClose(); router.push(userProfileHref(story.player_id!)); }}/> : <Text>Profile link is unavailable for this story.</Text>}
 <Text>Watching is free. Donate is optional in the athlete’s existing profile and never adds votes.</Text></> : <Text>This curated story is unavailable. No different athlete is substituted.</Text>}
 </FanPanel>;
}
function StoryPlayer({ url, onClose }: {
    url: string;
    onClose: () => void;
}) {
    const [error, setError] = useState(false);
    const source = useMemo(() => ({ uri: url, useCaching: false }), [url]);
    const player = useVideoPlayer(source, p => { p.loop = false; });
    useEffect(() => { const listener = player.addListener('statusChange', e => { if (e.status === 'error')
        setError(true); }); try {
        player.play();
    }
    catch {
        setError(true);
    } return () => { player.pause(); listener.remove(); }; }, [player]);
    useFocusEffect(useCallback(() => () => onClose(), [onClose]));
    useEffect(() => { const sub = AppState.addEventListener('change', s => { if (s !== 'active')
        onClose(); }); return () => sub.remove(); }, [onClose]);
    return error ? <Text>Curated story playback is unavailable. Please refresh.</Text> : <VideoView player={player} nativeControls style={{ height: 240, width: '100%' }} accessibilityLabel="Curated free athlete story"/>;
}
