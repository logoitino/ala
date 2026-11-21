/** UX-13 proof fixture mounts the actual safe-area provider; badge data and proof assertions remain synthetic. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SchoolCrest } from '@/components/Verification/SchoolCrest';
import type { SchoolBadge } from '@/lib/schoolBadge';

jest.mock('@/components/UI/HapticPressable', () => {
  const { Pressable } = jest.requireActual('react-native');
  return { HapticPressable: Pressable };
});
jest.mock('@/components/Effects/CardShine', () => ({ CardShine: () => null }));
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, Path: View };
});

const BADGE: SchoolBadge = {
  schoolId: 's1',
  schoolName: 'Lone Peak High',
  mascot: 'Knights',
  logoUrl: null,
  colorPrimary: '#1D3F8F',
  colorSecondary: '#FFFFFF',
  confirmedAt: '2026-09-29T18:00:00Z',
  confirmedBy: 'athletic_director',
};

describe('SchoolCrest', () => {
  it('draws the monogram and opens the proof sheet on tap', async () => {
    await render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}><SchoolCrest badge={BADGE} athleteName="Sione Fifita" /></SafeAreaProvider>);
    expect(screen.queryByText(/confirmed Lone Peak High athlete/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Lone Peak High confirmed athlete. Show proof'));
    expect(screen.getByText('Sione Fifita is a confirmed Lone Peak High athlete')).toBeTruthy();
    expect(screen.getByText(/Confirmed in person by the athletic director on/)).toBeTruthy();
    expect(screen.getByText(/A school logo inside a profile photo is not a confirmation/)).toBeTruthy();
  });
});
