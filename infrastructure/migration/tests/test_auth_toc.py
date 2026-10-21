"""Full Auth data proposal gates, with synthetic private fingerprints only; no SQL execution."""
import json
import copy
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import parity
import toc_review

AUTH_TABLES = ['auth.flow_state', 'auth.identities', 'auth.mfa_factors', 'auth.refresh_tokens',
               'auth.schema_migrations', 'auth.sessions', 'auth.users']


def fingerprint(host):
    function = {'kind': 'f', 'returns': 'uuid', 'language': 'sql', 'securityDefiner': False,
                'volatility': 's', 'config': [], 'bodyMd5': 'a' * 32, 'owner': 'supabase_auth_admin',
                'execute': ['PUBLIC'], 'definition': 'CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;',
                'binary': None, 'strict': False, 'leakproof': False, 'parallel': 'u',
                'grants': [{'grantee': 'PUBLIC', 'grantor': 'supabase_auth_admin',
                            'privilege': 'EXECUTE', 'grantOption': False}]}
    service_tables = {table: {'kind': 'r', 'owner': 'supabase_auth_admin', 'rls': True, 'forceRls': False,
                             'columns': ['id uuid not null'], 'constraints': {'primary': 'PRIMARY KEY (id)'},
                             'indexes': {}, 'definition': None, 'grants': ['supabase_auth_admin:SELECT'],
                             'privilegeDetails': [{'grantee': 'supabase_auth_admin', 'grantor': 'supabase_auth_admin',
                                                   'privilege': 'SELECT', 'grantOption': False}]}
                      for table in AUTH_TABLES + ['storage.objects']}
    return {'format': parity.FORMAT,
            'connectionIdentity': {'PGHOST': host, 'PGPORT': '5432', 'PGDATABASE': 'postgres'},
            'meta': {'schemas': ['public'], 'hashRows': True, 'bypassRls': True, 'superuser': False},
            'tables': {}, 'functions': {},
            'service': {'functions': {'auth.uid()': function}, 'attachments': {}, 'tables': service_tables,
                        'authSequences': {}},
            'coverage': {'version': 2, 'serviceFunctionDefinitions': True, 'serviceFunctionKeys': ['auth.uid()'],
                         'serviceFunctionCount': 1, 'serviceFunctionSchemas': ['auth', 'realtime', 'storage'],
                         'applicationFunctionDefinitions': True, 'applicationFunctionKeys': [],
                         'applicationFunctionCount': 0, 'unsupportedServiceFunctionKinds': [],
                         'extensionOwnedFunctionsExcluded': True,
                         'serviceTableDefinitions': True, 'serviceTableKeys': sorted(service_tables),
                         'serviceTableCount': len(service_tables),
                         'authSequenceDefinitions': True, 'authSequenceKeys': [], 'authSequenceCount': 0,
                         'authData': {'mode': 'exact-row-hash', 'requiredTables': sorted(parity.AUTH_REQUIRED),
                                      'missingRequiredTables': [], 'detectedAuthTables': AUTH_TABLES.copy(),
                                      'hashedTables': AUTH_TABLES.copy(), 'detectedMfaTables': ['auth.mfa_factors']}},
            'rows': {table: {'count': 0, 'digest': ''} for table in AUTH_TABLES}}


def toc():
    lines = ['; Original immutable TOC', '1; 2615 16384 SCHEMA - auth supabase_auth_admin',
             '2; 1259 16385 TABLE auth users supabase_auth_admin']
    lines += [f'{100 + i}; 0 {17000 + i} TABLE DATA auth {name.split(".")[1]} supabase_auth_admin'
              for i, name in enumerate(AUTH_TABLES)]
    lines.append('300; 0 19000 TABLE DATA storage objects supabase_storage_admin')
    return '\n'.join(lines) + '\n'


AUTH_SEQUENCE_LINE = '400; 0 0 SEQUENCE SET auth refresh_tokens_id_seq supabase_auth_admin'


def add_sequence(data, last=80, called=True):
    key = 'auth.refresh_tokens_id_seq'
    data['service']['authSequences'][key] = {
        'dataType': 'bigint', 'start': 1, 'increment': 1, 'min': 1, 'max': 9223372036854775807,
        'cache': 1, 'cycle': False, 'owner': 'supabase_auth_admin', 'ownedBy': ['auth.refresh_tokens.id'],
        'grants': [], 'stateRowKey': 'auth-sequence:' + key}
    data['coverage'].update(authSequenceDefinitions=True, authSequenceKeys=[key], authSequenceCount=1)
    data['rows']['auth-sequence:' + key] = {'count': last, 'digest': 'true' if called else 'false'}
    return data


