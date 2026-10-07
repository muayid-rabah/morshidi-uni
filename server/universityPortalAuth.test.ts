import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  getCalendar,
  normalizeStudentEmail,
  resolveUniversityAuthConfig,
  UniversityApiError,
} from '../src/lib/universityApi';

const expectApiError = (expectedStatus: number, expectedCode: string) => (error: unknown) => {
  assert.ok(error instanceof UniversityApiError);
  assert.equal(error.status, expectedStatus);
  assert.equal(error.code, expectedCode);
  return true;
};

test('normalizes a student number to its university email', () => {
  assert.equal(normalizeStudentEmail(' 202310001 '), '202310001@std.morshidi.edu.jo');
});

test('keeps a full university email and normalizes its case', () => {
  assert.equal(
    normalizeStudentEmail(' 202310001@STD.MORSHIDI.EDU.JO '),
    '202310001@std.morshidi.edu.jo',
  );
});

test('rejects an external email domain', () => {
  assert.throws(
    () => normalizeStudentEmail('202310001@example.com'),
    expectApiError(401, 'AUTH_FAILED'),
  );
});

test('fails closed when the Supabase URL is missing', () => {
  assert.throws(
    () => resolveUniversityAuthConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key' }),
    expectApiError(503, 'AUTH_NOT_CONFIGURED'),
  );
});

test('fails closed when the Supabase publishable key is missing', () => {
  assert.throws(
    () => resolveUniversityAuthConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co' }),
    expectApiError(503, 'AUTH_NOT_CONFIGURED'),
  );
});

test('normalizes trailing slashes in the Supabase URL', () => {
  assert.deepEqual(
    resolveUniversityAuthConfig({
      VITE_SUPABASE_URL: 'https://example.supabase.co///',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    }),
    { url: 'https://example.supabase.co', publishableKey: 'publishable-key' },
  );
});

test('frontend auth contains no legacy Supabase fallback or secret-key variable', async () => {
  const source = await readFile(new URL('../src/lib/universityApi.ts', import.meta.url), 'utf8');
  const forbiddenSecretVariable = ['VITE', 'SUPABASE', 'SECRET', 'KEY'].join('_');
  assert.equal(source.includes('lzwttbjnuhdllesfuzzs.supabase.co'), false);
  assert.equal(source.includes(forbiddenSecretVariable), false);
});

test('university API routes remain same-origin under the default configuration', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      currentTerm: { code: '2026-1', label: 'Test' },
      registrationOpen: false,
      registrationWindow: { start: null, end: null },
      nextTerm: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await getCalendar();
    assert.equal(requestedUrl, '/v1/calendar');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
