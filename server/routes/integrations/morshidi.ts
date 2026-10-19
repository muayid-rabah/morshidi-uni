import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import type { StudentProfile } from '../../../src/types/student';
import type { UniversityRepository } from '../../repositories/universityRepository';
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
import {
  CurriculumResolutionError,
  LEGACY_AI_PLAN_KEY,
  legacyAiCurriculum,
  resolveStudentCurriculumIdentity,
  type CurriculumDefinition,
} from '../../curriculum/curriculum';
import { RegistrationService } from '../../registration/registrationService';

async function curriculumForStudent(
  repository: UniversityRepository,
  profile: StudentProfile,
  record: Record<string, unknown> | null,
): Promise<CurriculumDefinition> {
  const identity = resolveStudentCurriculumIdentity(profile, record);
  const registered = await repository.getCurriculum?.(identity.planKey);
  if (registered) {
    if (registered.identity.planKey !== identity.planKey) {
      throw new CurriculumResolutionError('CURRICULUM_IDENTITY_INVALID', 'Curriculum registry identity mismatch.');
    }
    return registered;
  }
  if (identity.planKey === LEGACY_AI_PLAN_KEY) {
    return legacyAiCurriculum(await repository.listCourses());
  }
  throw new CurriculumResolutionError('CURRICULUM_NOT_MAPPED', 'Student curriculum is not registered.');
}

function curriculumFailure(reply: FastifyReply, error: unknown) {
  if (error instanceof CurriculumResolutionError) {
    return reply.code(409).send({ success: false, error: error.code });
  }
  throw error;
}

export interface MorshidiIntegrationRoutesOptions {
  repository?: UniversityRepository;
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

  const registrationService = options.repository ? new RegistrationService(options.repository) : null;

  const authenticatedStudent = async (request: Parameters<typeof authenticateMorshidiIntegrationRequest>[0], reply: FastifyReply) => {
    const result = await authenticateMorshidiIntegrationRequest(request, {
      secret: options.morshidiTokenSecret,
      expectedAudience: 'morshidi',
      expectedIssuer: options.morshidiTokenIssuer,
    });
    if (result.success) return result.studentId;
    if (result.reason === 'INTEGRATION_UNAVAILABLE') reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
    else if (result.reason === 'TOKEN_EXPIRED') reply.code(401).send({ success: false, error: 'TOKEN_EXPIRED' });
    else reply.code(401).send({ success: false, error: 'UNAUTHORIZED' });
    return null;
  };

  const idempotencyKey = (request: { headers: Record<string, unknown> }) => {
    const value = request.headers['idempotency-key'];
    return typeof value === 'string' && value.trim().length >= 8 && value.length <= 200 ? value.trim() : null;
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
        repository: options.repository,
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

  // Server-mediated token exchange. The trusted Morshidi backend resolves the
  // external student ID from its authenticated owner mapping; the browser never
  // receives client credentials or this short-lived upstream token.
  app.post('/auth/exchange', { bodyLimit: 4 * 1024, config: { rateLimit: apiRateLimitConfig } }, async (request, reply) => {
    const clientAuth = authenticateMorshidiClient(request, {
      expectedClientId: options.morshidiClientId,
      expectedClientSecret: options.morshidiClientSecret,
    });
    if (!clientAuth.authenticated) return reply.code(401).send({ success: false, error: 'INVALID_CLIENT' });
    const body = request.body as { studentId?: unknown } | undefined;
    if (typeof body?.studentId !== 'string') return reply.code(400).send({ success: false, error: 'INVALID_REQUEST' });
    const studentId = body.studentId.trim();
    if (!options.repository || !await options.repository.getStudent(studentId)) {
      return reply.code(401).send({ success: false, error: 'INVALID_STUDENT' });
    }
    const token = await issueIntegrationToken({ studentId }, {
      secret: options.morshidiTokenSecret,
      expiresInSeconds: options.morshidiTokenExpirySeconds,
      issuer: options.morshidiTokenIssuer,
      audience: 'morshidi',
    });
    if (!token.success) return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
    return reply.send({ success: true, accessToken: token.accessToken, tokenType: token.tokenType, expiresIn: token.expiresIn });
  });

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

      if (!options.repository) {
        return reply.code(500).send({
          success: false,
          error: 'INTEGRATION_UNAVAILABLE',
        });
      }

      // 2. Load authoritative student data from live University Store
      const profile = await options.repository.getStudent(studentId);
      if (!profile) {
        return reply.code(404).send({
          success: false,
          error: 'STUDENT_NOT_FOUND',
        });
      }

      const record = await options.repository.getStudentRecord(studentId);

      // 3. Map to external, sanitized Morshidi contract
      let curriculum: CurriculumDefinition;
      try {
        curriculum = await curriculumForStudent(options.repository, profile, record);
      } catch (error) {
        return curriculumFailure(reply, error);
      }
      const student = mapStudentToMorshidiProfile(profile, record, curriculum.identity);

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

      if (!options.repository) {
        return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
      }

      const profile = await options.repository.getStudent(authResult.studentId);
      if (!profile) {
        return reply.code(404).send({ success: false, error: 'STUDENT_NOT_FOUND' });
      }

      const record = await options.repository.getStudentRecord(authResult.studentId);
      let curriculum: CurriculumDefinition;
      try {
        curriculum = await curriculumForStudent(options.repository, profile, record);
      } catch (error) {
        return curriculumFailure(reply, error);
      }
      const courses = mapStudentCoursesToMorshidi(profile, curriculum.courses);

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

      if (!options.repository) {
        return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
      }

      const profile = await options.repository.getStudent(authResult.studentId);
      if (!profile) {
        return reply.code(404).send({ success: false, error: 'STUDENT_NOT_FOUND' });
      }

      const record = await options.repository.getStudentRecord(authResult.studentId);
      const gradesData = mapStudentGradesToMorshidi(profile, record);

      return reply.code(200).send({
        success: true,
        cumulativeGpa: gradesData.cumulativeGpa,
        gpaScale: gradesData.gpaScale,
        gradingPolicy: gradesData.gradingPolicy,
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

      if (!options.repository) {
        return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
      }

      const profile = await options.repository.getStudent(authResult.studentId);
      if (!profile) {
        return reply.code(404).send({ success: false, error: 'STUDENT_NOT_FOUND' });
      }

      const calendar = await options.repository.getCalendar();
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

      if (!options.repository) {
        return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
      }

      const profile = await options.repository.getStudent(authResult.studentId);
      if (!profile) {
        return reply.code(404).send({ success: false, error: 'STUDENT_NOT_FOUND' });
      }

      const record = await options.repository.getStudentRecord(authResult.studentId);
      let curriculum: CurriculumDefinition;
      try {
        curriculum = await curriculumForStudent(options.repository, profile, record);
      } catch (error) {
        return curriculumFailure(reply, error);
      }
      const plan = mapAcademicPlanToMorshidi(profile, record, curriculum);

      return reply.code(200).send({
        success: true,
        plan,
      });
    },
  );

  app.get('/student/registration/context', { config: { rateLimit: apiRateLimitConfig } }, async (request, reply) => {
    const studentId = await authenticatedStudent(request, reply);
    if (!studentId) return;
    if (!registrationService) return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
    try {
      return reply.send({ success: true, context: await registrationService.context(studentId) });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'STUDENT_NOT_FOUND') return reply.code(404).send({ success: false, error: code });
      if (error instanceof CurriculumResolutionError) return curriculumFailure(reply, error);
      throw error;
    }
  });

