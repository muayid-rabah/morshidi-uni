import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { UniversityStore } from '../../store';
import { authenticateMorshidiClient } from '../../auth/morshidiClientAuth';
import { verifyStudentCredentials } from '../../services/morshidiAuthVerifier';
import { issueIntegrationToken } from '../../auth/integrationToken';
import { authenticateMorshidiIntegrationRequest } from '../../auth/morshidiIntegrationAuth';
import {
  mapStudentToMorshidiProfile,
  mapStudentCoursesToMorshidi,
  mapStudentGradesToMorshidi,
  mapStudentEnrollmentsToMorshidi,
  mapAcademicPlanToMorshidi,
} from '../../serializers/morshidiContract';

export interface MorshidiIntegrationRoutesOptions {
  store?: UniversityStore;
  fetcher?: typeof fetch;
  supabaseUrl?: string;
  supabaseKey?: string;
  adminUserIds?: string[];
  morshidiClientId?: string;
  morshidiClientSecret?: string;
  morshidiTokenSecret?: string;
  morshidiTokenExpirySeconds?: number;
  morshidiTokenIssuer?: string;
  loginRateLimitMax?: number;
  loginRateLimitWindowMs?: number;
  apiRateLimitMax?: number;
  apiRateLimitWindowMs?: number;
}

