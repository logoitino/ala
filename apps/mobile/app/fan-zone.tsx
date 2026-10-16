/** FUN-01 all-role root route; UUID context and permission section select presentation only. */
import { useLocalSearchParams } from 'expo-router';
import { FanZoneScreen } from '@/components/FanZone/FanZoneScreen';
/** @purpose Preserve a selected canonical campaign context while SQL authenticates its actual audience. */
export default function FanZoneRoute() {
    const params = useLocalSearchParams<{
        campaign?: string | string[];
        section?: string | string[];
    }>();
    const campaign = typeof params.campaign === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.campaign) ? params.campaign.toLowerCase() : null;
    return <FanZoneScreen campaignId={campaign} initialSection={params.section === 'permissions' ? 'permissions' : undefined}/>;
}
