/**
 * Open support rows land in syntax, logic, glitches, or other. Expected rows stay out.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { failurePoints, type EngineeringSupportSnapshot, type SupportSignal } from '@tapuai/shared-types/admin/engineeringSupport';
import { UNAPPLIED_CONTROLS } from '@tapuai/shared-types/admin/unappliedControls';

const signal = (patch: Partial<SupportSignal>): SupportSignal => ({
  id: '11111111-1111-4111-8111-111111111111',
  fingerprint: 'app:render_failure:client:test:test-release',
  feature: 'app',
  code: 'render_failure',
  source: 'client',
  environment: 'test',
  release: 'test-release',
  category: 'ui',
  severity: 'error',
  occurred_at: '2026-10-17T00:00:00.000Z',
  actor_id: '22222222-2222-4222-8222-222222222222',
  ...patch,
});

const snapshot = (signals: SupportSignal[]): EngineeringSupportSnapshot => ({
  version: 1,
  read_at: '2026-10-17T00:00:00.000Z',
  signals,
  reviews: [],
  audit: [],
  releases: [],
  limits: { signals: 200, reviews: 300, audit: 200, releases: 20 },
});

test('syntax, logic, and glitches are separate, and a cancelled tap is not a failure', () => {
  const points = failurePoints(snapshot([
    signal({ id: '11111111-1111-4111-8111-111111111111', category: 'ui', code: 'render_failure' }),
    signal({ id: '11111111-1111-4111-8111-111111111112', category: 'data', code: 'data_invalid', fingerprint: 'app:data_invalid:client:test:test-release' }),
    signal({ id: '11111111-1111-4111-8111-111111111113', category: 'syntax', code: 'syntax_check_failed', source: 'check', fingerprint: 'app:syntax_check_failed:check:test:test-release' }),
    signal({ id: '11111111-1111-4111-8111-111111111114', category: 'ui', code: 'user_cancelled', fingerprint: 'app:user_cancelled:client:test:test-release' }),
  ]));
  const count = (id: string) => points.find((point) => point.id === id)?.count;
  assert.equal(count('glitch'), 1);
  assert.equal(count('logic'), 1);
  assert.equal(count('syntax'), 1);
  assert.equal(count('other'), 0);
});

test('Fan Zone, Engineering Support, and the IQ note are on the waiting list', () => {
  assert.equal(UNAPPLIED_CONTROLS.find((control) => control.id === 'fan_zone')?.rpc, 'fun_admin_snapshot');
  assert.equal(UNAPPLIED_CONTROLS.find((control) => control.id === 'support')?.adminPath, '/admin/support');
  assert.match(UNAPPLIED_CONTROLS.find((control) => control.id === 'trivia')?.note ?? '', /20261017110000_trivia_iq\.sql/);
});
