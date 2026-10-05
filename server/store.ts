import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { demoStudents } from '../src/data/demoStudents';
import { academicDates } from '../src/data/academicDates';
import type { StudentProfile, CourseGrade, SemesterRecord, CourseSection } from '../src/types/student';

export type UniEventType =
  | 'student.created'
  | 'grade.posted'
  | 'record.updated'
  | 'registration.opened'
  | 'registration.closed'
  | 'offering.updated'
  | 'section.opened'
  | 'section.closed'
  | 'schedule.changed'
  | 'plan.updated';

export interface UniEvent {
  id: string;
  type: UniEventType;
  version: number;
  occurredAt: string;
  studentId?: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  cursor: number;
}

export interface CalendarState {
  currentTerm: { code: string; label: string };
  registrationOpen: boolean;
  registrationWindow: { start: string | null; end: string | null };
  nextTerm: { code: string; label: string } | null;
}

interface SeedManifest {
  schema_version: string;
  fixture_version: string;
  institution_id: string;
  institution_name: string;
  active_term: { term_id: string; name: string };
}

interface SeedRecord {
  student_id: string;
  [key: string]: unknown;
}

interface SeedOffering {
  id: string;
  course_code: string;
  [key: string]: unknown;
}

export interface GradeInput {
  studentId: string;
  courseCode: string;
  grade: number;
  letterGrade?: string;
  termCode?: string;
  idempotencyKey?: string;
}

