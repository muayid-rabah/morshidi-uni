import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { AuthUser, GradeInput, UniEvent } from './store';
import { safeEqual, signWebhook, UniversityStore } from './store';

type VerifyUser = (token: string) => Promise<AuthUser | null>;

interface ServerOptions {
  store?: UniversityStore;
  seedSyntheticData?: boolean;
  verifyUser?: VerifyUser;
  adminUserIds?: string[];
  serviceSecret?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  startWebhookWorker?: boolean;
  fetcher?: typeof fetch;
  servePortal?: boolean;
}

function bearer(request: FastifyRequest): string | null {
  const value = request.headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice(7).trim() : null;
}

function studentIdFromEmail(email?: string): string | null {
  if (!email) return null;
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (domain !== 'std.morshidi.edu.jo' || !/^\d{9}$/.test(local || '')) return null;
  return local;
}

function readManifest() {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'server', 'seed-data', 'manifest.json'), 'utf8')) as Record<string, unknown>;
}

export function createUniversityServer(options: ServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 256 * 1024 });
  const allowSyntheticSeed = process.env.NODE_ENV !== 'production' || process.env.UNI_ALLOW_SYNTHETIC_SEED === 'true';
  const store = options.store ?? new UniversityStore(undefined, options.seedSyntheticData ?? allowSyntheticSeed);
  const fetcher = options.fetcher ?? fetch;
  const serviceSecret = options.serviceSecret ?? process.env.UNI_SERVICE_KEY ?? '';
  const webhookSecret = options.webhookSecret ?? process.env.UNI_WEBHOOK_SECRET ?? '';
  const webhookUrl = options.webhookUrl ?? process.env.UNI_WEBHOOK_URL ?? '';
  const adminUserIds = options.adminUserIds ?? (process.env.UNI_ADMIN_USER_IDS || '').split(',').map((value) => value.trim()).filter(Boolean);
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  const verifyUser: VerifyUser = options.verifyUser ?? (async (token) => {
    if (!supabaseUrl || !supabaseKey) return null;
    try {
      const response = await fetcher(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      const value = await response.json() as { id?: string; email?: string };
      return typeof value.id === 'string' ? { id: value.id, email: value.email } : null;
    } catch {
      return null;
    }
  });

  async function authenticatedUser(request: FastifyRequest): Promise<AuthUser | null> {
    const token = bearer(request);
    return token ? verifyUser(token) : null;
  }

  async function adminUser(request: FastifyRequest, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) {
    const user = await authenticatedUser(request);
    if (!user) {
      reply.code(401).send({ error: 'AUTH_REQUIRED' });
      return null;
    }
    if (!adminUserIds.includes(user.id)) {
      reply.code(403).send({ error: 'ADMIN_REQUIRED' });
      return null;
    }
    return user;
  }

  const pending = new Set<number>();
  let deliveryRunning = false;
  async function deliverPending() {
    if (deliveryRunning || !webhookUrl || !webhookSecret) return;
    deliveryRunning = true;
    try {
      for (const row of store.deliveryBatch()) {
        const event: UniEvent = {
          cursor: row.cursor,
          id: row.id,
          type: row.event_type,
          version: row.version,
          occurredAt: row.occurred_at,
          ...(row.student_id ? { studentId: row.student_id } : {}),
          payload: JSON.parse(row.payload_json) as Record<string, unknown>,
          idempotencyKey: row.idempotency_key,
        };
        if (pending.has(row.cursor)) continue;
        pending.add(row.cursor);
        const body = JSON.stringify({
          id: event.id, type: event.type, version: event.version, occurredAt: event.occurredAt,
          ...(event.studentId ? { studentId: event.studentId } : {}),
          payload: event.payload, idempotencyKey: event.idempotencyKey,
        });
        let statusCode: number | null = null;
        try {
          const response = await fetcher(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'X-Uni-Signature': signWebhook(body, webhookSecret),
              'Idempotency-Key': event.idempotencyKey,
            },
            body,
            signal: AbortSignal.timeout(5000),
          });
          statusCode = response.status;
          store.markDelivery(row.cursor, statusCode, response.ok);
        } catch {
          store.markDelivery(row.cursor, statusCode, false);
        } finally {
          pending.delete(row.cursor);
        }
      }
    } finally {
      deliveryRunning = false;
    }
  }

  if (options.startWebhookWorker !== false) {
    const worker = setInterval(() => { void deliverPending(); }, 1000);
    worker.unref();
  }

  app.get('/healthz', async () => ({ ok: true, ready: store.hasAcademicData(), cursor: store.cursor() }));
  app.get('/v1/auth/me', async (request, reply) => {
    const user = await authenticatedUser(request);
    if (!user) return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    const isAdmin = adminUserIds.includes(user.id);
    const studentId = studentIdFromEmail(user.email);
    if (!isAdmin && !studentId) return reply.code(403).send({ error: 'STUDENT_SCOPE_REQUIRED' });
    return { studentId, role: isAdmin ? 'admin' : 'student' };
  });
  app.get('/v1/manifest', async () => ({ ...readManifest(), runtime_initialized: store.hasAcademicData() }));
  app.get('/v1/calendar', async (_request, reply) => {
    if (!store.hasAcademicData()) return reply.code(503).send({ error: 'UNIVERSITY_DATA_NOT_INITIALIZED' });
    return store.getCalendar();
  });
  app.get('/v1/calendar/dates', async (_request, reply) => {
    if (!store.hasAcademicData()) return reply.code(503).send({ error: 'UNIVERSITY_DATA_NOT_INITIALIZED' });
    return store.getAcademicDates();
  });
  app.get('/v1/courses', async (_request, reply) => {
    if (!store.hasAcademicData()) return reply.code(503).send({ error: 'UNIVERSITY_DATA_NOT_INITIALIZED' });
    return store.listCourses();
  });
  app.get('/v1/offerings', async (request, reply) => {
    if (!store.hasAcademicData()) return reply.code(503).send({ error: 'UNIVERSITY_DATA_NOT_INITIALIZED' });
    const term = (request.query as { term?: string }).term;
    const rows = store.listOfferings(term);
    if (term && rows.length === 0) return reply.code(404).send({ error: 'TERM_NOT_FOUND', message: 'No offerings for this term.' });
    return rows;
  });
  app.get('/v1/events', async (request, reply) => {
    const supplied = request.headers['x-uni-api-key'];
    if (!serviceSecret || typeof supplied !== 'string' || !safeEqual(supplied, serviceSecret)) {
      return reply.code(401).send({ error: 'SERVICE_AUTH_REQUIRED' });
    }
    const query = request.query as { since?: string; limit?: string };
    const since = Number(query.since ?? 0);
    if (!Number.isSafeInteger(since) || since < 0) return reply.code(400).send({ error: 'INVALID_CURSOR' });
    const events = store.eventsSince(since, Number(query.limit ?? 250));
    return { cursor: events.at(-1)?.cursor ?? since, events };
  });

  // Server-to-server contract for Morshidi. This key must never reach browser code.
  app.get('/v1/integration/students/:id', async (request, reply) => {
    const supplied = request.headers['x-uni-api-key'];
    if (!serviceSecret || typeof supplied !== 'string' || !safeEqual(supplied, serviceSecret)) {
      return reply.code(401).send({ error: 'SERVICE_AUTH_REQUIRED' });
    }
    const studentId = (request.params as { id: string }).id;
    if (!store.hasAcademicData()) return reply.code(503).send({ error: 'UNIVERSITY_DATA_NOT_INITIALIZED' });
    const profile = store.getStudent(studentId);
    const record = store.getStudentRecord(studentId);
    if (!profile || !record) return reply.code(404).send({ error: 'STUDENT_NOT_FOUND' });
    const manifest = readManifest();
    return { profile, record, source: manifest.source ?? 'university', synthetic: manifest.synthetic === true,
      updatedAt: record.updated_at ?? null };
  });

  app.get('/v1/students', async (request, reply) => {
    const user = await adminUser(request, reply);
    if (!user) return;
    return store.listStudents();
  });
  app.get('/v1/students/:id', async (request, reply) => {
    const studentId = (request.params as { id: string }).id;
    const user = await authenticatedUser(request);
    if (!user) return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    if (!adminUserIds.includes(user.id) && studentIdFromEmail(user.email) !== studentId) {
      return reply.code(403).send({ error: 'STUDENT_SCOPE_REQUIRED' });
    }
    const student = store.getStudent(studentId);
    return student ? student : reply.code(404).send({ error: 'STUDENT_NOT_FOUND' });
  });
  app.get('/v1/students/:id/records', async (request, reply) => {
    const studentId = (request.params as { id: string }).id;
    const user = await authenticatedUser(request);
    if (!user) return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    if (!adminUserIds.includes(user.id) && studentIdFromEmail(user.email) !== studentId) {
      return reply.code(403).send({ error: 'STUDENT_SCOPE_REQUIRED' });
    }
    const record = store.getStudentRecord(studentId);
    return record ? record : reply.code(404).send({ error: 'STUDENT_NOT_FOUND' });
  });
  app.get('/v1/me/schedule', async (request, reply) => {
    const user = await authenticatedUser(request);
    if (!user) return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    const studentId = studentIdFromEmail(user.email);
    if (!studentId) return reply.code(403).send({ error: 'STUDENT_SCOPE_REQUIRED' });
    return { sections: store.getStudent(studentId)?.currentRegisteredSections ?? [] };
  });
  app.put('/v1/me/schedule', async (request, reply) => {
    const user = await authenticatedUser(request);
    if (!user) return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    const studentId = studentIdFromEmail(user.email);
    if (!studentId) return reply.code(403).send({ error: 'STUDENT_SCOPE_REQUIRED' });
    const body = request.body as { sectionIds?: unknown } | undefined;
    if (!Array.isArray(body?.sectionIds) || body.sectionIds.some((id) => typeof id !== 'string')) {
      return reply.code(422).send({ error: 'INVALID_SCHEDULE' });
    }
    try {
      return store.registerSections(studentId, body.sectionIds as string[], request.headers['idempotency-key'] as string | undefined);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const validationErrors = new Set(['REGISTRATION_CLOSED', 'DUPLICATE_SECTION', 'WRONG_TERM', 'SECTION_FULL',
        'COURSE_NOT_ELIGIBLE', 'PREREQUISITES_NOT_MET', 'HOURS_LIMIT', 'SCHEDULE_CONFLICT']);
      if (code === 'STUDENT_NOT_FOUND' || code === 'SECTION_NOT_FOUND') return reply.code(404).send({ error: code });
      if (validationErrors.has(code)) return reply.code(422).send({ error: code });
      throw error;
    }
  });

  app.post('/v1/admin/grades', async (request, reply) => {
    if (!await adminUser(request, reply)) return;
    try {
      const body = request.body as Omit<GradeInput, 'idempotencyKey'>;
      if (!body || typeof body.studentId !== 'string' || typeof body.courseCode !== 'string' || typeof body.grade !== 'number') {
        return reply.code(422).send({ error: 'INVALID_GRADE_REQUEST' });
      }
      const result = store.postGrade({ ...body, idempotencyKey: request.headers['idempotency-key'] as string | undefined });
      return reply.code(result.duplicate ? 200 : 201).send(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'STUDENT_NOT_FOUND' || code === 'COURSE_NOT_FOUND') return reply.code(404).send({ error: code });
      if (code === 'INVALID_GRADE') return reply.code(422).send({ error: code });
      throw error;
    }
  });
  app.post('/v1/admin/students', async (request, reply) => {
    if (!await adminUser(request, reply)) return;
    const body = request.body as { profile?: Record<string, unknown> } | undefined;
    const profile = body?.profile;
    if (!profile || typeof profile.universityId !== 'string' || !/^\d{9}$/.test(profile.universityId) ||
      typeof profile.name !== 'string' || typeof profile.major !== 'string' || typeof profile.studyPlan !== 'string') {
      return reply.code(422).send({ error: 'INVALID_STUDENT' });
    }
    try {
      const event = store.createStudent(profile as unknown as import('../src/types/student').StudentProfile,
        request.headers['idempotency-key'] as string | undefined);
      return reply.code(event.cursor ? 201 : 200).send({ event });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'STUDENT_ALREADY_EXISTS') return reply.code(409).send({ error: code });
      throw error;
    }
  });
  app.patch('/v1/admin/students/:id/plan', async (request, reply) => {
    if (!await adminUser(request, reply)) return;
    const { studyPlan } = request.body as { studyPlan?: string };
    if (typeof studyPlan !== 'string' || !studyPlan.trim()) return reply.code(422).send({ error: 'INVALID_PLAN' });
    try {
      const event = store.updateStudentPlan((request.params as { id: string }).id, studyPlan.trim(),
        request.headers['idempotency-key'] as string | undefined);
      return { event };
    } catch (error) {
      if (error instanceof Error && error.message === 'STUDENT_NOT_FOUND') return reply.code(404).send({ error: error.message });
      throw error;
    }
  });
  app.put('/v1/admin/students/:id/schedule', async (request, reply) => {
    if (!await adminUser(request, reply)) return;
    const body = request.body as { sections?: unknown } | undefined;
    if (!Array.isArray(body?.sections)) return reply.code(422).send({ error: 'INVALID_SCHEDULE' });
    try {
      const event = store.updateStudentSchedule((request.params as { id: string }).id,
        body.sections as import('../src/types/student').StudentProfile['currentRegisteredSections'],
        request.headers['idempotency-key'] as string | undefined);
      return { event };
    } catch (error) {
      if (error instanceof Error && error.message === 'STUDENT_NOT_FOUND') return reply.code(404).send({ error: error.message });
      throw error;
    }
  });
  app.post('/v1/admin/registration/open', async (request, reply) => {
    if (!await adminUser(request, reply)) return;
    const body = (request.body ?? {}) as { start?: string; end?: string };
    const result = store.setRegistration(true, body.start, body.end, request.headers['idempotency-key'] as string | undefined);
    return { currentTerm: result.calendar.currentTerm, registrationOpen: result.calendar.registrationOpen,
      registrationWindow: result.calendar.registrationWindow, event: result.event };
  });
  app.post('/v1/admin/registration/close', async (request, reply) => {
    if (!await adminUser(request, reply)) return;
    const result = store.setRegistration(false, undefined, undefined, request.headers['idempotency-key'] as string | undefined);
    return { currentTerm: result.calendar.currentTerm, registrationOpen: result.calendar.registrationOpen,
      registrationWindow: result.calendar.registrationWindow, event: result.event };
  });
  app.patch('/v1/admin/offerings/:id', async (request, reply) => {
    if (!await adminUser(request, reply)) return;
    try {
      const result = store.updateOffering((request.params as { id: string }).id, request.body as Record<string, unknown>,
        'update', request.headers['idempotency-key'] as string | undefined);
      return result;
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'SECTION_NOT_FOUND') return reply.code(404).send({ error: code });
      if (code === 'INVALID_CAPACITY') return reply.code(422).send({ error: code });
      throw error;
    }
  });
  for (const action of ['open', 'close', 'fill'] as const) {
    app.post(`/v1/admin/offerings/:id/${action}`, async (request, reply) => {
      if (!await adminUser(request, reply)) return;
      try {
        return store.updateOffering((request.params as { id: string }).id, {}, action,
          request.headers['idempotency-key'] as string | undefined);
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        if (code === 'SECTION_NOT_FOUND') return reply.code(404).send({ error: code });
        if (code === 'NO_SEATS') return reply.code(422).send({ error: code });
        throw error;
      }
    });
  }

  if (options.servePortal !== false) {
    void app.register(fastifyStatic, { root: resolve(process.cwd(), 'dist'), prefix: '/', decorateReply: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/v1/') && !request.url.startsWith('/healthz')) {
        return reply.type('text/html; charset=utf-8').sendFile('index.html');
      }
      return reply.code(404).send({ error: 'NOT_FOUND' });
    });
  }
  app.addHook('onClose', async () => store.close());
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createUniversityServer();
  const port = Number(process.env.PORT || 4101);
  await app.listen({ host: '0.0.0.0', port });
}
