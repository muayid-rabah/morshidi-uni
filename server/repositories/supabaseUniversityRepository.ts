import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CourseGrade, CourseSection, SemesterRecord, StudentProfile } from '../../src/types/student';
import {
  academicRecordFromProfile,
  type CalendarState,
  type GradeInput,
  type UniEvent,
  type UniEventType,
} from '../store';
import type {
  DeliveryEventRow,
  OfferingAction,
  RegisterSectionsResult,
  UniversityRepository,
  UpdateOfferingResult,
} from './universityRepository';

type JsonObject = Record<string, unknown>;

export interface StudentSnapshot {
  studentId: string;
  profile: StudentProfile;
  record: JsonObject;
  updatedAt: string;
}

export interface OfferingSnapshot {
  sectionId: string;
  courseCode: string;
  termCode: string;
  data: JsonObject;
  updatedAt: string;
}

export interface CalendarSnapshot {
  calendar: CalendarState;
  updatedAt: string;
}

export interface RawEventRow {
  cursor: unknown;
  id: string;
  event_type: UniEventType;
  version: number;
  occurred_at: string;
  student_id: string | null;
  payload_json: JsonObject;
  idempotency_key: string;
  attempts?: number;
}

export interface UniversitySupabaseDataClient {
  getStudent(studentId: string): Promise<StudentSnapshot | null>;
  listStudents(): Promise<StudentSnapshot[]>;
  listCourses(): Promise<Array<{ courseCode: string; data: JsonObject }>>;
  getCourse(courseCode: string): Promise<JsonObject | null>;
  listOfferings(termCode: string): Promise<OfferingSnapshot[]>;
  getOfferings(sectionIds: string[]): Promise<OfferingSnapshot[]>;
  getCalendar(): Promise<CalendarSnapshot | null>;
  getAcademicDates(): Promise<JsonObject[]>;
  hasCourses(): Promise<boolean>;
  latestCursor(): Promise<unknown | null>;
  eventsSince(since: number, limit: number): Promise<RawEventRow[]>;
  eventByKey(key: string): Promise<RawEventRow | null>;
  deliveryBatch(now: string): Promise<RawEventRow[]>;
  rpc(name: string, parameters: JsonObject): Promise<unknown>;
}

function queryError(operation: string, error: { message: string } | null): never {
  const knownCodes = [
    'STUDENT_NOT_FOUND', 'STUDENT_ALREADY_EXISTS', 'SECTION_NOT_FOUND',
    'UNIVERSITY_DATA_NOT_INITIALIZED', 'CONCURRENT_MODIFICATION',
    'REGISTRATION_CLOSED', 'WRONG_TERM',
  ];
  const knownCode = knownCodes.find((code) => error?.message.includes(code));
  if (knownCode) throw new Error(knownCode);
  throw new Error(`${operation}: ${error?.message ?? 'unknown Supabase error'}`);
}

export class SupabaseJsUniversityDataClient implements UniversitySupabaseDataClient {
  constructor(private readonly client: SupabaseClient) {}

  async getStudent(studentId: string): Promise<StudentSnapshot | null> {
    const { data, error } = await this.client.from('students')
      .select('student_id, profile_json, record_json, updated_at')
      .eq('student_id', studentId)
      .maybeSingle();
    if (error) queryError('getStudent failed', error);
    return data ? {
      studentId: String(data.student_id),
      profile: data.profile_json as StudentProfile,
      record: data.record_json as JsonObject,
      updatedAt: String(data.updated_at),
    } : null;
  }

  async listStudents(): Promise<StudentSnapshot[]> {
    const { data, error } = await this.client.from('students')
      .select('student_id, profile_json, record_json, updated_at')
      .order('student_id', { ascending: true });
    if (error) queryError('listStudents failed', error);
    return (data ?? []).map((row) => ({
      studentId: String(row.student_id),
      profile: row.profile_json as StudentProfile,
      record: row.record_json as JsonObject,
      updatedAt: String(row.updated_at),
    }));
  }

  async listCourses(): Promise<Array<{ courseCode: string; data: JsonObject }>> {
    const { data, error } = await this.client.from('courses')
      .select('course_code, data_json')
      .order('course_code', { ascending: true });
    if (error) queryError('listCourses failed', error);
    return (data ?? []).map((row) => ({ courseCode: String(row.course_code), data: row.data_json as JsonObject }));
  }

