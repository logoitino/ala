import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

/**
 * @purpose Legacy `/athlete/[id]` deep link → unified `/user/[id]` athlete sheet.
 */
export default function AthleteProfileRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playerId = Array.isArray(id) ? id[0] : id;
  if (!playerId) return null;
  return <Redirect href={`/user/${playerId}` as Href} />;
}
