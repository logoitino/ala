/**
 * Desk status cards on the admin Home (2026-10-15). The Home route supplies the cards (today the Trivia status card)
 * through this context, so the report screen only marks where they go and a report rendered without the route (tests,
 * other pages) shows none and makes no desk reads.
 * @sideEffects None; each card owns its own read-only admin reads.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { View } from 'react-native';

export const AdminHomeCardsContext = createContext<ReactNode>(null);

/** @purpose Render the Home route's desk cards in the Home report body, or nothing outside the Home route. */
export function AdminHomeCards() {
  const cards = useContext(AdminHomeCardsContext);
  return cards ? <View style={{ gap: 24 }}>{cards}</View> : null;
}