  async getCourse(courseCode: string): Promise<JsonObject | null> {
    const { data, error } = await this.client.from('courses')
      .select('data_json')
      .eq('course_code', courseCode)
      .maybeSingle();
    if (error) queryError('getCourse failed', error);
    return data ? data.data_json as JsonObject : null;
  }

  async listOfferings(termCode: string): Promise<OfferingSnapshot[]> {
    const { data, error } = await this.client.from('offerings')
      .select('section_id, course_code, term_code, data_json, updated_at')
      .eq('term_code', termCode)
      .order('course_code', { ascending: true })
      .order('section_id', { ascending: true });
    if (error) queryError('listOfferings failed', error);
    return (data ?? []).map(mapOffering);
  }

  async getOfferings(sectionIds: string[]): Promise<OfferingSnapshot[]> {
    if (sectionIds.length === 0) return [];
    const { data, error } = await this.client.from('offerings')
      .select('section_id, course_code, term_code, data_json, updated_at')
      .in('section_id', sectionIds)
      .order('section_id', { ascending: true });
    if (error) queryError('getOfferings failed', error);
    return (data ?? []).map(mapOffering);
  }

  async getCalendar(): Promise<CalendarSnapshot | null> {
    const { data, error } = await this.client.from('calendar')
      .select('data_json, updated_at')
      .eq('id', 1)
      .maybeSingle();
    if (error) queryError('getCalendar failed', error);
    return data ? { calendar: data.data_json as unknown as CalendarState, updatedAt: String(data.updated_at) } : null;
  }

  async getAcademicDates(): Promise<JsonObject[]> {
    const { data, error } = await this.client.from('academic_dates')
      .select('data_json')
      .order('date_id', { ascending: true });
    if (error) queryError('getAcademicDates failed', error);
    return (data ?? []).map((row) => row.data_json as JsonObject);
  }

  async hasCourses(): Promise<boolean> {
    const { count, error } = await this.client.from('courses').select('course_code', { count: 'exact', head: true });
    if (error) queryError('hasAcademicData failed', error);
    return (count ?? 0) > 0;
  }

  async latestCursor(): Promise<unknown | null> {
    const { data, error } = await this.client.from('events')
      .select('cursor')
      .order('cursor', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) queryError('cursor failed', error);
    return data?.cursor ?? null;
  }

  async eventsSince(since: number, limit: number): Promise<RawEventRow[]> {
    const { data, error } = await this.client.from('events')
      .select('cursor, id, event_type, version, occurred_at, student_id, payload_json, idempotency_key')
      .gt('cursor', since)
      .order('cursor', { ascending: true })
      .limit(limit);
    if (error) queryError('eventsSince failed', error);
    return (data ?? []) as RawEventRow[];
  }

  async eventByKey(key: string): Promise<RawEventRow | null> {
    const { data, error } = await this.client.from('events')
      .select('cursor, id, event_type, version, occurred_at, student_id, payload_json, idempotency_key')
      .eq('idempotency_key', key)
      .maybeSingle();
    if (error) queryError('eventByKey failed', error);
    return data as RawEventRow | null;
  }

  async deliveryBatch(now: string): Promise<RawEventRow[]> {
    const { data, error } = await this.client.from('events')
      .select('cursor, id, event_type, version, occurred_at, student_id, payload_json, idempotency_key, attempts')
      .is('delivered_at', null)
      .lte('next_attempt_at', now)
      .order('cursor', { ascending: true })
      .limit(25);
    if (error) queryError('deliveryBatch failed', error);
    return (data ?? []) as RawEventRow[];
  }

  async rpc(name: string, parameters: JsonObject): Promise<unknown> {
    const { data, error } = await this.client.rpc(name, parameters);
    if (error) queryError(`${name} failed`, error);
    return data;
  }
}

function mapOffering(row: Record<string, unknown>): OfferingSnapshot {
  return {
    sectionId: String(row.section_id),
    courseCode: String(row.course_code),
    termCode: String(row.term_code),
    data: row.data_json as JsonObject,
    updatedAt: String(row.updated_at),
  };
}

function makeKey(value?: string): string {
  return value?.trim() || randomUUID();
}

