/**
 * Self-contained Vercel serverless function for the university API.
 * Serves all /v1/* endpoints directly — no external Fastify server required.
 *
 * Routing: Vercel rewrites /v1/:path* → /api/university?path=:path*
 * e.g. /v1/auth/me  →  ?path=auth/me
 *      /v1/students/202310001  →  ?path=students/202310001
 *      /v1/offerings?term=2026-1  →  ?path=offerings&term=2026-1
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { UniversityStore } from '../server/store';
import type { SeedBundle } from '../server/store';

// Static JSON imports — bundled by Vercel, no filesystem needed at runtime
import manifestJson from '../server/seed-data/manifest.json';
import academicRecordsJson from '../server/seed-data/academic-records.json';
import coursesJson from '../server/seed-data/courses.json';
import offeringsJson from '../server/seed-data/offerings.json';

const SEED_BUNDLE: SeedBundle = {
  manifest: manifestJson as SeedBundle['manifest'],
  records: academicRecordsJson as SeedBundle['records'],
  courses: coursesJson as SeedBundle['courses'],
  offerings: offeringsJson as SeedBundle['offerings'],
};

// ---------------------------------------------------------------------------
// Singleton store (reused across warm Vercel invocations)
// ---------------------------------------------------------------------------
let _store: UniversityStore | null = null;
function getStore(): UniversityStore {
  if (!_store) {
    _store = new UniversityStore(':memory:', true, SEED_BUNDLE);
  }
  return _store;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
interface AuthUser {
  id: string;
  email?: string;
}

function bearerToken(req: IncomingMessage): string | null {
  const value = req.headers['authorization'];
  if (typeof value === 'string' && value.startsWith('Bearer ')) {
    return value.slice(7).trim();
  }
  return null;
}

function studentIdFromEmail(email?: string): string | null {
  if (!email) return null;
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (domain !== 'std.morshidi.edu.jo' || !/^\d{9}$/.test(local || '')) return null;
  return local;
}

async function verifyUser(token: string): Promise<AuthUser | null> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const value = (await response.json()) as { id?: string; email?: string };
    return typeof value.id === 'string' ? { id: value.id, email: value.email } : null;
  } catch {
    return null;
  }
}

async function authenticatedUser(req: IncomingMessage): Promise<AuthUser | null> {
  const token = bearerToken(req);
  return token ? verifyUser(token) : null;
}

function isAdmin(user: AuthUser): boolean {
  const adminIds = (process.env.UNI_ADMIN_USER_IDS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return adminIds.includes(user.id);
}

// ---------------------------------------------------------------------------
// Body reader
// ---------------------------------------------------------------------------
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk as ArrayBuffer);
    length += bytes.length;
    if (length > 256 * 1024) throw new Error('REQUEST_ENTITY_TOO_LARGE');
    chunks.push(bytes);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? (JSON.parse(text) as unknown) : undefined;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------
function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' });
  res.end(payload);
}

// ---------------------------------------------------------------------------
// Manifest (read once from seed-data at cold start)
// ---------------------------------------------------------------------------
// Manifest helper — uses the already-bundled import
function readManifest(): Record<string, unknown> {
  return manifestJson as unknown as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');

  const method = (req.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method)) {
    json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const requestUrl = new URL(req.url || '/', 'https://portal.invalid');
  const path = requestUrl.searchParams.get('path') || '';
  const query = requestUrl.searchParams;

  const store = getStore();

  try {
    // ── healthz ────────────────────────────────────────────────────────────
    if (path === 'healthz' || path === '') {
      json(res, 200, { ok: true, ready: store.hasAcademicData() });
      return;
    }

    // ── auth/me ────────────────────────────────────────────────────────────
    if (path === 'auth/me' && method === 'GET') {
      const user = await authenticatedUser(req);
      if (!user) { json(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      const admin = isAdmin(user);
      const studentId = studentIdFromEmail(user.email);
      if (!admin && !studentId) { json(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return; }
      json(res, 200, { studentId, role: admin ? 'admin' : 'student' });
      return;
    }

    // ── manifest ───────────────────────────────────────────────────────────
    if (path === 'manifest' && method === 'GET') {
      json(res, 200, { ...readManifest(), runtime_initialized: store.hasAcademicData() });
      return;
    }

    // ── calendar ───────────────────────────────────────────────────────────
    if (path === 'calendar' && method === 'GET') {
      if (!store.hasAcademicData()) { json(res, 503, { error: 'UNIVERSITY_DATA_NOT_INITIALIZED' }); return; }
      json(res, 200, store.getCalendar());
      return;
    }
    if (path === 'calendar/dates' && method === 'GET') {
      if (!store.hasAcademicData()) { json(res, 503, { error: 'UNIVERSITY_DATA_NOT_INITIALIZED' }); return; }
      json(res, 200, store.getAcademicDates());
      return;
    }

    // ── courses ────────────────────────────────────────────────────────────
    if (path === 'courses' && method === 'GET') {
      if (!store.hasAcademicData()) { json(res, 503, { error: 'UNIVERSITY_DATA_NOT_INITIALIZED' }); return; }
      json(res, 200, store.listCourses());
      return;
    }

    // ── offerings ──────────────────────────────────────────────────────────
    if (path === 'offerings' && method === 'GET') {
      if (!store.hasAcademicData()) { json(res, 503, { error: 'UNIVERSITY_DATA_NOT_INITIALIZED' }); return; }
      const term = query.get('term') ?? undefined;
      const rows = store.listOfferings(term);
      if (term && rows.length === 0) { json(res, 404, { error: 'TERM_NOT_FOUND', message: 'No offerings for this term.' }); return; }
      json(res, 200, rows);
      return;
    }

    // ── students (admin list) ──────────────────────────────────────────────
    if (path === 'students' && method === 'GET') {
      const user = await authenticatedUser(req);
      if (!user) { json(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      if (!isAdmin(user)) { json(res, 403, { error: 'ADMIN_REQUIRED' }); return; }
      json(res, 200, store.listStudents());
      return;
    }

    // ── students/:id ───────────────────────────────────────────────────────
    const studentMatch = /^students\/([^/]+)$/.exec(path);
    if (studentMatch && method === 'GET') {
      const studentId = studentMatch[1];
      const user = await authenticatedUser(req);
      if (!user) { json(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      if (!isAdmin(user) && studentIdFromEmail(user.email) !== studentId) {
        json(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return;
      }
      const student = store.getStudent(studentId);
      if (!student) { json(res, 404, { error: 'STUDENT_NOT_FOUND' }); return; }
      json(res, 200, student);
      return;
    }

    // ── students/:id/records ───────────────────────────────────────────────
    const recordsMatch = /^students\/([^/]+)\/records$/.exec(path);
    if (recordsMatch && method === 'GET') {
      const studentId = recordsMatch[1];
      const user = await authenticatedUser(req);
      if (!user) { json(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      if (!isAdmin(user) && studentIdFromEmail(user.email) !== studentId) {
        json(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return;
      }
      const record = store.getStudentRecord(studentId);
      if (!record) { json(res, 404, { error: 'STUDENT_NOT_FOUND' }); return; }
      json(res, 200, record);
      return;
    }

    // ── me/schedule GET ────────────────────────────────────────────────────
    if (path === 'me/schedule' && method === 'GET') {
      const user = await authenticatedUser(req);
      if (!user) { json(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      const studentId = studentIdFromEmail(user.email);
      if (!studentId) { json(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return; }
      json(res, 200, { sections: store.getStudent(studentId)?.currentRegisteredSections ?? [] });
      return;
    }

    // ── me/schedule PUT ────────────────────────────────────────────────────
    if (path === 'me/schedule' && method === 'PUT') {
      const user = await authenticatedUser(req);
      if (!user) { json(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      const studentId = studentIdFromEmail(user.email);
      if (!studentId) { json(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return; }
      let body: unknown;
      try { body = await readBody(req); } catch { json(res, 413, { error: 'REQUEST_TOO_LARGE' }); return; }
      const b = body as { sectionIds?: unknown } | undefined;
      if (!Array.isArray(b?.sectionIds) || b.sectionIds.some((id) => typeof id !== 'string')) {
        json(res, 422, { error: 'INVALID_SCHEDULE' }); return;
      }
      const idempotencyKey = req.headers['idempotency-key'];
      try {
        const result = store.registerSections(
          studentId,
          b.sectionIds as string[],
          typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
        );
        json(res, 200, result);
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        const validationErrors = new Set([
          'REGISTRATION_CLOSED', 'DUPLICATE_SECTION', 'WRONG_TERM', 'SECTION_FULL',
          'COURSE_NOT_ELIGIBLE', 'PREREQUISITES_NOT_MET', 'HOURS_LIMIT', 'SCHEDULE_CONFLICT',
        ]);
        if (code === 'STUDENT_NOT_FOUND' || code === 'SECTION_NOT_FOUND') { json(res, 404, { error: code }); return; }
        if (validationErrors.has(code)) { json(res, 422, { error: code }); return; }
        throw error;
      }
      return;
    }

    // ── 404 fallback ───────────────────────────────────────────────────────
    json(res, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    console.error('[university-api]', error);
    json(res, 500, { error: 'INTERNAL_ERROR' });
  }
}
