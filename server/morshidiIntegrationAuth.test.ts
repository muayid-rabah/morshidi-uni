import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createUniversityServer } from './index';
import { UniversityStore } from './store';
import { verifyIntegrationToken } from './auth/integrationToken';

describe('Morshidi Authentication API Endpoint (Step 3)', () => {
  let store: UniversityStore;
  let app: ReturnType<typeof createUniversityServer>;

  const knownStudentId = '202310001';
  const mockAuthUserId = 'usr-supabase-uuid-1';
  const testClientId = 'morshidi';
  const testClientSecret = 'super-secret-morshidi-client-key-1234';
  const testTokenSecret = 'integration-token-signing-secret-5678';
  const mockSupabaseUrl = 'https://mock.supabase.co';
  const mockSupabaseKey = 'mock-publishable-key';
  const rawSupabaseAccessToken = 'raw-supabase-secret-token-do-not-leak';
  const rawSupabaseRefreshToken = 'raw-supabase-refresh-token-do-not-leak';

  let providerCallCount = 0;
  let mockFetcherResponse: { status: number; body: unknown } | null = null;
  let mockFetcherShouldThrow = false;

  const mockFetcher: typeof fetch = async () => {
    providerCallCount += 1;
    if (mockFetcherShouldThrow) {
      throw new Error('Connection timeout to Supabase');
    }
    const resp = mockFetcherResponse ?? {
      status: 200,
      body: {
        access_token: rawSupabaseAccessToken,
        refresh_token: rawSupabaseRefreshToken,
        user: {
          id: mockAuthUserId,
          email: `${knownStudentId}@std.morshidi.edu.jo`,
        },
      },
    };
    return new Response(JSON.stringify(resp.body), {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const validHeaders = {
    'content-type': 'application/json',
    'x-morshidi-client-id': testClientId,
    'x-morshidi-client-secret': testClientSecret,
  };

  beforeEach(() => {
    providerCallCount = 0;
    mockFetcherResponse = null;
    mockFetcherShouldThrow = false;

    store = new UniversityStore(':memory:');
    app = createUniversityServer({
      store,
      servePortal: false,
      startWebhookWorker: false,
      fetcher: mockFetcher,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      morshidiClientId: testClientId,
      morshidiClientSecret: testClientSecret,
      morshidiTokenSecret: testTokenSecret,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('1. successful login issues short-lived integration token for verified student', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/integrations/morshidi/v1/auth/login',
      headers: validHeaders,
      payload: {
        studentId: knownStudentId,
        password: 'correct-password-123',
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      success: boolean;
      accessToken: string;
      tokenType: string;
      expiresIn: number;
      student: { studentId: string; email: string };
    };

    assert.equal(body.success, true);
    assert.equal(body.tokenType, 'Bearer');
    assert.equal(body.expiresIn, 900);
    assert.equal(body.student.studentId, knownStudentId);
    assert.equal(body.student.email, `${knownStudentId}@std.morshidi.edu.jo`);
    assert.ok(typeof body.accessToken === 'string' && body.accessToken.length > 30);

    // Verify the issued token with Step 2's verifyIntegrationToken
    const tokenVerification = await verifyIntegrationToken(body.accessToken, {
      secret: testTokenSecret,
    });

    assert.equal(tokenVerification.success, true);
    if (tokenVerification.success) {
      assert.equal(tokenVerification.studentId, knownStudentId);
      assert.equal(tokenVerification.claims.sub, knownStudentId);
      assert.equal(tokenVerification.claims.aud, 'morshidi');
      assert.equal(tokenVerification.claims.iss, 'fake-university');
    }
  });

  it('2. rejects request with missing Morshidi client headers without calling auth provider', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/integrations/morshidi/v1/auth/login',
      headers: { 'content-type': 'application/json' }, // No client credentials
      payload: {
        studentId: knownStudentId,
        password: 'some-password',
      },
    });

    assert.equal(response.statusCode, 401);
    const body = response.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, 'INVALID_CLIENT');
    assert.equal(providerCallCount, 0, 'Auth provider must not be contacted if client is unauthenticated');
  });

  it('3. rejects request with wrong client secret without proceeding to student verification', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/integrations/morshidi/v1/auth/login',
      headers: {
        ...validHeaders,
        'x-morshidi-client-secret': 'wrong-secret',
      },
      payload: {
        studentId: knownStudentId,
        password: 'some-password',
      },
    });

    assert.equal(response.statusCode, 401);
    const body = response.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, 'INVALID_CLIENT');
    assert.equal(providerCallCount, 0, 'Student verification must not proceed on wrong client secret');
  });

  it('4. rejects wrong student password with normalized 401 INVALID_CREDENTIALS', async () => {
    mockFetcherResponse = {
      status: 400,
      body: { error: 'invalid_grant', error_description: 'Invalid login credentials' },
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/integrations/morshidi/v1/auth/login',
      headers: validHeaders,
      payload: {
        studentId: knownStudentId,
        password: 'incorrect-password',
      },
    });

    assert.equal(response.statusCode, 401);
    const body = response.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, 'INVALID_CREDENTIALS');
  });

  it('5. rejects invalid student ID format with normalized 401 INVALID_CREDENTIALS', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/integrations/morshidi/v1/auth/login',
      headers: validHeaders,
      payload: {
        studentId: 'bad-format-123',
        password: 'any-password',
      },
    });

    assert.equal(response.statusCode, 401);
    const body = response.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, 'INVALID_CREDENTIALS');
    assert.equal(providerCallCount, 0, 'Provider should not be called for malformed student ID');
  });

  it('6. rejects student existing in Supabase but missing in university DB with normalized 401', async () => {
    const missingStudentId = '209999999';
    mockFetcherResponse = {
      status: 200,
      body: {
        access_token: 'fake-token',
        user: {
          id: 'user-not-in-db',
          email: `${missingStudentId}@std.morshidi.edu.jo`,
        },
      },
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/integrations/morshidi/v1/auth/login',
      headers: validHeaders,
      payload: {
        studentId: missingStudentId,
        password: 'password123',
      },
    });

    assert.equal(response.statusCode, 401);
    const body = response.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, 'INVALID_CREDENTIALS', 'Normalized to prevent account enumeration');
  });

  it('7. returns 503 AUTH_SERVICE_UNAVAILABLE when Supabase is unreachable', async () => {
    mockFetcherShouldThrow = true;

    const response = await app.inject({
      method: 'POST',
      url: '/api/integrations/morshidi/v1/auth/login',
      headers: validHeaders,
      payload: {
        studentId: knownStudentId,
        password: 'some-password',
      },
    });

    assert.equal(response.statusCode, 503);
    const body = response.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, 'AUTH_SERVICE_UNAVAILABLE');
  });

  it('8. returns 500 INTEGRATION_UNAVAILABLE when token signing secret is missing on server', async () => {
    const localStore = new UniversityStore(':memory:');
    const unconfiguredApp = createUniversityServer({
      store: localStore,
      servePortal: false,
      startWebhookWorker: false,
      fetcher: mockFetcher,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      morshidiClientId: testClientId,
      morshidiClientSecret: testClientSecret,
      morshidiTokenSecret: '', // Missing secret
    });

    try {
      const response = await unconfiguredApp.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: validHeaders,
        payload: {
          studentId: knownStudentId,
          password: 'valid-password',
        },
      });

      assert.equal(response.statusCode, 500);
      const body = response.json() as { success: boolean; error: string };
      assert.equal(body.success, false);
      assert.equal(body.error, 'INTEGRATION_UNAVAILABLE');
      assert.ok(!JSON.stringify(body).includes('secret'));
    } finally {
      await unconfiguredApp.close();
    }
  });

  it('9. security guarantee: password is never returned in response body', async () => {
    const sensitivePassword = 'super-secret-plain-password-888';

    const response = await app.inject({
      method: 'POST',
      url: '/api/integrations/morshidi/v1/auth/login',
      headers: validHeaders,
      payload: {
        studentId: knownStudentId,
        password: sensitivePassword,
      },
    });

    assert.equal(response.statusCode, 200);
    const rawBody = response.body;
    assert.equal(rawBody.includes(sensitivePassword), false, 'Password must not appear in response');
    assert.equal(rawBody.includes('password'), false, 'Key "password" must not appear in response');
  });

  it('10. security guarantee: Supabase tokens never leak in response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/integrations/morshidi/v1/auth/login',
      headers: validHeaders,
      payload: {
        studentId: knownStudentId,
        password: 'valid-password',
      },
    });

    assert.equal(response.statusCode, 200);
    const rawBody = response.body;
    assert.equal(rawBody.includes(rawSupabaseAccessToken), false, 'Supabase access token must never leak');
    assert.equal(rawBody.includes(rawSupabaseRefreshToken), false, 'Supabase refresh token must never leak');
  });

  it('11. security guarantee: client secret never leaks in response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/integrations/morshidi/v1/auth/login',
      headers: validHeaders,
      payload: {
        studentId: knownStudentId,
        password: 'valid-password',
      },
    });

    assert.equal(response.statusCode, 200);
    const rawBody = response.body;
    assert.equal(rawBody.includes(testClientSecret), false, 'Client secret must never appear in response');
    assert.equal(rawBody.includes('MORSHIDI_INTEGRATION_CLIENT_SECRET'), false);
  });

  it('12. rejects malformed or missing request body with 400 INVALID_REQUEST', async () => {
    const invalidBodies = [
      {},
      { studentId: knownStudentId }, // missing password
      { password: 'some-password' }, // missing studentId
      { studentId: '', password: 'pass' }, // empty studentId
      { studentId: knownStudentId, password: '' }, // empty password
      { studentId: 123456789, password: 'pass' }, // non-string studentId
    ];

    for (const badBody of invalidBodies) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: validHeaders,
        payload: badBody,
      });

      assert.equal(response.statusCode, 400, `Body ${JSON.stringify(badBody)} must return 400`);
      const body = response.json() as { success: boolean; error: string };
      assert.equal(body.success, false);
      assert.equal(body.error, 'INVALID_REQUEST');
    }
  });
});
