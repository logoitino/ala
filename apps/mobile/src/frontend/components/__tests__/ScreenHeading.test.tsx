/** UX-19: fan page headers save height by sharing the title row with the kicker badge; role headings keep their layout. */
import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

let mockPath = '/activity';
jest.mock('expo-router', () => ({ usePathname: () => mockPath }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { theme: { gold: '#7A5A00', text: '#14191B' } } }) }));
jest.mock('@/hooks/useViewerSport', () => ({ useViewerSport: () => null }));
jest.mock('@/components/Effects/SportField', () => ({ SportField: () => null }));
jest.mock('@/components/UI/SportIcon', () => ({ SportIcon: () => null }));

import { ScreenHeading } from '../ScreenHeading';

const rowHolding = (text: string) => {
  let row = screen.getByRole('header').parent;
  while (row && StyleSheet.flatten(row.props.style)?.flexDirection !== 'row') row = row.parent;
  return row ? within(row).queryByText(text) !== null : false;
};
const underlineWidth = () => StyleSheet.flatten(screen.getByTestId('screen-heading-underline', { includeHiddenElements: true }).props.style).width;

it('puts the fan kicker badge on the title row', async () => {
  mockPath = '/activity';
  await render(<ScreenHeading kicker="Friday" title="Activity" lede="Gifts and tags." />);
  expect(rowHolding('Friday')).toBe(true);
});

it('draws a 32pt fan underline and keeps the role heading unchanged', async () => {
  mockPath = '/activity';
  const { unmount } = await render(<ScreenHeading kicker="Friday" title="Activity" />);
  expect(underlineWidth()).toBe(32);
  await unmount();
  mockPath = '/parent';
  await render(<ScreenHeading kicker="Parent HQ" title="Family" />);
  expect(underlineWidth()).toBe(48);
  expect(rowHolding('Parent HQ')).toBe(false);
});

// UX-19 follow-up M4: the kicker badge centres on the title line.
it('centres the fan kicker badge on the title line', async () => {
  mockPath = '/activity';
  await render(<ScreenHeading kicker="Friday" title="Activity" />);
  let badge = screen.getByText('Friday').parent;
  while (badge && StyleSheet.flatten(badge.props.style)?.paddingHorizontal !== 7) badge = badge.parent;
  expect(StyleSheet.flatten(badge!.props.style).alignSelf).toBe('center');
});