  app.get('/student/registration/offerings', { config: { rateLimit: apiRateLimitConfig } }, async (request, reply) => {
    const studentId = await authenticatedStudent(request, reply);
    if (!studentId) return;
    if (!registrationService) return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
    try {
      return reply.send({ success: true, offerings: await registrationService.offerings(studentId) });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'STUDENT_NOT_FOUND') return reply.code(404).send({ success: false, error: code });
      if (error instanceof CurriculumResolutionError) return curriculumFailure(reply, error);
      throw error;
    }
  });

  app.post('/student/registration/preview', { bodyLimit: 16 * 1024, config: { rateLimit: apiRateLimitConfig } }, async (request, reply) => {
    const studentId = await authenticatedStudent(request, reply);
    if (!studentId) return;
    if (!registrationService) return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
    const body = request.body as { sectionIds?: unknown } | undefined;
    if (!Array.isArray(body?.sectionIds) || body.sectionIds.length === 0 || body.sectionIds.some((id) => typeof id !== 'string')) {
      return reply.code(400).send({ success: false, error: 'INVALID_REQUEST' });
    }
    try {
      const preview = await registrationService.preview(studentId, body.sectionIds as string[]);
      return reply.code(preview.canRegister ? 200 : 422).send({ success: preview.canRegister, preview });
    } catch (error) {
      if (error instanceof CurriculumResolutionError) return curriculumFailure(reply, error);
      throw error;
    }
  });

  app.post('/student/registration/register', { bodyLimit: 16 * 1024, config: { rateLimit: apiRateLimitConfig } }, async (request, reply) => {
    const studentId = await authenticatedStudent(request, reply);
    if (!studentId) return;
    if (!registrationService) return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
    const key = idempotencyKey(request as unknown as { headers: Record<string, unknown> });
    const body = request.body as { sectionIds?: unknown } | undefined;
    if (!key) return reply.code(400).send({ success: false, error: 'IDEMPOTENCY_KEY_REQUIRED' });
    if (!Array.isArray(body?.sectionIds) || body.sectionIds.length === 0 || body.sectionIds.some((id) => typeof id !== 'string')) {
      return reply.code(400).send({ success: false, error: 'INVALID_REQUEST' });
    }
    try {
      const result = await registrationService.register(studentId, body.sectionIds as string[], key);
      return reply.code(result.success ? 200 : 422).send(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const status = code === 'SECTION_NOT_FOUND' ? 404 : 409;
      if (code) return reply.code(status).send({ success: false, error: code });
      throw error;
    }
  });

  app.post('/student/registration/drop', { bodyLimit: 8 * 1024, config: { rateLimit: apiRateLimitConfig } }, async (request, reply) => {
    const studentId = await authenticatedStudent(request, reply);
    if (!studentId) return;
    if (!registrationService) return reply.code(500).send({ success: false, error: 'INTEGRATION_UNAVAILABLE' });
    const key = idempotencyKey(request as unknown as { headers: Record<string, unknown> });
    const body = request.body as { sectionId?: unknown } | undefined;
    if (!key) return reply.code(400).send({ success: false, error: 'IDEMPOTENCY_KEY_REQUIRED' });
    if (typeof body?.sectionId !== 'string' || !body.sectionId.trim()) {
      return reply.code(400).send({ success: false, error: 'INVALID_REQUEST' });
    }
    const result = await registrationService.drop(studentId, body.sectionId.trim(), key);
    return reply.code(result.success ? 200 : 422).send(result);
  });
};

