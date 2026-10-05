import { createHmac } from 'node:crypto';
import { safeEqual } from '../store';
import { isValidStudentId } from '../services/morshidiAuthVerifier';

export const DEFAULT_INTEGRATION_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes
export const DEFAULT_INTEGRATION_TOKEN_AUDIENCE = 'morshidi';
export const DEFAULT_INTEGRATION_TOKEN_ISSUER = 'fake-university';

export interface IntegrationTokenPayload {
  sub: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
}

export interface IssueIntegrationTokenInput {
  studentId: string;
}

export interface IntegrationTokenOptions {
  secret?: string;
  expiresInSeconds?: number;
  issuer?: string;
  audience?: string;
  nowInSeconds?: number;
}

export type IssueTokenFailureReason =
  | 'INVALID_STUDENT_ID'
  | 'TOKEN_CONFIGURATION_ERROR';

export interface IssueTokenSuccess {
  success: true;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface IssueTokenFailure {
  success: false;
  reason: IssueTokenFailureReason;
  message: string;
}

export type IssueIntegrationTokenResult = IssueTokenSuccess | IssueTokenFailure;

export type VerifyTokenFailureReason =
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_CONFIGURATION_ERROR';

export interface VerifyTokenSuccess {
  success: true;
  studentId: string;
  claims: IntegrationTokenPayload;
}

export interface VerifyTokenFailure {
  success: false;
  reason: VerifyTokenFailureReason;
  message: string;
}

export type VerifyIntegrationTokenResult = VerifyTokenSuccess | VerifyTokenFailure;

/**
 * Issues a short-lived, cryptographically signed integration token scoped
 * strictly to the authenticated student ID for the Morshidi platform.
 *
 * Security:
 * - Fixed audience: "morshidi"
 * - Fixed algorithm: HMAC-SHA256 (HS256)
 * - Minimum claims only: sub, aud, iss, iat, exp
 * - No sensitive data (passwords, Supabase tokens, secrets) are ever included.
 */
export async function issueIntegrationToken(
  input: IssueIntegrationTokenInput,
  options: IntegrationTokenOptions = {},
): Promise<IssueIntegrationTokenResult> {
  // 1. Validate student ID format
  if (!input || !isValidStudentId(input.studentId)) {
    return {
      success: false,
      reason: 'INVALID_STUDENT_ID',
      message: 'Student ID must be a valid 9-digit university number',
    };
  }

  // 2. Validate configuration
  const secret = (options.secret ?? process.env.MORSHIDI_INTEGRATION_TOKEN_SECRET ?? '').trim();
  if (!secret) {
    return {
      success: false,
      reason: 'TOKEN_CONFIGURATION_ERROR',
      message: 'Integration token signing secret is not configured',
    };
  }

  const cleanStudentId = input.studentId.trim();

  // 3. Resolve expiration, issuer, audience
  let expiresIn = options.expiresInSeconds;
  if (!expiresIn && process.env.MORSHIDI_INTEGRATION_TOKEN_EXPIRY_SECONDS) {
    const parsed = Number(process.env.MORSHIDI_INTEGRATION_TOKEN_EXPIRY_SECONDS);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      expiresIn = parsed;
    }
  }
  if (!expiresIn || expiresIn <= 0) {
    expiresIn = DEFAULT_INTEGRATION_TOKEN_EXPIRY_SECONDS;
  }

  const issuer = options.issuer ?? process.env.MORSHIDI_INTEGRATION_TOKEN_ISSUER ?? DEFAULT_INTEGRATION_TOKEN_ISSUER;
  const audience = options.audience ?? DEFAULT_INTEGRATION_TOKEN_AUDIENCE;
  const now = options.nowInSeconds ?? Math.floor(Date.now() / 1000);

  const payload: IntegrationTokenPayload = {
    sub: cleanStudentId,
    aud: audience,
    iss: issuer,
    iat: now,
    exp: now + expiresIn,
  };

  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;
  const signatureB64 = createHmac('sha256', secret).update(signingInput, 'utf8').digest('base64url');

  const accessToken = `${signingInput}.${signatureB64}`;

  return {
    success: true,
    accessToken,
    tokenType: 'Bearer',
    expiresIn,
  };
}

/**
 * Cryptographically verifies a Morshidi Integration Token.
 *
 * Validates:
 * 1. Signing secret configuration
 * 2. 3-part compact JWT format
 * 3. HS256 header
 * 4. HMAC-SHA256 signature using timing-safe comparison
 * 5. Fixed audience: "morshidi"
 * 6. Issuer match
 * 7. Valid 9-digit university student ID in "sub"
 * 8. Sane iat/exp timestamps and expiration
 */
