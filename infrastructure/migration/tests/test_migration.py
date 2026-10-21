"""Unit checks for the restore-list proposal and the parity comparer, with synthetic inputs only.

The TOC below imitates `pg_restore --list` from a hosted Supabase dump (managed schemas, extensions, the
realtime publication, Auth and Storage rows, application objects). No database, network or credential is used;
the end-to-end proof on the real schema is `pglite-parity.mjs`, and a hosted restore drill remains unrun.
"""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import parity
import toc_review

TOC = """;
; Archive created at 2026-10-19 12:00:00 UTC
;     dbname: postgres
;
; Selected TOC Entries:
;
4530; 0 0 ENCODING - ENCODING
4531; 0 0 STDSTRINGS - STDSTRINGS
4532; 0 0 SEARCHPATH - SEARCHPATH
16; 2615 16488 SCHEMA - auth supabase_admin
4533; 0 0 ACL - SCHEMA auth supabase_admin
7; 2615 2200 SCHEMA - public pg_database_owner
4534; 0 0 COMMENT - SCHEMA public pg_database_owner
4535; 0 0 ACL - SCHEMA public pg_database_owner
20; 2615 16600 SCHEMA - storage supabase_admin
3; 3079 16700 EXTENSION - pgcrypto -
4536; 0 0 COMMENT - EXTENSION pgcrypto
4; 3079 16710 EXTENSION - pg_graphql -
300; 1255 17000 FUNCTION public is_admin() postgres
301; 1255 17001 FUNCTION public accept_guardian_invite(text, text, text, boolean, boolean, text, text) postgres
4600; 0 0 ACL public FUNCTION is_admin() postgres
310; 1259 17100 TABLE auth users supabase_auth_admin
311; 1259 17101 TABLE auth sessions supabase_auth_admin
320; 1259 17200 TABLE public players postgres
321; 1259 17201 TABLE public profiles postgres
322; 1259 17202 SEQUENCE public challenge_mutes_id_seq postgres
330; 1259 17300 TABLE storage objects supabase_storage_admin
4100; 0 17100 TABLE DATA auth users supabase_auth_admin
4101; 0 17101 TABLE DATA auth sessions supabase_auth_admin
4102; 0 17200 TABLE DATA public players postgres
4103; 0 17201 TABLE DATA public profiles postgres
4104; 0 17300 TABLE DATA storage objects supabase_storage_admin
4105; 0 0 SEQUENCE SET public challenge_mutes_id_seq postgres
3900; 2606 17400 CONSTRAINT public players players_pkey postgres
3901; 2606 17401 FK CONSTRAINT public profiles profiles_id_fkey postgres
3800; 2620 17500 TRIGGER public players players_audit postgres
3700; 3256 17600 POLICY public players Public read postgres
3701; 0 0 ROW SECURITY public players postgres
4700; 0 0 ACL public TABLE players postgres
4800; 6104 17700 PUBLICATION - supabase_realtime postgres
4801; 6106 17701 PUBLICATION TABLE public supabase_realtime games postgres
4900; 826 17800 DEFAULT ACL - DEFAULT PRIVILEGES FOR TABLES postgres
5000; 3466 17900 EVENT TRIGGER - issue_pg_graphql_access supabase_admin
5100; 9999 18000 MYSTERY public something postgres
10; 2615 19719 SCHEMA - fan_zone_private postgres
750; 1255 19720 FUNCTION fan_zone_private upload_allowed(text, uuid) postgres
5549; 0 0 ACL fan_zone_private FUNCTION upload_allowed(p_name text, p_owner uuid) postgres
3962; 2606 18375 CHECK CONSTRAINT public tips tips_amount_cents_cap_check postgres
354; 1255 16402 FUNCTION auth uid() postgres
4837; 2620 17564 TRIGGER auth users on_auth_user_created postgres
4838; 2620 19366 TRIGGER storage objects beyond_storage_guard postgres
4839; 2620 19367 TRIGGER storage objects update_objects_updated_at supabase_storage_admin
5292; 3256 19372 POLICY storage objects Beyond approved and inspection media postgres
5070; 0 16432 ROW SECURITY storage objects supabase_storage_admin
"""


def bare_target():
    """Fingerprint of a fresh stack: public exists, Storage ships its own updated_at trigger and auth.uid()."""
    return {'meta': {'schemas': ['public']}, 'service': {
        'attachments': {'auth.users': {'rls': False, 'policies': {}, 'triggers': {}},
                        'storage.objects': {'rls': True, 'policies': {}, 'triggers': {'update_objects_updated_at': {'def': 'x', 'enabled': 'O'}}}},
        'functions': ['auth.uid()', 'auth.role()']}}


def fingerprint_fixture():
    """A small source fingerprint: two tables, one of them pointing at auth.users."""
    table = {'kind': 'r', 'owner': 'postgres', 'rls': True, 'forceRls': False, 'columns': ['id uuid not null'],
             'constraints': {}, 'indexes': {}, 'triggers': {}, 'policies': {}, 'definition': None, 'grants': []}
    profiles = copy.deepcopy(table)
    profiles['constraints'] = {'profiles_id_fkey': 'FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE'}
    return {'tables': {'public.players': table, 'public.profiles': profiles}}


