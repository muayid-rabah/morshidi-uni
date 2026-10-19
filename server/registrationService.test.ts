import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { CurriculumDefinition } from './curriculum/curriculum';
import { SQLiteUniversityRepository } from './repositories/sqliteUniversityRepository';
import { RegistrationService } from './registration/registrationService';
import { UniversityStore } from './store';
import type { StudentProfile } from '../src/types/student';
import { createUniversityServer } from './index';
import { issueIntegrationToken } from './auth/integrationToken';
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const identities = [
  ['209900001', 'ZU:IT:AI:P12'], ['209900002', 'ZU:IT:SE:P12'], ['209900003', 'ZU:IT:CS:P12'],
  ['209900004', 'ZU:IT:CYBER:P12'], ['209900005', 'ZU:SCI:MATH:P12'], ['209900006', 'ZU:SCI:PHYS:P12'],
  ['209900007', 'ZU:ARTS:ARABIC:P12'], ['209900008', 'ZU:ARTS:ENGLISH:P12'], ['209900009', 'ZU:ARTS:HISTORY:P12'],
  ['209900010', 'ZU:ARTS:TRANS:P12'], ['209900011', 'ZU:BUS:ECON:P12'], ['209900012', 'ZU:BUS:BBA:P12'],
  ['209900013', 'ZU:BUS:ACC:P12'], ['209900014', 'ZU:MEDIA:DJOURN:P12'], ['209900015', 'ZU:MEDIA:RTV:P12'],
  ['209900016', 'ZU:LAW:LAW:P12'], ['209900017', 'ZU:NURS:NURS:P12'],
] as const;

function profile(studentId: string, planKey: string): StudentProfile {
  const [, facultyCode, majorCode] = planKey.split(':');
  return {
    id: studentId, universityId: studentId, name: `Student ${studentId}`, faculty: facultyCode,
    major: majorCode, degree: 'Bachelor', studyType: 'Regular', admissionYear: 2026,
    studyPlan: 'Plan 12', planKey, planNumber: '12', facultyCode, majorCode,
    totalRequiredCredits: 132, requirementGroupCredits: {}, academicAdvisor: 'Demo Advisor',
    academicStatus: 'Freshman', profileType: 'freshman', profileDescription: 'Synthetic test student',
    earnedCredits: 0, completedCourses: [], currentRegisteredSections: [], semesterHistory: [],
    absences: [], exams: [], financialSummary: { previousBalance: 0, totalFees: 0, totalPayments: 0, totalDiscounts: 0, currentBalance: 0 },
    transactions: [],
  };
}

