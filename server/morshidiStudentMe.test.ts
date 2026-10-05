import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createUniversityServer } from './index';
import { UniversityStore } from './store';
import { issueIntegrationToken } from './auth/integrationToken';

describe('Morshidi Authenticated Student /me Endpoint (Step 4)', () => {
  let store: UniversityStore;
  let app: ReturnType<typeof createUniversityServer>;

  const studentAId = '202310001';
  const studentBId = '202610005';
  const testTokenSecret = 'test-morshidi-integration-token-secret-xyz123';
  const testClientId = 'morshidi';
  const testClientSecret = 'super-secret-morshidi-client-key-1234';
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
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('1. valid token returns correct student with clean profile contract', async () => {
    const tokenResult = await issueIntegrationToken(
      { studentId: studentAId },
      { secret: testTokenSecret },
    );
    assert.equal(tokenResult.success, true);
    if (!tokenResult.success) return;

    const response = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/me',
      headers: {
        authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      success: boolean;
      student: {
        studentId: string;
        name: string;
        email: string;
        faculty: string;
        major: string;
        degree: string;
        studyType: string;
        admissionYear: number;
        academicAdvisor: string;
        academicStatus: string;
        gpa: number;
        earnedCredits: number;
      };
    };

    assert.equal(body.success, true);
    assert.equal(body.student.studentId, studentAId);
    assert.equal(body.student.name, 'أحمد محمود الخطيب');
    assert.equal(body.student.email, `${studentAId}@std.morshidi.edu.jo`);
    assert.equal(body.student.faculty, 'كلية تكنولوجيا المعلومات');
    assert.equal(body.student.major, 'الذكاء الاصطناعي');
    assert.equal(body.student.degree, 'بكالوريوس');
    assert.equal(body.student.studyType, 'انتظام');
    assert.equal(body.student.admissionYear, 2023);
    assert.equal(body.student.academicAdvisor, 'د. سامر العلي');
    assert.ok(typeof body.student.academicStatus === 'string' && body.student.academicStatus.length > 0);
    assert.ok(typeof body.student.gpa === 'number' && body.student.gpa > 0);
    assert.ok(typeof body.student.earnedCredits === 'number' && body.student.earnedCredits > 0);
  });

  it('2. rejects request with missing Authorization header with 401 UNAUTHORIZED', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/me',
    });

    assert.equal(response.statusCode, 401);
    const body = response.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, 'UNAUTHORIZED');
  });

  it('3. rejects invalid Bearer formats with 401 UNAUTHORIZED', async () => {
    const invalidHeaders = [
      'abc',
      'Basic dXNlcjpwYXNz',
      'Bearer',
      'Bearer ',
      'Token some-token',
      'bearer-without-space',
    ];

    for (const badAuth of invalidHeaders) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/me',
        headers: { authorization: badAuth },
      });

      assert.equal(response.statusCode, 401, `Header "${badAuth}" must return 401`);
      const body = response.json() as { success: boolean; error: string };
      assert.equal(body.success, false);
      assert.equal(body.error, 'UNAUTHORIZED');
    }
  });

  it('4. rejects tampered token payload or signature with 401 UNAUTHORIZED', async () => {
    const tokenResult = await issueIntegrationToken(
      { studentId: studentAId },
      { secret: testTokenSecret },
    );
    assert.equal(tokenResult.success, true);
    if (!tokenResult.success) return;

    const parts = tokenResult.accessToken.split('.');

    // Tamper payload (try modifying sub from student A to student B)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    payload.sub = studentBId;
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;

    const response = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/me',
      headers: { authorization: `Bearer ${tamperedToken}` },
    });

    assert.equal(response.statusCode, 401);
    const body = response.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, 'UNAUTHORIZED');

    // Also test with corrupt signature
    const corruptSigToken = `${parts[0]}.${parts[1]}.corruptsignature12345`;
    const response2 = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/me',
      headers: { authorization: `Bearer ${corruptSigToken}` },
    });

    assert.equal(response2.statusCode, 401);
    const body2 = response2.json() as { success: boolean; error: string };
    assert.equal(body2.success, false);
    assert.equal(body2.error, 'UNAUTHORIZED');
  });

  it('5. rejects expired token with 401 TOKEN_EXPIRED', async () => {
    // Issued in the past (e.g. timestamp 1700000000 with 60s lifetime)
    const tokenResult = await issueIntegrationToken(
      { studentId: studentAId },
      { secret: testTokenSecret, expiresInSeconds: 60, nowInSeconds: 1700000000 },
    );
    assert.equal(tokenResult.success, true);
    if (!tokenResult.success) return;

    const response = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/me',
      headers: { authorization: `Bearer ${tokenResult.accessToken}` },
    });

    assert.equal(response.statusCode, 401);
    const body = response.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, 'TOKEN_EXPIRED');
  });

  it('6. rejects token with wrong audience with 401 UNAUTHORIZED', async () => {
    const tokenResult = await issueIntegrationToken(
      { studentId: studentAId },
      { secret: testTokenSecret, audience: 'wrong-external-system' },
    );
    assert.equal(tokenResult.success, true);
    if (!tokenResult.success) return;

    const response = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/me',
      headers: { authorization: `Bearer ${tokenResult.accessToken}` },
    });

    assert.equal(response.statusCode, 401);
    const body = response.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, 'UNAUTHORIZED');
  });

  it('7. rejects token with wrong issuer with 401 UNAUTHORIZED', async () => {
    const tokenResult = await issueIntegrationToken(
      { studentId: studentAId },
      { secret: testTokenSecret, issuer: 'rogue-identity-provider' },
    );
    assert.equal(tokenResult.success, true);
    if (!tokenResult.success) return;

    const response = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/me',
      headers: { authorization: `Bearer ${tokenResult.accessToken}` },
    });

    assert.equal(response.statusCode, 401);
    const body = response.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, 'UNAUTHORIZED');
  });

  it('8. returns 404 STUDENT_NOT_FOUND when student no longer exists in university DB', async () => {
    const nonExistentStudentId = '202999999';
    const tokenResult = await issueIntegrationToken(
      { studentId: nonExistentStudentId },
      { secret: testTokenSecret },
    );
    assert.equal(tokenResult.success, true);
    if (!tokenResult.success) return;

    const response = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/me',
      headers: { authorization: `Bearer ${tokenResult.accessToken}` },
    });

    assert.equal(response.statusCode, 404);
    const body = response.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.equal(body.error, 'STUDENT_NOT_FOUND');
  });

  it('9. critical security: cannot access another student data via query, body, or headers', async () => {
    const tokenAResult = await issueIntegrationToken(
      { studentId: studentAId },
      { secret: testTokenSecret },
    );
    const tokenBResult = await issueIntegrationToken(
      { studentId: studentBId },
      { secret: testTokenSecret },
    );
    assert.equal(tokenAResult.success, true);
    assert.equal(tokenBResult.success, true);
    if (!tokenAResult.success || !tokenBResult.success) return;

    // Call with Token A attempting to inject Student B ID through various attack vectors
    const responseWithInjections = await app.inject({
      method: 'GET',
      url: `/api/integrations/morshidi/v1/student/me?studentId=${studentBId}&id=${studentBId}`,
      headers: {
        authorization: `Bearer ${tokenAResult.accessToken}`,
        'x-student-id': studentBId,
        'student-id': studentBId,
      },
    });

    assert.equal(responseWithInjections.statusCode, 200);
    const bodyA = responseWithInjections.json() as { success: boolean; student: { studentId: string } };
    assert.equal(bodyA.success, true);
    assert.equal(bodyA.student.studentId, studentAId, 'MUST strictly return Student A regardless of query/header injection');

    // Calling with Token B returns Student B
    const responseB = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/me',
      headers: {
        authorization: `Bearer ${tokenBResult.accessToken}`,
      },
    });

    assert.equal(responseB.statusCode, 200);
    const bodyB = responseB.json() as { success: boolean; student: { studentId: string } };
    assert.equal(bodyB.success, true);
    assert.equal(bodyB.student.studentId, studentBId);
  });

  it('10. security guarantee: response contract does not leak internal sensitive fields', async () => {
    const tokenResult = await issueIntegrationToken(
      { studentId: studentAId },
      { secret: testTokenSecret },
    );
    assert.equal(tokenResult.success, true);
    if (!tokenResult.success) return;

    const response = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/me',
      headers: { authorization: `Bearer ${tokenResult.accessToken}` },
    });

    assert.equal(response.statusCode, 200);
    const rawBody = response.body;

    // Verify forbidden fields do not leak in response body
    const forbiddenSubstrings = [
      'password',
      'hash',
      'access_token',
      'refresh_token',
      testTokenSecret,
      testClientSecret,
      'UNI_SERVICE_KEY',
      'financialSummary',
      'transactions',
      'profile_json',
      'record_json',
      'semesterHistory',
      'attempts',
      'absences',
      'exams',
    ];

    for (const forbidden of forbiddenSubstrings) {
      assert.equal(
        rawBody.includes(forbidden),
        false,
        `Response must not leak internal field or secret "${forbidden}"`,
      );
    }
  });

  it('11. fresh university data: reads latest store state at request time without token reissuance', async () => {
    const tokenResult = await issueIntegrationToken(
      { studentId: studentAId },
      { secret: testTokenSecret },
    );
    assert.equal(tokenResult.success, true);
    if (!tokenResult.success) return;

    // Initial check
    const initialResp = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/me',
      headers: { authorization: `Bearer ${tokenResult.accessToken}` },
    });
    assert.equal(initialResp.statusCode, 200);
    const initialBody = initialResp.json() as { student: { academicStatus: string } };
    const originalStatus = initialBody.student.academicStatus;

    // Mutate student profile directly in the store SQLite database
    const updatedStatus = 'موقوف مؤقتًا لأسباب إدارية';
    const profile = store.getStudent(studentAId);
    assert.ok(profile);
    if (profile) {
      profile.academicStatus = updatedStatus;
      store.db
        .prepare('UPDATE students SET profile_json = ? WHERE student_id = ?')
        .run(JSON.stringify(profile), studentAId);
    }

    // Call /student/me again using the SAME token issued prior to the database mutation
    const secondResp = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/me',
      headers: { authorization: `Bearer ${tokenResult.accessToken}` },
    });

    assert.equal(secondResp.statusCode, 200);
    const secondBody = secondResp.json() as { student: { academicStatus: string } };
    assert.notEqual(secondBody.student.academicStatus, originalStatus);
    assert.equal(secondBody.student.academicStatus, updatedStatus, 'Must immediately reflect authoritative database update');
  });

  it('12. server configuration failure: returns 500 INTEGRATION_UNAVAILABLE when signing secret is missing', async () => {
    const localStore = new UniversityStore(':memory:');
    const unconfiguredApp = createUniversityServer({
      store: localStore,
      servePortal: false,
      startWebhookWorker: false,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      morshidiClientId: testClientId,
      morshidiClientSecret: testClientSecret,
      morshidiTokenSecret: '', // Missing server secret
    });

    try {
      const response = await unconfiguredApp.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/me',
        headers: { authorization: 'Bearer some-sample-token-123' },
      });

      assert.equal(response.statusCode, 500);
      const body = response.json() as { success: boolean; error: string };
      assert.equal(body.success, false);
      assert.equal(body.error, 'INTEGRATION_UNAVAILABLE');
    } finally {
      await unconfiguredApp.close();
    }
  });

  it('13. regression check: Step 3 POST /auth/login continues to work alongside Step 4 GET /student/me', async () => {
    // Mock fetcher to allow student login
    let loginApp: ReturnType<typeof createUniversityServer> | null = null;
    const localStore = new UniversityStore(':memory:');

    const mockFetcher: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          access_token: 'fake-supabase-access-token',
          user: {
            id: 'mock-uuid-student-1',
            email: `${studentAId}@std.morshidi.edu.jo`,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    loginApp = createUniversityServer({
      store: localStore,
      servePortal: false,
      startWebhookWorker: false,
      fetcher: mockFetcher,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      morshidiClientId: testClientId,
      morshidiClientSecret: testClientSecret,
      morshidiTokenSecret: testTokenSecret,
    });

    try {
      // 1. Login via Step 3 endpoint
      const loginResp = await loginApp.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: {
          'x-morshidi-client-id': testClientId,
          'x-morshidi-client-secret': testClientSecret,
          'content-type': 'application/json',
        },
        payload: {
          studentId: studentAId,
          password: 'student-password-123',
        },
      });

      assert.equal(loginResp.statusCode, 200);
      const loginBody = loginResp.json() as {
        success: boolean;
        accessToken: string;
        tokenType: string;
        expiresIn: number;
        student: { studentId: string };
      };

      assert.equal(loginBody.success, true);
      assert.ok(loginBody.accessToken);

      // 2. Immediately call Step 4 /student/me with the issued accessToken
      const meResp = await loginApp.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/me',
        headers: {
          authorization: `Bearer ${loginBody.accessToken}`,
        },
      });

      assert.equal(meResp.statusCode, 200);
      const meBody = meResp.json() as {
        success: boolean;
        student: { studentId: string; name: string };
      };

      assert.equal(meBody.success, true);
      assert.equal(meBody.student.studentId, studentAId);
      assert.equal(meBody.student.name, 'أحمد محمود الخطيب');
    } finally {
      if (loginApp) await loginApp.close();
    }
  });
});
