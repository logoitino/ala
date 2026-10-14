/** VERIFY-02: SSN-shaped text is removed before telemetry leaves the phone; ordinary ids, dates and counts survive. */
import { REDACTED, redactPayload, redactSsnText } from '@/lib/redact';

it('removes SSN-shaped numbers in the common forms', () => {
  // no-ssn-check: fake numbers that test the redaction itself
  expect(redactSsnText('mine is 123-45-6789 ok')).toBe(`mine is ${REDACTED} ok`);
  expect(redactSsnText('123 45 6789')).toBe(REDACTED);
  expect(redactSsnText('123456789')).toBe(REDACTED);
});

it('leaves ids, dates, phone-length numbers and counts alone', () => {
  const id = '00000000-0000-0000-0000-000000000123';
  expect(redactSsnText(id)).toBe(id);
  expect(redactSsnText('2026-10-14')).toBe('2026-10-14');
  expect(redactSsnText('(801) 555-0134')).toBe('(801) 555-0134');
  expect(redactSsnText('1234567890')).toBe('1234567890');
});

it('cleans nested payload strings and keeps numbers and keys', () => {
  expect(redactPayload({ note: 'ssn 123-45-6789', n: 123456789, list: ['a', '987654321'], deep: { x: '111-22-3333' } })) // no-ssn-check: fake numbers that test the redaction itself
    .toEqual({ note: `ssn ${REDACTED}`, n: 123456789, list: ['a', REDACTED], deep: { x: REDACTED } }); // no-ssn-check: payload key named after the test
});
