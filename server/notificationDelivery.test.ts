import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createUniversityServer } from './index';
import { UniversityStore } from './store';
import { SQLiteUniversityRepository } from './repositories/sqliteUniversityRepository';

const admin = { authorization: 'Bearer admin' };
const verifyUser = async (token: string) => token === 'admin' ? { id: 'administrator' } : token === 'student' ? { id: 'student' } : null;

test('opening requires admin, creates one global event per transition, and preserves term', async () => {
  const store = new UniversityStore(':memory:');
  const app = createUniversityServer({ store, servePortal: false, startWebhookWorker: false, adminUserIds: ['administrator'], verifyUser });
  try {
    const term = store.getCalendar().currentTerm;
    const call = (headers: Record<string, string>) => app.inject({ method: 'POST', url: '/v1/admin/registration/open', headers, payload: {} });
    assert.equal((await call({})).statusCode, 401);
    assert.equal((await call({ authorization: 'Bearer student' })).statusCode, 403);
    assert.equal(store.cursor(), 0);
    const [first, second] = await Promise.all([call({ ...admin, 'idempotency-key': 'one' }), call({ ...admin, 'idempotency-key': 'two' })]);
    assert.equal(first.statusCode, 200); assert.equal(second.statusCode, 200);
    const events = store.eventsSince(0);
    assert.equal(events.length, 1); assert.equal(events[0].type, 'registration.opened');
    assert.equal(events[0].studentId, undefined); assert.deepEqual(events[0].payload.currentTerm, term);
    assert.match(events[0].id, /^[0-9a-f-]{36}$/); assert.ok(events[0].version > 0);
    assert.ok(!Number.isNaN(Date.parse(events[0].occurredAt))); assert.ok(events[0].idempotencyKey);
    await call({ ...admin, 'idempotency-key': events[0].idempotencyKey });
    assert.equal(store.cursor(), 1);
    await app.inject({ method: 'POST', url: '/v1/admin/registration/close', headers: admin });
    await call(admin);
    assert.deepEqual(store.eventsSince(0).map(e => e.type), ['registration.opened', 'registration.closed', 'registration.opened']);
    assert.deepEqual(store.eventsSince(0).map(e => e.version), [1, 2, 3]);
  } finally { await app.close(); }
});

test('worker signs exact bytes, persists a failed attempt and retries until acknowledged', async () => {
  const store = new UniversityStore(':memory:');
  const repository = new SQLiteUniversityRepository(store);
  const event = store.setRegistration(true, null, null, 'open-delivery').event!;
  const attempts: Array<{ body: string; signature: string; signal: AbortSignal | null | undefined }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(String(input), 'https://api.example/api/v1/uni/webhook');
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    attempts.push({ body: String(init?.body), signature: headers.get('X-Uni-Signature')!, signal: init?.signal });
    if (attempts.length === 1) return new Response(null, { status: 503 });
    if (attempts.length === 2) throw new Error('timeout');
    return new Response(null, { status: 202 });
  };
  const app = createUniversityServer({ repository, servePortal: false, webhookUrl: 'https://api.example/api/v1/uni/webhook', webhookSecret: 'test-secret', fetcher, startWebhookWorker: true });
  try {
    const deadline = Date.now() + 14000;
    while (attempts.length < 3 && Date.now() < deadline) await delay(100);
    assert.equal(attempts.length, 3);
    assert.equal(attempts[0].body, attempts[1].body);
    assert.equal(attempts[1].body, attempts[2].body);
    const body = JSON.parse(attempts[0].body);
    assert.deepEqual(Object.keys(body).sort(), ['id', 'idempotencyKey', 'occurredAt', 'payload', 'type', 'version'].sort());
    assert.equal(body.id, event.id); assert.equal(body.type, 'registration.opened');
    assert.equal(attempts[0].signature, 'sha256=' + createHmac('sha256', 'test-secret').update(attempts[0].body).digest('hex'));
    assert.ok(attempts[0].signal);
    await delay(150);
    assert.equal(store.deliveryBatch().length, 0);
  } finally { await app.close(); }
});

test('no-op key remains effective after close and fresh key permits a new opening', () => {
  const store = new UniversityStore(':memory:');
  try {
    store.setRegistration(true, null, null, 'initial');
    assert.equal(store.setRegistration(true, null, null, 'no-op').event, null);
    store.setRegistration(false, null, null, 'close');
    assert.equal(store.setRegistration(true, null, null, 'no-op').calendar.registrationOpen, false);
    assert.equal(store.eventsSince(0).length, 2);
    assert.throws(() => store.setRegistration(false, null, null, 'no-op'), /IDEMPOTENCY_KEY_CONFLICT/);
    assert.equal(store.setRegistration(true, null, null, 'fresh').event?.type, 'registration.opened');
    assert.equal(store.eventsSince(0).length, 3);
  } finally { store.close(); }
});

test('unsupported and permanently rejected events do not block later supported events', async () => {
  const store = new UniversityStore(':memory:');
  store.recordRegistrationAudit('123456789', {}, 'audit-event');
  store.setRegistration(true, null, null, 'open-rejected');
  store.setRegistration(false, null, null, 'close-delivered');
  const sent: string[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    const event = JSON.parse(String(init?.body)); sent.push(event.type);
    return new Response(null, { status: event.type === 'registration.opened' ? 422 : 202 });
  };
  const app = createUniversityServer({ store, servePortal: false, webhookUrl: 'https://api.example/api/v1/uni/webhook', webhookSecret: 'test-secret', fetcher });
  try {
    const deadline = Date.now() + 6000;
    while (sent.length < 2 && Date.now() < deadline) await delay(100);
    assert.deepEqual(sent, ['registration.opened', 'registration.closed']);
    await delay(100);
    const rows = store.db.prepare('SELECT event_type, delivered_at, delivery_terminal_reason, last_status FROM events ORDER BY cursor').all() as Array<{ event_type: string; delivered_at: string | null; delivery_terminal_reason: string | null; last_status: number | null }>;
    assert.equal(rows[0].delivery_terminal_reason, 'unsupported_event');
    assert.equal(rows[0].delivered_at, null);
    assert.equal(rows[1].delivery_terminal_reason, 'http_rejected');
    assert.equal(rows[1].last_status, 422);
    assert.equal(rows[1].delivered_at, null);
    assert.ok(rows[2].delivered_at);
    assert.equal(store.eventsSince(0).length, 3);
    assert.equal(store.deliveryBatch().length, 0);
  } finally { await app.close(); }
});


test('no-op command survives a database restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'uni-notify-test-'));
  const path = join(dir, 'university.sqlite');
  try {
    const first = new UniversityStore(path);
    first.setRegistration(true, null, null, 'initial');
    first.setRegistration(true, null, null, 'durable-no-op');
    first.setRegistration(false, null, null, 'close');
    first.close();
    const second = new UniversityStore(path);
    try {
      assert.equal(second.setRegistration(true, null, null, 'durable-no-op').calendar.registrationOpen, false);
      assert.equal(second.eventsSince(0).length, 2);
    } finally { second.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