class TocReviewTests(unittest.TestCase):
    def decisions(self, include_auth=False, fingerprint=None, target=None, schemas=('public', 'fan_zone_private')):
        result = toc_review.propose(TOC, set(schemas), include_auth, fingerprint, target)
        kept = [line for line in result['list'].splitlines() if line and not line.startswith(';')]
        return result, kept

    def test_output_only_drops_or_comments_original_lines(self):
        result, kept = self.decisions()
        original = {line for line in TOC.splitlines() if line[:1].isdigit()}
        self.assertTrue(set(kept) <= original)
        # Every original entry is still present, verbatim or after the comment prefix.
        for line in original:
            self.assertTrue(any(out == line or out.endswith(' ' + line) for out in result['list'].splitlines()), line)

    def test_application_objects_kept_and_managed_objects_excluded(self):
        _, kept = self.decisions()
        joined = '\n'.join(kept)
        for wanted in ('TABLE public players', 'TABLE DATA public players', 'FUNCTION public accept_guardian_invite(text, text, text, boolean, boolean, text, text)',
                       'POLICY public players Public read', 'ROW SECURITY public players', 'SEQUENCE SET public challenge_mutes_id_seq',
                       'FK CONSTRAINT public profiles profiles_id_fkey', 'PUBLICATION TABLE public supabase_realtime games', 'ENCODING - ENCODING'):
            self.assertIn(wanted, joined)
        for unwanted in ('SCHEMA - auth', 'SCHEMA - public', 'COMMENT - SCHEMA public', 'ACL - SCHEMA public', 'EXTENSION - pgcrypto',
                         'TABLE auth users', 'TABLE DATA storage objects', 'PUBLICATION - supabase_realtime', 'EVENT TRIGGER'):
            self.assertNotIn(unwanted, joined)

    def test_pg18_check_constraints_and_second_app_schema_are_restored(self):
        _, kept = self.decisions()
        joined = '\n'.join(kept)
        self.assertIn('CHECK CONSTRAINT public tips tips_amount_cents_cap_check', joined)
        self.assertIn('SCHEMA - fan_zone_private', joined)  # the target does not have it yet
        self.assertIn('FUNCTION fan_zone_private upload_allowed(text, uuid)', joined)
        self.assertIn('ACL fan_zone_private FUNCTION upload_allowed', joined)

    def test_app_attachments_on_supabase_tables_kept_and_stack_objects_excluded(self):
        result, kept = self.decisions(include_auth=True, target=bare_target())
        joined = '\n'.join(kept)
        self.assertIn('TRIGGER auth users on_auth_user_created', joined)             # signup creates the profile
        self.assertIn('TRIGGER storage objects beyond_storage_guard', joined)
        self.assertIn('POLICY storage objects Beyond approved and inspection media', joined)
        self.assertNotIn('update_objects_updated_at', joined)                       # the stack already has it
        self.assertNotIn('FUNCTION auth uid()', joined)
        self.assertNotIn('ROW SECURITY storage objects', joined)
        self.assertFalse(any('storage objects' in r['line'] or 'auth users' in r['line'] for r in result['review']))

    def test_without_target_fingerprint_supabase_attachments_need_review(self):
        result, kept = self.decisions(include_auth=True)
        reviewed = '\n'.join(r['line'] for r in result['review'])
        self.assertIn('on_auth_user_created', reviewed)
        self.assertIn('Beyond approved and inspection media', reviewed)
        self.assertFalse(any('on_auth_user_created' in line for line in kept))

    def test_storage_rows_never_restored_because_the_api_recreates_them(self):
        _, kept = self.decisions(include_auth=True)
        self.assertFalse(any('storage objects' in line for line in kept))

    def test_auth_rows_opt_in_and_sessions_never(self):
        _, without = self.decisions()
        _, with_auth = self.decisions(include_auth=True)
        self.assertNotIn('4100; 0 17100 TABLE DATA auth users supabase_auth_admin', without)
        self.assertIn('4100; 0 17100 TABLE DATA auth users supabase_auth_admin', with_auth)
        self.assertNotIn('4101; 0 17101 TABLE DATA auth sessions supabase_auth_admin', with_auth)

    def test_unknown_and_default_acl_entries_need_review(self):
        result, kept = self.decisions()
        reviewed = [r['line'] for r in result['review']]
        self.assertTrue(any('MYSTERY' in line for line in reviewed))
        self.assertTrue(any('DEFAULT ACL' in line for line in reviewed))
        self.assertFalse(any('MYSTERY' in line for line in kept))
        self.assertEqual(result['extensionsRequiredOnTarget'], ['pg_graphql', 'pgcrypto'])

    def test_blocks_auth_foreign_keys_without_auth_rows(self):
        result, _ = self.decisions(fingerprint=fingerprint_fixture())
        self.assertTrue(any('profiles_id_fkey references Auth' in p for p in result['blocking']))
        result, _ = self.decisions(include_auth=True, fingerprint=fingerprint_fixture())
        self.assertEqual(result['blocking'], [])

    def test_blocks_app_table_missing_from_dump(self):
        fp = fingerprint_fixture()
        fp['tables']['public.donations'] = copy.deepcopy(fp['tables']['public.players'])
        result, _ = self.decisions(include_auth=True, fingerprint=fp)
        self.assertIn('public.donations: table definition missing from the dump or not selected', result['blocking'])
        self.assertIn('public.donations: table rows missing from the dump or not selected', result['blocking'])

    def test_cli_refuses_blocking_and_accepts_restore_py_format(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            (tmp / 'database.toc').write_text(TOC)
            (tmp / 'fp.json').write_text(json.dumps(fingerprint_fixture()))
            refused = toc_review.main(['--toc', str(tmp / 'database.toc'), '--out', str(tmp / 'a.list'),
                                       '--source-fingerprint', str(tmp / 'fp.json')])
            self.assertEqual(refused, 1)
            self.assertFalse((tmp / 'a.list').exists())
            status = toc_review.main(['--toc', str(tmp / 'database.toc'), '--out', str(tmp / 'b.list'), '--include-auth-data',
                                      '--source-fingerprint', str(tmp / 'fp.json'), '--report', str(tmp / 'b.md')])
            self.assertEqual(status, 2)  # written, but MYSTERY and DEFAULT ACL still need a person
            self.assertEqual((tmp / 'b.list').stat().st_mode & 0o777, 0o600)
            # The same acceptance rule restore.py applies: kept lines are verbatim TOC entries, no duplicates.
            sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backup'))
            import restore
            selected = restore.reviewed_list(tmp, tmp / 'b.list')
            self.assertIn('4102; 0 17200 TABLE DATA public players postgres', selected)

    def test_refuses_to_write_inside_the_repository(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / 'database.toc').write_text(TOC)
            inside = Path(__file__).resolve().parent / 'should-not-exist.list'
            with self.assertRaises(ValueError):
                toc_review.main(['--toc', str(Path(tmp) / 'database.toc'), '--out', str(inside), '--include-auth-data'])
            self.assertFalse(inside.exists())
            with self.assertRaises(ValueError):
                parity.write_private(str(inside), '{}')

    def test_rejects_managed_schema_as_application_schema(self):
        with self.assertRaises(SystemExit):
            toc_review.main(['--toc', 'x', '--out', 'y', '--schemas', 'public,auth'])


def base_fingerprint():
    table = {'kind': 'r', 'owner': 'postgres', 'rls': True, 'forceRls': False,
             'columns': ['id uuid not null default gen_random_uuid()', 'name text not null'],
             'constraints': {'players_pkey': 'PRIMARY KEY (id)'}, 'indexes': {'players_pkey': 'CREATE UNIQUE INDEX players_pkey ON public.players USING btree (id)'},
             'triggers': {'audit': {'def': 'CREATE TRIGGER audit AFTER INSERT ON public.players FOR EACH ROW EXECUTE FUNCTION audit()', 'enabled': 'O'}},
             'policies': {'Public read': {'cmd': 'r', 'permissive': True, 'roles': ['PUBLIC'], 'using': 'true', 'check': None}},
             'definition': None, 'grants': ['anon:SELECT', 'authenticated:SELECT', 'postgres:SELECT']}
    function = {'kind': 'f', 'returns': 'boolean', 'language': 'sql', 'securityDefiner': True, 'volatility': 's',
                'config': ['search_path=""'], 'bodyMd5': '9' * 32, 'owner': 'postgres', 'execute': ['authenticated', 'postgres'],
                'definition': 'CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO "" AS $$ SELECT false $$;',
                'binary': None, 'strict': False, 'leakproof': False, 'parallel': 'u',
                'grants': [{'grantee': role, 'grantor': 'postgres', 'privilege': 'EXECUTE', 'grantOption': False}
                           for role in ['authenticated', 'postgres']]}
    service_function = {**copy.deepcopy(function), 'definition': 'CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;',
                        'returns': 'uuid', 'bodyMd5': 'a' * 32, 'binary': None, 'strict': False,
                        'leakproof': False, 'parallel': 'u'}
    service_tables = {key: {k: copy.deepcopy(v) for k, v in table.items() if k not in ('policies', 'triggers')}
                      for key in ('auth.users', 'auth.identities', 'auth.mfa_factors', 'storage.objects', 'storage.buckets')}
    for body in service_tables.values():
        body['privilegeDetails'] = [{'grantee': 'postgres', 'grantor': 'postgres', 'privilege': 'SELECT', 'grantOption': False}]
    return {'format': parity.FORMAT,
            'coverage': {'version': 2, 'serviceFunctionDefinitions': True,
                         'serviceFunctionKeys': ['auth.uid()'], 'serviceFunctionCount': 1,
                         'applicationFunctionDefinitions': True, 'applicationFunctionKeys': ['public.is_admin()'],
                         'applicationFunctionCount': 1, 'extensionOwnedFunctionsExcluded': True,
                         'serviceTableDefinitions': True, 'serviceTableKeys': sorted(service_tables),
                         'serviceTableCount': len(service_tables),
                         'authSequenceDefinitions': True, 'authSequenceKeys': [], 'authSequenceCount': 0,
                         'serviceFunctionSchemas': ['auth', 'realtime', 'storage'],
                         'unsupportedServiceFunctionKinds': [], 'authData': {'mode': 'exact-row-hash',
                         'requiredTables': ['auth.users', 'auth.identities', 'auth.mfa_factors'],
                         'missingRequiredTables': [], 'hashedTables': ['auth.identities', 'auth.mfa_factors', 'auth.users'],
                         'detectedAuthTables': ['auth.identities', 'auth.mfa_factors', 'auth.users'],
                         'detectedMfaTables': ['auth.mfa_factors'],
                         'absentKnownMfaTables': ['auth.mfa_amr_claims', 'auth.mfa_challenges']}},
            'meta': {'serverVersionNum': 170011, 'currentUser': 'postgres', 'superuser': False, 'bypassRls': True,
                     'schemas': ['public'], 'missingSchemas': [], 'hashRows': True},
            'extensions': {'pgcrypto': {'version': '1.3', 'schema': 'extensions'}},
            'tables': {'public.players': table}, 'functions': {'public.is_admin()': function},
            'sequences': {'public.seq': 42}, 'enums': {'public.status': ['a', 'b']},
            'publications': {'supabase_realtime': ['public.players']},
            'service': {'attachments': {}, 'functions': {'auth.uid()': service_function}, 'tables': service_tables, 'authSequences': {}},
            'rows': {'public.players': {'count': 2, 'digest': 'd1'}, 'auth.users': {'count': 5, 'digest': 'b' * 32},
                     'auth.identities': {'count': 5, 'digest': 'c' * 32}, 'auth.mfa_factors': {'count': 0, 'digest': ''},
                     'supabase_migrations.schema_migrations': {'count': 2, 'digest': '20260929120000,20261013210000'}},
            'access': [{'who': 'anon', 'key': 'public.players', 'count': 2, 'digest': 'a1', 'error': None},
                       {'who': 'user:u1', 'key': 'public.players', 'count': 2, 'digest': 'a1', 'error': None},
                       {'who': 'anon', 'key': 'public.rallies', 'count': None, 'digest': None, 'error': '42501'}]}


class ParityCompareTests(unittest.TestCase):
    def blocked(self, mutate):
        source, target = base_fingerprint(), base_fingerprint()
        mutate(target)
        return [(i['area'], i['message']) for i in parity.compare(source, target)['findings'] if i['severity'] == 'block']

    def test_identical_fingerprints_pass(self):
        result = parity.compare(base_fingerprint(), base_fingerprint())
        self.assertTrue(result['ok'])
        self.assertEqual(result['findings'], [])
        self.assertTrue(result['compared']['coverageComplete'])
        self.assertEqual(result['compared']['serviceFunctions'], 1)

    def test_service_function_names_alone_do_not_establish_exact_parity(self):
        source, target = base_fingerprint(), base_fingerprint()
        for fp in (source, target):
            fp.pop('coverage')
            fp['service']['functions'] = ['auth.uid()']
            fp['rows']['auth.users']['digest'] = None
        result = parity.compare(source, target)
        self.assertTrue(result['ok'])  # legacy diagnostic remains usable; the strict migration gate is false
        self.assertFalse(result['compared']['coverageComplete'])
        self.assertEqual(len([f for f in result['findings'] if f['area'] == 'coverage']), 2)

    def test_service_function_exact_behavior_and_privileges_block_upgrade_drift(self):
        changes = {'definition': 'CREATE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql;',
                   'config': [], 'securityDefiner': False, 'strict': True, 'leakproof': True,
                   'parallel': 's', 'binary': 'different-version.so', 'owner': 'supabase_auth_admin',
                   'execute': ['PUBLIC'],
                   'grants': [{'grantee': 'authenticated', 'grantor': 'postgres',
                               'privilege': 'EXECUTE', 'grantOption': True}]}
        for field, value in changes.items():
            with self.subTest(field=field):
                findings = self.blocked(lambda fp: fp['service']['functions']['auth.uid()'].update({field: value}))
                self.assertIn(('service-functions', f'{field} differs (pinned service compatibility required)'), findings)

    def test_extra_service_function_is_not_ignored_by_allow_extra(self):
        source, target = base_fingerprint(), base_fingerprint()
        target['service']['functions']['auth.new_helper()'] = copy.deepcopy(target['service']['functions']['auth.uid()'])
        result = parity.compare(source, target, allow_extra=True)
        self.assertFalse(result['ok'])
        self.assertTrue(any(f['key'] == 'auth.new_helper()' and f['severity'] == 'block' for f in result['findings']))

    def test_same_count_auth_identity_and_mfa_content_drift_blocks(self):
        for table in ('auth.users', 'auth.identities', 'auth.mfa_factors'):
            with self.subTest(table=table):
                source, target = base_fingerprint(), base_fingerprint()
                source['rows'][table] = {'count': 1, 'digest': '1' * 32}
                target['rows'][table] = {'count': 1, 'digest': '2' * 32}
                # App table count-only mode cannot hide a replaced password/identity/MFA secret.
                source['meta']['hashRows'] = target['meta']['hashRows'] = False
                result = parity.compare(source, target)
                self.assertFalse(result['ok'])
                self.assertTrue(any(f['area'] == 'rows' and f['key'] == table for f in result['findings']))

    def test_missing_factors_on_both_synthetic_stacks_warns_and_cannot_be_ready(self):
        source, target = base_fingerprint(), base_fingerprint()
        for fp in (source, target):
            auth = fp['coverage']['authData']
            auth['hashedTables'].remove('auth.mfa_factors')
            auth['detectedAuthTables'].remove('auth.mfa_factors')
            auth['detectedMfaTables'] = []
            auth['missingRequiredTables'] = ['auth.mfa_factors']
            auth['absentKnownMfaTables'].append('auth.mfa_factors')
            del fp['rows']['auth.mfa_factors']
            del fp['service']['tables']['auth.mfa_factors']
            fp['coverage']['serviceTableKeys'].remove('auth.mfa_factors')
            fp['coverage']['serviceTableCount'] -= 1
        result = parity.compare(source, target)
        self.assertTrue(result['ok'])
        self.assertFalse(result['compared']['coverageComplete'])
        self.assertTrue(any(f['area'] == 'coverage' for f in result['findings']))

    def test_detected_version_specific_mfa_tables_must_be_hashed_and_match(self):
        source, target = base_fingerprint(), base_fingerprint()
        table = 'auth.mfa_webauthn_credentials'
        for fp in (source, target):
            auth = fp['coverage']['authData']
            auth['hashedTables'] = sorted(auth['hashedTables'] + [table])
            auth['detectedAuthTables'] = sorted(auth['detectedAuthTables'] + [table])
            auth['detectedMfaTables'] = sorted(auth['detectedMfaTables'] + [table])
            fp['rows'][table] = {'count': 1, 'digest': '4' * 32}
            fp['service']['tables'][table] = copy.deepcopy(fp['service']['tables']['auth.mfa_factors'])
            fp['coverage']['serviceTableKeys'] = sorted(fp['service']['tables'])
            fp['coverage']['serviceTableCount'] = len(fp['service']['tables'])
        self.assertTrue(parity.compare(source, target)['compared']['coverageComplete'])
        target['rows'][table]['digest'] = '5' * 32
        self.assertFalse(parity.compare(source, target)['ok'])
        del target['rows'][table]
        target['coverage']['authData']['hashedTables'].remove(table)
        target['coverage']['authData']['detectedAuthTables'].remove(table)
        target['coverage']['authData']['detectedMfaTables'].remove(table)
        result = parity.compare(source, target)
        self.assertFalse(result['ok'])
        self.assertTrue(any(f['area'] == 'coverage' and f['key'] == 'Auth data' for f in result['findings']))

    def test_same_count_auth_sessions_refresh_tokens_and_flow_drift_blocks(self):
        for table in ('auth.sessions', 'auth.refresh_tokens', 'auth.flow_state'):
            with self.subTest(table=table):
                source, target = base_fingerprint(), base_fingerprint()
                for fp in (source, target):
                    auth = fp['coverage']['authData']
                    auth['hashedTables'] = sorted(auth['hashedTables'] + [table])
                    auth['detectedAuthTables'] = sorted(auth['detectedAuthTables'] + [table])
                    fp['rows'][table] = {'count': 1, 'digest': '6' * 32}
                    fp['service']['tables'][table] = copy.deepcopy(fp['service']['tables']['auth.users'])
                    fp['coverage']['serviceTableKeys'] = sorted(fp['service']['tables'])
                    fp['coverage']['serviceTableCount'] = len(fp['service']['tables'])
                    fp['meta']['hashRows'] = False
                target['rows'][table]['digest'] = '7' * 32
                result = parity.compare(source, target)
                self.assertFalse(result['ok'])
                self.assertTrue(result['compared']['coverageComplete'])
                self.assertTrue(any(f['area'] == 'rows' and f['key'] == table for f in result['findings']))
                source['coverage']['authData']['hashedTables'].remove(table)
                self.assertFalse(parity.coverage_complete(source))

    def test_claimed_coverage_without_required_hash_or_definition_is_incomplete(self):
        mutations = [lambda fp: fp['rows']['auth.users'].update(digest=None),
                     lambda fp: fp['rows']['auth.identities'].update(digest='not-a-hash'),
                     lambda fp: fp['service']['functions']['auth.uid()'].pop('definition'),
                     lambda fp: fp['coverage'].update(unsupportedServiceFunctionKinds=['auth.agg(integer)']),
                     lambda fp: fp['rows'].update({'auth.mfa_unknown': {'count': 0, 'digest': ''}})]
        for change in mutations:
            fp = base_fingerprint()
            change(fp)
            self.assertFalse(parity.coverage_complete(fp))

    def test_empty_or_partial_function_dictionary_is_not_complete_coverage(self):
        for prefix, area in (('service', 'service'), ('application', None)):
            fp = base_fingerprint()
            funcs = fp['service']['functions'] if area else fp['functions']
            funcs.clear()
            self.assertFalse(parity.coverage_complete(fp))
            if prefix == 'service':
                fp['coverage']['serviceFunctionCount'] = 0
                fp['coverage']['serviceFunctionKeys'] = []
                self.assertFalse(parity.coverage_complete(fp))
        legacy = base_fingerprint()
        legacy['functions']['public.is_admin()'].pop('definition')
        self.assertFalse(parity.coverage_complete(legacy))

    def test_null_or_invalid_function_evidence_cannot_establish_complete_coverage(self):
        invalid = {'owner': None, 'returns': None, 'language': '', 'bodyMd5': 'not-a-hash',
                   'securityDefiner': None, 'strict': None, 'leakproof': None, 'kind': 'other',
                   'parallel': 'other', 'volatility': 'other', 'binary': {}, 'config': [None],
                   'execute': [None], 'grants': [{'grantee': 'authenticated', 'grantor': None,
                                               'privilege': 'EXECUTE', 'grantOption': False}]}
        for field, value in invalid.items():
            with self.subTest(field=field):
                fp = base_fingerprint()
                fp['service']['functions']['auth.uid()'][field] = value
                self.assertFalse(parity.coverage_complete(fp))

    def test_same_signature_changed_default_and_application_flags_are_blocked(self):
        for field, value in {'definition': 'CREATE FUNCTION public.is_admin() RETURNS boolean AS $$ SELECT true $$ LANGUAGE sql;',
                             'strict': True, 'leakproof': True, 'parallel': 'r',
                             'binary': 'other.so', 'grants': []}.items():
            with self.subTest(field=field):
                findings = self.blocked(lambda fp: fp['functions']['public.is_admin()'].update({field: value}))
                self.assertTrue(any(area == 'functions' for area, _ in findings))
        source, target = base_fingerprint(), base_fingerprint()
        for fp, default in ((source, 'false'), (target, 'true')):
            body = fp['functions'].pop('public.is_admin()')
            body['definition'] = f'CREATE FUNCTION public.check_access(enabled boolean DEFAULT {default}) RETURNS boolean LANGUAGE sql AS $$ SELECT enabled $$;'
            fp['functions']['public.check_access(enabled boolean)'] = body
            fp['coverage']['applicationFunctionKeys'] = ['public.check_access(enabled boolean)']
        result = parity.compare(source, target)
        self.assertFalse(result['ok'])
        self.assertTrue(any(f['area'] == 'functions' and f['message'] == 'exact definition/defaults differs' for f in result['findings']))

    def test_same_named_auth_table_schema_defaults_constraints_and_acl_drift_block(self):
        changes = {'columns': ['id uuid not null default null::uuid', 'name text not null'],
                   'constraints': {'players_pkey': 'UNIQUE (id)'},
                   'indexes': {'players_pkey': 'CREATE INDEX players_pkey ON auth.users USING btree (name)'},
                   'owner': 'different_auth_admin', 'rls': False, 'forceRls': True,
                   'privilegeDetails': [{'grantee': 'postgres', 'grantor': 'postgres', 'privilege': 'SELECT', 'grantOption': True}]}
        for field, value in changes.items():
            with self.subTest(field=field):
                findings = self.blocked(lambda fp: fp['service']['tables']['auth.users'].update({field: value}))
                self.assertIn(('service-tables', f'{field} differs (pinned service schema compatibility required)'), findings)

    def test_preimport_schema_compatibility_keeps_app_attachments_separate(self):
        source, target = base_fingerprint(), base_fingerprint()
        source['service']['attachments'] = {'auth.users': {'rls': True, 'policies': {},
                      'triggers': {'on_auth_user_created': {'def': 'CREATE TRIGGER signup ...', 'enabled': 'O'}}}}
        self.assertTrue(parity.service_tables_compatible(source, target))
        target['service']['tables']['auth.users']['columns'].append('instance_id uuid not null')
        self.assertFalse(parity.service_tables_compatible(source, target))

    def sequence_fixture(self, last=200, called=True, increment=1, cycle=False):
        fp = base_fingerprint()
        key = 'auth.refresh_tokens_id_seq'
        fp['service']['authSequences'][key] = {'dataType': 'bigint', 'start': 1, 'increment': increment,
                 'min': 1, 'max': 9223372036854775807, 'cache': 1, 'cycle': cycle, 'owner': 'postgres',
                 'ownedBy': ['auth.refresh_tokens.id'], 'grants': [{'grantee': 'postgres', 'grantor': 'postgres',
                 'privilege': 'USAGE', 'grantOption': False}], 'stateRowKey': parity.AUTH_SEQUENCE_PREFIX + key}
        fp['coverage']['authSequenceKeys'] = [key]
        fp['coverage']['authSequenceCount'] = 1
        fp['rows'][parity.AUTH_SEQUENCE_PREFIX + key] = {'count': last, 'digest': 'true' if called else 'false'}
        return fp

    def test_fresh_auth_sequence_behind_restored_ids_blocks_and_source_set_is_planned(self):
        source, target = self.sequence_fixture(), self.sequence_fixture(last=1, called=False)
        result = parity.compare(source, target)
        self.assertFalse(result['ok'])
        self.assertTrue(result['compared']['coverageComplete'])
        self.assertTrue(any(f['area'] == 'auth-sequences' and f['severity'] == 'block' for f in result['findings']))
        plan = parity.auth_sequence_plan(source, target)
        self.assertTrue(plan['compatible'])
        self.assertEqual(plan['sequences'][0]['source']['nextValue'], 201)
        self.assertEqual(plan['sequences'][0]['target']['nextValue'], 1)
        self.assertEqual(plan['sequences'][0]['action'], 'restore-source-state')

    def test_is_called_false_state_is_distinct_from_called_at_same_last_value(self):
        source, target = self.sequence_fixture(last=200), self.sequence_fixture(last=200, called=False)
        self.assertFalse(parity.compare(source, target)['ok'])
        self.assertEqual(parity.auth_sequence_state(target, 'auth.refresh_tokens_id_seq'),
                         {'lastValue': 200, 'isCalled': False, 'nextValue': 200})

    def test_already_ahead_auth_sequence_is_preserved_and_not_regressed(self):
        source, target = self.sequence_fixture(), self.sequence_fixture(last=300)
        result = parity.compare(source, target)
        self.assertTrue(result['ok'])
        self.assertTrue(any(f['area'] == 'auth-sequences' and f['severity'] == 'warn' for f in result['findings']))
        self.assertEqual(parity.auth_sequence_plan(source, target)['sequences'][0]['action'], 'preserve-target-state')
        self.assertTrue(parity.compare(source, self.sequence_fixture())['ok'])

    def test_missing_sequence_state_or_mutable_acl_cannot_claim_complete_coverage(self):
        for change in (lambda fp: fp['service']['authSequences'].clear(),
                       lambda fp: fp['rows'].pop(parity.AUTH_SEQUENCE_PREFIX + 'auth.refresh_tokens_id_seq'),
                       lambda fp: fp['rows'][parity.AUTH_SEQUENCE_PREFIX + 'auth.refresh_tokens_id_seq'].update(digest=None),
                       lambda fp: fp['service']['authSequences']['auth.refresh_tokens_id_seq'].update(increment=0),
                       lambda fp: fp['service']['authSequences']['auth.refresh_tokens_id_seq']['grants'][0].update(grantOption=None)):
            fp = self.sequence_fixture()
            change(fp)
            self.assertFalse(parity.coverage_complete(fp))
            self.assertFalse(parity.auth_sequence_plan(fp, self.sequence_fixture())['compatible'])

    def test_auth_sequence_definition_and_grants_drift_block(self):
        source, target = self.sequence_fixture(), self.sequence_fixture()
        target['service']['authSequences']['auth.refresh_tokens_id_seq']['grants'][0]['grantOption'] = True
        self.assertFalse(parity.compare(source, target)['ok'])
        self.assertFalse(parity.auth_sequence_plan(source, target)['compatible'])
        target = self.sequence_fixture()
        target['service']['authSequences']['auth.refresh_tokens_id_seq']['ownedBy'] = ['auth.other_tokens.id']
        self.assertFalse(parity.compare(source, target)['ok'])

    def test_ahead_but_exhausted_auth_sequence_is_not_accepted_as_safe(self):
        source, target = self.sequence_fixture(last=1), self.sequence_fixture(last=3)
        for fp in (source, target):
            fp['service']['authSequences']['auth.refresh_tokens_id_seq']['max'] = 3
        result = parity.compare(source, target)
        self.assertFalse(result['ok'])
        self.assertTrue(any('exhausted' in f['message'] and f['severity'] == 'block' for f in result['findings']))
        self.assertFalse(parity.auth_sequence_plan(source, target)['compatible'])

    def test_preimport_only_history_exception_does_not_relax_postrestore_parity(self):
        source, target = base_fingerprint(), base_fingerprint()
        key = 'supabase_migrations.schema_migrations'
        source['service']['tables'][key] = copy.deepcopy(source['service']['tables']['auth.users'])
        source['coverage']['serviceTableKeys'] = sorted(source['service']['tables'])
        source['coverage']['serviceTableCount'] = len(source['service']['tables'])
        source['coverage']['serviceFunctionSchemas'].append('supabase_migrations')
        self.assertTrue(parity.service_tables_compatible(source, target))
        self.assertFalse(parity.compare(source, target)['ok'])
        self.assertTrue(any(f['area'] == 'service-tables' and f['key'] == key for f in parity.compare(source, target)['findings']))
        target['service']['tables']['auth.users']['columns'].append('schema_incompatible text')
        self.assertFalse(parity.service_tables_compatible(source, target))

    def test_missing_or_malformed_service_schema_cannot_claim_complete_coverage(self):
        changes = [lambda fp: fp['service']['tables'].pop('auth.users'),
                   lambda fp: fp['coverage'].update(serviceTableKeys=[], serviceTableCount=0),
                   lambda fp: fp['service']['tables']['auth.users'].update(owner=None),
                   lambda fp: fp['service']['tables']['auth.users'].update(rls=None),
                   lambda fp: fp['service']['tables']['auth.users'].update(columns=[None]),
                   lambda fp: fp['service']['tables']['auth.users'].update(constraints={'id_pk': None}),
                   lambda fp: fp['service']['tables']['auth.users'].update(privilegeDetails=[{'grantee': 'postgres',
                              'grantor': 'postgres', 'privilege': 'SELECT', 'grantOption': None}])]
        for change in changes:
            fp = base_fingerprint()
            change(fp)
            self.assertFalse(parity.coverage_complete(fp))
            self.assertFalse(parity.service_tables_compatible(fp, base_fingerprint()))

    def test_security_drift_blocks(self):
        cases = {
            'rls off': lambda t: t['tables']['public.players'].update(rls=False),
            'policy changed': lambda t: t['tables']['public.players']['policies']['Public read'].update(roles=['anon']),
            'extra policy': lambda t: t['tables']['public.players']['policies'].update(extra={'cmd': '*'}),
            'anon write grant': lambda t: t['tables']['public.players']['grants'].append('anon:INSERT'),
            'definer search_path lost': lambda t: t['functions']['public.is_admin()'].update(config=[]),
            'definer owner changed': lambda t: t['functions']['public.is_admin()'].update(owner='supabase_admin'),
            'anon execute added': lambda t: t['functions']['public.is_admin()']['execute'].append('anon'),
            'trigger disabled': lambda t: t['tables']['public.players']['triggers']['audit'].update(enabled='D'),
        }
        for name, mutate in cases.items():
            with self.subTest(name):
                self.assertTrue(self.blocked(mutate), name)

    def test_data_drift_blocks(self):
        self.assertIn(('rows', '2 rows on source, 1 on target'), self.blocked(lambda t: t['rows']['public.players'].update(count=1)))
        self.assertIn(('rows', 'same row count but row contents differ'), self.blocked(lambda t: t['rows']['public.players'].update(digest='d2')))
        self.assertTrue(self.blocked(lambda t: t['rows']['auth.users'].update(count=4)))
        self.assertTrue(self.blocked(lambda t: t['sequences'].update({'public.seq': 7})))
        self.assertTrue(self.blocked(lambda t: t['sequences'].update({'public.seq': None})))
        self.assertTrue(self.blocked(lambda t: t['publications'].update(supabase_realtime=[])))
        self.assertTrue(self.blocked(lambda t: t['enums'].update({'public.status': ['a']})))
        self.assertIn(('migrations', 'target lacks applied versions: 20261013210000'),
                      self.blocked(lambda t: t['rows']['supabase_migrations.schema_migrations'].update(digest='20260929120000')))

    def test_sequence_ahead_of_source_is_fine(self):
        self.assertEqual(self.blocked(lambda t: t['sequences'].update({'public.seq': 100})), [])

    def test_owner_and_version_drift_only_warn(self):
        source, target = base_fingerprint(), base_fingerprint()
        target['tables']['public.players']['owner'] = 'supabase_admin'
        target['extensions']['pgcrypto']['version'] = '1.4'
        target['meta']['serverVersionNum'] = 150008
        target['tables']['public.players']['indexes'] = {}
        result = parity.compare(source, target)
        self.assertTrue(result['ok'])
        self.assertEqual({i['area'] for i in result['findings']}, {'owners', 'extensions', 'meta', 'indexes'})

    def test_rls_filtered_counts_block(self):
        source, target = base_fingerprint(), base_fingerprint()
        target['meta'].update(bypassRls=False, superuser=False, currentUser='authenticator')
        self.assertFalse(parity.compare(source, target)['ok'])

    def test_counts_only_when_either_side_skipped_hashes(self):
        source, target = base_fingerprint(), base_fingerprint()
        target['meta']['hashRows'] = False
        target['rows']['public.players']['digest'] = None
        result = parity.compare(source, target)
        self.assertTrue(result['ok'])
        self.assertFalse(result['compared']['rowHashes'])

    def test_app_attachments_on_supabase_tables_must_come_back(self):
        def with_service(fp, policies, triggers):
            fp['service'] = {'attachments': {'storage.objects': {'rls': True, 'policies': policies, 'triggers': triggers}},
                             'functions': ['auth.uid()']}
            return fp
        rule = {'cmd': 'r', 'permissive': True, 'roles': ['authenticated'], 'using': "bucket_id = 'avatars'", 'check': None}
        guard = {'def': 'CREATE TRIGGER guard ...', 'enabled': 'O'}
        source = with_service(base_fingerprint(), {'avatars read': rule}, {'guard': guard})
        self.assertTrue(parity.compare(source, with_service(base_fingerprint(), {'avatars read': rule}, {'guard': guard}))['ok'])
        lost = parity.compare(source, with_service(base_fingerprint(), {}, {'guard': guard}))
        self.assertIn('storage.objects.avatars read', [i['key'] for i in lost['findings'] if i['severity'] == 'block'])
        no_guard = parity.compare(source, with_service(base_fingerprint(), {'avatars read': rule}, {}))
        self.assertFalse(no_guard['ok'])
        extra = with_service(base_fingerprint(), {'avatars read': rule, 'open': dict(rule, using='true')}, {'guard': guard})
        self.assertFalse(parity.compare(source, extra)['ok'])

    def test_reparse_flattening_is_not_a_difference_but_regrouping_is(self):
        source, target = base_fingerprint(), base_fingerprint()
        source['tables']['public.players']['constraints']['reason_check'] = 'CHECK ((((length(r) >= 10) AND (length(r) <= 500)) AND (NOT public.ssn(r))))'
        target['tables']['public.players']['constraints']['reason_check'] = 'CHECK (((length(r) >= 10) AND (length(r) <= 500) AND (NOT public.ssn(r))))'
        source['tables']['public.players']['policies']['Public read']['using'] = '((a AND b) AND c)'
        target['tables']['public.players']['policies']['Public read']['using'] = '(a AND b AND c)'
        self.assertTrue(parity.compare(source, target)['ok'])
        target['tables']['public.players']['policies']['Public read']['using'] = '(a AND (b OR c))'
        source['tables']['public.players']['policies']['Public read']['using'] = '((a AND b) OR c)'
        self.assertFalse(parity.compare(source, target)['ok'])
        self.assertNotEqual(parity.canonical_expr("x = 'a AND (b)'"), parity.canonical_expr("x = 'a AND b'"))

    def test_grant_sync_revokes_reopened_rights_and_restores_lost_ones(self):
        source, target = base_fingerprint(), base_fingerprint()
        target['tables']['public.players']['grants'] += ['anon:DELETE', 'anon:INSERT']
        target['tables']['public.players']['grants'].remove('authenticated:SELECT')
        target['functions']['public.is_admin()']['execute'].append('anon')
        sql, count = parity.grant_sync(source, target)
        self.assertEqual(count, 4)
        self.assertIn('revoke delete on table "public"."players" from "anon";', sql)
        self.assertIn('revoke insert on table "public"."players" from "anon";', sql)
        self.assertIn('grant select on table "public"."players" to "authenticated";', sql)
        self.assertIn('revoke execute on function "public"."is_admin"() from "anon";', sql)
        self.assertTrue(sql.splitlines()[2] == 'begin;' and sql.rstrip().endswith('commit;'))
        self.assertEqual(parity.grant_sync(base_fingerprint(), base_fingerprint())[1], 0)

    def test_grant_sync_refuses_unusual_role_names(self):
        source, target = base_fingerprint(), base_fingerprint()
        target['tables']['public.players']['grants'].append('evil"; drop table x; --:SELECT')
        with self.assertRaises(ValueError):
            parity.grant_sync(source, target)

    def test_access_parity_blocks_a_different_view_through_rls(self):
        def mutate(change):
            source, target = base_fingerprint(), base_fingerprint()
            change(target['access'])
            return [(i['area'], i['key'], i['message']) for i in parity.compare(source, target)['findings'] if i['severity'] == 'block']
        self.assertEqual(mutate(lambda a: None), [])
        self.assertIn(('access', 'user:u1 → public.players', 'sees 2 rows on source, 0 on target'), mutate(lambda a: a[1].update(count=0)))
        self.assertTrue(mutate(lambda a: a[0].update(digest='other')))
        self.assertTrue(mutate(lambda a: a[2].update(error=None, count=1)))            # guests suddenly can read rallies
        self.assertTrue(mutate(lambda a: a.pop(1)))                                     # identity missing on target
        self.assertTrue(mutate(lambda a: a.append({'who': 'anon', 'key': 'public.secret', 'count': 1, 'digest': 'x', 'error': None})))

    def test_access_parity_missing_on_both_sides_only_warns(self):
        source, target = base_fingerprint(), base_fingerprint()
        source.pop('access'); target.pop('access')
        result = parity.compare(source, target)
        self.assertTrue(result['ok'])
        self.assertEqual([i['area'] for i in result['findings']], ['access'])
        target2 = base_fingerprint()
        self.assertFalse(parity.compare(source, target2)['ok'])

    def test_rejects_foreign_format(self):
        with self.assertRaises(ValueError):
            parity.compare({'format': 'other'}, base_fingerprint())

    def test_psql_script_is_one_read_only_snapshot(self):
        script = parity.psql_script(['public'], True)
        self.assertIn('begin transaction isolation level repeatable read read only;', script)
        self.assertIn("set local tapuai.parity_schemas = 'public';", script)
        self.assertIn("set local timezone = 'UTC';", script)
        self.assertIn("set local search_path = '';", script)
        self.assertIn('set local row_security = on;', script)  # expressions print schema-qualified for every role
        self.assertIn('\\gset', script)
        self.assertTrue(script.rstrip().endswith('rollback;'))  # access parity runs last and is always rolled back
        self.assertIn('commit;\nbegin transaction isolation level repeatable read;\n', script)
        self.assertNotIn('access.sql', parity.psql_script(['public'], True, access=False))
        self.assertTrue(parity.psql_script(['public'], True, access=False).rstrip().endswith('commit;'))
        self.assertNotIn(';\n) f', script)  # catalog wrapped without its trailing semicolon

    def test_mocked_fingerprint_binds_only_sanitized_endpoint_identity(self):
        from argparse import Namespace
        import common
        for port in (None, '5433'):
            with self.subTest(port=port), tempfile.TemporaryDirectory() as tmp:
                env = {'PGHOST': 'db.synthetic.invalid', 'PGDATABASE': 'postgres',
                       'PGUSER': 'recovery_reader', 'PGSSLMODE': 'verify-full',
                       'PGPASSWORD': 'synthetic-secret-not-persisted'}
                if port is not None:
                    env['PGPORT'] = port
                fp = base_fingerprint()
                access = fp.pop('access')
                result = Namespace(returncode=0, stdout=(json.dumps(fp) + '\n' + json.dumps(access) + '\n').encode(), stderr=b'')
                args = Namespace(schemas='auto', no_row_hash=False, no_access=False,
                                 env_file='/unused/synthetic.env', out=str(Path(tmp) / 'fingerprint.json'))
                with patch.object(common, 'load_env', return_value=env), patch.object(parity.shutil, 'which', return_value='/synthetic/psql'), \
                     patch.object(parity.subprocess, 'run', return_value=result):
                    self.assertEqual(parity.fingerprint(args), 0)
                saved = json.loads(Path(args.out).read_text())
                self.assertEqual(saved['connectionIdentity'], {'PGHOST': env['PGHOST'], 'PGDATABASE': 'postgres',
                                                              'PGPORT': port or '5432'})
                self.assertNotIn('synthetic-secret-not-persisted', Path(args.out).read_text())
                self.assertEqual(Path(args.out).stat().st_mode & 0o777, 0o600)

    def test_connection_identity_is_binding_metadata_and_not_parity_equality(self):
        source, target = base_fingerprint(), base_fingerprint()
        source['connectionIdentity'] = {'PGHOST': 'source.synthetic.invalid', 'PGPORT': '5432', 'PGDATABASE': 'postgres'}
        target['connectionIdentity'] = {'PGHOST': 'target.synthetic.invalid', 'PGPORT': '5433', 'PGDATABASE': 'postgres'}
        self.assertTrue(parity.compare(source, target)['ok'])

    def test_cli_compare_exit_codes_and_private_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            good, bad = base_fingerprint(), base_fingerprint()
            bad['tables']['public.players']['rls'] = False
            for name, data in (('s.json', good), ('t.json', good), ('bad.json', bad)):
                (tmp / name).write_text(json.dumps(data))
            self.assertEqual(parity.main(['compare', str(tmp / 's.json'), str(tmp / 't.json'), '--report', str(tmp / 'ok.md')]), 0)
            self.assertIn('**PASS**', (tmp / 'ok.md').read_text())
            self.assertEqual((tmp / 'ok.md').stat().st_mode & 0o777, 0o600)
            self.assertEqual(parity.main(['compare', str(tmp / 's.json'), str(tmp / 'bad.json')]), 1)


if __name__ == '__main__':
    unittest.main()