describe('authoritative multi-plan registration service', () => {
  let store: UniversityStore;
  let service: RegistrationService;
  let app: FastifyInstance;

  before(() => {
    store = new UniversityStore(':memory:', false);
    const now = new Date().toISOString();
    store.db.prepare('INSERT INTO calendar(id, data_json, updated_at) VALUES (1, ?, ?)').run(JSON.stringify({
      currentTerm: { code: '2026-1', label: 'الفصل الأول 2026/2027' }, registrationOpen: true,
      registrationWindow: { start: '2026-09-20T00:00:00Z', end: '2026-10-31T23:59:59Z' }, nextTerm: null,
    }), now);
    const insertStudent = store.db.prepare('INSERT INTO students(student_id, profile_json, record_json, updated_at) VALUES (?, ?, ?, ?)');
    const insertCourse = store.db.prepare('INSERT INTO courses(course_code, data_json, updated_at) VALUES (?, ?, ?)');
    const insertPlan = store.db.prepare('INSERT INTO curriculum_plans(plan_key, data_json, updated_at) VALUES (?, ?, ?)');
    const insertOffering = store.db.prepare('INSERT INTO offerings(section_id, course_code, term_code, data_json, updated_at) VALUES (?, ?, ?, ?, ?)');
    identities.forEach(([studentId, planKey], index) => {
      const courseCode = `T${String(index + 1).padStart(2, '0')}100`;
      const sectionId = `SEC-${courseCode}-1`;
      const student = profile(studentId, planKey);
      const [, facultyCode, majorCode] = planKey.split(':');
      const course = { code: courseCode, name: `Course ${index + 1}`, credits: 3, group: 'MAJOR_REQUIRED', type: 'REQUIRED', prerequisites: [], learningType: 'LECTURE' };
      const curriculum: CurriculumDefinition = {
        identity: { institutionId: 'ZU', facultyCode, majorCode, planNumber: '12', planKey },
        faculty: facultyCode, major: majorCode, totalRequiredCredits: 132, requirementGroups: [], courses: [course],
      };
      const record = { student_id: studentId, plan_key: planKey, plan_number: '12', faculty_code: facultyCode, major_code: majorCode, attempts: [], marker: `unchanged-${studentId}` };
      const offering = { id: sectionId, course_code: courseCode, course_name: course.name, section_number: 1, credits: 3,
        instructor: 'Demo Instructor', days: 'Sun', days_array: ['الأحد'], start_time: '08:00', end_time: '09:00',
        room: 'D-1', capacity: 2, enrolled: 0, available: 2, status: 'متاحة' };
      insertStudent.run(studentId, JSON.stringify(student), JSON.stringify(record), now);
      insertCourse.run(courseCode, JSON.stringify(course), now);
      insertPlan.run(planKey, JSON.stringify(curriculum), now);
      insertOffering.run(sectionId, courseCode, '2026-1', JSON.stringify(offering), now);
    });
    service = new RegistrationService(new SQLiteUniversityRepository(store));
    app = createUniversityServer({ store, servePortal: false, startWebhookWorker: false, logger: false,
      morshidiClientId: 'morshidi-test', morshidiClientSecret: 'registration-client-secret-123456789',
      morshidiTokenSecret: 'registration-token-secret-1234567890' });
  });

  after(async () => app.close());

  test('all 17 curricula load context, isolate offerings, preview, register, reject duplicate, and drop without changing academic records', async () => {
    for (let index = 0; index < identities.length; index += 1) {
      const [studentId, planKey] = identities[index];
      const ownCode = `T${String(index + 1).padStart(2, '0')}100`;
      const sectionId = `SEC-${ownCode}-1`;
      const recordBefore = structuredClone(store.getStudentRecord(studentId));
      const context = await service.context(studentId);
      assert.equal(context.planKey, planKey);
      const offerings = await service.offerings(studentId);
      assert.deepEqual(new Set(offerings.map((item) => item.courseCode)), new Set([ownCode]));
      const preview = await service.preview(studentId, [sectionId]);
      assert.equal(preview.canRegister, true);
      const registered = await service.register(studentId, [sectionId], `register-${studentId}`);
      assert.equal(registered.success, true);
      assert.equal(store.eventByKey(`register-${studentId}:audit`)?.payload.outcome, 'CONFIRMED');
      assert.equal(store.getStudent(studentId)?.currentRegisteredSections.length, 1);
      const retried = await service.register(studentId, [sectionId], `register-${studentId}`);
      assert.equal(retried.success, true);
      if (retried.success) assert.equal(retried.duplicate, true);
      const duplicate = await service.preview(studentId, [sectionId]);
      assert.equal(duplicate.issues.some((item) => item.code === 'ALREADY_REGISTERED'), true);
      const dropped = await service.drop(studentId, sectionId, `drop-${studentId}`);
      assert.equal(dropped.success, true);
      assert.equal(store.eventByKey(`drop-${studentId}:audit`)?.payload.outcome, 'CONFIRMED');
      const dropRetry = await service.drop(studentId, sectionId, `drop-${studentId}`);
      assert.equal(dropRetry.success, true);
      if (dropRetry.success) assert.equal(dropRetry.duplicate, true);
      assert.equal(store.getStudent(studentId)?.currentRegisteredSections.length, 0);
      assert.deepEqual(store.getStudentRecord(studentId), recordBefore);
    }
  });

  test('foreign-plan section fails closed and does not mutate enrollment', async () => {
    const result = await service.preview(identities[0][0], ['SEC-T02100-1']);
    assert.equal(result.canRegister, false);
    assert.equal(result.issues.some((item) => item.code === 'COURSE_NOT_OFFERED'), true);
    assert.equal(store.getStudent(identities[0][0])?.currentRegisteredSections.length, 0);
  });

  test('integration routes derive ownership from token and server-mediated exchange requires client authentication', async () => {
    const exchanged = await app.inject({ method: 'POST', url: '/api/integrations/morshidi/v1/auth/exchange',
      headers: { 'x-morshidi-client-id': 'morshidi-test', 'x-morshidi-client-secret': 'registration-client-secret-123456789', 'content-type': 'application/json' },
      payload: { studentId: identities[0][0] } });
    assert.equal(exchanged.statusCode, 200);
    assert.equal(typeof exchanged.json().accessToken, 'string');
    const denied = await app.inject({ method: 'POST', url: '/api/integrations/morshidi/v1/auth/exchange', payload: { studentId: identities[0][0] } });
    assert.equal(denied.statusCode, 401);

    const issued = await issueIntegrationToken({ studentId: identities[0][0] }, { secret: 'registration-token-secret-1234567890' });
    assert.equal(issued.success, true);
    if (!issued.success) return;
    const response = await app.inject({ method: 'GET',
      url: `/api/integrations/morshidi/v1/student/registration/context?studentId=${identities[1][0]}`,
      headers: { authorization: `Bearer ${issued.accessToken}` } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().context.planKey, identities[0][1]);
  });

  test('capacity allocation is atomic in SQLite and only one student can take a final seat', async () => {
    const sharedCode = 'SHARED100';
    const sharedSection = 'SEC-SHARED100-1';
    const now = new Date().toISOString();
    const course = { code: sharedCode, name: 'Shared Course', credits: 3, group: 'UNIVERSITY_REQUIRED', type: 'REQUIRED', prerequisites: [], learningType: 'LECTURE' };
    store.db.prepare('INSERT INTO courses(course_code, data_json, updated_at) VALUES (?, ?, ?)').run(sharedCode, JSON.stringify(course), now);
    for (const [, planKey] of identities.slice(0, 2)) {
      const curriculum = store.getCurriculum(planKey)!;
      curriculum.courses.push(course);
      store.db.prepare('UPDATE curriculum_plans SET data_json = ? WHERE plan_key = ?').run(JSON.stringify(curriculum), planKey);
    }
    const offering = { id: sharedSection, course_code: sharedCode, course_name: 'Shared Course', section_number: 1, credits: 3,
      instructor: 'Demo', days: 'Mon', days_array: ['الاثنين'], start_time: '10:00', end_time: '11:00', room: 'D-2',
      capacity: 1, enrolled: 0, available: 1, status: 'متاحة' };
    store.db.prepare('INSERT INTO offerings(section_id, course_code, term_code, data_json, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(sharedSection, sharedCode, '2026-1', JSON.stringify(offering), now);
    const first = await service.register(identities[0][0], [sharedSection], 'final-seat-one');
    const second = await service.register(identities[1][0], [sharedSection], 'final-seat-two');
    assert.equal(first.success, true);
    assert.equal(second.success, false);
    if (!second.success) assert.equal(second.preview.issues.some((item) => item.code === 'SECTION_FULL'), true);
    assert.equal(store.eventByKey('final-seat-two:audit')?.payload.outcome, 'REJECTED');
  });

  test('review-required, prerequisites, conflicts, credit limits, invalid sections, and closed windows fail closed', async () => {
    const studentId = identities[2][0];
    const planKey = identities[2][1];
    const curriculum = store.getCurriculum(planKey)!;
    const now = new Date().toISOString();
    const courses = [
      { code: 'BLOCK200', name: 'Blocked', credits: 3, group: 'MAJOR_REQUIRED', type: 'REQUIRED', prerequisites: ['MISSING100'], learningType: 'LECTURE' },
      { code: 'REVIEW200', name: 'Review', credits: 3, group: 'MAJOR_REQUIRED', type: 'REQUIRED', prerequisites: [], reviewRequired: true, reviewReason: 'Unresolved AND/OR rule', learningType: 'LECTURE' },
      { code: 'CONFLICT100', name: 'Conflict', credits: 3, group: 'MAJOR_REQUIRED', type: 'REQUIRED', prerequisites: [], learningType: 'LECTURE' },
      { code: 'MULTI100', name: 'Multi-block', credits: 3, group: 'MAJOR_REQUIRED', type: 'REQUIRED', prerequisites: [], learningType: 'LECTURE' },
    ];
    curriculum.courses.push(...courses);
    store.db.prepare('UPDATE curriculum_plans SET data_json = ? WHERE plan_key = ?').run(JSON.stringify(curriculum), planKey);
    const insertCourse = store.db.prepare('INSERT INTO courses(course_code, data_json, updated_at) VALUES (?, ?, ?)');
    const insertOffering = store.db.prepare('INSERT INTO offerings(section_id, course_code, term_code, data_json, updated_at) VALUES (?, ?, ?, ?, ?)');
    courses.forEach((course, index) => {
      insertCourse.run(course.code, JSON.stringify(course), now);
      const section = { id: `SEC-${course.code}-1`, course_code: course.code, course_name: course.name, section_number: 1,
        credits: 3, instructor: 'Demo', days: 'Sun', days_array: ['الأحد'], start_time: index === 2 ? '08:30' : '12:00',
        end_time: index === 2 ? '09:30' : '13:00', room: 'D-3', capacity: 10, enrolled: 0, available: 10, status: 'متاحة' };
      insertOffering.run(section.id, course.code, '2026-1', JSON.stringify(section), now);
    });
    const prereq = await service.preview(studentId, ['SEC-BLOCK200-1']);
    assert.equal(prereq.issues.some((item) => item.code === 'NOT_ELIGIBLE'), true);
    const review = await service.preview(studentId, ['SEC-REVIEW200-1']);
    assert.equal(review.issues.some((item) => item.code === 'REVIEW_REQUIRED'), true);
    const invalid = await service.preview(studentId, ['NO-SUCH-SECTION']);
    assert.equal(invalid.issues.some((item) => item.code === 'INVALID_SECTION'), true);

    const original = store.getStudent(studentId)!;
    original.currentRegisteredSections = [{ id: 'EXISTING', courseCode: 'EXISTING', courseName: 'Existing', sectionNumber: 1,
      credits: 18, instructor: 'Demo', days: 'Sun', daysArray: ['الأحد'], startTime: '08:00', endTime: '09:00', room: 'D-0',
      capacity: 10, enrolled: 1, status: 'متاحة' }];
    store.db.prepare('UPDATE students SET profile_json = ? WHERE student_id = ?').run(JSON.stringify(original), studentId);
    const overloaded = await service.preview(studentId, ['SEC-CONFLICT100-1']);
    assert.equal(overloaded.issues.some((item) => item.code === 'CREDIT_LIMIT_EXCEEDED'), true);
    assert.equal(overloaded.issues.some((item) => item.code === 'SCHEDULE_CONFLICT'), true);
    const multiRow = store.db.prepare('SELECT data_json FROM offerings WHERE section_id = ?').get('SEC-MULTI100-1') as { data_json: string };
    const multi = JSON.parse(multiRow.data_json);
    multi.days_array = ['الاثنين'];
    multi.start_time = '14:00';
    multi.end_time = '15:00';
    multi.meetings = [{ day: 'الأحد', startTime: '08:30', endTime: '09:30' }, { day: 'الاثنين', startTime: '14:00', endTime: '15:00' }];
    store.db.prepare('UPDATE offerings SET data_json = ? WHERE section_id = ?').run(JSON.stringify(multi), 'SEC-MULTI100-1');
    const multiBlock = await service.preview(studentId, ['SEC-MULTI100-1']);
    assert.equal(multiBlock.issues.some((item) => item.code === 'SCHEDULE_CONFLICT'), true);

    const calendar = store.getCalendar();
    calendar.registrationOpen = false;
    store.db.prepare('UPDATE calendar SET data_json = ? WHERE id = 1').run(JSON.stringify(calendar));
    const closed = await service.preview(studentId, ['SEC-CONFLICT100-1']);
    assert.equal(closed.issues.some((item) => item.code === 'REGISTRATION_CLOSED'), true);
    calendar.registrationOpen = true;
    store.db.prepare('UPDATE calendar SET data_json = ? WHERE id = 1').run(JSON.stringify(calendar));
  });
});

test('registration migration keeps audit RPC service-only and demo offerings canonical', () => {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261019143000_registration_audit_and_demo_offerings.sql'), 'utf8');
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.university_record_registration_audit[\s\S]*anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.university_record_registration_audit[\s\S]*to service_role/i);
  assert.match(sql, /from public\.curriculum_plan_courses/i);
  assert.match(sql, /jsonb_array_length\(pc\.prerequisite_codes\) = 0/i);
  assert.match(sql, /coalesce\(pc\.review_required, false\) = false/i);
  assert.doesNotMatch(sql, /grant execute[\s\S]{0,160}to (anon|authenticated)/i);
});

