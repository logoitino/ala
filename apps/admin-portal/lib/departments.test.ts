import assert from 'node:assert/strict';
import test from 'node:test';

import { managementAlerts, managementDeskStatus, type ManagementSnapshot } from './departments.ts';

const quiet: ManagementSnapshot = {
  reportsError: null,
  revenueError: null,
  donations7dCents: 500,
  sessions24h: 12,
  issues24h: 0,
  openBugs: 0,
  stalls24h: 0,
  reconnects24h: 0,
};

test('a quiet window is clear on every desk', () => {
  assert.deepEqual(managementAlerts(quiet), []);
  const tones = Object.fromEntries(managementDeskStatus(quiet).map((desk) => [desk.id, desk.tone]));
  assert.deepEqual(tones, { billing: 'ok', marketing: 'ok', support: 'ok', api: 'ok', it: 'ok' });
});

test('a failed money read is a billing and API alert, and support still sees an issue', () => {
  const snapshot: ManagementSnapshot = {
    ...quiet,
    revenueError: 'permission denied',
    issues24h: 2,
  };
  assert.deepEqual(managementAlerts(snapshot), ['Money did not load. permission denied']);
  const byId = Object.fromEntries(managementDeskStatus(snapshot).map((desk) => [desk.id, desk.tone]));
  assert.equal(byId.billing, 'danger');
  assert.equal(byId.api, 'warn');
  assert.equal(byId.support, 'warn');
  assert.equal(byId.marketing, 'ok');
});

test('both reads failing marks API as danger', () => {
  const snapshot: ManagementSnapshot = { ...quiet, reportsError: 'missing', revenueError: 'missing' };
  assert.equal(managementAlerts(snapshot).length, 2);
  assert.equal(managementDeskStatus(snapshot).find((desk) => desk.id === 'api')?.tone, 'danger');
  assert.equal(managementDeskStatus(snapshot).find((desk) => desk.id === 'it')?.tone, 'danger');
});
