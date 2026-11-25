/** Explicit web workspace scope expands existing account sheets without altering native or other popups. */
import { createContext } from 'react';

export const SheetPresentationContext = createContext<'default' | 'web-workspace'>('default');
