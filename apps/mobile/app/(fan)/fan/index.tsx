/**
 * Old /fan URL: redirects to Home (/).
 */

import { Redirect } from 'expo-router';

export default function FanHomeRedirect() {
  return <Redirect href="/" />;
}