class AllAuthProposalTests(unittest.TestCase):
    def propose(self, source=None, target=None, text=None):
        return toc_review.propose(text or toc(), {'public'}, False,
                                  source or fingerprint('source.invalid'), target or fingerprint('target.invalid'),
                                  include_all_auth_data=True)

    def test_full_opt_in_keeps_all_detected_data_and_no_service_schema_overwrite(self):
        result = self.propose()
        self.assertFalse(result['blocking'])
        self.assertTrue(result['allAuthDataIncluded'])
        kept = [line for line in result['list'].splitlines() if line and not line.startswith(';')]
        self.assertEqual(len(kept), len(AUTH_TABLES))
        self.assertTrue(all('TABLE DATA auth ' in line for line in kept))
        self.assertEqual(result['allAuthTables'], AUTH_TABLES)
        for line in toc().splitlines():
            self.assertTrue(any(out == line or out.endswith(' ' + line) for out in result['list'].splitlines()))

    def test_narrow_mode_does_not_silently_import_sessions_tokens_or_flows(self):
        result = toc_review.propose(toc(), {'public'}, True)
        kept = '\n'.join(line for line in result['list'].splitlines() if not line.startswith(';'))
        self.assertIn('TABLE DATA auth users', kept)
        for name in ['sessions', 'refresh_tokens', 'flow_state', 'schema_migrations']:
            self.assertNotIn('TABLE DATA auth ' + name, kept)

    def test_both_complete_fingerprints_required_and_no_list_on_cli_failure(self):
        for source, target in [(None, fingerprint('target.invalid')), (fingerprint('source.invalid'), None)]:
            result = toc_review.propose(toc(), {'public'}, False, source, target, include_all_auth_data=True)
            self.assertTrue(result['blocking'])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'toc').write_text(toc())
            output = path / 'full.list'
            self.assertEqual(toc_review.main(['--toc', str(path / 'toc'), '--out', str(output),
                                              '--include-all-auth-data']), 1)
            self.assertFalse(output.exists())

    def test_legacy_coverage_or_missing_hash_cannot_enable_full_auth(self):
        for mutate in [lambda f: f.pop('coverage'),
                       lambda f: f['rows']['auth.sessions'].update(digest=None),
                       lambda f: f['coverage']['authData']['detectedAuthTables'].remove('auth.sessions')]:
            source = fingerprint('source.invalid'); mutate(source)
            self.assertTrue(self.propose(source=source)['blocking'])

    def test_schema_table_set_and_every_service_definition_security_grant_must_match(self):
        mutations = [lambda f: f['service']['functions']['auth.uid()'].update(definition='CHANGED'),
                     lambda f: f['service']['functions']['auth.uid()'].update(owner='postgres'),
                     lambda f: f['service']['functions']['auth.uid()']['grants'][0].update(grantOption=True)]
        for mutate in mutations:
            target = fingerprint('target.invalid'); mutate(target)
            self.assertTrue(self.propose(target=target)['blocking'])
        target = fingerprint('target.invalid')
        for key in ('detectedAuthTables', 'hashedTables'):
            target['coverage']['authData'][key].remove('auth.sessions')
        target['rows'].pop('auth.sessions')
        target['service']['tables'].pop('auth.sessions')
        target['coverage']['serviceTableKeys'].remove('auth.sessions')
        target['coverage']['serviceTableCount'] -= 1
        self.assertTrue(parity.coverage_complete(target))
        self.assertTrue(self.propose(target=target)['blocking'])

    def test_full_service_table_shape_and_grants_must_match_before_auth_import(self):
        mutations = [lambda f: f['service']['tables']['auth.users']['columns'].append('new_required text not null'),
                     lambda f: f['service']['tables']['auth.users']['constraints'].update(extra='CHECK (false)'),
                     lambda f: f['service']['tables']['storage.objects'].update(owner='postgres'),
                     lambda f: f['service']['tables']['auth.users']['privilegeDetails'][0].update(grantOption=True)]
        for mutate in mutations:
            target = fingerprint('target.invalid'); mutate(target)
            self.assertTrue(parity.coverage_complete(target))
            self.assertTrue(self.propose(target=target)['blocking'])

    def test_missing_duplicate_or_undetected_auth_data_entry_is_blocked(self):
        session = next(line for line in toc().splitlines() if 'TABLE DATA auth sessions ' in line)
        for text in [toc().replace(session + '\n', ''), toc() + session + '\n',
                     toc() + '999; 0 19999 TABLE DATA auth unknown_credentials supabase_auth_admin\n']:
            self.assertTrue(self.propose(text=text)['blocking'])

    def test_populated_bare_target_and_same_identity_are_blocked_without_deletion(self):
        target = fingerprint('target.invalid'); target['rows']['auth.schema_migrations'] = {'count': 1, 'digest': 'c' * 32}
        self.assertTrue(self.propose(target=target)['blocking'])
        self.assertTrue(self.propose(target=fingerprint('source.invalid'))['blocking'])

    def test_identical_seed_auth_rows_are_preserved_without_duplicate_data_import(self):
        source, target = fingerprint('source.invalid'), fingerprint('target.invalid')
        for data in (source, target):
            data['rows']['auth.schema_migrations'] = {'count': 3, 'digest': 'd' * 32}
        result = self.propose(source=source, target=target)
        self.assertFalse(result['blocking'])
        self.assertEqual(result['preservedAuthTables'], ['auth.schema_migrations'])
        kept = '\n'.join(line for line in result['list'].splitlines() if not line.startswith(';'))
        self.assertNotIn('TABLE DATA auth schema_migrations ', kept)
        self.assertIn('already exact', result['list'])
        source['rows']['auth.schema_migrations']['digest'] = 'e' * 32
        self.assertTrue(self.propose(source=source, target=target)['blocking'])

    def test_unverified_auth_sequence_set_blocks_full_auth_instead_of_silent_exclusion(self):
        result = self.propose(text=toc() + '400; 0 0 SEQUENCE SET auth refresh_tokens_id_seq supabase_auth_admin\n')
        self.assertTrue(result['blocking'])

    def test_detected_auth_sequence_state_is_selected_verbatim_without_auth_ddl(self):
        source, target = add_sequence(fingerprint('source.invalid')), add_sequence(fingerprint('target.invalid'), 1, False)
        text = toc() + AUTH_SEQUENCE_LINE + '\n500; 1259 20000 SEQUENCE auth refresh_tokens_id_seq supabase_auth_admin\n'
        result = self.propose(source, target, text)
        self.assertFalse(result['blocking'])
        kept = [line for line in result['list'].splitlines() if not line.startswith(';')]
        self.assertIn(AUTH_SEQUENCE_LINE, kept)
        self.assertFalse(any(' SEQUENCE auth ' in line for line in kept))
        for text in [toc(), toc() + AUTH_SEQUENCE_LINE + '\n' + AUTH_SEQUENCE_LINE + '\n',
                     toc() + AUTH_SEQUENCE_LINE + '\n501; 0 0 SEQUENCE SET auth unknown_seq supabase_auth_admin\n']:
            self.assertTrue(self.propose(source, target, text)['blocking'])

    def test_ahead_auth_sequence_is_preserved_and_unsupported_definition_blocks(self):
        source, target = add_sequence(fingerprint('source.invalid')), add_sequence(fingerprint('target.invalid'), 120)
        result = self.propose(source, target, toc() + AUTH_SEQUENCE_LINE + '\n')
        self.assertFalse(result['blocking'])
        self.assertEqual(result['preservedAuthSequences'], ['auth.refresh_tokens_id_seq'])
        self.assertNotIn(AUTH_SEQUENCE_LINE, [line for line in result['list'].splitlines() if not line.startswith(';')])
        target['service']['authSequences']['auth.refresh_tokens_id_seq']['increment'] = 2
        self.assertTrue(self.propose(source, target, toc() + AUTH_SEQUENCE_LINE + '\n')['blocking'])

    def test_missing_source_history_on_bare_target_is_restored_and_still_requires_original_toc(self):
        source = fingerprint('source.invalid')
        source['service']['tables']['supabase_migrations.schema_migrations'] = copy.deepcopy(source['service']['tables']['auth.users'])
        source['coverage']['serviceTableKeys'] = sorted(source['service']['tables'])
        source['coverage']['serviceTableCount'] += 1
        source['coverage']['serviceFunctionSchemas'].append('supabase_migrations')
        source['rows']['supabase_migrations.schema_migrations'] = {'count': 1, 'digest': '20261019000000'}
        history = ('600; 2615 21000 SCHEMA - supabase_migrations postgres\n'
                   '601; 1259 21001 TABLE supabase_migrations schema_migrations postgres\n'
                   '602; 0 21001 TABLE DATA supabase_migrations schema_migrations postgres\n')
        result = self.propose(source, fingerprint('target.invalid'), toc() + history)
        self.assertFalse(result['blocking'])
        for line in history.splitlines():
            self.assertIn(line, result['list'].splitlines())
        self.assertTrue(self.propose(source, fingerprint('target.invalid'))['blocking'])

    def test_cli_opt_in_creates_private_original_only_list(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            for name, value in [('source', fingerprint('source.invalid')), ('target', fingerprint('target.invalid'))]:
                (path / (name + '.json')).write_text(json.dumps(value))
            (path / 'toc').write_text(toc())
            output, report = path / 'full.list', path / 'review.md'
            result = toc_review.main(['--toc', str(path / 'toc'), '--out', str(output), '--report', str(report),
                                     '--source-fingerprint', str(path / 'source.json'),
                                     '--target-fingerprint', str(path / 'target.json'), '--include-all-auth-data'])
            self.assertEqual(result, 0)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertIn('all detected Auth', report.read_text())


if __name__ == '__main__':
    unittest.main()
