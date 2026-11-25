/** GUEST-ACCESS-01 fixes one cross-platform policy and tests anonymous-session bypasses before UI integration. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { GUEST_PREVIEW_HIGHLIGHTS, guestRouteNeedsAccount, hasAccountSession } from '../../packages/shared-types/guestAccess.ts';

test('guests get a bounded preview and auth completion, not other direct routes', () => {
  assert.equal(GUEST_PREVIEW_HIGHLIGHTS, 3);
  for (const route of ['/', '/auth/callback']) assert.equal(guestRouteNeedsAccount(route), false);
  for (const route of ['/user/a', '/athlete/a', '/player/a', '/gift/a', '/local', '/local/directory', '/beyond', '/profile', '/activity', '/spotlight', '/drip', '/sport-quiz', '/fan-zone', '/admin', '/auth/callback/other']) assert.equal(guestRouteNeedsAccount(route), true, route);
});
test('only a real account session is eligible; anonymous-auth sessions stay guests', () => {
  assert.equal(hasAccountSession(null), false);
  assert.equal(hasAccountSession({ user: { id: '', is_anonymous: false } }), false);
  assert.equal(hasAccountSession({ user: { id: 'account', is_anonymous: true } }), false);
  assert.equal(hasAccountSession({ user: { id: 'account' } }), true);
});
