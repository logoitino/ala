/** Governance parser regression: private policy helpers must appear without colliding with public functions. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sqlFunctionBodies } from '../lib/sql-functions.mjs';

test('keeps private namespace identity and both live overloads, with the last replacement winning', () => {
  const sql = `create or replace function public.checker(p text) returns text as $$ old $$;
    create or replace function public.checker(p text) returns text as $$ latest $$;
    create or replace function public.checker(p uuid) returns text as $$ overload $$;
    create or replace function fan_zone_private.checker(p text) returns boolean as $$ private body $$;`;
  const bodies = sqlFunctionBodies(sql);
  assert.match(bodies.get('checker'), /latest/); assert.match(bodies.get('checker'), /overload/);
  assert.doesNotMatch(bodies.get('checker'), /old/);
  assert.equal(bodies.get('fan_zone_private.checker'), '\n private body ');
});
test('an archived private helper disappears independently of the same public name', () => {
  const bodies = sqlFunctionBodies(`create or replace function public.guard() returns bool as $$ true $$;
    create or replace function fan_zone_private.guard() returns bool as $$ false $$;
    drop function if exists fan_zone_private.guard();`);
  assert.equal(bodies.has('fan_zone_private.guard'), false); assert.equal(bodies.has('guard'), true);
});
test('the actual private Fan Zone storage policy helper is covered by the master map parser', () => {
  const sql = fs.readFileSync(new URL('../../supabase/migrations/20261014130000_fan_zone.sql', import.meta.url), 'utf8').replace(/--[^\n]*/g, '');
  assert.match(sqlFunctionBodies(sql).get('fan_zone_private.upload_allowed'), /fan_zone_entries/);
});
test('dropping one overload after both creates preserves the other live signature', () => {
  const bodies = sqlFunctionBodies(`create or replace function public.checker(p text) returns text as $$ removed text $$;
    create or replace function public.checker(p uuid) returns text as $$ live uuid $$;
    drop function if exists public.checker(text);`);
  assert.match(bodies.get('checker'), /live uuid/);
  assert.doesNotMatch(bodies.get('checker'), /removed text/);
});
test('dropping one overload before a later different create never resurrects its old body', () => {
  const bodies = sqlFunctionBodies(`create or replace function public.checker(p text) returns text as $$ removed text $$;
    drop function if exists public.checker(text);
    create or replace function public.checker(p uuid) returns text as $$ live uuid $$;`);
  assert.match(bodies.get('checker'), /live uuid/);
  assert.doesNotMatch(bodies.get('checker'), /removed text/);
});
test('source-ordered replacement/drop identity isolates the same public and private names', () => {
  const bodies = sqlFunctionBodies(`create or replace function public.checker(p text) returns text as $$ public text $$;
    create or replace function fan_zone_private.checker(p text) returns text as $$ private text $$;
    create or replace function fan_zone_private.checker(p uuid) returns text as $$ private uuid $$;
    drop function if exists FAN_ZONE_PRIVATE.CHECKER(TEXT);
    create or replace function PUBLIC.CHECKER(renamed TEXT default null) returns text as $$ public replacement $$;`);
  assert.match(bodies.get('checker'), /public replacement/);
  assert.doesNotMatch(bodies.get('checker'), /public text|private/);
  assert.match(bodies.get('fan_zone_private.checker'), /private uuid/);
  assert.doesNotMatch(bodies.get('fan_zone_private.checker'), /private text|public/);
});
