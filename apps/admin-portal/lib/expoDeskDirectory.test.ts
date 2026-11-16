/**
 * Keeps the portal Expo desk directory and Control map surfaces honest for agents.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EXPO_DESKS,
  EXPO_DESK_GROUPS,
  PORTAL_COVERAGE_SURFACES,
} from '@tapuai/shared-types/admin/expoDeskDirectory';
import { UNAPPLIED_CONTROLS } from '@tapuai/shared-types/admin/unappliedControls';

describe('expoDeskDirectory', () => {
  it('lists unique Expo /admin paths for every desk', () => {
    const paths = EXPO_DESKS.map((desk) => desk.path);
    assert.equal(new Set(paths).size, paths.length);
    for (const desk of EXPO_DESKS) {
      assert.match(desk.path, /^\/admin(?:\/|$)/);
      assert.ok(desk.title.length > 0);
      assert.ok(desk.detail.length > 0);
      assert.ok(EXPO_DESK_GROUPS.some((group) => group.id === desk.group));
    }
  });

  it('includes Control map, Sport Quiz, Fan Zone, Books, and Support desks', () => {
    const paths = new Set(EXPO_DESKS.map((desk) => desk.path));
    for (const required of [
      '/admin/product/coverage',
      '/admin/sport-quiz',
      '/admin/fan-zone',
      '/admin/books',
      '/admin/support',
      '/admin/money',
    ]) {
      assert.ok(paths.has(required), `missing ${required}`);
    }
  });

  it('keeps portal coverage surfaces unique and web-aware', () => {
    const ids = PORTAL_COVERAGE_SURFACES.map((surface) => surface.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.includes('web'));
    assert.ok(ids.includes('sport-quiz'));
    assert.ok(ids.includes('fan-zone'));
    for (const surface of PORTAL_COVERAGE_SURFACES) {
      assert.match(surface.adminPath, /^\/admin(?:\/|$)/);
    }
  });

  it('probes notifications among unapplied controls', () => {
    assert.ok(UNAPPLIED_CONTROLS.some((row) => row.id === 'notifications'));
    const notifications = UNAPPLIED_CONTROLS.find((row) => row.id === 'notifications')!;
    assert.equal(notifications.rpc, 'get_admin_notification_health');
    assert.equal(notifications.adminPath, '/admin/features');
  });
});
