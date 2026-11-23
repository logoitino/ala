/** UX-19: one section heading style shared by every fan tab, pinned to the readable 16/21 Bricolage Bold scale. */
import { FONT, SECTION_HEADING } from '../fonts';

it('SECTION_HEADING is the 16/21 Bricolage Bold section style', () => {
  expect(SECTION_HEADING).toMatchObject({ fontSize: 16, lineHeight: 21, fontFamily: FONT.displayBold, fontWeight: 'normal' });
});