export const morshidiIntegrationRoutes: FastifyPluginAsync<MorshidiIntegrationRoutesOptions> = async (
  app: FastifyInstance,
  options: MorshidiIntegrationRoutesOptions,
) => {
  // Security Hook: Guarantee strict no-cache headers on all integration responses
  app.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    reply.header('Pragma', 'no-cache');
  });

  // Security Error Handler: Normalize rate limits, payload sizes, media types, and unexpected errors
  app.setErrorHandler((error: unknown, _request, reply) => {
    const err = error as { statusCode?: number; code?: string } | null | undefined;
    const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : undefined;
    const errorCode = typeof err?.code === 'string' ? err.code : undefined;

    if (reply.statusCode === 429 || statusCode === 429) {
      return reply.code(429).send({
        success: false,
        error: 'RATE_LIMITED',
      });
    }

    if (statusCode === 413 || errorCode === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
      });
    }

    if (statusCode === 415 || errorCode === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      return reply.code(415).send({
        success: false,
        error: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }

    if (statusCode === 400 || errorCode === 'FST_ERR_CTP_INVALID_JSON_BODY') {
      return reply.code(400).send({
        success: false,
        error: 'INVALID_REQUEST',
      });
    }

    // Default safe fallback: Never leak stack traces or internal exception details
    return reply.code(statusCode || 500).send({
      success: false,
      error: 'INTERNAL_ERROR',
    });
  });

  const loginRateLimitConfig = {
    max: options.loginRateLimitMax ?? 10,
    timeWindow: options.loginRateLimitWindowMs ?? 60000,
  };

  const apiRateLimitConfig = {
    max: options.apiRateLimitMax ?? 60,
    timeWindow: options.apiRateLimitWindowMs ?? 60000,
  };

  // 1. POST /auth/login
  app.post(
    '/auth/login',
    {
      bodyLimit: 16 * 1024, // 16 KB body limit
      config: {
        rateLimit: loginRateLimitConfig,
      },
    },
    async (request, reply) => {
      // Content-Type enforcement
      const contentType = request.headers['content-type'];
      if (!contentType || !contentType.toLowerCase().includes('application/json')) {
        return reply.code(415).send({
          success: false,
          error: 'UNSUPPORTED_MEDIA_TYPE',
        });
      }

      // 1. Level 1: Application Authentication (Verify Morshidi Caller)
      const clientAuth = authenticateMorshidiClient(request, {
        expectedClientId: options.morshidiClientId,
        expectedClientSecret: options.morshidiClientSecret,
      });

      if (!clientAuth.authenticated) {
        return reply.code(401).send({
          success: false,
          error: 'INVALID_CLIENT',
        });
      }

      // 2. Validate Request Body
      const body = request.body as { studentId?: unknown; password?: unknown } | undefined;
      if (
        !body ||
        typeof body !== 'object' ||
        typeof body.studentId !== 'string' ||
        typeof body.password !== 'string' ||
        body.studentId.trim() === '' ||
        body.password === ''
      ) {
        return reply.code(400).send({
          success: false,
          error: 'INVALID_REQUEST',
        });
      }

      const studentId = body.studentId.trim();
      const password = body.password;

      // 3. Level 2: Student Authentication (Orchestrate Step 1 Verifier)
      const verifyResult = await verifyStudentCredentials(studentId, password, {
        store: options.store,
        fetcher: options.fetcher,
        supabaseUrl: options.supabaseUrl,
        supabaseKey: options.supabaseKey,
        adminUserIds: options.adminUserIds,
      });

      if (!verifyResult.success) {
        if (verifyResult.reason === 'AUTH_PROVIDER_UNAVAILABLE') {
          return reply.code(503).send({
            success: false,
            error: 'AUTH_SERVICE_UNAVAILABLE',
          });
        }

        // Safe normalization: INVALID_STUDENT_ID, INVALID_CREDENTIALS,
        // STUDENT_NOT_FOUND, and IDENTITY_MISMATCH all map to INVALID_CREDENTIALS (401)
        // to prevent student account enumeration.
        return reply.code(401).send({
          success: false,
          error: 'INVALID_CREDENTIALS',
        });
      }

      // 4. Issue Scoped Integration Token (Step 2 Token Service)
      // CRITICAL SECURITY: Always use verified studentId from verifyResult, never raw unverified input!
      const tokenResult = await issueIntegrationToken(
        { studentId: verifyResult.studentId },
        {
          secret: options.morshidiTokenSecret,
          expiresInSeconds: options.morshidiTokenExpirySeconds,
          issuer: options.morshidiTokenIssuer,
          audience: 'morshidi',
        },
      );

      if (!tokenResult.success) {
        // Configuration failure (e.g. missing token signing secret)
        return reply.code(500).send({
          success: false,
          error: 'INTEGRATION_UNAVAILABLE',
        });
      }

      // 5. Return Success Response
      return reply.code(200).send({
        success: true,
        accessToken: tokenResult.accessToken,
        tokenType: 'Bearer',
        expiresIn: tokenResult.expiresIn,
        student: {
          studentId: verifyResult.studentId,
          email: verifyResult.email,
        },
      });
    },
  );

  // 2. GET /student/me
  app.get(
    '/student/me',
    {
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (request, reply) => {
      // 1. Authenticate Request via short-lived Bearer Integration Token
      const authResult = await authenticateMorshidiIntegrationRequest(request, {
        secret: options.morshidiTokenSecret,
        expectedAudience: 'morshidi',
        expectedIssuer: options.morshidiTokenIssuer,
      });

      if (!authResult.success) {
        if (authResult.reason === 'INTEGRATION_UNAVAILABLE') {
          return reply.code(500).send({
            success: false,
            error: 'INTEGRATION_UNAVAILABLE',
          });
        }
        if (authResult.reason === 'TOKEN_EXPIRED') {
          return reply.code(401).send({
            success: false,
            error: 'TOKEN_EXPIRED',
          });
        }
        return reply.code(401).send({
          success: false,
          error: 'UNAUTHORIZED',
        });
      }

      const studentId = authResult.studentId;

      if (!options.store) {
        return reply.code(500).send({
          success: false,
          error: 'INTEGRATION_UNAVAILABLE',
        });
      }

      // 2. Load authoritative student data from live University Store
      const profile = options.store.getStudent(studentId);
      if (!profile) {
        return reply.code(404).send({
          success: false,
          error: 'STUDENT_NOT_FOUND',
        });
      }

      const record = options.store.getStudentRecord(studentId);

      // 3. Map to external, sanitized Morshidi contract
      const student = mapStudentToMorshidiProfile(profile, record);

      return reply.code(200).send({
        success: true,
        student,
      });
    },
  );

  // 3. GET /student/courses
  app.get(
    '/student/courses',
    {
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (request, reply) => {
      const authResult = await authenticateMorshidiIntegrationRequest(request, {
        secret: options.morshidiTokenSecret,
        expectedAudience: 'morshidi',
        expectedIssuer: options.morshidiTokenIssuer,
      });

      if (!authResult.success) {
        if (authResult.reason === 'INTEGRATION_UNAVAILABLE') {
          return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
        }
        if (authResult.reason === 'TOKEN_EXPIRED') {
          return reply.code(401).send({ success: false, error: 'TOKEN_EXPIRED' });
        }
        return reply.code(401).send({ success: false, error: 'UNAUTHORIZED' });
      }

      if (!options.store) {
        return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
      }

      const profile = options.store.getStudent(authResult.studentId);
      if (!profile) {
        return reply.code(404).send({ success: false, error: 'STUDENT_NOT_FOUND' });
      }

      const catalog = options.store.listCourses();
      const courses = mapStudentCoursesToMorshidi(profile, catalog);

      return reply.code(200).send({
        success: true,
        courses,
      });
    },
  );

  // 4. GET /student/grades
  app.get(
    '/student/grades',
    {
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (request, reply) => {
      const authResult = await authenticateMorshidiIntegrationRequest(request, {
        secret: options.morshidiTokenSecret,
        expectedAudience: 'morshidi',
        expectedIssuer: options.morshidiTokenIssuer,
      });

      if (!authResult.success) {
        if (authResult.reason === 'INTEGRATION_UNAVAILABLE') {
          return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
        }
        if (authResult.reason === 'TOKEN_EXPIRED') {
          return reply.code(401).send({ success: false, error: 'TOKEN_EXPIRED' });
        }
        return reply.code(401).send({ success: false, error: 'UNAUTHORIZED' });
      }

      if (!options.store) {
        return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
      }

      const profile = options.store.getStudent(authResult.studentId);
      if (!profile) {
        return reply.code(404).send({ success: false, error: 'STUDENT_NOT_FOUND' });
      }

      const record = options.store.getStudentRecord(authResult.studentId);
      const gradesData = mapStudentGradesToMorshidi(profile, record);

      return reply.code(200).send({
        success: true,
        cumulativeGpa: gradesData.cumulativeGpa,
        semesters: gradesData.semesters,
      });
    },
  );

  // 5. GET /student/enrollments
  app.get(
    '/student/enrollments',
    {
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (request, reply) => {
      const authResult = await authenticateMorshidiIntegrationRequest(request, {
        secret: options.morshidiTokenSecret,
        expectedAudience: 'morshidi',
        expectedIssuer: options.morshidiTokenIssuer,
      });

      if (!authResult.success) {
        if (authResult.reason === 'INTEGRATION_UNAVAILABLE') {
          return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
        }
        if (authResult.reason === 'TOKEN_EXPIRED') {
          return reply.code(401).send({ success: false, error: 'TOKEN_EXPIRED' });
        }
        return reply.code(401).send({ success: false, error: 'UNAUTHORIZED' });
      }

      if (!options.store) {
        return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
      }

      const profile = options.store.getStudent(authResult.studentId);
      if (!profile) {
        return reply.code(404).send({ success: false, error: 'STUDENT_NOT_FOUND' });
      }

      const calendar = options.store.getCalendar();
      const currentTerm = calendar?.currentTerm ?? { code: 'UNKNOWN', label: 'Unknown Term' };
      const enrollmentsData = mapStudentEnrollmentsToMorshidi(profile, currentTerm);

      return reply.code(200).send({
        success: true,
        term: enrollmentsData.term,
        termLabel: enrollmentsData.termLabel,
        enrollments: enrollmentsData.enrollments,
      });
    },
  );

  // 6. GET /student/academic-plan
  app.get(
    '/student/academic-plan',
    {
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (request, reply) => {
      const authResult = await authenticateMorshidiIntegrationRequest(request, {
        secret: options.morshidiTokenSecret,
        expectedAudience: 'morshidi',
        expectedIssuer: options.morshidiTokenIssuer,
      });

      if (!authResult.success) {
        if (authResult.reason === 'INTEGRATION_UNAVAILABLE') {
          return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
        }
        if (authResult.reason === 'TOKEN_EXPIRED') {
          return reply.code(401).send({ success: false, error: 'TOKEN_EXPIRED' });
        }
        return reply.code(401).send({ success: false, error: 'UNAUTHORIZED' });
      }

      if (!options.store) {
        return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
      }

      const profile = options.store.getStudent(authResult.studentId);
      if (!profile) {
        return reply.code(404).send({ success: false, error: 'STUDENT_NOT_FOUND' });
      }

      const record = options.store.getStudentRecord(authResult.studentId);
      const catalog = options.store.listCourses();
      const plan = mapAcademicPlanToMorshidi(profile, record, catalog);

      return reply.code(200).send({
        success: true,
        plan,
      });
    },
  );
};