function safeCursor(value: unknown): number {
  let cursor: bigint;
  try {
    cursor = typeof value === 'bigint' ? value : BigInt(String(value ?? 0));
  } catch {
    throw new Error('INVALID_EVENT_CURSOR');
  }
  if (cursor < 0n || cursor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('EVENT_CURSOR_OUT_OF_RANGE');
  return Number(cursor);
}

function isoTimestamp(value: unknown): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_EVENT_TIMESTAMP');
  return date.toISOString();
}

function mapEvent(row: RawEventRow): UniEvent {
  return {
    cursor: safeCursor(row.cursor),
    id: row.id,
    type: row.event_type,
    version: Number(row.version),
    occurredAt: isoTimestamp(row.occurred_at),
    ...(row.student_id ? { studentId: row.student_id } : {}),
    payload: row.payload_json,
    idempotencyKey: row.idempotency_key,
  };
}

function eventFromRpc(value: unknown): UniEvent {
  const event = value as Partial<UniEvent> | null;
  if (!event || typeof event.id !== 'string' || typeof event.type !== 'string') throw new Error('INVALID_RPC_RESPONSE');
  return {
    id: event.id,
    type: event.type as UniEventType,
    version: Number(event.version),
    occurredAt: isoTimestamp(event.occurredAt),
    ...(event.studentId ? { studentId: String(event.studentId) } : {}),
    payload: event.payload as JsonObject,
    idempotencyKey: String(event.idempotencyKey),
    cursor: safeCursor(event.cursor),
  };
}

