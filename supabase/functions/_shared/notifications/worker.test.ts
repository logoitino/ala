/**
 * Synthetic repository/transport tests prove current authorization, durable attempts and honest outcomes.
 * The memory ledger simulates the worker boundary only; SQL replay separately proves database authority.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as worker from './worker.ts';
import * as transportModule from './transport.ts';
import type { NotificationAttemptOutcome, NotificationAuthorization, NotificationJob, NotificationRepository, NotificationWorkerOptions } from './worker.ts';
import type { NotificationTransport, NotificationTransportMessage, NotificationTransportResult } from './transport.ts';
const workerId = '00000000-0000-4000-8000-000000000099';
const recipientId = '00000000-0000-4000-8000-000000000001';
const job: NotificationJob = {id: recipientId, eventId: recipientId, recipientId, category: 'account',
  payload: {version: 1, kind: 'account_welcome', referenceId: recipientId},
  leaseToken: workerId, attemptNumber: 1, idempotencyKey: 'notification_test_job'};
const authorized: Extract<NotificationAuthorization, {allowed: true}> = {allowed: true, recipient: {userId: recipientId, email: 'synthetic@example.invalid', verified: true},
  category: 'account', payload: job.payload, idempotencyKey: job.idempotencyKey,
  unsubscribeUrl: `https://example.invalid/notifications/unsubscribe?t=${'x'.repeat(43)}`};

function memoryRepository(options: {
  authorization?: NotificationAuthorization; beginAuthorization?: NotificationAuthorization;
  completeResult?: boolean; throwSend?: boolean; hangSend?: boolean; sendResult?: NotificationTransportResult;
} = {}) {
  const ledger: {
    started: boolean; completed: NotificationAttemptOutcome[]; released: number;
    claims: Parameters<NotificationRepository['claim']>[0][]; external: NotificationTransportMessage[];
  } = {started: false, completed: [], released: 0, claims: [], external: []};
  const repository: NotificationRepository = {
    async claim(input) { ledger.claims.push(input); return [job]; },
    async authorize() { return options.authorization ?? authorized; },
    async begin() { ledger.started = true; return options.beginAuthorization ?? authorized; },
    async complete(_job, outcome) { ledger.completed.push(outcome); return options.completeResult ?? true; },
    async release() { ledger.released++; return true; },
  };
  const transport: NotificationTransport = { configured: true, async send(message) {
    assert.equal(ledger.started, true, 'attempt must be durable before external send');
    ledger.external.push(message);
    if (options.throwSend) throw new Error('private provider failure containing an address');
    if (options.hangSend) return new Promise<NotificationTransportResult>(() => {});
    return options.sendResult ?? {status: 'accepted', providerMessageId: 'synthetic-1'};
  }};
  return {ledger, repository, transport};
}

async function run(fixture: ReturnType<typeof memoryRepository>, extra: Partial<NotificationWorkerOptions> = {}) {
  assert.equal(typeof worker.runNotificationWorker, 'function', 'worker must exist');
  return worker.runNotificationWorker(fixture.repository, fixture.transport, {
    workerId, appOrigin: 'https://example.invalid', ...extra,
  });
}

test('queued opt-out suppresses mail without beginning a transport attempt', async () => {
  const fixture = memoryRepository({authorization: {allowed: false, reason: 'email_opt_out'}});
  const result = await run(fixture);
  assert.equal(fixture.ledger.started, false);
  assert.equal(fixture.ledger.external.length, 0);
  assert.deepEqual(fixture.ledger.completed, [{outcome: 'suppressed', errorCode: 'email_opt_out', safeRetry: false}]);
  assert.equal(result.suppressed, 1);
});

test('recipient/guardian eligibility is checked again at durable attempt authorization', async () => {
  const fixture = memoryRepository({beginAuthorization: {allowed: false, reason: 'recipient_ineligible'}});
  await run(fixture);
  assert.equal(fixture.ledger.external.length, 0);
  assert.equal(fixture.ledger.completed[0].outcome, 'suppressed');
});

test('send uses the fresh verified recipient returned by begin and records acceptance only', async () => {
  const fixture = memoryRepository({beginAuthorization: {...authorized, recipient: {...authorized.recipient, email: 'fresh@example.invalid'}}});
  const result = await run(fixture);
  assert.equal(fixture.ledger.external[0].to, 'fresh@example.invalid');
  assert.equal(fixture.ledger.external[0].idempotencyKey, job.idempotencyKey);
  assert.deepEqual(fixture.ledger.completed, [{outcome: 'accepted', providerMessageId: 'synthetic-1', safeRetry: false}]);
  assert.equal(result.accepted, 1);
  assert.equal('delivered' in result, false);
});

test('unconfigured production transport releases jobs without fake acceptance or attempts', async () => {
  assert.equal(typeof transportModule.createUnconfiguredNotificationTransport, 'function', 'unconfigured transport must exist');
  const fixture = memoryRepository();
  fixture.transport = transportModule.createUnconfiguredNotificationTransport();
  const result = await run(fixture);
  assert.equal(fixture.ledger.started, false);
  assert.equal(fixture.ledger.completed.length, 0);
  assert.equal(fixture.ledger.released, 1);
  assert.equal(result.unconfigured, 1);
});

test('transport exception records unknown with no blind retry or private error text', async () => {
  const fixture = memoryRepository({throwSend: true});
  const result = await run(fixture);
  assert.deepEqual(fixture.ledger.completed, [{outcome: 'unknown', errorCode: 'transport_unknown', safeRetry: false}]);
  assert.equal(fixture.ledger.external.length, 1);
  assert.equal(result.unknown, 1);
});

test('a timeout after send starts stays unknown and is not retried', async () => {
  const fixture = memoryRepository({hangSend: true});
  const result = await run(fixture, {sendTimeoutMs: 5});
  assert.equal(fixture.ledger.completed[0].outcome, 'unknown');
  assert.equal(fixture.ledger.completed[0].safeRetry, false);
  assert.equal(fixture.ledger.external.length, 1);
  assert.equal(result.unknown, 1);
});

test('only known retryable rejection is eligible for explicit later retry', async () => {
  const fixture = memoryRepository({sendResult: {status: 'failed', errorCode: 'provider_rate_limited', retryable: true}});
  const result = await run(fixture);
  assert.deepEqual(fixture.ledger.completed, [{outcome: 'failed', errorCode: 'provider_rate_limited', safeRetry: true}]);
  assert.equal(fixture.ledger.external.length, 1);
  assert.equal(result.failed, 1);
});

test('lost completion after provider acceptance reports unknown instead of persisted acceptance', async () => {
  const fixture = memoryRepository({completeResult: false});
  const result = await run(fixture);
  assert.equal(result.accepted, 0);
  assert.equal(result.unknown, 1);
  assert.equal(fixture.ledger.external.length, 1);
});

test('malformed or mismatched recipients and payloads never reach a transport', async () => {
  for (const authorization of [
    {...authorized, recipient: {...authorized.recipient, verified: false}},
    {...authorized, recipient: {...authorized.recipient, userId: workerId}},
    {...authorized, recipient: {...authorized.recipient, email: 'x@example.invalid\r\nBcc: secret@example.invalid'}},
    {...authorized, payload: {...authorized.payload, amount: 100}},
    {...authorized, unsubscribeUrl: undefined},
  ]) {
    const fixture = memoryRepository({authorization: authorization as unknown as NotificationAuthorization});
    await run(fixture);
    assert.equal(fixture.ledger.external.length, 0);
    assert.equal(fixture.ledger.completed[0].outcome, 'suppressed');
  }
});

test('worker clamps claim bounds and RPC adapter never accepts client send-to fields', async () => {
  const fixture = memoryRepository();
  await run(fixture, {batchSize: 999, leaseSeconds: 999});
  assert.equal(fixture.ledger.claims[0].batchSize, 50);
  assert.equal(fixture.ledger.claims[0].leaseSeconds, 300);
  assert.equal(typeof worker.createRpcNotificationRepository, 'function', 'service RPC adapter must exist');
  const calls: {name: string; args: Record<string, unknown>}[] = [];
  const repository = worker.createRpcNotificationRepository({async rpc(name, args) {calls.push({name, args}); return {data: [], error: null};}});
  await repository.claim({workerId, batchSize: 20, leaseSeconds: 60});
  assert.deepEqual(calls, [{name: 'claim_notification_jobs', args: {worker_id: workerId, batch_size: 20, lease_seconds: 60}}]);
});

test('malformed completion confirmations cannot claim durable acceptance', async () => {
  for (const value of ['true', {}, null]) {
    const fixture = memoryRepository();
    fixture.repository.complete = async () => value as unknown as boolean;
    const result = await run(fixture);
    assert.equal(result.accepted, 0, 'only the exact boolean true proves persisted acceptance');
    assert.equal(result.unknown, 1);
    assert.equal(result.repositoryErrors, 1);
  }
});

test('malformed release confirmations cannot count a job as safely released', async () => {
  for (const value of ['true', {}, null, false]) {
    const fixture = memoryRepository();
    fixture.transport = transportModule.createUnconfiguredNotificationTransport();
    fixture.repository.release = async () => value as unknown as boolean;
    const result = await run(fixture);
    assert.equal(result.unconfigured, 0, 'only the exact boolean true confirms release');
    assert.equal(result.repositoryErrors, 1);
    assert.equal(fixture.ledger.external.length, 0);
  }
});

test('RPC completion and release reject string, object and null confirmations', async () => {
  for (const value of ['true', {}, null]) {
    const repository = worker.createRpcNotificationRepository({async rpc() { return {data: value, error: null}; }});
    await assert.rejects(repository.complete(job, {outcome: 'accepted', providerMessageId: 'synthetic-1', safeRetry: false}), /notification_repository_error/);
    await assert.rejects(repository.release(job), /notification_repository_error/);
  }
  for (const value of [true, false]) {
    const repository = worker.createRpcNotificationRepository({async rpc() { return {data: value, error: null}; }});
    assert.equal(await repository.complete(job, {outcome: 'unknown', safeRetry: false}), value);
    assert.equal(await repository.release(job), value);
  }
});

test('provider acceptance evidence fits the exact SQL message-id contract', async () => {
  for (const providerMessageId of ['provider:message', 'x'.repeat(121)]) {
    const fixture = memoryRepository({sendResult: {status: 'accepted', providerMessageId}});
    const result = await run(fixture);
    assert.equal(result.accepted, 0);
    assert.deepEqual(fixture.ledger.completed, [{outcome: 'unknown', errorCode: 'transport_unknown', safeRetry: false}]);
  }
});

test('permanent provider rejection cannot authorize retry even when an adapter asks for it', async () => {
  const fixture = memoryRepository({sendResult: {status: 'failed', errorCode: 'provider_rejected', retryable: true}});
  await run(fixture);
  assert.deepEqual(fixture.ledger.completed, [{outcome: 'failed', errorCode: 'provider_rejected', safeRetry: false}]);
});
