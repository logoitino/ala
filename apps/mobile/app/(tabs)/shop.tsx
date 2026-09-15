import { Redirect } from 'expo-router';

/** Old Drip route. Hidden from the tab bar; keeps `/shop` from 404ing. */
export default function ShopRedirect() {
  return <Redirect href="/drip" />;
}
