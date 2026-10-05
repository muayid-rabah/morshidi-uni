import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  issueIntegrationToken,
  verifyIntegrationToken,
  DEFAULT_INTEGRATION_TOKEN_EXPIRY_SECONDS,
  DEFAULT_INTEGRATION_TOKEN_AUDIENCE,
  DEFAULT_INTEGRATION_TOKEN_ISSUER,
} from './auth/integrationToken';

describe('Morshidi Scoped Integration Token Service (Step 2)', () => {
  const mockSecret = 'test-morshidi-integration-token-secret-32b';
  const alternateSecret = 'different-signing-secret-key-44444';
  const studentA = '202310001';
  const studentB = '202410002';

  it('1. issues and verifies a valid student integration token', async () => {
    const issueResult = await issueIntegrationToken(
      { studentId: studentA },
      { secret: mockSecret },
    );

    assert.equal(issueResult.success, true);
    if (!issueResult.success) return;

    assert.equal(issueResult.tokenType, 'Bearer');
    assert.equal(issueResult.expiresIn, DEFAULT_INTEGRATION_TOKEN_EXPIRY_SECONDS);
    assert.ok(issueResult.accessToken.length > 30);
    assert.equal(issueResult.accessToken.split('.').length, 3);

    const verifyResult = await verifyIntegrationToken(issueResult.accessToken, {
      secret: mockSecret,
    });

    assert.equal(verifyResult.success, true);
    if (!verifyResult.success) return;

    assert.equal(verifyResult.studentId, studentA);
    assert.equal(verifyResult.claims.sub, studentA);
    assert.equal(verifyResult.claims.aud, DEFAULT_INTEGRATION_TOKEN_AUDIENCE);
    assert.equal(verifyResult.claims.iss, DEFAULT_INTEGRATION_TOKEN_ISSUER);
    assert.ok(verifyResult.claims.exp > verifyResult.claims.iat);
  });

  it('2. rejects tokens with wrong signature or verified against different secret', async () => {
    const issueResult = await issueIntegrationToken(
      { studentId: studentA },
      { secret: mockSecret },
    );
    assert.equal(issueResult.success, true);
    if (!issueResult.success) return;

    // A: Verified with a different secret
    const wrongSecretResult = await verifyIntegrationToken(issueResult.accessToken, {
      secret: alternateSecret,
    });
    assert.equal(wrongSecretResult.success, false);
    if (!wrongSecretResult.success) {
      assert.equal(wrongSecretResult.reason, 'INVALID_TOKEN');
      assert.equal(wrongSecretResult.message, 'Invalid token signature');
    }

    // B: Tampered signature characters
    const [headerB64, payloadB64, sigB64] = issueResult.accessToken.split('.');
    const corruptedSig = sigB64.slice(0, -3) + (sigB64.endsWith('a') ? 'b' : 'a') + sigB64.slice(-2);
    const tamperedSigToken = `${headerB64}.${payloadB64}.${corruptedSig}`;

    const corruptedResult = await verifyIntegrationToken(tamperedSigToken, {
      secret: mockSecret,
    });
    assert.equal(corruptedResult.success, false);
    if (!corruptedResult.success) {
      assert.equal(corruptedResult.reason, 'INVALID_TOKEN');
    }
  });

  it('3. rejects payload tampering (sub changed from studentA to studentB without resigning)', async () => {
    const issueResult = await issueIntegrationToken(
      { studentId: studentA },
      { secret: mockSecret },
    );
    assert.equal(issueResult.success, true);
    if (!issueResult.success) return;

    const [headerB64, payloadB64, sigB64] = issueResult.accessToken.split('.');
    const decodedPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as Record<string, unknown>;

    // Attempted Privilege Escalation: Swap student ID from 202310001 to 202410002
    decodedPayload.sub = studentB;
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(decodedPayload), 'utf8').toString('base64url');
    const forgedToken = `${headerB64}.${tamperedPayloadB64}.${sigB64}`;

    const verifyResult = await verifyIntegrationToken(forgedToken, {
      secret: mockSecret,
    });

    assert.equal(verifyResult.success, false, 'Tampered payload must fail cryptographic verification');
    if (!verifyResult.success) {
      assert.equal(verifyResult.reason, 'INVALID_TOKEN');
      assert.equal(verifyResult.message, 'Invalid token signature');
    }
  });

  it('4. rejects expired tokens with TOKEN_EXPIRED', async () => {
    const fixedNow = 1700000000;
    const issueResult = await issueIntegrationToken(
      { studentId: studentA },
      {
        secret: mockSecret,
        expiresInSeconds: 300,
        nowInSeconds: fixedNow,
      },
    );
    assert.equal(issueResult.success, true);
    if (!issueResult.success) return;

    // Verify at exactly exp timestamp (300 seconds later)
    const expiredResult = await verifyIntegrationToken(issueResult.accessToken, {
      secret: mockSecret,
      nowInSeconds: fixedNow + 301,
    });

    assert.equal(expiredResult.success, false);
    if (!expiredResult.success) {
      assert.equal(expiredResult.reason, 'TOKEN_EXPIRED');
      assert.equal(expiredResult.message, 'Token has expired');
    }

    // Verify 1 second before exp should still succeed
    const validBeforeResult = await verifyIntegrationToken(issueResult.accessToken, {
      secret: mockSecret,
      nowInSeconds: fixedNow + 299,
    });
    assert.equal(validBeforeResult.success, true);
  });

  it('5. rejects tokens with wrong audience', async () => {
    // Manually forged token with wrong audience
    const now = Math.floor(Date.now() / 1000);
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify({
      sub: studentA,
      aud: 'rogue-platform',
      iss: DEFAULT_INTEGRATION_TOKEN_ISSUER,
      iat: now,
      exp: now + 900,
    })).toString('base64url');

    const { createHmac } = await import('node:crypto');
    const signature = createHmac('sha256', mockSecret).update(`${headerB64}.${payloadB64}`).digest('base64url');
    const rogueToken = `${headerB64}.${payloadB64}.${signature}`;

    const verifyResult = await verifyIntegrationToken(rogueToken, {
      secret: mockSecret,
      audience: 'morshidi',
    });

    assert.equal(verifyResult.success, false);
    if (!verifyResult.success) {
      assert.equal(verifyResult.reason, 'INVALID_TOKEN');
      assert.equal(verifyResult.message, 'Token audience mismatch');
    }
  });

  it('6. rejects tokens with wrong issuer', async () => {
    const now = Math.floor(Date.now() / 1000);
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify({
      sub: studentA,
      aud: DEFAULT_INTEGRATION_TOKEN_AUDIENCE,
      iss: 'malicious-third-party',
      iat: now,
      exp: now + 900,
    })).toString('base64url');

    const { createHmac } = await import('node:crypto');
    const signature = createHmac('sha256', mockSecret).update(`${headerB64}.${payloadB64}`).digest('base64url');
    const rogueToken = `${headerB64}.${payloadB64}.${signature}`;

    const verifyResult = await verifyIntegrationToken(rogueToken, {
      secret: mockSecret,
      issuer: 'fake-university',
    });

    assert.equal(verifyResult.success, false);
    if (!verifyResult.success) {
      assert.equal(verifyResult.reason, 'INVALID_TOKEN');
      assert.equal(verifyResult.message, 'Token issuer mismatch');
    }
  });

  it('7. rejects tokens where subject is not a valid 9-digit university student ID', async () => {
    const invalidSubTokens = ['admin', '123', 'student-id-abc', '20231000'];

    for (const badSub of invalidSubTokens) {
      const now = Math.floor(Date.now() / 1000);
      const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify({
        sub: badSub,
        aud: DEFAULT_INTEGRATION_TOKEN_AUDIENCE,
        iss: DEFAULT_INTEGRATION_TOKEN_ISSUER,
        iat: now,
        exp: now + 900,
      })).toString('base64url');

      const { createHmac } = await import('node:crypto');
      const signature = createHmac('sha256', mockSecret).update(`${headerB64}.${payloadB64}`).digest('base64url');
      const invalidToken = `${headerB64}.${payloadB64}.${signature}`;

      const verifyResult = await verifyIntegrationToken(invalidToken, { secret: mockSecret });
      assert.equal(verifyResult.success, false, `Subject "${badSub}" must be rejected`);
      if (!verifyResult.success) {
        assert.equal(verifyResult.reason, 'INVALID_TOKEN');
        assert.equal(verifyResult.message, 'Token subject must be a valid 9-digit university student ID');
      }
    }
  });

  it('8. fails safely with TOKEN_CONFIGURATION_ERROR when signing secret is missing', async () => {
    const prevEnv = process.env.MORSHIDI_INTEGRATION_TOKEN_SECRET;
    delete process.env.MORSHIDI_INTEGRATION_TOKEN_SECRET;

    try {
      // Issuance fails safely
      const issueResult = await issueIntegrationToken({ studentId: studentA }, { secret: '' });
      assert.equal(issueResult.success, false);
      if (!issueResult.success) {
        assert.equal(issueResult.reason, 'TOKEN_CONFIGURATION_ERROR');
      }

      // Verification fails safely
      const verifyResult = await verifyIntegrationToken('some.fake.token', { secret: '' });
      assert.equal(verifyResult.success, false);
      if (!verifyResult.success) {
        assert.equal(verifyResult.reason, 'TOKEN_CONFIGURATION_ERROR');
      }
    } finally {
      if (prevEnv) process.env.MORSHIDI_INTEGRATION_TOKEN_SECRET = prevEnv;
    }
  });

  it('9. security guarantee: token payload contains no sensitive auth credentials', async () => {
    const issueResult = await issueIntegrationToken(
      { studentId: studentA },
      { secret: mockSecret },
    );
    assert.equal(issueResult.success, true);
    if (!issueResult.success) return;

    const [, payloadB64] = issueResult.accessToken.split('.');
    const decodedPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as Record<string, unknown>;

    const forbiddenFields = [
      'password', 'pass', 'hash', 'secret', 'apikey', 'api_key',
      'access_token', 'refresh_token', 'supabase_token', 'service_key',
    ];

    for (const field of forbiddenFields) {
      assert.equal(field in decodedPayload, false, `Field "${field}" must not exist in token payload`);
    }

    // Exact expected keys only: sub, aud, iss, iat, exp
    const payloadKeys = Object.keys(decodedPayload).sort();
    assert.deepEqual(payloadKeys, ['aud', 'exp', 'iat', 'iss', 'sub']);
  });

  it('10. different students produce strictly scoped tokens with no cross-identity capability', async () => {
    const tokenA = await issueIntegrationToken({ studentId: studentA }, { secret: mockSecret });
    const tokenB = await issueIntegrationToken({ studentId: studentB }, { secret: mockSecret });

    assert.equal(tokenA.success, true);
    assert.equal(tokenB.success, true);
    if (!tokenA.success || !tokenB.success) return;

    assert.notEqual(tokenA.accessToken, tokenB.accessToken);

    const verifiedA = await verifyIntegrationToken(tokenA.accessToken, { secret: mockSecret });
    const verifiedB = await verifyIntegrationToken(tokenB.accessToken, { secret: mockSecret });

    assert.equal(verifiedA.success, true);
    assert.equal(verifiedB.success, true);
    if (!verifiedA.success || !verifiedB.success) return;

    assert.equal(verifiedA.studentId, studentA);
    assert.equal(verifiedB.studentId, studentB);
    assert.notEqual(verifiedA.studentId, verifiedB.studentId);
  });

  it('11. rejects malformed or empty token strings gracefully', async () => {
    const malformedCases = [
      '',
      '   ',
      'onlyonepart',
      'two.parts',
      'four.parts.are.here',
      'invalid!base64url.invalid!base64url.invalid!base64url',
    ];

    for (const badToken of malformedCases) {
      const result = await verifyIntegrationToken(badToken, { secret: mockSecret });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.reason, 'INVALID_TOKEN');
      }
    }
  });

  it('12. rejects tokens issued far into the future (clock skew guard)', async () => {
    const fixedNow = 1700000000;
    const futureIssueResult = await issueIntegrationToken(
      { studentId: studentA },
      {
        secret: mockSecret,
        nowInSeconds: fixedNow + 3600, // 1 hour ahead
        expiresInSeconds: 900,
      },
    );
    assert.equal(futureIssueResult.success, true);
    if (!futureIssueResult.success) return;

    const verifyResult = await verifyIntegrationToken(futureIssueResult.accessToken, {
      secret: mockSecret,
      nowInSeconds: fixedNow, // Current server time
    });

    assert.equal(verifyResult.success, false);
    if (!verifyResult.success) {
      assert.equal(verifyResult.reason, 'INVALID_TOKEN');
      assert.equal(verifyResult.message, 'Token issued in the future');
    }
  });
});

