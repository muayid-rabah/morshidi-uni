import type { FastifyRequest } from 'fastify';
import { verifyIntegrationToken } from './integrationToken';

export type MorshidiAuthFailureReason =
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'INTEGRATION_UNAVAILABLE';

export interface MorshidiAuthSuccess {
  success: true;
  studentId: string;
}

export interface MorshidiAuthFailure {
  success: false;
  reason: MorshidiAuthFailureReason;
}

export type MorshidiIntegrationAuthResult = MorshidiAuthSuccess | MorshidiAuthFailure;

export interface AuthenticateMorshidiRequestOptions {
  secret?: string;
  expectedAudience?: string;
  expectedIssuer?: string;
  clockSkewSeconds?: number;
  nowInSeconds?: number;
}

/**
 * Authenticates an incoming Morshidi integration request using the Bearer integration token.
 *
 * Security:
 * - Requires Authorization: Bearer <token>
 * - Verifies token signature, claims, expiry, audience, issuer using Step 2's verifyIntegrationToken()
 * - Strictly normalizes internal cryptographic failure reasons (e.g. INVALID_SIGNATURE, WRONG_AUDIENCE)
 *   to 'UNAUTHORIZED' to prevent disclosing internal token validation details.
 * - Distinguishes 'TOKEN_EXPIRED' so clients know reauthentication is needed.
 * - Distinguishes 'INTEGRATION_UNAVAILABLE' on missing server secret so it maps to HTTP 500.
 * - Returns verified studentId exclusively from the cryptographically verified token.
 */
export async function authenticateMorshidiIntegrationRequest(
  request: FastifyRequest,
  options: AuthenticateMorshidiRequestOptions = {},
): Promise<MorshidiIntegrationAuthResult> {
  const authHeader = request.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return { success: false, reason: 'UNAUTHORIZED' };
  }

  // Exact Bearer token format check
  if (!authHeader.startsWith('Bearer ')) {
    return { success: false, reason: 'UNAUTHORIZED' };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { success: false, reason: 'UNAUTHORIZED' };
  }

  const verifyResult = await verifyIntegrationToken(token, {
    secret: options.secret,
    audience: options.expectedAudience,
    issuer: options.expectedIssuer,
    nowInSeconds: options.nowInSeconds,
  });

  if (!verifyResult.success) {
    if (verifyResult.reason === 'TOKEN_CONFIGURATION_ERROR') {
      return { success: false, reason: 'INTEGRATION_UNAVAILABLE' };
    }
    if (verifyResult.reason === 'TOKEN_EXPIRED') {
      return { success: false, reason: 'TOKEN_EXPIRED' };
    }
    return { success: false, reason: 'UNAUTHORIZED' };
  }

  return {
    success: true,
    studentId: verifyResult.studentId,
  };
}