function mutationResult(value: unknown): { event: UniEvent; duplicate: boolean } {
  const result = value as { event?: unknown; duplicate?: unknown } | null;
  if (!result) throw new Error('INVALID_RPC_RESPONSE');
  return { event: eventFromRpc(result.event), duplicate: result.duplicate === true };
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class SupabaseUniversityRepository implements UniversityRepository {
  constructor(private readonly data: UniversitySupabaseDataClient) {}

  async getCalendar(): Promise<CalendarState> {
    const row = await this.data.getCalendar();
    if (!row) throw new Error('UNIVERSITY_DATA_NOT_INITIALIZED');
    return row.calendar;
  }

  hasAcademicData() { return this.data.hasCourses(); }
  getAcademicDates() { return this.data.getAcademicDates(); }
  async getStudent(studentId: string) { return (await this.data.getStudent(studentId))?.profile ?? null; }
  async getStudentRecord(studentId: string) { return (await this.data.getStudent(studentId))?.record ?? null; }
  async listStudents() { return (await this.data.listStudents()).map((row) => row.profile); }
  async listCourses() { return (await this.data.listCourses()).map((row) => row.data); }
  getCourse(courseCode: string) { return this.data.getCourse(courseCode); }
  async listOfferings(termCode?: string) {
    const term = termCode || (await this.getCalendar()).currentTerm.code;
    return (await this.data.listOfferings(term)).map((row) => row.data);
  }
  async cursor() { return safeCursor((await this.data.latestCursor()) ?? 0); }
  async eventsSince(since: number, limit = 250) {
    const clampedLimit = Math.max(1, Math.min(limit, 500));
    return (await this.data.eventsSince(Math.max(0, since), clampedLimit)).map(mapEvent);
  }
  async deliveryBatch(): Promise<DeliveryEventRow[]> {
    return (await this.data.deliveryBatch(new Date().toISOString())).map((row) => ({
      cursor: safeCursor(row.cursor),
      id: row.id,
      event_type: row.event_type,
      version: Number(row.version),
      occurred_at: isoTimestamp(row.occurred_at),
      student_id: row.student_id,
      payload_json: JSON.stringify(row.payload_json),
      idempotency_key: row.idempotency_key,
      attempts: Number(row.attempts ?? 0),
    }));
  }

  private async existingEvent(key: string): Promise<UniEvent | null> {
    const row = await this.data.eventByKey(key);
    return row ? mapEvent(row) : null;
  }

  private async retryConcurrent<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!errorCode(error).includes('CONCURRENT_MODIFICATION')) throw error;
      }
    }
    throw lastError;
  }

  async postGrade(input: GradeInput): Promise<{ event: UniEvent; duplicate: boolean }> {
    const key = makeKey(input.idempotencyKey);
    const eventKey = `${key}:grade`;
    const prior = await this.existingEvent(eventKey);
    if (prior) return { event: prior, duplicate: true };
    if (!Number.isFinite(input.grade) || input.grade < 0 || input.grade > 100) throw new Error('INVALID_GRADE');

    return this.retryConcurrent(async () => {
      const snapshot = await this.data.getStudent(input.studentId);
      if (!snapshot) throw new Error('STUDENT_NOT_FOUND');
      const courses = await this.listCourses();
      const course = courses.find((item) => item.code === input.courseCode);
      if (!course) throw new Error('COURSE_NOT_FOUND');
      const calendar = await this.getCalendar();
      const profile = structuredClone(snapshot.profile);
      const record = structuredClone(snapshot.record);
      const termCode = input.termCode || calendar.currentTerm.code;
      const courseName = String(course.name ?? input.courseCode);
      const credits = Number(course.credits ?? 0);
      const status = input.grade >= 50 ? 'ناجح' : 'راسب';
      const letterGrade = input.letterGrade || (input.grade >= 90 ? 'A' : input.grade >= 80 ? 'B' : input.grade >= 70 ? 'C' : input.grade >= 60 ? 'D' : 'F');
      const gradeRow: CourseGrade = {
        courseCode: input.courseCode, courseName, credits, grade: input.grade, letterGrade,
        status: status as CourseGrade['status'], semesterId: termCode, semesterName: calendar.currentTerm.label,
      };
      const semesterIndex = profile.semesterHistory.findIndex((semester) => semester.semesterId === termCode);
      let semester: SemesterRecord;
      if (semesterIndex >= 0) {
        semester = profile.semesterHistory[semesterIndex];
        const attemptIndex = semester.courses.findIndex((attempt) => attempt.courseCode === input.courseCode);
        if (attemptIndex >= 0) semester.courses[attemptIndex] = gradeRow;
        else semester.courses.push(gradeRow);
      } else {
        semester = { semesterId: termCode, semesterName: calendar.currentTerm.label, registeredHours: credits,
          passedHours: status === 'ناجح' ? credits : 0, semesterGpa: 0, cumulativeGpa: 0, courses: [gradeRow] };
        profile.semesterHistory.push(semester);
      }
      semester.registeredHours = semester.courses.reduce((sum, attempt) => sum + attempt.credits, 0);
      semester.passedHours = semester.courses.filter((attempt) => attempt.status === 'ناجح')
        .reduce((sum, attempt) => sum + attempt.credits, 0);
      semester.semesterGpa = semester.courses.length
        ? Number((semester.courses.reduce((sum, attempt) => sum + attempt.grade * attempt.credits, 0) /
          Math.max(1, semester.courses.reduce((sum, attempt) => sum + attempt.credits, 0))).toFixed(2)) : 0;
      const previousCredits = profile.semesterHistory.filter((item) => item.semesterId !== termCode)
        .reduce((sum, item) => sum + item.courses.reduce((s, attempt) => s + attempt.grade * attempt.credits, 0), 0);
      const previousHours = profile.semesterHistory.filter((item) => item.semesterId !== termCode)
        .reduce((sum, item) => sum + item.courses.reduce((s, attempt) => s + attempt.credits, 0), 0);
      semester.cumulativeGpa = Number(((previousCredits + semester.courses.reduce((sum, attempt) =>
        sum + attempt.grade * attempt.credits, 0)) /
        Math.max(1, previousHours + semester.courses.reduce((sum, attempt) => sum + attempt.credits, 0))).toFixed(2));
      if (status === 'ناجح' && !profile.completedCourses.includes(input.courseCode)) profile.completedCourses.push(input.courseCode);
      if (status !== 'ناجح') profile.completedCourses = profile.completedCourses.filter((code) => code !== input.courseCode);
      record.attempts = [...(Array.isArray(record.attempts) ? record.attempts : []).filter((attempt) =>
        (attempt as JsonObject).course_code !== input.courseCode), {
        course_code: input.courseCode, course_name: courseName, credits, grade: input.grade, letter_grade: letterGrade,
        outcome: status === 'ناجح' ? 'PASSED' : 'FAILED', semester_id: termCode, semester_name: calendar.currentTerm.label,
      }];
      record.earned_credits = profile.semesterHistory.reduce((sum, item) => sum + item.passedHours, 0);
      record.cumulative_gpa = semester.cumulativeGpa;
      record.semesters = profile.semesterHistory;
      const payload = { courseCode: input.courseCode, courseName, grade: input.grade, letterGrade, credits, termCode, status };
      const result = await this.data.rpc('university_commit_student_mutation', {
        p_student_id: input.studentId,
        p_expected_updated_at: snapshot.updatedAt,
        p_profile_json: profile,
        p_record_json: record,
        p_event_type: 'grade.posted',
        p_event_payload: payload,
        p_idempotency_key: eventKey,
        p_secondary_event_type: 'record.updated',
        p_secondary_event_payload: { ...payload, earnedCredits: record.earned_credits, cumulativeGpa: record.cumulative_gpa },
        p_secondary_idempotency_key: `${key}:record`,
      });
      return mutationResult(result);
    });
  }

  async createStudent(profile: StudentProfile, idempotencyKey?: string): Promise<UniEvent> {
    const key = makeKey(idempotencyKey);
    const prior = await this.existingEvent(key);
    if (prior) return prior;
    if (!profile.universityId || await this.getStudent(profile.universityId)) throw new Error('STUDENT_ALREADY_EXISTS');
    const record = academicRecordFromProfile(profile, (await this.getCalendar()).currentTerm.code);
    const result = mutationResult(await this.data.rpc('university_create_student', {
      p_student_id: profile.universityId,
      p_profile_json: profile,
      p_record_json: record,
      p_event_payload: { major: profile.major, studyPlan: profile.studyPlan },
      p_idempotency_key: key,
    }));
    return result.event;
  }

  async updateStudentPlan(studentId: string, studyPlan: string, idempotencyKey?: string): Promise<UniEvent> {
    const key = makeKey(idempotencyKey);
    const prior = await this.existingEvent(key);
    if (prior) return prior;
    return this.retryConcurrent(async () => {
      const snapshot = await this.data.getStudent(studentId);
      if (!snapshot) throw new Error('STUDENT_NOT_FOUND');
      const profile = structuredClone(snapshot.profile);
      profile.studyPlan = studyPlan;
      const result = mutationResult(await this.data.rpc('university_commit_student_mutation', {
        p_student_id: studentId,
        p_expected_updated_at: snapshot.updatedAt,
        p_profile_json: profile,
        p_record_json: null,
        p_event_type: 'plan.updated',
        p_event_payload: { studyPlan },
        p_idempotency_key: key,
        p_secondary_event_type: null,
        p_secondary_event_payload: null,
        p_secondary_idempotency_key: null,
      }));
      return result.event;
    });
  }

  async updateStudentSchedule(
    studentId: string,
    sections: StudentProfile['currentRegisteredSections'],
    idempotencyKey?: string,
  ): Promise<UniEvent> {
    const key = makeKey(idempotencyKey);
    const prior = await this.existingEvent(key);
    if (prior) return prior;
    return this.retryConcurrent(async () => {
      const snapshot = await this.data.getStudent(studentId);
      if (!snapshot) throw new Error('STUDENT_NOT_FOUND');
      const profile = structuredClone(snapshot.profile);
      profile.currentRegisteredSections = sections;
      const result = mutationResult(await this.data.rpc('university_commit_student_mutation', {
        p_student_id: studentId,
        p_expected_updated_at: snapshot.updatedAt,
        p_profile_json: profile,
        p_record_json: null,
        p_event_type: 'schedule.changed',
        p_event_payload: { sections: sections.map((section) => ({ sectionId: section.id, courseCode: section.courseCode })) },
        p_idempotency_key: key,
        p_secondary_event_type: null,
        p_secondary_event_payload: null,
        p_secondary_idempotency_key: null,
      }));
      return result.event;
    });
  }

  async registerSections(studentId: string, sectionIds: string[], idempotencyKey?: string): Promise<RegisterSectionsResult> {
    const key = makeKey(idempotencyKey);
    const prior = await this.existingEvent(key);
    if (prior) return { event: prior, duplicate: true, sections: (await this.getStudent(studentId))?.currentRegisteredSections ?? [] };
    return this.retryConcurrent(async () => {
      const calendar = await this.getCalendar();
      if (!calendar.registrationOpen) throw new Error('REGISTRATION_CLOSED');
      const student = await this.data.getStudent(studentId);
      if (!student) throw new Error('STUDENT_NOT_FOUND');
      if (new Set(sectionIds).size !== sectionIds.length) throw new Error('DUPLICATE_SECTION');
      const allIds = [...new Set([...sectionIds, ...student.profile.currentRegisteredSections.map((section) => section.id)])];
      const offerings = await this.data.getOfferings(allIds);
      const offeringById = new Map(offerings.map((row) => [row.sectionId, row]));
      if (sectionIds.some((id) => !offeringById.has(id))) throw new Error('SECTION_NOT_FOUND');
      const courses = await this.listCourses();
      const registeredIds = new Set(student.profile.currentRegisteredSections.map((section) => section.id));
      const nextSections: CourseSection[] = [];
      for (const id of sectionIds) {
        const row = offeringById.get(id)!;
        const data = row.data;
        if (row.termCode !== calendar.currentTerm.code) throw new Error('WRONG_TERM');
        if (!registeredIds.has(row.sectionId) && (data.status !== 'متاحة' || Number(data.available) <= 0)) throw new Error('SECTION_FULL');
        const course = courses.find((item) => item.code === row.courseCode);
        if (!course || student.profile.completedCourses.includes(row.courseCode)) throw new Error('COURSE_NOT_ELIGIBLE');
        const prerequisites = Array.isArray(course.prerequisites) ? course.prerequisites as string[] : [];
        if (prerequisites.some((code) => !student.profile.completedCourses.includes(code))) throw new Error('PREREQUISITES_NOT_MET');
        nextSections.push({
          id: row.sectionId, courseCode: row.courseCode, courseName: String(data.course_name),
          sectionNumber: Number(data.section_number), credits: Number(data.credits), instructor: String(data.instructor),
          days: String(data.days), daysArray: data.days_array as CourseSection['daysArray'],
          startTime: String(data.start_time), endTime: String(data.end_time), room: String(data.room),
          capacity: Number(data.capacity), enrolled: Number(data.enrolled), status: String(data.status) as CourseSection['status'],
        });
      }
      const totalHours = nextSections.reduce((sum, section) => sum + section.credits, 0);
      if (totalHours > 18) throw new Error('HOURS_LIMIT');
      const toMinutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; };
      for (let left = 0; left < nextSections.length; left += 1) {
        for (let right = left + 1; right < nextSections.length; right += 1) {
          const a = nextSections[left]; const b = nextSections[right];
          const sameDay = a.daysArray.some((day) => b.daysArray.includes(day));
          if (sameDay && Math.max(toMinutes(a.startTime), toMinutes(b.startTime)) < Math.min(toMinutes(a.endTime), toMinutes(b.endTime))) {
            throw new Error('SCHEDULE_CONFLICT');
          }
        }
      }
      const previousById = new Map(student.profile.currentRegisteredSections.map((section) => [section.id, section]));
      const nextById = new Map(nextSections.map((section) => [section.id, section]));
      const changedSections: Array<{ id: string; enrolled: number }> = [];
      const offeringUpdates: JsonObject[] = [];
      for (const id of new Set([...previousById.keys(), ...nextById.keys()])) {
        if (previousById.has(id) === nextById.has(id)) continue;
        const row = offeringById.get(id);
        if (!row) continue;
        const data = structuredClone(row.data);
        const delta = nextById.has(id) ? 1 : -1;
        const enrolled = Math.max(0, Math.min(Number(data.capacity), Number(data.enrolled) + delta));
        data.enrolled = enrolled;
        data.available = Number(data.capacity) - enrolled;
        data.status = enrolled >= Number(data.capacity) ? 'ممتلئة' : 'متاحة';
        changedSections.push({ id, enrolled });
        offeringUpdates.push({
          section_id: id,
          expected_updated_at: row.updatedAt,
          data_json: data,
          event_payload: { sectionId: id, courseCode: data.course_code, termCode: row.termCode,
            enrolled, available: data.available, capacity: data.capacity, status: data.status },
          idempotency_key: `${key}:section:${id}`,
        });
      }
      const profile = structuredClone(student.profile);
      profile.currentRegisteredSections = nextSections;
      const result = mutationResult(await this.data.rpc('university_register_sections', {
        p_student_id: studentId,
        p_expected_student_updated_at: student.updatedAt,
        p_profile_json: profile,
        p_offering_updates: offeringUpdates,
        p_event_payload: { sections: nextSections.map((section) => ({ sectionId: section.id, courseCode: section.courseCode })), totalHours },
        p_idempotency_key: key,
      }));
      if (result.duplicate) {
        return { event: result.event, duplicate: true, sections: (await this.getStudent(studentId))?.currentRegisteredSections ?? [] };
      }
      return { event: result.event, duplicate: false, sections: nextSections, changedSections };
    });
  }

  async setRegistration(
    open: boolean,
    start?: string | null,
    end?: string | null,
    idempotencyKey?: string,
  ): Promise<{ calendar: CalendarState; event: UniEvent }> {
    const key = makeKey(idempotencyKey);
    const prior = await this.existingEvent(key);
    if (prior) return { calendar: await this.getCalendar(), event: prior };
    return this.retryConcurrent(async () => {
      const snapshot = await this.data.getCalendar();
      if (!snapshot) throw new Error('UNIVERSITY_DATA_NOT_INITIALIZED');
      const calendar = structuredClone(snapshot.calendar);
      calendar.registrationOpen = open;
      calendar.registrationWindow = { start: start ?? calendar.registrationWindow.start, end: end ?? calendar.registrationWindow.end };
      const type: UniEventType = open ? 'registration.opened' : 'registration.closed';
      const result = mutationResult(await this.data.rpc('university_set_registration', {
        p_expected_updated_at: snapshot.updatedAt,
        p_calendar_json: calendar,
        p_event_type: type,
        p_event_payload: { currentTerm: calendar.currentTerm, registrationWindow: calendar.registrationWindow },
        p_idempotency_key: key,
      }));
      return { calendar: result.duplicate ? await this.getCalendar() : calendar, event: result.event };
    });
  }

  async updateOffering(
    sectionId: string,
    patch: JsonObject,
    action: OfferingAction,
    idempotencyKey?: string,
  ): Promise<UpdateOfferingResult> {
    const key = makeKey(idempotencyKey);
    const prior = await this.existingEvent(key);
    if (prior) {
      const row = (await this.data.getOfferings([sectionId]))[0];
      return { section: row?.data ?? null, event: prior, duplicate: true };
    }
    return this.retryConcurrent(async () => {
      const row = (await this.data.getOfferings([sectionId]))[0];
      if (!row) throw new Error('SECTION_NOT_FOUND');
      const section = structuredClone(row.data);
      const editableFields = ['capacity', 'enrolled', 'days', 'days_array', 'start_time', 'end_time', 'room', 'instructor', 'status'];
      if (action === 'fill') {
        section.enrolled = Number(section.capacity); section.available = 0; section.status = 'ممتلئة';
      } else if (action === 'open') {
        if (Number(section.capacity) <= Number(section.enrolled)) throw new Error('NO_SEATS');
        section.status = 'متاحة'; section.available = Number(section.capacity) - Number(section.enrolled);
      } else if (action === 'close') {
        section.status = 'مغلقة'; section.available = 0;
      } else {
        for (const field of editableFields) if (field in patch) section[field] = patch[field];
        const capacity = Number(section.capacity); const enrolled = Number(section.enrolled);
        if (!Number.isFinite(capacity) || !Number.isFinite(enrolled) || capacity < 0 || enrolled < 0 || enrolled > capacity) {
          throw new Error('INVALID_CAPACITY');
        }
        section.available = capacity - enrolled;
        if (section.status !== 'مغلقة') section.status = section.available === 0 ? 'ممتلئة' : 'متاحة';
      }
      const type: UniEventType = action === 'open' ? 'section.opened' : action === 'close' || action === 'fill'
        ? 'section.closed' : 'offering.updated';
      const result = mutationResult(await this.data.rpc('university_update_offering', {
        p_section_id: sectionId,
        p_expected_updated_at: row.updatedAt,
        p_data_json: section,
        p_event_type: type,
        p_event_payload: { sectionId, courseCode: section.course_code, termCode: row.termCode,
          capacity: section.capacity, enrolled: section.enrolled, available: section.available, days: section.days,
          startTime: section.start_time, endTime: section.end_time, room: section.room, instructor: section.instructor,
          status: section.status },
        p_idempotency_key: key,
      }));
      if (result.duplicate) {
        const current = (await this.data.getOfferings([sectionId]))[0];
        return { section: current?.data ?? null, event: result.event, duplicate: true };
      }
      return { section, event: result.event, duplicate: false };
    });
  }

  async markDelivery(cursor: number, status: number | null, delivered: boolean): Promise<void> {
    await this.data.rpc('university_mark_delivery', {
      p_cursor: cursor,
      p_status: status,
      p_delivered: delivered,
    });
  }

  async close(): Promise<void> {
    // supabase-js uses stateless HTTP requests; there is no database connection to close.
  }
}
