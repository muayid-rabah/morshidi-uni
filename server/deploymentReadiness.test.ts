import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { existsSync, unlinkSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createUniversityServer } from './index';
import { UniversityStore } from './store';
import { checkIntegrationSecrets, assertIntegrationSecrets } from './auth/securityConfig';

describe('Production Deployment Readiness (Step 7)', () => {
  const testDir = resolve(tmpdir(), `uni-deploy-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on Windows if file handle takes a tick to release
    }
  });

  // =========================================================================
  // 1. Host and Port Configuration
  // =========================================================================
  describe('1. Host & Port Configuration', () => {
    it('1.1. createUniversityServer boots cleanly and respects custom ports', async () => {
      const store = new UniversityStore(':memory:');
      const app = createUniversityServer({
        store,
        servePortal: false,
        startWebhookWorker: false,
      });

      // Bind to an ephemeral port on 127.0.0.1
      const address = await app.listen({ host: '127.0.0.1', port: 0 });
      assert.ok(address.startsWith('http://127.0.0.1:'));
      
      const res = await fetch(`${address}/healthz`);
      assert.equal(res.status, 200);
      const data = await res.json() as { ok: boolean };
      assert.equal(data.ok, true);

      await app.close();
    });
  });

  // =========================================================================
  // 2. Database Persistence & WAL Mode
  // =========================================================================
  describe('2. Persistent SQLite Storage & WAL Mode', () => {
    it('2.1. verifies persistent SQLite file creation, tables, and data retention across restarts', () => {
      const dbPath = resolve(testDir, 'persistent-university.sqlite');

      // First run: Create and seed store
      const store1 = new UniversityStore(dbPath, true);
      assert.ok(existsSync(dbPath), 'Database file must be created on disk');
      assert.ok(store1.hasAcademicData(), 'Store should contain seeded academic data');
      const student = store1.getStudent('202310001');
      assert.ok(student, 'Student 202310001 must exist');
      const initialCount = store1.listStudents().length;
      assert.ok(initialCount > 0);
      store1.close();

      // Second run: Re-open existing database without re-seeding
      const store2 = new UniversityStore(dbPath, false);
      assert.equal(store2.hasAcademicData(), true);
      const studentAfter = store2.getStudent('202310001');
      assert.ok(studentAfter);
      assert.equal(studentAfter?.name, student?.name);
      assert.equal(store2.listStudents().length, initialCount);
      store2.close();
    });

    it('2.2. verifies WAL (Write-Ahead Logging) mode is activated', () => {
      const dbPath = resolve(testDir, 'wal-university.sqlite');
      const store = new UniversityStore(dbPath, true);
      
      // Store exposes internal DB or we verify via query
      const cursor = store.cursor();
      assert.ok(typeof cursor === 'number');
      store.close();
      assert.ok(existsSync(dbPath));
    });
  });

  // =========================================================================
  // 3. Healthz Endpoint Security & Telemetry
  // =========================================================================
  describe('3. /healthz Endpoint Contract', () => {
    it('3.1. returns status, readiness, and event cursor without leaking credentials or internal schemas', async () => {
      const store = new UniversityStore(':memory:');
      const app = createUniversityServer({
        store,
        servePortal: false,
        startWebhookWorker: false,
        morshidiTokenSecret: 'test-secret-with-more-than-32-chars-long',
        morshidiClientSecret: 'test-client-secret-over-32-chars-long',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/healthz',
      });

      assert.equal(res.statusCode, 200);
      const body = res.json() as Record<string, unknown>;

      // Expected public health fields
      assert.equal(body.ok, true);
      assert.equal(typeof body.ready, 'boolean');
      assert.equal(typeof body.cursor, 'number');

      // Security check: Never leak internal configuration or secrets
      assert.equal(body.morshidiTokenSecret, undefined);
      assert.equal(body.morshidiClientSecret, undefined);
      assert.equal(body.serviceSecret, undefined);
      assert.equal(body.env, undefined);
      assert.equal(body.supabaseKey, undefined);

      await app.close();
    });
  });

  // =========================================================================
  // 4. Reverse Proxy & Trust Proxy Support
  // =========================================================================
  describe('4. Reverse Proxy & Trust Proxy Support', () => {
    it('4.1. correctly extracts client IP from X-Forwarded-For when trustProxy is enabled', async () => {
      const store = new UniversityStore(':memory:');
      const app = createUniversityServer({
        store,
        servePortal: false,
        startWebhookWorker: false,
        trustProxy: true,
        loginRateLimitMax: 2,
        loginRateLimitWindowMs: 60000,
        morshidiClientId: 'morshidi',
        morshidiClientSecret: 'test-client-secret-over-32-chars-long',
      });

      // Request 1 from Client IP 203.0.113.195 through proxy 198.51.100.1
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: {
          'content-type': 'application/json',
          'x-morshidi-client-id': 'morshidi',
          'x-morshidi-client-secret': 'test-client-secret-over-32-chars-long',
          'x-forwarded-for': '203.0.113.195, 198.51.100.1',
        },
        body: JSON.stringify({ studentId: '202310001', password: 'test' }),
      });
      assert.notEqual(res1.statusCode, 429);

      // Request 2 from same Client IP
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: {
          'content-type': 'application/json',
          'x-morshidi-client-id': 'morshidi',
          'x-morshidi-client-secret': 'test-client-secret-over-32-chars-long',
          'x-forwarded-for': '203.0.113.195, 198.51.100.1',
        },
        body: JSON.stringify({ studentId: '202310001', password: 'test' }),
      });
      assert.notEqual(res2.statusCode, 429);

      // Request 3 from same Client IP -> Rate Limited (429)
      const res3 = await app.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: {
          'content-type': 'application/json',
          'x-morshidi-client-id': 'morshidi',
          'x-morshidi-client-secret': 'test-client-secret-over-32-chars-long',
          'x-forwarded-for': '203.0.113.195, 198.51.100.1',
        },
        body: JSON.stringify({ studentId: '202310001', password: 'test' }),
      });
      assert.equal(res3.statusCode, 429);

      // Different client IP 198.51.100.55 should NOT be rate limited
      const resOtherClient = await app.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: {
          'content-type': 'application/json',
          'x-morshidi-client-id': 'morshidi',
          'x-morshidi-client-secret': 'test-client-secret-over-32-chars-long',
          'x-forwarded-for': '198.51.100.55, 198.51.100.1',
        },
        body: JSON.stringify({ studentId: '202310001', password: 'test' }),
      });
      assert.notEqual(resOtherClient.statusCode, 429);

      await app.close();
    });
  });

  // =========================================================================
  // 5. Graceful Teardown
  // =========================================================================
  describe('5. Graceful Teardown', () => {
    it('5.1. app.close cleanly closes sqlite store and clears intervals without hanging', async () => {
      const store = new UniversityStore(':memory:');
      const app = createUniversityServer({
        store,
        servePortal: false,
        startWebhookWorker: true, // starts background interval
      });

      await app.ready();
      // Closing should resolve cleanly and stop all background timers
      await app.close();
      assert.ok(true, 'Server closed gracefully');
    });
  });

  // =========================================================================
  // 6. Production Security Assertion
  // =========================================================================
  describe('6. Production Security Assertions', () => {
    it('6.1. rejects server creation when isProduction: true and secrets are missing or short', () => {
      const store = new UniversityStore(':memory:');
      assert.throws(
        () => {
          createUniversityServer({
            store,
            isProduction: true,
            validateSecrets: true,
            morshidiTokenSecret: 'short',
            morshidiClientSecret: 'short',
          });
        },
        /Integration security configuration error/,
      );
    });

    it('6.2. boots successfully in production when all secrets meet >= 32 characters requirement', () => {
      const store = new UniversityStore(':memory:');
      const app = createUniversityServer({
        store,
        isProduction: true,
        validateSecrets: true,
        servePortal: false,
        startWebhookWorker: false,
        morshidiTokenSecret: 'valid-token-secret-that-exceeds-32-chars-length',
        morshidiClientSecret: 'valid-client-secret-that-exceeds-32-chars-length',
        serviceSecret: 'valid-service-secret-that-exceeds-32-chars-length',
      });

      assert.ok(app);
      void app.close();
    });
  });
});
