/**
 * Self-contained Vercel serverless function for the Morshidi University Portal API.
 * Uses pure in-memory data bundled from api/seedData.ts.
 * Zero external database or native module dependencies.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  MANIFEST,
  COURSES,
  OFFERINGS,
  ACADEMIC_RECORDS,
  DEMO_STUDENTS,
  ACADEMIC_DATES,
} from './seedData.js';

type AnyObj = Record<string, unknown>;

// Fallback public Supabase keys
const DEFAULT_SUPABASE_URL = 'https://lzwttbjnuhdllesfuzzs.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_JinD7WD4fZ_8GDbkNBeDGQ_6BGh0R-S';

// Fast lookups
const STUDENT_MAP = new Map<string, AnyObj>();
for (const stu of DEMO_STUDENTS) {
  if (stu && stu.universityId) {
    STUDENT_MAP.set(String(stu.universityId), stu);
  }
}

const RECORD_MAP = new Map<string, AnyObj>();
const recordList = (ACADEMIC_RECORDS?.records || []) as AnyObj[];
for (const rec of recordList) {
  if (rec && rec.student_id) {
    RECORD_MAP.set(String(rec.student_id), rec);
  }
}

const CURRENT_TERM_CODE = String(MANIFEST?.active_term?.term_id || '2026-1');
const CURRENT_TERM_NAME = String(MANIFEST?.active_term?.name || '2026/2027 - الفصل الأول');

const CALENDAR = {
  currentTerm: { code: CURRENT_TERM_CODE, label: CURRENT_TERM_NAME },
  registrationOpen: true,
  registrationWindow: { start: null, end: null },
  nextTerm: null,
};

// In-memory student schedule map
const scheduleMap = new Map<string, string[]>();

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
interface AuthUser {
  id: string;
  email?: string;
}

function bearerToken(req: any): string | null {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (typeof h === 'string' && h.startsWith('Bearer ')) {
    return h.slice(7).trim();
  }
  return null;
}

function studentIdFromEmail(email?: string): string | null {
  if (!email) return null;
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (domain !== 'std.morshidi.edu.jo' || !/^\d{9}$/.test(local || '')) return null;
  return local || null;
}

async function verifyUser(token: string): Promise<AuthUser | null> {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: string; email?: string };
    return typeof body.id === 'string' ? { id: body.id, email: body.email } : null;
  } catch (err) {
    console.error('verifyUser error:', err);
    return null;
  }
}

async function getAuth(req: any): Promise<AuthUser | null> {
  const token = bearerToken(req);
  return token ? verifyUser(token) : null;
}

function isAdmin(user: AuthUser): boolean {
  const adminIds = (process.env.UNI_ADMIN_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return adminIds.includes(user.id);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function sendJson(res: any, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,idempotency-key');
  }
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(status).json(body);
  } else if (typeof res.writeHead === 'function') {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization,content-type,idempotency-key',
    });
    res.end(payload);
  } else {
    res.statusCode = status;
    res.end(payload);
  }
}

async function readBody(req: any): Promise<unknown> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return undefined;
    }
  }
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
// Main Handler
// ---------------------------------------------------------------------------
export default async function handler(req: any, res: any): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,idempotency-key');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }
    if (typeof res.status === 'function') {
      res.status(204).end();
    } else {
      res.writeHead(204);
      res.end();
    }
    return;
  }

  // Parse path from query (Vercel rewrite) or URL
  const rawPath =
    req.query?.path ??
    new URL(req.url || '/', 'https://localhost').searchParams.get('path') ??
    '';
  const path = (Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath))
    .replace(/^\/+/, '')
    .trim();

  // Parse term query
  const term =
    req.query?.term ??
    new URL(req.url || '/', 'https://localhost').searchParams.get('term') ??
    undefined;

  try {
    // ── healthz ──────────────────────────────────────────────────────────────
    if (path === '' || path === 'healthz') {
      sendJson(res, 200, { ok: true, ready: true, cursor: 0 });
      return;
    }

    // ── manifest ─────────────────────────────────────────────────────────────
    if (path === 'manifest' && method === 'GET') {
      sendJson(res, 200, { ...MANIFEST, runtime_initialized: true });
      return;
    }

    // ── calendar ─────────────────────────────────────────────────────────────
    if (path === 'calendar' && method === 'GET') {
      sendJson(res, 200, CALENDAR);
      return;
    }
    if (path === 'calendar/dates' && method === 'GET') {
      sendJson(res, 200, ACADEMIC_DATES);
      return;
    }

    // ── courses ──────────────────────────────────────────────────────────────
    if (path === 'courses' && method === 'GET') {
      sendJson(res, 200, COURSES);
      return;
    }

    // ── offerings ────────────────────────────────────────────────────────────
    if (path === 'offerings' && method === 'GET') {
      const rows = term
        ? OFFERINGS.filter((o) => !o.term_code || o.term_code === term)
        : OFFERINGS;
      if (term && rows.length === 0) {
        sendJson(res, 404, { error: 'TERM_NOT_FOUND', message: 'No offerings for this term.' });
        return;
      }
      sendJson(res, 200, rows);
      return;
    }

    // ── auth/me ──────────────────────────────────────────────────────────────
    if (path === 'auth/me' && method === 'GET') {
      const user = await getAuth(req);
      if (!user) {
        sendJson(res, 401, { error: 'AUTH_REQUIRED' });
        return;
      }
      const admin = isAdmin(user);
      const studentId = studentIdFromEmail(user.email);
      if (!admin && !studentId) {
        sendJson(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' });
        return;
      }
      sendJson(res, 200, { studentId, role: admin ? 'admin' : 'student' });
      return;
    }

    // ── students (admin list) ─────────────────────────────────────────────────
    if (path === 'students' && method === 'GET') {
      const user = await getAuth(req);
      if (!user) {
        sendJson(res, 401, { error: 'AUTH_REQUIRED' });
        return;
      }
      if (!isAdmin(user)) {
        sendJson(res, 403, { error: 'ADMIN_REQUIRED' });
        return;
      }
      sendJson(res, 200, DEMO_STUDENTS);
      return;
    }

    // ── students/:id ─────────────────────────────────────────────────────────
    const studentMatch = /^students\/([^/]+)$/.exec(path);
    if (studentMatch && method === 'GET') {
      const sid = studentMatch[1];
      const user = await getAuth(req);
      if (!user) {
        sendJson(res, 401, { error: 'AUTH_REQUIRED' });
        return;
      }
      if (!isAdmin(user) && studentIdFromEmail(user.email) !== sid) {
        sendJson(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' });
        return;
      }
      const student = STUDENT_MAP.get(sid);
      if (!student) {
        sendJson(res, 404, { error: 'STUDENT_NOT_FOUND' });
        return;
      }
      sendJson(res, 200, student);
      return;
    }

    // ── students/:id/records ──────────────────────────────────────────────────
    const recordMatch = /^students\/([^/]+)\/records$/.exec(path);
    if (recordMatch && method === 'GET') {
      const sid = recordMatch[1];
      const user = await getAuth(req);
      if (!user) {
        sendJson(res, 401, { error: 'AUTH_REQUIRED' });
        return;
      }
      if (!isAdmin(user) && studentIdFromEmail(user.email) !== sid) {
        sendJson(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' });
        return;
      }
      const record = RECORD_MAP.get(sid);
      if (!record) {
        sendJson(res, 404, { error: 'STUDENT_NOT_FOUND' });
        return;
      }
      sendJson(res, 200, record);
      return;
    }

    // ── me/schedule GET ───────────────────────────────────────────────────────
    if (path === 'me/schedule' && method === 'GET') {
      const user = await getAuth(req);
      if (!user) {
        sendJson(res, 401, { error: 'AUTH_REQUIRED' });
        return;
      }
      const sid = studentIdFromEmail(user.email);
      if (!sid) {
        sendJson(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' });
        return;
      }
      const profile = STUDENT_MAP.get(sid);
      const defaultSections =
        (profile?.currentRegisteredSections as AnyObj[] | undefined)?.map((s) => s.id) ?? [];
      sendJson(res, 200, { sections: scheduleMap.get(sid) ?? defaultSections });
      return;
    }

    // ── me/schedule PUT ───────────────────────────────────────────────────────
    if (path === 'me/schedule' && method === 'PUT') {
      const user = await getAuth(req);
      if (!user) {
        sendJson(res, 401, { error: 'AUTH_REQUIRED' });
        return;
      }
      const sid = studentIdFromEmail(user.email);
      if (!sid) {
        sendJson(res, 403, { error: 'STUDENT_SCOPE_REQUIRED' });
        return;
      }
      let body: unknown;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 413, { error: 'REQUEST_TOO_LARGE' });
        return;
      }
      const b = body as { sectionIds?: unknown } | undefined;
      if (!Array.isArray(b?.sectionIds) || b.sectionIds.some((id) => typeof id !== 'string')) {
        sendJson(res, 422, { error: 'INVALID_SCHEDULE' });
        return;
      }
      scheduleMap.set(sid, b.sectionIds as string[]);
      sendJson(res, 200, { sections: b.sectionIds });
      return;
    }

    // ── 404 fallback ──────────────────────────────────────────────────────────
    sendJson(res, 404, { error: 'NOT_FOUND', path });
  } catch (err) {
    console.error('[university-api] exception:', err);
    sendJson(res, 500, { error: 'INTERNAL_ERROR', detail: String(err) });
  }
}
