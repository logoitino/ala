/** MONEY-TIPS-01: the Next Features reader uses published-only flags and OFF money defaults.
 * Synthetic raw snapshots test the same shared reader used by PortalShell, without hosted I/O. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_RUNTIME_FLAG_GROUPS, readPublishedRuntimeFlag } from '../../../packages/shared-types/index.ts';

const flags = APP_RUNTIME_FLAG_GROUPS.flatMap(group => group.flags);
const money = flags.find(flag => flag.path === 'buttons.MONETIZATION_TIPS_ENABLED')!;
const legacy = flags.find(flag => flag.path === 'buttons.malo')!;

test('the same catalog used by both admin desks defaults only optional money controls OFF', () => {
  assert.equal(money.defaultValue, false);
  assert.equal(flags.filter(flag => flag.path === money.path).length, 1);
  assert.ok(flags.filter(flag => flag.path !== money.path).every(flag => flag.defaultValue == null));
});

for (const [name, published] of Object.entries({
  missingSnapshot: {}, missingButtons: { tabs: {} }, nullButtons: { buttons: null },
  arrayButtons: { buttons: [] }, textTrue: { buttons: { MONETIZATION_TIPS_ENABLED: 'true' } },
  numberTrue: { buttons: { MONETIZATION_TIPS_ENABLED: 1 } },
})) {
  test(`Next published status stays OFF with ${name}`, () => {
    assert.equal(readPublishedRuntimeFlag(published, money), false);
    assert.equal(readPublishedRuntimeFlag(published, legacy), true);
  });
}

test('only an explicit published boolean true enables optional money status', () => {
  assert.equal(readPublishedRuntimeFlag({ buttons: { MONETIZATION_TIPS_ENABLED: true } }, money), true);
  assert.equal(readPublishedRuntimeFlag({ buttons: { MONETIZATION_TIPS_ENABLED: false } }, money), false);
});

test('an unrelated existing OFF value stays OFF independently from money defaults', () => {
  assert.equal(readPublishedRuntimeFlag({ buttons: { malo: false } }, legacy), false);
});
