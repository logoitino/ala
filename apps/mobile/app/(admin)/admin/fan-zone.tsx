/**
 * FUN-01 Expo operational route; the existing admin shell gates every private desk read and write.
 * @sideEffects Mounts the authenticated admin desk and its bound SDK consumer.
 */
import { FanZoneScreen } from '@/components/Admin/FanZone/FanZoneScreen';
/** @purpose Fan Zone operational desk; no account-facing Fan Zone UI is implemented by this route. */
export default function AdminFanZoneRoute() { return <FanZoneScreen />; }
