import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { UniversityStore } from './store';
import {
  isValidStudentId,
  studentIdFromEmail,
  verifyStudentCredentials,
  createStudentAuthVerifier,
} from './services/morshidiAuthVerifier';

describe('Morshidi Backend Auth Verifier (Step 1)', () => {
  let store: UniversityStore;
  const knownStudentId = '202310001';
  const mockAuthUserId = 'usr-supabase-uuid-1';
  const mockSupabaseUrl = 'https://mock.supabase.co';
  const mockSupabaseKey = 'mock-publishable-key';

  beforeEach(() => {
    store = new UniversityStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('validates 9-digit university student ID format correctly', () => {
    assert.equal(isValidStudentId('202310001'), true);
    assert.equal(isValidStudentId('202610005'), true);
    assert.equal(isValidStudentId(' 202310001 '), true, 'trims leading/trailing whitespace');

    assert.equal(isValidStudentId('20231000'), false, 'too short (8 digits)');
    assert.equal(isValidStudentId('2023100001'), false, 'too long (10 digits)');
    assert.equal(isValidStudentId('2023abc01'), false, 'contains letters');
    assert.equal(isValidStudentId(''), false, 'empty string');
    assert.equal(isValidStudentId(null), false, 'null');
    assert.equal(isValidStudentId(undefined), false, 'undefined');
    assert.equal(isValidStudentId(123456789), false, 'number type');
  });

  it('extracts student ID from email within university domain', () => {
    assert.equal(studentIdFromEmail('202310001@std.morshidi.edu.jo'), '202310001');
    assert.equal(studentIdFromEmail('202610005@std.morshidi.edu.jo'), '202610005');
    assert.equal(studentIdFromEmail('admin@morshidi.edu.jo'), null, 'staff domain rejected');
    assert.equal(studentIdFromEmail('student@gmail.com'), null, 'external domain rejected');
    assert.equal(studentIdFromEmail('invalid@std.morshidi.edu.jo'), null, 'non-numeric prefix rejected');
  });

  it('authenticates valid student existing in both Supabase and university database', async () => {
    let capturedBody = '';
    const mockFetcher: typeof fetch = async (input, init) => {
      capturedBody = String(init?.body || '');
      return new Response(JSON.stringify({
        access_token: 'fake-jwt-token',
        user: {
          id: mockAuthUserId,
          email: `${knownStudentId}@std.morshidi.edu.jo`,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const result = await verifyStudentCredentials(knownStudentId, 'valid-password-123', {
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      fetcher: mockFetcher,
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.studentId, knownStudentId);
      assert.equal(result.authUserId, mockAuthUserId);
      assert.equal(result.email, `${knownStudentId}@std.morshidi.edu.jo`);
    }

    assert.ok(capturedBody.includes(knownStudentId));
    assert.ok(capturedBody.includes('valid-password-123'));
  });

  it('rejects invalid student ID format before calling auth provider', async () => {
    let providerCalled = false;
    const mockFetcher: typeof fetch = async () => {
      providerCalled = true;
      return new Response('{}', { status: 200 });
    };

    const result = await verifyStudentCredentials('bad-id', 'some-password', {
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      fetcher: mockFetcher,
    });

    assert.equal(result.success, false);
    assert.equal(providerCalled, false, 'Downstream auth provider must not be contacted for invalid ID');
    if (!result.success) {
      assert.equal(result.reason, 'INVALID_STUDENT_ID');
    }
  });

  it('rejects empty or non-string password as INVALID_CREDENTIALS before calling auth provider', async () => {
    let providerCalled = false;
    const mockFetcher: typeof fetch = async () => {
      providerCalled = true;
      return new Response('{}', { status: 200 });
    };

    const resultEmpty = await verifyStudentCredentials(knownStudentId, '', {
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      fetcher: mockFetcher,
    });
    assert.equal(resultEmpty.success, false);
    assert.equal(providerCalled, false);
    if (!resultEmpty.success) {
      assert.equal(resultEmpty.reason, 'INVALID_CREDENTIALS');
    }
  });

  it('returns INVALID_CREDENTIALS when Supabase reports wrong password', async () => {
    const mockFetcher: typeof fetch = async () => {
      return new Response(JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Invalid login credentials',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    };

    const result = await verifyStudentCredentials(knownStudentId, 'wrong-password', {
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      fetcher: mockFetcher,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.reason, 'INVALID_CREDENTIALS');
      assert.ok(!result.message.includes('wrong-password'));
    }
  });

  it('returns STUDENT_NOT_FOUND when student is authenticated in Supabase but missing in university DB', async () => {
    const nonExistentStudentId = '209999999';
    const mockFetcher: typeof fetch = async () => {
      return new Response(JSON.stringify({
        access_token: 'valid-token',
        user: {
          id: 'user-not-in-db',
          email: `${nonExistentStudentId}@std.morshidi.edu.jo`,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const result = await verifyStudentCredentials(nonExistentStudentId, 'password123', {
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      fetcher: mockFetcher,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.reason, 'STUDENT_NOT_FOUND');
    }
  });

  it('returns IDENTITY_MISMATCH if Supabase returns mismatched student ID', async () => {
    const mockFetcher: typeof fetch = async () => {
      return new Response(JSON.stringify({
        access_token: 'valid-token',
        user: {
          id: 'user-different',
          email: '202410002@std.morshidi.edu.jo', // Different student ID
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const result = await verifyStudentCredentials(knownStudentId, 'password123', {
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      fetcher: mockFetcher,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.reason, 'IDENTITY_MISMATCH');
    }
  });

  it('returns IDENTITY_MISMATCH if authenticated user is in adminUserIds list', async () => {
    const mockFetcher: typeof fetch = async () => {
      return new Response(JSON.stringify({
        access_token: 'valid-token',
        user: {
          id: 'admin-user-id',
          email: `${knownStudentId}@std.morshidi.edu.jo`,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const result = await verifyStudentCredentials(knownStudentId, 'password123', {
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      adminUserIds: ['admin-user-id'],
      fetcher: mockFetcher,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.reason, 'IDENTITY_MISMATCH');
    }
  });

  it('returns AUTH_PROVIDER_UNAVAILABLE when Supabase configuration is missing', async () => {
    const result = await verifyStudentCredentials(knownStudentId, 'password123', {
      store,
      supabaseUrl: '',
      supabaseKey: '',
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.reason, 'AUTH_PROVIDER_UNAVAILABLE');
    }
  });

  it('returns AUTH_PROVIDER_UNAVAILABLE on network timeout or fetch rejection', async () => {
    const mockFetcher: typeof fetch = async () => {
      throw new Error('Connection timeout to auth provider');
    };

    const result = await verifyStudentCredentials(knownStudentId, 'password123', {
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      fetcher: mockFetcher,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.reason, 'AUTH_PROVIDER_UNAVAILABLE');
      assert.ok(!result.message.includes('password123'));
    }
  });

  it('returns AUTH_PROVIDER_UNAVAILABLE when provider responds with HTTP 500 error', async () => {
    const mockFetcher: typeof fetch = async () => {
      return new Response('Internal Server Error', { status: 500 });
    };

    const result = await verifyStudentCredentials(knownStudentId, 'password123', {
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      fetcher: mockFetcher,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.reason, 'AUTH_PROVIDER_UNAVAILABLE');
    }
  });

  it('security guarantee: password is never returned in result or error object', async () => {
    const sensitivePassword = 'super-secret-student-pass-999';

    const failFetcher: typeof fetch = async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
    const failResult = await verifyStudentCredentials(knownStudentId, sensitivePassword, {
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      fetcher: failFetcher,
    });

    assert.equal('password' in failResult, false);
    assert.equal(JSON.stringify(failResult).includes(sensitivePassword), false);

    const successFetcher: typeof fetch = async () => new Response(JSON.stringify({
      access_token: 'fake-jwt',
      user: { id: mockAuthUserId, email: `${knownStudentId}@std.morshidi.edu.jo` },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const successResult = await verifyStudentCredentials(knownStudentId, sensitivePassword, {
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      fetcher: successFetcher,
    });

    assert.equal('password' in successResult, false);
    assert.equal(JSON.stringify(successResult).includes(sensitivePassword), false);
  });

  it('security guarantee: no database modification happens during verification', async () => {
    const studentBefore = store.getStudent(knownStudentId);
    const cursorBefore = store.cursor();

    const mockFetcher: typeof fetch = async () => new Response(JSON.stringify({
      access_token: 'fake-jwt',
      user: { id: mockAuthUserId, email: `${knownStudentId}@std.morshidi.edu.jo` },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    await verifyStudentCredentials(knownStudentId, 'any-pass', {
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      fetcher: mockFetcher,
    });

    const studentAfter = store.getStudent(knownStudentId);
    const cursorAfter = store.cursor();

    assert.deepEqual(studentBefore, studentAfter);
    assert.equal(cursorBefore, cursorAfter, 'No university events should be emitted during auth verification');
  });

  it('createStudentAuthVerifier factory correctly binds options', async () => {
    const mockFetcher: typeof fetch = async () => new Response(JSON.stringify({
      access_token: 'fake-jwt',
      user: { id: mockAuthUserId, email: `${knownStudentId}@std.morshidi.edu.jo` },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const verifier = createStudentAuthVerifier({
      store,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      fetcher: mockFetcher,
    });

    const result = await verifier(knownStudentId, 'pass123');
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.studentId, knownStudentId);
    }
  });
});

