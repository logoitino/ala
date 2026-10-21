/**
 * Synthetic notification contract tests: optional mail requires an explicit category choice.
 * Node's local runner never contacts an account, database or email provider.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as contract from '../../../../packages/shared-types/notifications.ts';

test('notification preferences expose the owner-approved all-email-off defaults', () => {
  assert.equal(typeof contract.makeDefaultNotificationPreferences, 'function', 'default preferences must exist');
  const preferences = contract.makeDefaultNotificationPreferences();
  assert.equal(preferences.revision, 0);
  assert.equal(preferences.emailEnabled, true);
  assert.equal(preferences.inAppEnabled, true);
  assert.equal(Object.keys(preferences.categories).length, 8);
  for (const [id, choice] of Object.entries(preferences.categories)) {
    assert.equal(choice.email, false, `${id} email starts off`);
    assert.equal(choice.inApp, id !== 'games');
  }
});

test('unknown categories and unconfigured source channels fail closed', () => {
  assert.equal(typeof contract.resolveNotificationChoice, 'function', 'channel decision must exist');
  const preferences = contract.makeDefaultNotificationPreferences();
  assert.equal(contract.resolveNotificationChoice(preferences, 'new_category', 'inApp'), false);
  assert.equal(contract.resolveNotificationChoice(preferences, 'account', 'email'), false);
  preferences.categories.account.email = true;
  assert.equal(contract.resolveNotificationChoice(preferences, 'account', 'email'), true);
  preferences.emailEnabled = false;
  assert.equal(contract.resolveNotificationChoice(preferences, 'account', 'email'), false);
  assert.equal(preferences.categories.account.email, true, 'masters preserve choices');
  assert.equal(typeof contract.makeDefaultNotificationConfig, 'function');
  const config = contract.makeDefaultNotificationConfig();
  assert.equal(config.emailEnabled, false);
  assert.equal(config.inAppEnabled, false);
  assert.equal(config.sourceAvailability.account, true);
  assert.equal(config.sourceAvailability.donation_receipts, false);
  assert.equal(Object.values(config.categories).every(value => value === false), true);
});

test('fresh preference defaults cannot mutate another account defaults', () => {
  assert.equal(typeof contract.makeDefaultNotificationPreferences, 'function');
  const first = contract.makeDefaultNotificationPreferences();
  first.categories.account.email = true;
  assert.equal(contract.makeDefaultNotificationPreferences().categories.account.email, false);
});
