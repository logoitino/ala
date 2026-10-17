/**
 * The Health list treats only a missing function as a waiting database update.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { missingRpc, UNAPPLIED_CONTROLS } from '@tapuai/shared-types/admin/unappliedControls';

test('a missing function is the only waiting signal', () => {
  assert.equal(missingRpc({ code: 'PGRST202', message: 'could not find the function' }), true);
  assert.equal(missingRpc({ code: '42501', message: 'permission denied' }), false);
  assert.equal(missingRpc(null), false);
  assert.equal(UNAPPLIED_CONTROLS.some((control) => control.id === 'challenges' && control.adminPath === '/admin/highlights'), true);
});
