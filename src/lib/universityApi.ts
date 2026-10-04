import type { AcademicDate, CourseSection, PlanCourse } from '../types/student';

const apiBase = (import.meta.env.VITE_UNI_API_URL || '').replace(/\/$/, '');
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export class UniversityApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code === 'AUTH_NOT_CONFIGURED' ? 'خدمة الدخول غير مهيأة. تواصل مع مسؤول البوابة.' :
      code === 'UNIVERSITY_BACKEND_NOT_CONFIGURED' || code === 'UNIVERSITY_UNAVAILABLE' ? 'تعذر الوصول لخادم الجامعة. حاول لاحقًا.' :
      status === 401 ? 'تأكد من الرقم الجامعي وكلمة المرور.' :
      status === 403 ? 'لا تملك صلاحية الوصول لهذه البيانات.' :
        status >= 500 ? 'تعذر الاتصال بالبوابة. حاول مرة أخرى.' : 'تعذر إتمام الطلب. تحقق من البيانات.');
    this.status = status;
    this.code = code;
  }
}

async function jsonRequest<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new UniversityApiError(response.status, String(body.error || 'REQUEST_FAILED'));
  return body as T;
}

export async function signInStudent(universityId: string, password: string): Promise<string> {
  if (!supabaseUrl || !supabaseKey) throw new UniversityApiError(503, 'AUTH_NOT_CONFIGURED');
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: supabaseKey, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ email: `${universityId.trim()}@std.morshidi.edu.jo`, password }),
  });
  const body = await response.json().catch(() => ({})) as { access_token?: string };
  if (!response.ok || !body.access_token) throw new UniversityApiError(401, 'AUTH_FAILED');
  return body.access_token;
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem('morshidi_access_token');
}

export function storeToken(token: string | null) {
  if (token) sessionStorage.setItem('morshidi_access_token', token);
  else sessionStorage.removeItem('morshidi_access_token');
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export async function getMe(token: string) {
  return jsonRequest<{ studentId: string | null; role: 'student' | 'admin' }>('/v1/auth/me', token);
}

export async function getStudent<T>(token: string, id: string) {
  return jsonRequest<T>(`/v1/students/${encodeURIComponent(id)}`, token);
}

export async function getCalendar(token?: string) {
  return jsonRequest<{
    currentTerm: { code: string; label: string };
    registrationOpen: boolean;
    registrationWindow: { start: string | null; end: string | null };
    nextTerm: { code: string; label: string } | null;
  }>('/v1/calendar', token);
}

export async function getAcademicDates(token?: string) {
  return jsonRequest<AcademicDate[]>('/v1/calendar/dates', token);
}

export async function getCourses(token?: string) {
  const data = await jsonRequest<Array<Record<string, unknown>>>('/v1/courses', token);
  return data.map((course): PlanCourse => ({
    code: String(course.code), name: String(course.name), credits: Number(course.credits),
    group: String(course.group) as PlanCourse['group'], type: String(course.type || ''),
    prerequisites: Array.isArray(course.prerequisites) ? course.prerequisites.map(String) : [],
    reviewRequired: Boolean(course.review_required),
    reviewReason: typeof course.review_reason === 'string' ? course.review_reason : undefined,
    learningType: String(course.learning_type || ''),
  }));
}

export async function getOfferings(termCode: string, token?: string): Promise<CourseSection[]> {
  const data = await jsonRequest<Array<Record<string, unknown>>>(`/v1/offerings?term=${encodeURIComponent(termCode)}`, token);
  return data.map((section) => ({
    id: String(section.id), courseCode: String(section.course_code), courseName: String(section.course_name),
    sectionNumber: Number(section.section_number), credits: Number(section.credits), instructor: String(section.instructor),
    days: String(section.days), daysArray: Array.isArray(section.days_array) ? section.days_array as CourseSection['daysArray'] : [],
    startTime: String(section.start_time), endTime: String(section.end_time), room: String(section.room),
    capacity: Number(section.capacity), enrolled: Number(section.enrolled), status: String(section.status) as CourseSection['status'],
  } as CourseSection));
}

export async function getMySchedule(token: string) {
  return jsonRequest<{ sections: CourseSection[] }>('/v1/me/schedule', token);
}

export async function registerSections(token: string, sectionIds: string[]) {
  return jsonRequest<{ sections: CourseSection[] }>('/v1/me/schedule', token, {
    method: 'PUT',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify({ sectionIds }),
  });
}

export async function postGrade(token: string, input: { studentId: string; courseCode: string; grade: number; letterGrade?: string }) {
  return jsonRequest('/v1/admin/grades', token, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify(input),
  });
}
