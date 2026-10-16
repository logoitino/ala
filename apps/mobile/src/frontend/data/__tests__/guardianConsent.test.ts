/**
 * MINOR-01: the consent text the app shows is exactly the text the server accepts. The hash in data/guardianConsent.ts
 * must be the SHA-256 of the template and must match `guardian_consent_form_sha256()` (and the version) in the migration,
 * so a wording change cannot slip through without a new version and migration.
 */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';

import {
  GUARDIAN_CONSENT_CLAUSES,
  GUARDIAN_CONSENT_IS_DRAFT,
  GUARDIAN_CONSENT_SHA256,
  GUARDIAN_CONSENT_VERSION,
  fillConsentClause,
  guardianConsentTemplate,
} from '@/data/guardianConsent';

const migration = readFileSync(path.resolve(__dirname, '../../../../../../supabase/migrations/20261014110000_minor_accounts.sql'), 'utf8');

it('pins the exact signed text by hash', () => {
  expect(createHash('sha256').update(guardianConsentTemplate(), 'utf8').digest('hex')).toBe(GUARDIAN_CONSENT_SHA256);
});

it('matches the version and hash the database accepts', () => {
  expect(migration).toContain(`select '${GUARDIAN_CONSENT_VERSION}'::text;`);
  expect(migration).toContain(`select '${GUARDIAN_CONSENT_SHA256}'::text;`);
});

it('stays a draft until counsel approves, and covers the clauses the review asked for', () => {
  expect(GUARDIAN_CONSENT_IS_DRAFT).toBe(true);
  const text = guardianConsentTemplate();
  for (const needle of ['18 or older', 'signature', 'Public profile', 'Donations paid out', 'guardian on record', 'never who their friends are', 'Either of us can end', 'not tax-deductible']) {
    expect(text).toContain(needle);
  }
  expect(GUARDIAN_CONSENT_CLAUSES.length).toBe(6);
});

it('fills the teen\'s first name only on screen', () => {
  expect(fillConsentClause('{teen} sees what I see, {teen} can unlink.', 'Lani')).toBe('Lani sees what I see, Lani can unlink.');
  expect(fillConsentClause('{teen}', '  ')).toBe('this teen');
});
