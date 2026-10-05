import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createUniversityServer } from './index';
import { UniversityStore } from './store';
import { issueIntegrationToken } from './auth/integrationToken';
import { checkIntegrationSecrets, assertIntegrationSecrets } from './auth/securityConfig';

describe('Morshidi Security Hardening & Rate Limiting (Step 6)', () => {
  let store: UniversityStore;
  let app: ReturnType<typeof createUniversityServer>;

  const studentAId = '202310001';
  const testTokenSecret = 'test-morshidi-security-token-secret-32-chars-long';
  const testClientId = 'morshidi';
  const testClientSecret = 'super-secret-morshidi-client-key-32-chars-minimum';
  const mockSupabaseUrl = 'https://mock.supabase.co';
  const mockSupabaseKey = 'mock-publishable-key';

  beforeEach(() => {
    store = new UniversityStore(':memory:');
    app = createUniversityServer({
      store,
      servePortal: false,
      startWebhookWorker: false,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      morshidiClientId: testClientId,
      morshidiClientSecret: testClientSecret,
      morshidiTokenSecret: testTokenSecret,
      allowedOrigins: 'https://morshidi.edu.jo,https://trusted-portal.edu',
      // Configure tight limits for testing rate limiting
      loginRateLimitMax: 3,
      loginRateLimitWindowMs: 60000,
      apiRateLimitMax: 5,
      apiRateLimitWindowMs: 60000,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  // =========================================================================
  // 1. Rate Limiting
  // =========================================================================
  describe('1. Rate Limiting', () => {
    it('1.1. POST /auth/login returns 429 RATE_LIMITED with Retry-After when rate limit is exceeded', async () => {
      // First 3 requests should pass rate limiter (may return 400 for invalid body, but not 429)
      for (let i = 0; i < 3; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/integrations/morshidi/v1/auth/login',
          headers: {
            'content-type': 'application/json',
            'x-morshidi-client-id': testClientId,
            'x-morshidi-client-secret': testClientSecret,
          },
          body: JSON.stringify({ studentId: 'invalid', password: 'wrong' }),
        });
        assert.notEqual(res.statusCode, 429, `Request ${i + 1} must not be rate limited yet`);
      }

      // 4th request must be rate limited
      const rateLimitedRes = await app.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: {
          'content-type': 'application/json',
          'x-morshidi-client-id': testClientId,
          'x-morshidi-client-secret': testClientSecret,
        },
        body: JSON.stringify({ studentId: 'invalid', password: 'wrong' }),
      });

      assert.equal(rateLimitedRes.statusCode, 429);
      const body = rateLimitedRes.json() as { success: boolean; error: string };
      assert.equal(body.success, false);
      assert.equal(body.error, 'RATE_LIMITED');
      assert.ok(rateLimitedRes.headers['retry-after'], 'Retry-After header must be present');
    });

    it('1.2. GET /student/* returns 429 RATE_LIMITED with Retry-After when rate limit is exceeded', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const authHeaders = { authorization: `Bearer ${tokenResult.accessToken}` };

      // First 5 requests should succeed (apiRateLimitMax is 5)
      for (let i = 0; i < 5; i++) {
        const res = await app.inject({
          method: 'GET',
          url: '/api/integrations/morshidi/v1/student/me',
          headers: authHeaders,
        });
        assert.equal(res.statusCode, 200, `Request ${i + 1} must succeed with 200`);
      }

      // 6th request must be rate limited
      const rateLimitedRes = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/me',
        headers: authHeaders,
      });

      assert.equal(rateLimitedRes.statusCode, 429);
      const body = rateLimitedRes.json() as { success: boolean; error: string };
      assert.equal(body.success, false);
      assert.equal(body.error, 'RATE_LIMITED');
      assert.ok(rateLimitedRes.headers['retry-after'], 'Retry-After header must be present on academic endpoints');
    });
  });

  // =========================================================================
  // 2. Body Size Limiting
  // =========================================================================
  describe('2. Request Body Size Limiting', () => {
    it('2.1. rejects oversized payloads (> 16 KB) on /auth/login with 413 PAYLOAD_TOO_LARGE', async () => {
      // Create a payload larger than 16 KB (e.g. 20 KB of junk padding)
      const oversizedPayload = {
        studentId: studentAId,
        password: 'student-password',
        extra: 'x'.repeat(20 * 1024),
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: {
          'content-type': 'application/json',
          'x-morshidi-client-id': testClientId,
          'x-morshidi-client-secret': testClientSecret,
        },
        body: JSON.stringify(oversizedPayload),
      });

      assert.equal(res.statusCode, 413);
      const body = res.json() as { success: boolean; error: string };
      assert.equal(body.success, false);
      assert.equal(body.error, 'PAYLOAD_TOO_LARGE');
    });

    it('2.2. permits legitimate normal-sized payloads on /auth/login', async () => {
      const normalPayload = {
        studentId: studentAId,
        password: 'valid-length-password',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: {
          'content-type': 'application/json',
          'x-morshidi-client-id': testClientId,
          'x-morshidi-client-secret': testClientSecret,
        },
        body: JSON.stringify(normalPayload),
      });

      // Status should be 401 (credentials mismatch in mock) or 200, but NEVER 413
      assert.notEqual(res.statusCode, 413);
    });
  });

  // =========================================================================
  // 3. Content-Type Enforcement & JSON Parsing
  // =========================================================================
  describe('3. Content-Type Enforcement & JSON Parsing', () => {
    it('3.1. rejects POST /auth/login with non-JSON Content-Type with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: {
          'content-type': 'text/plain',
          'x-morshidi-client-id': testClientId,
          'x-morshidi-client-secret': testClientSecret,
        },
        body: 'studentId=202310001&password=pass',
      });

      assert.equal(res.statusCode, 415);
      const body = res.json() as { success: boolean; error: string };
      assert.equal(body.success, false);
      assert.equal(body.error, 'UNSUPPORTED_MEDIA_TYPE');
    });

    it('3.2. rejects malformed JSON with 400 INVALID_REQUEST without server crash', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: {
          'content-type': 'application/json',
          'x-morshidi-client-id': testClientId,
          'x-morshidi-client-secret': testClientSecret,
        },
        body: '{ malformed json: not valid }',
      });

      assert.equal(res.statusCode, 400);
      const body = res.json() as { success: boolean; error: string };
      assert.equal(body.success, false);
      assert.equal(body.error, 'INVALID_REQUEST');
    });
  });

  // =========================================================================
  // 4. Security Headers (Helmet)
  // =========================================================================
  describe('4. Security Headers', () => {
    it('4.1. returns required security headers on integration responses', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const res = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/me',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
      assert.equal(res.headers['referrer-policy'], 'no-referrer');
      assert.ok(res.headers['strict-transport-security']);
    });
  });

  // =========================================================================
  // 5. Cache-Control Guarantee
  // =========================================================================
  describe('5. Cache-Control', () => {
    it('5.1. guarantees no-store, no-cache, and must-revalidate on successful responses', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const res = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/courses',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['cache-control'], 'no-store, no-cache, must-revalidate');
      assert.equal(res.headers['pragma'], 'no-cache');
    });

    it('5.2. guarantees no-store, no-cache on error responses as well', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/grades',
        // Missing Authorization
      });

      assert.equal(res.statusCode, 401);
      assert.equal(res.headers['cache-control'], 'no-store, no-cache, must-revalidate');
      assert.equal(res.headers['pragma'], 'no-cache');
    });
  });

  // =========================================================================
  // 6. CORS Review & Origin Restriction
  // =========================================================================
  describe('6. CORS Hardening', () => {
    it('6.1. allows trusted origin configured in allowedOrigins', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const res = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/me',
        headers: {
          authorization: `Bearer ${tokenResult.accessToken}`,
          origin: 'https://morshidi.edu.jo',
        },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['access-control-allow-origin'], 'https://morshidi.edu.jo');
      assert.notEqual(res.headers['access-control-allow-origin'], '*');
    });

    it('6.2. does not reflect untrusted origin and NEVER returns wildcard *', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const res = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/me',
        headers: {
          authorization: `Bearer ${tokenResult.accessToken}`,
          origin: 'https://evil-unauthorized-site.com',
        },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.notEqual(res.headers['access-control-allow-origin'], '*');
    });

    it('6.3. permits server-to-server requests with no Origin header', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const res = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/enrollments',
        headers: {
          authorization: `Bearer ${tokenResult.accessToken}`,
          // No origin header
        },
      });

      assert.equal(res.statusCode, 200);
    });
  });

  // =========================================================================
  // 7. Secret Configuration Validation
  // =========================================================================
  describe('7. Secret Configuration Validation', () => {
    it('7.1. detects weak or missing secrets in production', () => {
      const weakCheck = checkIntegrationSecrets({
        morshidiTokenSecret: 'short-secret',
        morshidiClientSecret: 'short-client-key',
        isProduction: true,
      });

      assert.equal(weakCheck.valid, false);
      assert.ok(weakCheck.errors.length >= 2);
    });

    it('7.2. passes when secrets meet 32-character requirement', () => {
      const validCheck = checkIntegrationSecrets({
        morshidiTokenSecret: 'this-is-a-valid-production-secret-with-more-than-32-chars',
        morshidiClientSecret: 'this-is-another-valid-production-secret-over-32-chars',
        serviceSecret: 'this-is-a-valid-service-secret-over-32-chars-long',
        isProduction: true,
      });

      assert.equal(validCheck.valid, true);
      assert.equal(validCheck.errors.length, 0);
    });

    it('7.3. assertIntegrationSecrets throws descriptive error on weak production secret', () => {
      assert.throws(
        () => {
          assertIntegrationSecrets({
            morshidiTokenSecret: 'too-short',
            morshidiClientSecret: 'too-short',
            isProduction: true,
          });
        },
        /Integration security configuration error/,
      );
    });

    it('7.4. server fails startup in production mode if required secrets are weak or missing', () => {
      assert.throws(
        () => {
          createUniversityServer({
            store,
            isProduction: true,
            validateSecrets: true,
            morshidiTokenSecret: 'weak',
            morshidiClientSecret: 'weak',
          });
        },
        /Integration security configuration error/,
      );
    });
  });

  // =========================================================================
  // 8. Regression Check
  // =========================================================================
  describe('8. Regression Check', () => {
    it('8.1. all 5 academic endpoints continue to function with full security pipeline in place', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const authHeaders = { authorization: `Bearer ${tokenResult.accessToken}` };

      const endpoints = [
        '/api/integrations/morshidi/v1/student/me',
        '/api/integrations/morshidi/v1/student/courses',
        '/api/integrations/morshidi/v1/student/grades',
        '/api/integrations/morshidi/v1/student/enrollments',
        '/api/integrations/morshidi/v1/student/academic-plan',
      ];

      for (const endpoint of endpoints) {
        const res = await app.inject({ method: 'GET', url: endpoint, headers: authHeaders });
        assert.equal(res.statusCode, 200, `${endpoint} must return 200 under security pipeline`);
        assert.equal(res.headers['cache-control'], 'no-store, no-cache, must-revalidate');
        assert.equal(res.headers['x-content-type-options'], 'nosniff');
      }
    });
  });
});

