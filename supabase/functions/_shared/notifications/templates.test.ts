/**
 * Local synthetic template checks protect against copied private/financial content and unsafe links.
 * Previewing produces a document only, never an accepted or delivered email.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as templates from './templates.ts';
const referenceId = '00000000-0000-4000-8000-000000000001';
const unsubscribeUrl = `https://example.invalid/notifications/unsubscribe?t=${'x'.repeat(43)}`;

test('versioned templates reject unknown kinds, categories and extra private fields', () => {
  assert.equal(typeof templates.isNotificationPayload, 'function', 'payload validation must exist');
  assert.equal(templates.isNotificationPayload('account', {version: 1, kind: 'account_welcome', referenceId}), true);
  for (const [category, payload] of [
    ['unknown', {version: 1, kind: 'account_welcome', referenceId}],
    ['account', {version: 2, kind: 'account_welcome', referenceId}],
    ['account', {version: 1, kind: 'donation_confirmed', referenceId}],
    ['account', {version: 1, kind: 'account_welcome', referenceId, amount: 500}],
    ['account', {version: 1, kind: 'account_welcome', referenceId: '<script>'}],
  ]) assert.equal(templates.isNotificationPayload(category, payload), false);
});

test('mail templates only disclose generic copy and authenticated destinations', () => {
  assert.equal(typeof templates.renderNotificationTemplate, 'function', 'template rendering must exist');
  const mail = templates.renderNotificationTemplate('account', {version: 1, kind: 'account_welcome', referenceId}, {
    appOrigin: 'https://example.invalid', unsubscribeUrl,
  });
  assert.equal(mail.templateVersion, 1);
  assert.equal(mail.href, 'https://example.invalid/activity');
  assert.equal(mail.unsubscribeUrl, unsubscribeUrl);
  assert.equal(mail.text.includes(referenceId), false);
  assert.equal(mail.html.includes(referenceId), false);
  assert.match(mail.text, /sign in/i);
  assert.throws(() => templates.renderNotificationTemplate('account', {version: 1, kind: 'account_welcome', referenceId}, {
    appOrigin: 'https://example.invalid', unsubscribeUrl: 'https://attacker.invalid/notifications/unsubscribe?t=bad',
  }), /invalid_template_context/);
  assert.throws(() => templates.renderNotificationTemplate('account', {version: 1, kind: 'account_welcome', referenceId}, {
    appOrigin: 'https://example.invalid', unsubscribeUrl: undefined as unknown as string,
  }), /invalid_template_context/);
});

test('synthetic previews contain no recipient or fake delivery status', () => {
  assert.equal(typeof templates.previewNotificationTemplate, 'function', 'synthetic preview must exist');
  const preview = templates.previewNotificationTemplate('donation_receipts');
  assert.equal(preview.mode, 'preview');
  assert.equal(preview.templateVersion, 1);
  assert.equal('to' in preview, false);
  assert.equal('status' in preview, false);
  assert.match(preview.subject, /donation/i);
  assert.equal(preview.html.includes('$'), false);
  assert.equal(preview.text.includes('tax deduction'), false);
});
