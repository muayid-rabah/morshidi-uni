/**
 * Self-contained Vercel serverless function for the university API.
 * Zero external dependencies — data served from statically bundled JSON.
 *
 * Routing via vercel.json rewrites:
 *   /v1/:path*  →  /api/university?path=:path*
 *   /healthz    →  /api/university?path=healthz
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

// ---------------------------------------------------------------------------
// Static seed data — bundled by Vercel at build time, no filesystem at runtime
// ---------------------------------------------------------------------------
import manifestJson from '../server/seed-data/manifest.json';
import academicRecordsJson from '../server/seed-data/academic-records.json';
import coursesJson from '../server/seed-data/courses.json';
import offeringsJson from '../server/seed-data/offerings.json';
import { demoStudents } from '../src/data/demoStudents';
import { academicDates } from '../src/data/academicDates';

// Type shims for imported JSON
type AnyObj = Record<string, unknown>;

const MANIFEST = manifestJson as AnyObj;
const COURSES: AnyObj[] = coursesJson as AnyObj[];
const OFFERINGS: AnyObj[] = offeringsJson as AnyObj[];
const ACADEMIC_DATES: AnyObj[] = academicDates as unknown as AnyObj[];

// Build student + record maps from demo data and seed records
const STUDENT_MAP = new Map<string, AnyObj>();
const RECORD_MAP = new Map<string, AnyObj>();

for (const profile of demoStudents) {
  STUDENT_MAP.set(profile.universityId, profile as unknown as AnyObj);
}

const seedRecords = (academicRecordsJson as { records: AnyObj[] }).records;
for (const record of seedRecords) {
  const id = record['student_id'] as string;
  if (id) RECORD_MAP.set(id, record);
}

const CURRENT_TERM = {
  code: (MANIFEST['active_term'] as AnyObj)['term_id'] as string,
  label: (MANIFEST['active_term'] as AnyObj)['name'] as string,
};

const CALENDAR = {
  currentTerm: CURRENT_TERM,
  registrationOpen: true,
  registrationWindow: { start: null, end: null },
  nextTerm: null,
};

// In-memory student schedule map (resets on cold start — acceptable for demo)
const scheduleMap = new Map<string, string[]>();

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
interface AuthUser { id: string; email?: string }

function bearerToken(req: IncomingMessage): string | null {
  const v = req.headers['authorization'];
  return typeof v === 'string' && v.startsWith('Bearer ') ? v.slice(7).trim() : null;
}

function studentIdFromEmail(email?: string): string | null {
  if (!email) return null;
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (domain !== 'std.morshidi.edu.jo' || !/^\d{9}$/.test(local ?? '')) return null;
  return local ?? null;
}

async function verifyUser(token: string): Promise<AuthUser | null> {
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const v = await r.json() as { id?: string; email?: string };
    return typeof v.id === 'string' ? { id: v.id, email: v.email } : null;
  } catch { return null; }
}

async function getAuth(req: IncomingMessage): Promise<AuthUser | null> {
  const token = bearerToken(req);
  return token ? verifyUser(token) : null;
}

function isAdmin(user: AuthUser): boolean {
  return (process.env.UNI_ADMIN_USER_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)
    .includes(user.id);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let len = 0;
  for await (const chunk of req) {
    const b = Buffer.from(chunk as ArrayBuffer);
    len += b.length;
    if (len > 256 * 1024) throw new Error('TOO_LARGE');
    chunks.push(b);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type' });
    res.end(); return;
  }

  const url = new URL(req.url ?? '/', 'https://x');
  const path = url.searchParams.get('path') ?? '';
  const query = url.searchParams;

  try {
    // ── healthz ──────────────────────────────────────────────────────────────
    if (path === '' || path === 'healthz') {
      json(res, 200, { ok: true, ready: true, cursor: 0 }); return;
    }

    // ── manifest ─────────────────────────────────────────────────────────────
    if (path === 'manifest' && method === 'GET') {
      json(res, 200, { ...MANIFEST, runtime_initialized: true }); return;
    }

    // ── calendar ─────────────────────────────────────────────────────────────
    if (path === 'calendar' && method === 'GET') {
      json(res, 200, CALENDAR); return;
    }
    if (path === 'calendar/dates' && method === 'GET') {
      json(res, 200, ACADEMIC_DATES); return;
    }

    // ── courses ──────────────────────────────────────────────────────────────
    if (path === 'courses' && method === 'GET') {
      json(res, 200, COURSES); return;
    }

    // ── offerings ────────────────────────────────────────────────────────────
    if (path === 'offerings' && method === 'GET') {
      const term = query.get('term');
      const rows = term
        ? OFFERINGS.filter(o => o['term_code'] === term || !o['term_code'])
        : OFFERINGS;
      if (term && rows.length === 0) {
        json(res, 404, { error: 'TERM_NOT_FOUND', message: 'No offerings for this term.' }); return;
      }
      json(res, 200, rows); return;
    }

    // ── auth/me ──────────────────────────────────────────────────────────────
    if (path === 'auth/me' && method === 'GET') {
      const user = await getAuth(req);
      if (!user) { json(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      const admin = isAdmin(user);
      const studentId = studentIdFromEmail(user.email);
      if (!admin && !studentId) { json(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return; }
      json(res, 200, { studentId, role: admin ? 'admin' : 'student' }); return;
    }

    // ── students (admin list) ─────────────────────────────────────────────────
    if (path === 'students' && method === 'GET') {
      const user = await getAuth(req);
      if (!user) { json(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      if (!isAdmin(user)) { json(res, 403, { error: 'ADMIN_REQUIRED' }); return; }
      json(res, 200, Array.from(STUDENT_MAP.values())); return;
    }

    // ── students/:id ─────────────────────────────────────────────────────────
    const studentMatch = /^students\/([^/]+)$/.exec(path);
    if (studentMatch && method === 'GET') {
      const sid = studentMatch[1]!;
      const user = await getAuth(req);
      if (!user) { json(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      if (!isAdmin(user) && studentIdFromEmail(user.email) !== sid) {
        json(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return;
      }
      const student = STUDENT_MAP.get(sid);
      if (!student) { json(res, 404, { error: 'STUDENT_NOT_FOUND' }); return; }
      json(res, 200, student); return;
    }

    // ── students/:id/records ──────────────────────────────────────────────────
    const recordMatch = /^students\/([^/]+)\/records$/.exec(path);
    if (recordMatch && method === 'GET') {
      const sid = recordMatch[1]!;
      const user = await getAuth(req);
      if (!user) { json(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      if (!isAdmin(user) && studentIdFromEmail(user.email) !== sid) {
        json(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return;
      }
      const record = RECORD_MAP.get(sid);
      if (!record) { json(res, 404, { error: 'STUDENT_NOT_FOUND' }); return; }
      json(res, 200, record); return;
    }

    // ── me/schedule GET ───────────────────────────────────────────────────────
    if (path === 'me/schedule' && method === 'GET') {
      const user = await getAuth(req);
      if (!user) { json(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      const sid = studentIdFromEmail(user.email);
      if (!sid) { json(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return; }
      const profile = STUDENT_MAP.get(sid);
      const defaultSections = (profile?.['currentRegisteredSections'] as AnyObj[] | undefined)?.map(s => s['id']) ?? [];
      json(res, 200, { sections: scheduleMap.get(sid) ?? defaultSections }); return;
    }

    // ── me/schedule PUT ───────────────────────────────────────────────────────
    if (path === 'me/schedule' && method === 'PUT') {
      const user = await getAuth(req);
      if (!user) { json(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      const sid = studentIdFromEmail(user.email);
      if (!sid) { json(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return; }
      let body: unknown;
      try { body = await readBody(req); } catch { json(res, 413, { error: 'REQUEST_TOO_LARGE' }); return; }
      const b = body as { sectionIds?: unknown } | undefined;
      if (!Array.isArray(b?.sectionIds) || b.sectionIds.some(id => typeof id !== 'string')) {
        json(res, 422, { error: 'INVALID_SCHEDULE' }); return;
      }
      scheduleMap.set(sid, b.sectionIds as string[]);
      json(res, 200, { sections: b.sectionIds }); return;
    }

    // ── 404 ───────────────────────────────────────────────────────────────────
    json(res, 404, { error: 'NOT_FOUND' });
  } catch (err) {
    console.error('[university-api]', err);
    json(res, 500, { error: 'INTERNAL_ERROR', detail: String(err) });
  }
}
