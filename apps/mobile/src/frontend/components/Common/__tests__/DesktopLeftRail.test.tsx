/**
 * Desktop left rail: Schools → /local/directory when Local is on; Local path match excludes directory.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockPathname = '/';
let mockLocalOn = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

jest.mock('@/hooks/useAppViewport', () => ({
  useWebDesktopMode: () => 'desktop',
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    roles: [],
    isGuest: true,
    isAdmin: false,
  }),
}));

jest.mock('@/context/AppRuntimeContext', () => ({
  useAppRuntime: () => ({
    live: {
      tabs: {
        home: true,
        local: mockLocalOn,
        spotlight: true,
        drip: true,
        activity: true,
        profile: true,
      },
    },
  }),
}));

jest.mock('@/lib/crew', () => ({
  fetchCrewShortcuts: jest.fn(async () => []),
}));

jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text } = require('react-native');
  return function IoniconsMock({ name }: { name: string }) {
    return <Text>{name}</Text>;
  };
});

import { DesktopLeftRail } from '@/components/Common/DesktopLeftRail';

describe('DesktopLeftRail', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname = '/';
    mockLocalOn = true;
  });

  it('shows Schools and opens /local/directory', async () => {
    await render(<DesktopLeftRail />);
    fireEvent.press(screen.getByLabelText('Schools'));
    expect(mockPush).toHaveBeenCalledWith('/local/directory');
  });

  it('hides Local and Schools when tabs.local is off', async () => {
    mockLocalOn = false;
    await render(<DesktopLeftRail />);
    expect(screen.queryByLabelText('Schools')).toBeNull();
    expect(screen.queryByLabelText('Local')).toBeNull();
  });

  it('selects Schools on the directory path without selecting Local', async () => {
    mockPathname = '/local/directory';
    await render(<DesktopLeftRail />);
    expect(screen.getByLabelText('Schools').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('Local').props.accessibilityState).toEqual({ selected: false });
  });
});
