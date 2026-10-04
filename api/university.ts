/**
 * Self-contained Vercel serverless function — university portal API.
 * Uses ONLY static JSON imports (bundled at build time). Zero native modules.
 *
 * Routing via vercel.json:
 *   /v1/:path*  →  /api/university?path=:path*
 *   /healthz    →  /api/university?path=healthz
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

// ── Static seed JSON (bundled by Vercel esbuild, no filesystem at runtime) ──
import manifestJson   from '../server/seed-data/manifest.json';
import studentsJson   from '../server/seed-data/students.json';
import recordsJson    from '../server/seed-data/academic-records.json';
import coursesJson    from '../server/seed-data/courses.json';
import offeringsJson  from '../server/seed-data/offerings.json';

type Row = Record<string, unknown>;

// ── Build lookup maps once at module level ───────────────────────────────────
const STUDENTS_LIST = studentsJson as Row[];
const STUDENT_BY_ID = new Map<string, Row>(
  STUDENTS_LIST.map(s => [String(s['university_id'] ?? s['student_id'] ?? ''), s])
);

const RECORDS_LIST = (recordsJson as { records: Row[] }).records;
const RECORD_BY_ID = new Map<string, Row>(
  RECORDS_LIST.map(r => [String(r['student_id'] ?? ''), r])
);

const COURSES_LIST   = coursesJson  as Row[];
const OFFERINGS_LIST = offeringsJson as Row[];

const MANIFEST = manifestJson as Row;
const ACTIVE_TERM = (MANIFEST['active_term'] as Row) ?? {};
const CURRENT_TERM_CODE = String(ACTIVE_TERM['term_id'] ?? '2026-1');

const CALENDAR = {
  currentTerm: { code: CURRENT_TERM_CODE, label: String(ACTIVE_TERM['name'] ?? CURRENT_TERM_CODE) },
  registrationOpen: true,
  registrationWindow: { start: null, end: null },
  nextTerm: null,
};

// In-memory schedule overrides (resets on cold start — acceptable for demo)
const scheduleOverrides = new Map<string, string[]>();

// ── Auth ─────────────────────────────────────────────────────────────────────
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
  const base = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key  = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
  if (!base || !key) return null;
  try {
    const r = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const v = await r.json() as { id?: string; email?: string };
    return typeof v.id === 'string' ? { id: v.id, email: v.email } : null;
  } catch { return null; }
}

async function getAuth(req: IncomingMessage): Promise<AuthUser | null> {
  const t = bearerToken(req);
  return t ? verifyUser(t) : null;
}

function isAdmin(user: AuthUser): boolean {
  return (process.env.UNI_ADMIN_USER_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)
    .includes(user.id);
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function send(res: ServerResponse, status: number, body: unknown): void {
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
  return text ? (JSON.parse(text) as unknown) : undefined;
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization,content-type,idempotency-key',
    });
    res.end(); return;
  }

  const url  = new URL(req.url ?? '/', 'https://x.invalid');
  const path = (url.searchParams.get('path') ?? '').replace(/^\/+/, '');

  try {
    // healthz ─────────────────────────────────────────────────────────────────
    if (path === '' || path === 'healthz') {
      send(res, 200, { ok: true, ready: true, cursor: 0 }); return;
    }

    // manifest ────────────────────────────────────────────────────────────────
    if (path === 'manifest') {
      send(res, 200, { ...MANIFEST, runtime_initialized: true }); return;
    }

    // calendar ────────────────────────────────────────────────────────────────
    if (path === 'calendar') {
      send(res, 200, CALENDAR); return;
    }
    if (path === 'calendar/dates') {
      // Return empty array — academic dates not in seed JSON; acceptable for demo
      send(res, 200, []); return;
    }

    // courses ─────────────────────────────────────────────────────────────────
    if (path === 'courses') {
      send(res, 200, COURSES_LIST); return;
    }

    // offerings ───────────────────────────────────────────────────────────────
    if (path === 'offerings') {
      const term = url.searchParams.get('term');
      const rows = term
        ? OFFERINGS_LIST.filter(o => !o['term_code'] || o['term_code'] === term)
        : OFFERINGS_LIST;
      if (term && rows.length === 0) {
        send(res, 404, { error: 'TERM_NOT_FOUND', message: 'No offerings for this term.' }); return;
      }
      send(res, 200, rows); return;
    }

    // auth/me ─────────────────────────────────────────────────────────────────
    if (path === 'auth/me') {
      const user = await getAuth(req);
      if (!user) { send(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      const admin     = isAdmin(user);
      const studentId = studentIdFromEmail(user.email);
      if (!admin && !studentId) { send(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return; }
      send(res, 200, { studentId, role: admin ? 'admin' : 'student' }); return;
    }

    // students (admin list) ───────────────────────────────────────────────────
    if (path === 'students') {
      const user = await getAuth(req);
      if (!user) { send(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      if (!isAdmin(user)) { send(res, 403, { error: 'ADMIN_REQUIRED' }); return; }
      send(res, 200, STUDENTS_LIST); return;
    }

    // students/:id ────────────────────────────────────────────────────────────
    const stuMatch = /^students\/([^/]+)$/.exec(path);
    if (stuMatch) {
      const sid  = stuMatch[1]!;
      const user = await getAuth(req);
      if (!user) { send(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      if (!isAdmin(user) && studentIdFromEmail(user.email) !== sid) {
        send(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return;
      }
      const student = STUDENT_BY_ID.get(sid);
      if (!student) { send(res, 404, { error: 'STUDENT_NOT_FOUND' }); return; }
      send(res, 200, student); return;
    }

    // students/:id/records ────────────────────────────────────────────────────
    const recMatch = /^students\/([^/]+)\/records$/.exec(path);
    if (recMatch) {
      const sid  = recMatch[1]!;
      const user = await getAuth(req);
      if (!user) { send(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      if (!isAdmin(user) && studentIdFromEmail(user.email) !== sid) {
        send(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return;
      }
      const record = RECORD_BY_ID.get(sid);
      if (!record) { send(res, 404, { error: 'STUDENT_NOT_FOUND' }); return; }
      send(res, 200, record); return;
    }

    // me/schedule GET ─────────────────────────────────────────────────────────
    if (path === 'me/schedule' && method === 'GET') {
      const user = await getAuth(req);
      if (!user) { send(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      const sid = studentIdFromEmail(user.email);
      if (!sid) { send(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return; }
      const profile = STUDENT_BY_ID.get(sid);
      const defaultSections = (profile?.['currentRegisteredSections'] as Row[] | undefined)
        ?.map(s => s['id']) ?? [];
      send(res, 200, { sections: scheduleOverrides.get(sid) ?? defaultSections }); return;
    }

    // me/schedule PUT ─────────────────────────────────────────────────────────
    if (path === 'me/schedule' && method === 'PUT') {
      const user = await getAuth(req);
      if (!user) { send(res, 401, { error: 'AUTH_REQUIRED' }); return; }
      const sid = studentIdFromEmail(user.email);
      if (!sid) { send(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' }); return; }
      let body: unknown;
      try { body = await readBody(req); } catch { send(res, 413, { error: 'REQUEST_TOO_LARGE' }); return; }
      const b = body as { sectionIds?: unknown } | undefined;
      if (!Array.isArray(b?.sectionIds) || (b.sectionIds as unknown[]).some(id => typeof id !== 'string')) {
        send(res, 422, { error: 'INVALID_SCHEDULE' }); return;
      }
      scheduleOverrides.set(sid, b.sectionIds as string[]);
      send(res, 200, { sections: b.sectionIds }); return;
    }

    // 404 ─────────────────────────────────────────────────────────────────────
    send(res, 404, { error: 'NOT_FOUND' });
  } catch (err) {
    console.error('[university-api] error:', err);
    send(res, 500, { error: 'INTERNAL_ERROR', detail: String(err) });
  }
}
