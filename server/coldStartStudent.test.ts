import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { demoStudents } from '../src/data/demoStudents';
import { createUniversityServer } from './index';
import { FAKE_UNIVERSITY_GRADING_POLICY } from './academic/gradingPolicy';
import { issueIntegrationToken } from './auth/integrationToken';
import {
  mapStudentGradesToMorshidi,
  mapStudentToMorshidiProfile,
} from './serializers/morshidiContract';
import { UniversityStore } from './store';

const COLD_START_ID = '202610099';
const EXISTING_STUDENT_ID = '202310001';
const CURRENT_COURSE_CODES = ['0300153', '0300101', '0200104', '0200110', '0200153'];
const TEST_TOKEN_SECRET = 'test-only-cold-start-token-secret-202610099';
const TEST_CLIENT_ID = 'morshidi';
const TEST_CLIENT_SECRET = 'test-only-cold-start-client-secret';
const MOCK_SUPABASE_URL = 'https://mock.supabase.co';
const MOCK_SUPABASE_KEY = 'mock-publishable-key';

interface ColdStartRecord {
  student_id: string;
  program_id: string;
  major_id: string;
  plan_id: string;
  plan_version_id: string;
  earned_credits: number;
  cumulative_gpa: number | null;
  semesters: unknown[];
  attempts: Array<{ numeric_grade?: number; letter_grade?: string; outcome?: string }>;
  current_registered_sections: Array<{ id: string; course_code: string }>;
}

function fixtureRecord(): ColdStartRecord {
  const fixture = JSON.parse(readFileSync(
    resolve(process.cwd(), 'server', 'seed-data', 'academic-records.json'),
    'utf8',
  )) as { records: ColdStartRecord[] };
  const record = fixture.records.find((item) => item.student_id === COLD_START_ID);
  assert.ok(record, `Missing academic record for ${COLD_START_ID}`);
  return record;
}

