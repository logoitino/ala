/** The one shared reading of "not applied yet": each kind matches only its own errors, so a real failure stays one. */
import { isMissingColumn, isMissingFunction, isMissingRelation } from '@/lib/dbErrors';

it('recognises a missing database function by code or message', () => {
  expect(isMissingFunction({ code: 'PGRST202', message: 'Could not find the function public.x in the schema cache' })).toBe(true);
  expect(isMissingFunction({ code: '42883', message: 'function public.x() does not exist' })).toBe(true);
  expect(isMissingFunction('Could not find the function public.get_my_payout_status')).toBe(true);
});

it('recognises a missing column and a missing table separately', () => {
  expect(isMissingColumn({ code: 'PGRST204', message: "Could not find the 'cover_fee_cents' column of 'tips' in the schema cache" })).toBe(true);
  expect(isMissingColumn({ code: '42703', message: 'column x does not exist' })).toBe(true);
  expect(isMissingRelation({ code: '42P01', message: 'relation "public.reel_photos" does not exist' })).toBe(true);
  expect(isMissingRelation({ code: 'PGRST205', message: "Could not find the table 'public.x' in the schema cache" })).toBe(true);
});

it('keeps every other failure a failure', () => {
  for (const error of [null, undefined, '', { code: '42501', message: 'permission denied for function x' }, { code: '23514', message: 'violates check constraint' }]) {
    expect(isMissingFunction(error)).toBe(false);
    expect(isMissingColumn(error)).toBe(false);
  }
  // A missing column is not a missing function: "schema cache" alone no longer means the RPC is absent.
  expect(isMissingFunction({ code: 'PGRST204', message: "Could not find the 'x' column of 'tips' in the schema cache" })).toBe(false);
  expect(isMissingRelation({ code: '42501', message: 'permission denied for table x' })).toBe(false);
});