export interface AuthUser {
  id: string;
  email?: string;
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signWebhook(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

function readSeed<T>(name: string): T {
  const path = resolve(process.cwd(), 'server', 'seed-data', name);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function currentTime(): string {
  return new Date().toISOString();
}

function makeKey(value?: string): string {
  return value?.trim() || randomUUID();
}

function academicRecordFromProfile(profile: StudentProfile, termCode: string) {
  const attempts = profile.semesterHistory.flatMap((semester) => semester.courses.map((course) => ({
    course_code: course.courseCode,
    course_name: course.courseName,
    credits: course.credits,
    grade: course.grade,
    letter_grade: course.letterGrade,
    status: course.status,
    semester_id: course.semesterId || semester.semesterId,
    semester_name: course.semesterName || semester.semesterName,
  })));
  const earnedCredits = profile.semesterHistory.reduce((total, semester) => total + semester.passedHours, 0);
  const currentRegisteredSections = profile.currentRegisteredSections.map((section) => section.id);
  return {
    student_id: profile.universityId,
    program_id: profile.degree,
    major_id: profile.major,
    plan_id: profile.studyPlan,
    plan_version_id: profile.studyPlan,
    earned_credits: earnedCredits,
    cumulative_gpa: profile.semesterHistory.at(-1)?.cumulativeGpa ?? 0,
    semesters: profile.semesterHistory,
    attempts,
    current_registered_sections: currentRegisteredSections,
    current_term_code: termCode,
  };
}

/** Pre-loaded seed bundle — pass this when filesystem is unavailable (e.g. Vercel serverless). */
export interface SeedBundle {
  manifest: SeedManifest;
  records: { records: SeedRecord[] };
  courses: Record<string, unknown>[];
  offerings: SeedOffering[];
}

export class UniversityStore {
  readonly db: DatabaseSync;

  constructor(
    databasePath = process.env.UNI_DATABASE_PATH || './data/university.sqlite',
    seedSyntheticData = true,
    private readonly seedBundle?: SeedBundle,
  ) {
    if (databasePath !== ':memory:') mkdirSync(dirname(resolve(databasePath)), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.initialize(seedSyntheticData);
  }

  private initialize(seedSyntheticData: boolean) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS students (
        student_id TEXT PRIMARY KEY,
        profile_json TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS courses (
        course_code TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS offerings (
        section_id TEXT PRIMARY KEY,
        course_code TEXT NOT NULL,
        term_code TEXT NOT NULL,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS offerings_term_course_idx ON offerings(term_code, course_code);
      CREATE TABLE IF NOT EXISTS calendar (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS academic_dates (
        date_id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        cursor INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        version INTEGER NOT NULL,
        occurred_at TEXT NOT NULL,
        student_id TEXT,
        payload_json TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        delivered_at TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT NOT NULL,
        last_status INTEGER
      );
      CREATE TABLE IF NOT EXISTS aggregate_versions (
        aggregate_key TEXT PRIMARY KEY,
        version INTEGER NOT NULL
      );
    `);
    this.seedIfEmpty(seedSyntheticData);
  }

  private seedIfEmpty(seedSyntheticData: boolean) {
    if (!seedSyntheticData) return;
    const existing = this.db.prepare('SELECT COUNT(*) AS count FROM students').get() as { count: number };
    if (existing.count > 0) return;

    const manifest = this.seedBundle?.manifest ?? readSeed<SeedManifest>('manifest.json');
    const records = this.seedBundle?.records.records ?? readSeed<{ records: SeedRecord[] }>('academic-records.json').records;
    const courses = this.seedBundle?.courses ?? readSeed<Record<string, unknown>[]>('courses.json');
    const offerings = this.seedBundle?.offerings ?? readSeed<SeedOffering[]>('offerings.json');
    const now = currentTime();
    const currentTerm = { code: manifest.active_term.term_id, label: manifest.active_term.name };
    const nextTermCode = `${currentTerm.code.split('-')[0]}-${Number(currentTerm.code.split('-')[1] || 0) + 1}`;
    const calendar: CalendarState = {
      currentTerm,
      registrationOpen: false,
      registrationWindow: { start: null, end: null },
      nextTerm: { code: nextTermCode, label: nextTermCode },
    };

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const insertStudent = this.db.prepare(
        'INSERT INTO students(student_id, profile_json, record_json, updated_at) VALUES (?, ?, ?, ?)',
      );
      for (const profile of demoStudents) {
        const record = records.find((row) => row.student_id === profile.universityId);
        insertStudent.run(
          profile.universityId,
          JSON.stringify(profile),
          JSON.stringify(record ?? academicRecordFromProfile(profile, currentTerm.code)),
          now,
        );
      }
      const insertCourse = this.db.prepare('INSERT INTO courses(course_code, data_json, updated_at) VALUES (?, ?, ?)');
      for (const course of courses) insertCourse.run(String(course.code), JSON.stringify(course), now);
      const insertOffering = this.db.prepare(
        'INSERT INTO offerings(section_id, course_code, term_code, data_json, updated_at) VALUES (?, ?, ?, ?, ?)',
      );
      for (const section of offerings) {
        insertOffering.run(section.id, section.course_code, currentTerm.code, JSON.stringify(section), now);
      }
      this.db.prepare('INSERT INTO calendar(id, data_json, updated_at) VALUES (1, ?, ?)')
        .run(JSON.stringify(calendar), now);
      const insertDate = this.db.prepare('INSERT INTO academic_dates(date_id, data_json, updated_at) VALUES (?, ?, ?)');
      for (const item of academicDates) insertDate.run(item.id, JSON.stringify(item), now);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  getCalendar(): CalendarState {
    const row = this.db.prepare('SELECT data_json FROM calendar WHERE id = 1').get() as { data_json: string } | undefined;
    if (!row) throw new Error('UNIVERSITY_DATA_NOT_INITIALIZED');
    return JSON.parse(row.data_json) as CalendarState;
  }

  hasAcademicData(): boolean {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM courses').get() as { count: number };
    return row.count > 0;
  }

  getAcademicDates(): Record<string, unknown>[] {
    const rows = this.db.prepare('SELECT data_json FROM academic_dates ORDER BY date_id').all() as { data_json: string }[];
    return rows.map((row) => JSON.parse(row.data_json) as Record<string, unknown>);
  }

  getStudent(studentId: string): StudentProfile | null {
    const row = this.db.prepare('SELECT profile_json FROM students WHERE student_id = ?').get(studentId) as
      | { profile_json: string }
      | undefined;
    return row ? JSON.parse(row.profile_json) as StudentProfile : null;
  }

  getStudentRecord(studentId: string): Record<string, unknown> | null {
    const row = this.db.prepare('SELECT record_json FROM students WHERE student_id = ?').get(studentId) as
      | { record_json: string }
      | undefined;
    return row ? JSON.parse(row.record_json) as Record<string, unknown> : null;
  }

  listStudents(): StudentProfile[] {
    const rows = this.db.prepare('SELECT profile_json FROM students ORDER BY student_id').all() as { profile_json: string }[];
    return rows.map((row) => JSON.parse(row.profile_json) as StudentProfile);
  }

  listCourses(): Record<string, unknown>[] {
    const rows = this.db.prepare('SELECT data_json FROM courses ORDER BY course_code').all() as { data_json: string }[];
    return rows.map((row) => JSON.parse(row.data_json) as Record<string, unknown>);
  }

  getCourse(courseCode: string): Record<string, unknown> | null {
    const row = this.db.prepare('SELECT data_json FROM courses WHERE course_code = ?').get(courseCode) as
      | { data_json: string }
      | undefined;
    return row ? JSON.parse(row.data_json) as Record<string, unknown> : null;
  }

  listOfferings(termCode?: string): Record<string, unknown>[] {
    const term = termCode || this.getCalendar().currentTerm.code;
    const rows = this.db.prepare('SELECT data_json FROM offerings WHERE term_code = ? ORDER BY course_code, section_id')
      .all(term) as { data_json: string }[];
    return rows.map((row) => JSON.parse(row.data_json) as Record<string, unknown>);
  }

  cursor(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(cursor), 0) AS cursor FROM events').get() as { cursor: number };
    return row.cursor;
  }

  eventsSince(since: number, limit = 250): UniEvent[] {
    const rows = this.db.prepare(
      'SELECT cursor, id, event_type, version, occurred_at, student_id, payload_json, idempotency_key FROM events WHERE cursor > ? ORDER BY cursor LIMIT ?',
    ).all(Math.max(0, since), Math.max(1, Math.min(limit, 500))) as Array<{
      cursor: number; id: string; event_type: UniEventType; version: number; occurred_at: string;
      student_id: string | null; payload_json: string; idempotency_key: string;
    }>;
    return rows.map((row) => ({
      cursor: row.cursor,
      id: row.id,
      type: row.event_type,
      version: row.version,
      occurredAt: row.occurred_at,
      ...(row.student_id ? { studentId: row.student_id } : {}),
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      idempotencyKey: row.idempotency_key,
    }));
  }

  private appendEvent(type: UniEventType, payload: Record<string, unknown>, studentId?: string, key?: string): UniEvent {
    const idempotencyKey = makeKey(key);
    const existing = this.db.prepare(
      'SELECT cursor, id, event_type, version, occurred_at, student_id, payload_json, idempotency_key FROM events WHERE idempotency_key = ?',
    ).get(idempotencyKey) as {
      cursor: number; id: string; event_type: UniEventType; version: number; occurred_at: string;
      student_id: string | null; payload_json: string; idempotency_key: string;
    } | undefined;
    if (existing) return {
      cursor: existing.cursor, id: existing.id, type: existing.event_type, version: existing.version,
      occurredAt: existing.occurred_at, ...(existing.student_id ? { studentId: existing.student_id } : {}),
      payload: JSON.parse(existing.payload_json) as Record<string, unknown>, idempotencyKey: existing.idempotency_key,
    };

    const aggregateKey = studentId ? `student:${studentId}` : type.startsWith('registration.') ? 'calendar' :
      type.includes('section') || type === 'offering.updated' ? `offering:${String(payload.sectionId ?? 'unknown')}` :
        `${type}:${String(payload.id ?? 'global')}`;
    this.db.prepare('INSERT INTO aggregate_versions(aggregate_key, version) VALUES (?, 1) ON CONFLICT(aggregate_key) DO UPDATE SET version = version + 1')
      .run(aggregateKey);
    const version = (this.db.prepare('SELECT version FROM aggregate_versions WHERE aggregate_key = ?').get(aggregateKey) as { version: number }).version;
    const event: UniEvent = {
      id: randomUUID(), type, version, occurredAt: currentTime(), ...(studentId ? { studentId } : {}),
      payload, idempotencyKey, cursor: 0,
    };
    const result = this.db.prepare(
      'INSERT INTO events(id, event_type, version, occurred_at, student_id, payload_json, idempotency_key, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(event.id, event.type, event.version, event.occurredAt, studentId ?? null,
      JSON.stringify(event.payload), event.idempotencyKey, event.occurredAt);
    event.cursor = Number(result.lastInsertRowid);
    return event;
  }

  private eventByKey(key: string): UniEvent | null {
    const row = this.db.prepare(
      'SELECT cursor, id, event_type, version, occurred_at, student_id, payload_json, idempotency_key FROM events WHERE idempotency_key = ?',
    ).get(key) as {
      cursor: number; id: string; event_type: UniEventType; version: number; occurred_at: string;
      student_id: string | null; payload_json: string; idempotency_key: string;
    } | undefined;
    return row ? {
      cursor: row.cursor, id: row.id, type: row.event_type, version: row.version, occurredAt: row.occurred_at,
      ...(row.student_id ? { studentId: row.student_id } : {}),
      payload: JSON.parse(row.payload_json) as Record<string, unknown>, idempotencyKey: row.idempotency_key,
    } : null;
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  postGrade(input: GradeInput): { event: UniEvent; duplicate: boolean } {
    const key = makeKey(input.idempotencyKey);
    const prior = this.eventByKey(`${key}:grade`);
    if (prior) return { event: prior, duplicate: true };
    if (!Number.isFinite(input.grade) || input.grade < 0 || input.grade > 100) throw new Error('INVALID_GRADE');
    const profile = this.getStudent(input.studentId);
    if (!profile) throw new Error('STUDENT_NOT_FOUND');
    const course = this.listCourses().find((item) => item.code === input.courseCode);
    if (!course) throw new Error('COURSE_NOT_FOUND');
    const calendar = this.getCalendar();
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
    semester.passedHours = semester.courses.filter((attempt) => attempt.status === 'ناجح').reduce((sum, attempt) => sum + attempt.credits, 0);
    semester.semesterGpa = semester.courses.length
      ? Number((semester.courses.reduce((sum, attempt) => sum + attempt.grade * attempt.credits, 0) /
        Math.max(1, semester.courses.reduce((sum, attempt) => sum + attempt.credits, 0))).toFixed(2)) : 0;
    const previousCredits = profile.semesterHistory.filter((item) => item.semesterId !== termCode)
      .reduce((sum, item) => sum + item.courses.reduce((s, attempt) => s + attempt.grade * attempt.credits, 0), 0);
    const previousHours = profile.semesterHistory.filter((item) => item.semesterId !== termCode)
      .reduce((sum, item) => sum + item.courses.reduce((s, attempt) => s + attempt.credits, 0), 0);
    semester.cumulativeGpa = Number(((previousCredits + semester.courses.reduce((sum, attempt) => sum + attempt.grade * attempt.credits, 0)) /
      Math.max(1, previousHours + semester.courses.reduce((sum, attempt) => sum + attempt.credits, 0))).toFixed(2));
    if (status === 'ناجح' && !profile.completedCourses.includes(input.courseCode)) profile.completedCourses.push(input.courseCode);
    if (status !== 'ناجح') profile.completedCourses = profile.completedCourses.filter((code) => code !== input.courseCode);
    const record = this.getStudentRecord(input.studentId) ?? academicRecordFromProfile(profile, termCode);
    record.attempts = [...(Array.isArray(record.attempts) ? record.attempts : []).filter((attempt) =>
      (attempt as Record<string, unknown>).course_code !== input.courseCode), {
      course_code: input.courseCode, course_name: courseName, credits, grade: input.grade, letter_grade: letterGrade,
      outcome: status === 'ناجح' ? 'PASSED' : 'FAILED', semester_id: termCode, semester_name: calendar.currentTerm.label,
    }];
    record.earned_credits = profile.semesterHistory.reduce((sum, item) => sum + item.passedHours, 0);
    record.cumulative_gpa = semester.cumulativeGpa;
    record.semesters = profile.semesterHistory;

    return this.transaction(() => {
      const now = currentTime();
      this.db.prepare('UPDATE students SET profile_json = ?, record_json = ?, updated_at = ? WHERE student_id = ?')
        .run(JSON.stringify(profile), JSON.stringify(record), now, input.studentId);
      const payload = { courseCode: input.courseCode, courseName, grade: input.grade,
        letterGrade, credits, termCode, status };
      const event = this.appendEvent('grade.posted', payload, input.studentId, `${key}:grade`);
      this.appendEvent('record.updated', { ...payload, earnedCredits: record.earned_credits,
        cumulativeGpa: record.cumulative_gpa }, input.studentId, `${key}:record`);
      return { event, duplicate: false };
    });
  }

  createStudent(profile: StudentProfile, idempotencyKey?: string) {
    const key = makeKey(idempotencyKey);
    const prior = this.eventByKey(key);
    if (prior) return prior;
    if (!profile.universityId || this.getStudent(profile.universityId)) throw new Error('STUDENT_ALREADY_EXISTS');
    const record = academicRecordFromProfile(profile, this.getCalendar().currentTerm.code);
    return this.transaction(() => {
      this.db.prepare('INSERT INTO students(student_id, profile_json, record_json, updated_at) VALUES (?, ?, ?, ?)')
        .run(profile.universityId, JSON.stringify(profile), JSON.stringify(record), currentTime());
      const event = this.appendEvent('student.created', { major: profile.major,
        studyPlan: profile.studyPlan }, profile.universityId, key);
      return event;
    });
  }

  updateStudentPlan(studentId: string, studyPlan: string, idempotencyKey?: string) {
    const key = makeKey(idempotencyKey);
    const prior = this.eventByKey(key);
    if (prior) return prior;
    const profile = this.getStudent(studentId);
    if (!profile) throw new Error('STUDENT_NOT_FOUND');
    profile.studyPlan = studyPlan;
    return this.transaction(() => {
      this.db.prepare('UPDATE students SET profile_json = ?, updated_at = ? WHERE student_id = ?')
        .run(JSON.stringify(profile), currentTime(), studentId);
      return this.appendEvent('plan.updated', { studyPlan }, studentId, key);
    });
  }

  updateStudentSchedule(studentId: string, sections: StudentProfile['currentRegisteredSections'], idempotencyKey?: string) {
    const key = makeKey(idempotencyKey);
    const prior = this.eventByKey(key);
    if (prior) return prior;
    const profile = this.getStudent(studentId);
    if (!profile) throw new Error('STUDENT_NOT_FOUND');
    profile.currentRegisteredSections = sections;
    return this.transaction(() => {
      this.db.prepare('UPDATE students SET profile_json = ?, updated_at = ? WHERE student_id = ?')
        .run(JSON.stringify(profile), currentTime(), studentId);
      return this.appendEvent('schedule.changed', { sections: sections.map((section) => ({
        sectionId: section.id, courseCode: section.courseCode,
      })) }, studentId, key);
    });
  }

  registerSections(studentId: string, sectionIds: string[], idempotencyKey?: string) {
    const key = makeKey(idempotencyKey);
    const prior = this.eventByKey(key);
    if (prior) return { event: prior, duplicate: true, sections: this.getStudent(studentId)?.currentRegisteredSections ?? [] };
    return this.transaction(() => {
      const calendar = this.getCalendar();
      if (!calendar.registrationOpen) throw new Error('REGISTRATION_CLOSED');
      const profile = this.getStudent(studentId);
      if (!profile) throw new Error('STUDENT_NOT_FOUND');
      if (new Set(sectionIds).size !== sectionIds.length) throw new Error('DUPLICATE_SECTION');
      const rows = sectionIds.map((id) => this.db.prepare(
        'SELECT section_id, course_code, term_code, data_json FROM offerings WHERE section_id = ?',
      ).get(id) as { section_id: string; course_code: string; term_code: string; data_json: string } | undefined);
      if (rows.some((row) => !row)) throw new Error('SECTION_NOT_FOUND');
      const sections = rows.map((row) => ({ ...row!, data: JSON.parse(row!.data_json) as Record<string, unknown> }));
      const registeredIds = new Set(profile.currentRegisteredSections.map((section) => section.id));
      const courses = this.listCourses();
      const nextSections: CourseSection[] = [];
      for (const row of sections) {
        const data = row.data;
        if (row.term_code !== calendar.currentTerm.code) throw new Error('WRONG_TERM');
        if (!registeredIds.has(row.section_id) && (data.status !== 'متاحة' || Number(data.available) <= 0)) throw new Error('SECTION_FULL');
        const course = courses.find((item) => item.code === row.course_code);
        if (!course || profile.completedCourses.includes(row.course_code)) throw new Error('COURSE_NOT_ELIGIBLE');
        const prerequisites = Array.isArray(course.prerequisites) ? course.prerequisites as string[] : [];
        if (prerequisites.some((code) => !profile.completedCourses.includes(code))) throw new Error('PREREQUISITES_NOT_MET');
        nextSections.push({
          id: row.section_id, courseCode: row.course_code, courseName: String(data.course_name),
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

      const previousById = new Map(profile.currentRegisteredSections.map((section) => [section.id, section]));
      const nextById = new Map(nextSections.map((section) => [section.id, section]));
      const changedSections: Array<{ id: string; enrolled: number }> = [];
      for (const id of new Set([...previousById.keys(), ...nextById.keys()])) {
        if (previousById.has(id) === nextById.has(id)) continue;
        const record = this.db.prepare('SELECT term_code, data_json FROM offerings WHERE section_id = ?').get(id) as
          | { term_code: string; data_json: string }
          | undefined;
        if (!record) continue;
        const data = JSON.parse(record.data_json) as Record<string, unknown>;
        const delta = nextById.has(id) ? 1 : -1;
        const enrolled = Math.max(0, Math.min(Number(data.capacity), Number(data.enrolled) + delta));
        data.enrolled = enrolled;
        data.available = Number(data.capacity) - enrolled;
        data.status = enrolled >= Number(data.capacity) ? 'ممتلئة' : 'متاحة';
        this.db.prepare('UPDATE offerings SET data_json = ?, updated_at = ? WHERE section_id = ?')
          .run(JSON.stringify(data), currentTime(), id);
        changedSections.push({ id, enrolled });
        this.appendEvent('offering.updated', { sectionId: id, courseCode: data.course_code, termCode: record.term_code,
          enrolled, available: data.available, capacity: data.capacity, status: data.status }, undefined, `${key}:section:${id}`);
      }
      profile.currentRegisteredSections = nextSections;
      this.db.prepare('UPDATE students SET profile_json = ?, updated_at = ? WHERE student_id = ?')
        .run(JSON.stringify(profile), currentTime(), studentId);
      const event = this.appendEvent('schedule.changed', { sections: nextSections.map((section) => ({
        sectionId: section.id, courseCode: section.courseCode,
      })), totalHours }, studentId, key);
      return { event, duplicate: false, sections: nextSections, changedSections };
    });
  }

  setRegistration(open: boolean, start?: string | null, end?: string | null, idempotencyKey?: string) {
    const key = makeKey(idempotencyKey);
    const prior = this.eventByKey(key);
    if (prior) return { calendar: this.getCalendar(), event: prior };
    const calendar = this.getCalendar();
    calendar.registrationOpen = open;
    calendar.registrationWindow = { start: start ?? calendar.registrationWindow.start, end: end ?? calendar.registrationWindow.end };
    return this.transaction(() => {
      this.db.prepare('UPDATE calendar SET data_json = ?, updated_at = ? WHERE id = 1').run(JSON.stringify(calendar), currentTime());
      const type: UniEventType = open ? 'registration.opened' : 'registration.closed';
      const event = this.appendEvent(type, { currentTerm: calendar.currentTerm, registrationWindow: calendar.registrationWindow }, undefined,
        key);
      return { calendar, event };
    });
  }

  updateOffering(sectionId: string, patch: Record<string, unknown>, action: 'update' | 'open' | 'close' | 'fill', idempotencyKey?: string) {
    const key = makeKey(idempotencyKey);
    const prior = this.eventByKey(key);
    if (prior) {
      const sectionRow = this.db.prepare('SELECT data_json FROM offerings WHERE section_id = ?').get(sectionId) as { data_json: string } | undefined;
      return { section: sectionRow ? JSON.parse(sectionRow.data_json) as Record<string, unknown> : null, event: prior, duplicate: true };
    }
    const row = this.db.prepare('SELECT term_code, data_json FROM offerings WHERE section_id = ?').get(sectionId) as
      | { term_code: string; data_json: string }
      | undefined;
    if (!row) throw new Error('SECTION_NOT_FOUND');
    const section = JSON.parse(row.data_json) as Record<string, unknown>;
    const editableFields = ['capacity', 'enrolled', 'days', 'days_array', 'start_time', 'end_time', 'room', 'instructor', 'status'];
    if (action === 'fill') {
      section.enrolled = Number(section.capacity);
      section.available = 0;
      section.status = 'ممتلئة';
    } else if (action === 'open') {
      if (Number(section.capacity) <= Number(section.enrolled)) throw new Error('NO_SEATS');
      section.status = 'متاحة';
      section.available = Number(section.capacity) - Number(section.enrolled);
    } else if (action === 'close') {
      section.status = 'مغلقة';
      section.available = 0;
    } else {
      for (const field of editableFields) if (field in patch) section[field] = patch[field];
      const capacity = Number(section.capacity);
      const enrolled = Number(section.enrolled);
      if (!Number.isFinite(capacity) || !Number.isFinite(enrolled) || capacity < 0 || enrolled < 0 || enrolled > capacity) {
        throw new Error('INVALID_CAPACITY');
      }
      section.available = capacity - enrolled;
      if (section.status !== 'مغلقة') section.status = section.available === 0 ? 'ممتلئة' : 'متاحة';
    }
    const type: UniEventType = action === 'open' ? 'section.opened' : action === 'close' || action === 'fill'
      ? 'section.closed' : 'offering.updated';
    return this.transaction(() => {
      this.db.prepare('UPDATE offerings SET data_json = ?, updated_at = ? WHERE section_id = ?')
        .run(JSON.stringify(section), currentTime(), sectionId);
      const event = this.appendEvent(type, { sectionId, courseCode: section.course_code, termCode: row.term_code,
        capacity: section.capacity, enrolled: section.enrolled, available: section.available, days: section.days,
        startTime: section.start_time, endTime: section.end_time, room: section.room, instructor: section.instructor,
        status: section.status }, undefined, key);
      return { section, event, duplicate: false };
    });
  }

  deliveryBatch() {
    return this.db.prepare(
      'SELECT cursor, id, event_type, version, occurred_at, student_id, payload_json, idempotency_key, attempts FROM events WHERE delivered_at IS NULL AND next_attempt_at <= ? ORDER BY cursor LIMIT 25',
    ).all(currentTime()) as Array<{
      cursor: number; id: string; event_type: UniEventType; version: number; occurred_at: string;
      student_id: string | null; payload_json: string; idempotency_key: string; attempts: number;
    }>;
  }

  markDelivery(cursor: number, status: number | null, delivered: boolean) {
    const row = this.db.prepare('SELECT attempts FROM events WHERE cursor = ?').get(cursor) as { attempts: number } | undefined;
    if (!row) return;
    const attempts = row.attempts + 1;
    const delaySeconds = Math.min(60, 2 ** Math.min(attempts, 6));
    this.db.prepare('UPDATE events SET attempts = ?, last_status = ?, delivered_at = ?, next_attempt_at = ? WHERE cursor = ?')
      .run(attempts, status, delivered ? currentTime() : null,
        new Date(Date.now() + delaySeconds * 1000).toISOString(), cursor);
  }

  close() { this.db.close(); }
}