describe('Cold-start first-year student 202610099', () => {
  let store: UniversityStore;
  let app: ReturnType<typeof createUniversityServer>;

  beforeEach(() => {
    store = new UniversityStore(':memory:');
    app = createUniversityServer({
      store,
      servePortal: false,
      startWebhookWorker: false,
      supabaseUrl: MOCK_SUPABASE_URL,
      supabaseKey: MOCK_SUPABASE_KEY,
      morshidiClientId: TEST_CLIENT_ID,
      morshidiClientSecret: TEST_CLIENT_SECRET,
      morshidiTokenSecret: TEST_TOKEN_SECRET,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('has one unique fictional identity in both profile and authoritative fixture representations', () => {
    assert.equal(demoStudents.filter((student) => student.universityId === COLD_START_ID).length, 1);
    assert.equal(store.listStudents().filter((student) => student.universityId === COLD_START_ID).length, 1);

    const profile = store.getStudent(COLD_START_ID);
    const record = fixtureRecord();
    assert.ok(profile);
    assert.equal(profile.profileType, 'freshman');
    assert.equal(profile.admissionYear, 2026);
    assert.equal(profile.major, 'الذكاء الاصطناعي');
    assert.equal(profile.studyPlan, 'خطة 12');
    assert.equal(record.student_id, profile.universityId);
    assert.equal(record.major_id, 'AI');
    assert.equal(record.plan_id, '12');
    assert.equal(record.plan_version_id, 'PLAN-12-V1');
  });

  it('contains no historical performance, credits, grades, outcomes, or fabricated semester GPA', () => {
    const profile = store.getStudent(COLD_START_ID);
    const record = fixtureRecord();
    assert.ok(profile);

    assert.deepEqual(profile.completedCourses, []);
    assert.deepEqual(profile.semesterHistory, []);
    assert.equal(profile.earnedCredits, 0);
    assert.equal(record.earned_credits, 0);
    assert.equal(record.cumulative_gpa, null);
    assert.equal(record.semesters.length, 0);
    assert.equal(record.attempts.length, 0);
    assert.equal(record.attempts.filter((attempt) => attempt.outcome === 'PASSED').length, 0);
    assert.equal(record.attempts.filter((attempt) => attempt.outcome === 'FAILED').length, 0);
    assert.equal(record.attempts.filter((attempt) => typeof attempt.numeric_grade === 'number').length, 0);
    assert.equal(record.attempts.filter((attempt) => typeof attempt.letter_grade === 'string').length, 0);
    assert.equal(record.current_registered_sections.length, 5);
  });

  it('uses five distinct active Plan 12 offerings with no prerequisites', () => {
    const profile = store.getStudent(COLD_START_ID);
    assert.ok(profile);

    const enrolledCodes = profile.currentRegisteredSections.map((section) => section.courseCode);
    assert.deepEqual(enrolledCodes, CURRENT_COURSE_CODES);
    assert.equal(new Set(enrolledCodes).size, 5);

    const catalog = new Map(store.listCourses().map((course) => [String(course.code), course]));
    const offerings = new Map(store.listOfferings('2026-1').map((offering) => [String(offering.id), offering]));
    for (const section of profile.currentRegisteredSections) {
      const course = catalog.get(section.courseCode);
      const offering = offerings.get(section.id);
      assert.ok(course, `${section.courseCode} must exist in canonical Plan 12`);
      assert.deepEqual(course.prerequisites, [], `${section.courseCode} must be valid with zero history`);
      assert.ok(offering, `${section.id} must be offered in active term 2026-1`);
      assert.equal(offering.course_code, section.courseCode);
      assert.equal(offering.status, 'متاحة');
      assert.ok(Number(offering.available) > 0);
    }
  });

  it('is login-capable in test auth and returns exact cold-start endpoint contracts', async () => {
    let requestedEmail = '';
    const authStore = new UniversityStore(':memory:');
    const authApp = createUniversityServer({
      store: authStore,
      servePortal: false,
      startWebhookWorker: false,
      supabaseUrl: MOCK_SUPABASE_URL,
      supabaseKey: MOCK_SUPABASE_KEY,
      morshidiClientId: TEST_CLIENT_ID,
      morshidiClientSecret: TEST_CLIENT_SECRET,
      morshidiTokenSecret: TEST_TOKEN_SECRET,
      fetcher: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { email: string };
        requestedEmail = body.email;
        return new Response(JSON.stringify({
          access_token: 'test-only-provider-token',
          user: { id: 'test-only-cold-start-auth-id', email: body.email },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });

    try {
      const login = await authApp.inject({
        method: 'POST',
        url: '/api/integrations/morshidi/v1/auth/login',
        headers: {
          'content-type': 'application/json',
          'x-morshidi-client-id': TEST_CLIENT_ID,
          'x-morshidi-client-secret': TEST_CLIENT_SECRET,
        },
        payload: { studentId: COLD_START_ID, password: 'test-only-password' },
      });
      assert.equal(login.statusCode, 200);
      assert.equal(requestedEmail, `${COLD_START_ID}@std.morshidi.edu.jo`);
      assert.equal(login.json().student.studentId, COLD_START_ID);
    } finally {
      await authApp.close();
    }

    const tokenResult = await issueIntegrationToken(
      { studentId: COLD_START_ID },
      { secret: TEST_TOKEN_SECRET },
    );
    assert.equal(tokenResult.success, true);
    if (!tokenResult.success) return;
    const headers = { authorization: `Bearer ${tokenResult.accessToken}` };
    const baseUrl = '/api/integrations/morshidi/v1/student';

    const [meResponse, gradesResponse, enrollmentsResponse, planResponse] = await Promise.all([
      app.inject({ method: 'GET', url: `${baseUrl}/me`, headers }),
      app.inject({ method: 'GET', url: `${baseUrl}/grades`, headers }),
      app.inject({ method: 'GET', url: `${baseUrl}/enrollments`, headers }),
      app.inject({ method: 'GET', url: `${baseUrl}/academic-plan`, headers }),
    ]);

    assert.equal(meResponse.statusCode, 200);
    const me = meResponse.json();
    assert.equal(me.success, true);
    assert.equal(me.student.studentId, COLD_START_ID);
    assert.equal(me.student.gpa, null);
    assert.equal(me.student.gpaScale, 100);
    assert.equal(me.student.earnedCredits, 0);

    assert.equal(gradesResponse.statusCode, 200);
    const grades = gradesResponse.json();
    assert.deepEqual(grades, {
      success: true,
      cumulativeGpa: null,
      gpaScale: 100,
      gradingPolicy: FAKE_UNIVERSITY_GRADING_POLICY,
      semesters: [],
    });

    assert.equal(enrollmentsResponse.statusCode, 200);
    const enrollments = enrollmentsResponse.json();
    assert.equal(enrollments.success, true);
    assert.equal(enrollments.term, '2026-1');
    assert.deepEqual(enrollments.enrollments.map((item: { courseCode: string }) => item.courseCode), CURRENT_COURSE_CODES);

    assert.equal(planResponse.statusCode, 200);
    const plan = planResponse.json();
    assert.equal(plan.success, true);
    assert.equal(plan.plan.planId, '12');
    assert.equal(plan.plan.earnedCredits, 0);
    assert.equal(plan.plan.remainingCredits, 132);
    assert.deepEqual(
      plan.plan.courses.filter((course: { status: string }) => course.status === 'completed'),
      [],
    );
    assert.deepEqual(
      plan.plan.courses.filter((course: { status: string }) => course.status === 'current')
        .map((course: { courseCode: string }) => course.courseCode).sort(),
      [...CURRENT_COURSE_CODES].sort(),
    );
  });

  it('preserves null as no GPA and leaves existing student 202310001 unchanged', () => {
    const coldProfile = store.getStudent(COLD_START_ID);
    const coldRecord = store.getStudentRecord(COLD_START_ID);
    const existingProfile = store.getStudent(EXISTING_STUDENT_ID);
    const existingRecord = store.getStudentRecord(EXISTING_STUDENT_ID);
    assert.ok(coldProfile);
    assert.ok(existingProfile);

    const coldMe = mapStudentToMorshidiProfile(coldProfile, coldRecord);
    const coldGrades = mapStudentGradesToMorshidi(coldProfile, coldRecord);
    assert.strictEqual(coldMe.gpa, null);
    assert.strictEqual(coldGrades.cumulativeGpa, null);
    assert.notStrictEqual(coldMe.gpa, 0);
    assert.equal(coldGrades.semesters.length, 0);
    assert.equal(coldGrades.semesters.flatMap((semester) => semester.courses).length, 0);

    const existingMe = mapStudentToMorshidiProfile(existingProfile, existingRecord);
    const existingGrades = mapStudentGradesToMorshidi(existingProfile, existingRecord);
    assert.equal(existingMe.gpa, 93.6);
    assert.equal(existingMe.gpaScale, 100);
    assert.equal(existingMe.earnedCredits, 96);
    assert.equal(existingGrades.cumulativeGpa, 93.6);
    assert.equal(existingGrades.semesters.length, 5);
    assert.equal(existingGrades.semesters.flatMap((semester) => semester.courses).length, 32);
  });
});
