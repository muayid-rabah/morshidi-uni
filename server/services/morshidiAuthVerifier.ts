import { UniversityStore } from '../store';

export type AuthFailureReason =
  | 'INVALID_STUDENT_ID'
  | 'INVALID_CREDENTIALS'
  | 'STUDENT_NOT_FOUND'
  | 'IDENTITY_MISMATCH'
  | 'AUTH_PROVIDER_UNAVAILABLE';

export interface AuthVerificationSuccess {
  success: true;
  studentId: string;
  authUserId: string;
  email: string;
}

export interface AuthVerificationFailure {
  success: false;
  reason: AuthFailureReason;
  message: string;
}

export type AuthVerificationResult = AuthVerificationSuccess | AuthVerificationFailure;

export interface AuthVerifierOptions {
  store?: UniversityStore;
  supabaseUrl?: string;
  supabaseKey?: string;
  adminUserIds?: string[];
  fetcher?: typeof fetch;
}

/**
 * Validates whether a given string adheres to the university 9-digit student ID format.
 */
export function isValidStudentId(id?: unknown): id is string {
  if (typeof id !== 'string') return false;
  return /^\d{9}$/.test(id.trim());
}

/**
 * Extracts the 9-digit student ID from an email within the university student domain.
 */
export function studentIdFromEmail(email?: string): string | null {
  if (!email) return null;
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (domain !== 'std.morshidi.edu.jo' || !/^\d{9}$/.test(local || '')) return null;
  return local;
}

/**
 * Verifies student credentials against the identity provider and ensures
 * the student exists in the university data store.
 *
 * Security:
 * - Passwords are never logged, stored, or returned.
 * - Raw Supabase responses and errors are intercepted and normalized.
 * - Identity is validated against the @std.morshidi.edu.jo domain and requested student ID.
 * - University store presence is verified before returning success.
 */
export async function verifyStudentCredentials(
  studentId: string,
  password: string,
  options: AuthVerifierOptions = {},
): Promise<AuthVerificationResult> {
  // 1. Validate student ID format
  if (!isValidStudentId(studentId)) {
    return {
      success: false,
      reason: 'INVALID_STUDENT_ID',
      message: 'Student ID must be a valid 9-digit university number',
    };
  }

  // 2. Validate password presence
  if (typeof password !== 'string' || password.length === 0) {
    return {
      success: false,
      reason: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials provided',
    };
  }

  const cleanId = studentId.trim();
  const studentEmail = `${cleanId}@std.morshidi.edu.jo`;

  // 3. Resolve configuration
  const supabaseUrl = (options.supabaseUrl ?? process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const supabaseKey = options.supabaseKey ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? '';

  if (!supabaseUrl || !supabaseKey) {
    return {
      success: false,
      reason: 'AUTH_PROVIDER_UNAVAILABLE',
      message: 'Authentication provider is not configured',
    };
  }

  const fetcher = options.fetcher ?? fetch;

  // 4. Authenticate against Supabase Auth (Password Grant)
  let response: Response;
  try {
    response = await fetcher(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ email: studentEmail, password }),
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    return {
      success: false,
      reason: 'AUTH_PROVIDER_UNAVAILABLE',
      message: 'Authentication provider is currently unreachable',
    };
  }

  // 5. Handle provider response
  if (!response.ok) {
    if (response.status >= 500) {
      return {
        success: false,
        reason: 'AUTH_PROVIDER_UNAVAILABLE',
        message: 'Authentication provider encountered an error',
      };
    }
    return {
      success: false,
      reason: 'INVALID_CREDENTIALS',
      message: 'Invalid student ID or password',
    };
  }

  interface SupabaseTokenResponse {
    access_token?: string;
    user?: {
      id?: string;
      email?: string;
    };
  }

  let body: SupabaseTokenResponse;
  try {
    body = (await response.json()) as SupabaseTokenResponse;
  } catch {
    return {
      success: false,
      reason: 'AUTH_PROVIDER_UNAVAILABLE',
      message: 'Invalid response from authentication provider',
    };
  }

  if (!body.access_token || !body.user || typeof body.user.id !== 'string') {
    return {
      success: false,
      reason: 'INVALID_CREDENTIALS',
      message: 'Authentication failed',
    };
  }

  const authUserId = body.user.id;
  const authEmail = body.user.email ?? '';

  // 6. Validate identity matching and scope
  const extractedStudentId = studentIdFromEmail(authEmail);
  if (!extractedStudentId || extractedStudentId !== cleanId) {
    return {
      success: false,
      reason: 'IDENTITY_MISMATCH',
      message: 'Authenticated identity does not match the requested student ID',
    };
  }

  // Reject administrative accounts trying to authenticate via student verifier
  const adminUserIds = options.adminUserIds ??
    (process.env.UNI_ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (adminUserIds.includes(authUserId)) {
    return {
      success: false,
      reason: 'IDENTITY_MISMATCH',
      message: 'Administrative accounts cannot authenticate as students',
    };
  }

  // 7. Verify presence in University student database
  let store = options.store;
  let ownedStore = false;
  if (!store) {
    store = new UniversityStore();
    ownedStore = true;
  }

  try {
    const student = store.getStudent(cleanId);
    if (!student) {
      return {
        success: false,
        reason: 'STUDENT_NOT_FOUND',
        message: 'Student account exists in identity provider but is not registered in university database',
      };
    }
  } finally {
    if (ownedStore) {
      store.close();
    }
  }

  // 8. Return minimum verified identity
  return {
    success: true,
    studentId: cleanId,
    authUserId,
    email: studentEmail,
  };
}

/**
 * Helper factory to create a verifier pre-bound to a specific UniversityStore or options.
 */
export function createStudentAuthVerifier(baseOptions: AuthVerifierOptions = {}) {
  return (studentId: string, password: string, overrideOptions: AuthVerifierOptions = {}) =>
    verifyStudentCredentials(studentId, password, { ...baseOptions, ...overrideOptions });
}