export async function verifyIntegrationToken(
  token: string,
  options: IntegrationTokenOptions = {},
): Promise<VerifyIntegrationTokenResult> {
  // 1. Resolve Secret configuration first
  const secret = (options.secret ?? process.env.MORSHIDI_INTEGRATION_TOKEN_SECRET ?? '').trim();
  if (!secret) {
    return {
      success: false,
      reason: 'TOKEN_CONFIGURATION_ERROR',
      message: 'Integration token signing secret is not configured',
    };
  }

  // 2. Basic format validation
  if (typeof token !== 'string' || !token.trim()) {
    return {
      success: false,
      reason: 'INVALID_TOKEN',
      message: 'Token must be a non-empty string',
    };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts.some((p) => !p)) {
    return {
      success: false,
      reason: 'INVALID_TOKEN',
      message: 'Token format is invalid',
    };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 3. Validate Header
  let header: Record<string, unknown>;
  try {
    const headerJson = Buffer.from(headerB64, 'base64url').toString('utf8');
    header = JSON.parse(headerJson) as Record<string, unknown>;
  } catch {
    return {
      success: false,
      reason: 'INVALID_TOKEN',
      message: 'Malformed token header',
    };
  }

  if (!header || header.alg !== 'HS256' || (typeof header.typ === 'string' && header.typ.toUpperCase() !== 'JWT')) {
    return {
      success: false,
      reason: 'INVALID_TOKEN',
      message: 'Unsupported token header',
    };
  }

  // 4. Verify Signature with timing-safe comparison
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSignature = createHmac('sha256', secret).update(signingInput, 'utf8').digest('base64url');

  if (!safeEqual(signatureB64, expectedSignature)) {
    return {
      success: false,
      reason: 'INVALID_TOKEN',
      message: 'Invalid token signature',
    };
  }

  // 5. Parse and Validate Payload
  let payload: Record<string, unknown>;
  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return {
      success: false,
      reason: 'INVALID_TOKEN',
      message: 'Malformed token payload',
    };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      success: false,
      reason: 'INVALID_TOKEN',
      message: 'Invalid token payload',
    };
  }

  // 6. Verify Audience
  const expectedAudience = options.audience ?? DEFAULT_INTEGRATION_TOKEN_AUDIENCE;
  if (payload.aud !== expectedAudience) {
    return {
      success: false,
      reason: 'INVALID_TOKEN',
      message: 'Token audience mismatch',
    };
  }

  // 7. Verify Issuer
  const expectedIssuer = options.issuer ?? process.env.MORSHIDI_INTEGRATION_TOKEN_ISSUER ?? DEFAULT_INTEGRATION_TOKEN_ISSUER;
  if (payload.iss !== expectedIssuer) {
    return {
      success: false,
      reason: 'INVALID_TOKEN',
      message: 'Token issuer mismatch',
    };
  }

  // 8. Verify Subject (Student ID)
  if (typeof payload.sub !== 'string' || !isValidStudentId(payload.sub)) {
    return {
      success: false,
      reason: 'INVALID_TOKEN',
      message: 'Token subject must be a valid 9-digit university student ID',
    };
  }

  // 9. Verify Timestamps
  if (
    typeof payload.iat !== 'number' ||
    !Number.isSafeInteger(payload.iat) ||
    typeof payload.exp !== 'number' ||
    !Number.isSafeInteger(payload.exp) ||
    payload.exp <= payload.iat
  ) {
    return {
      success: false,
      reason: 'INVALID_TOKEN',
      message: 'Token timestamps are invalid',
    };
  }

  const now = options.nowInSeconds ?? Math.floor(Date.now() / 1000);

  if (now >= payload.exp) {
    return {
      success: false,
      reason: 'TOKEN_EXPIRED',
      message: 'Token has expired',
    };
  }

  if (payload.iat > now + 60) {
    return {
      success: false,
      reason: 'INVALID_TOKEN',
      message: 'Token issued in the future',
    };
  }

  const verifiedClaims: IntegrationTokenPayload = {
    sub: payload.sub,
    aud: String(payload.aud),
    iss: String(payload.iss),
    iat: payload.iat,
    exp: payload.exp,
  };

  return {
    success: true,
    studentId: payload.sub,
    claims: verifiedClaims,
  };
}

