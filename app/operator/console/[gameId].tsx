import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

export default function OperatorConsoleRedirect() {
  const { gameId: rawId } = useLocalSearchParams<{ gameId: string }>();
  const gameId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!gameId) return <Redirect href={'/operator' as Href} />;
  return <Redirect href={`/operator/${gameId}` as Href} />;
}
