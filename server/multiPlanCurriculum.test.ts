import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { issueIntegrationToken } from './auth/integrationToken';
import type { CurriculumDefinition } from './curriculum/curriculum';
import { createUniversityServer } from './index';
import { academicRecordFromProfile, UniversityStore } from './store';
import { calculateStudentProgress, getRegistrationEligibility } from '../src/services/academicEngine';
import type { PlanCourse } from '../src/types/student';

const tokenSecret = 'multi-plan-local-test-secret-1234567890';

const curricula: CurriculumDefinition[] = [
  {
    identity: { institutionId: 'ZU', facultyCode: 'IT', majorCode: 'SE', planNumber: '12', planKey: 'ZU:IT:SE:P12' },
    faculty: 'كلية تكنولوجيا المعلومات', major: 'هندسة البرمجيات', totalRequiredCredits: 132,
    requirementGroups: [],
    courses: [
      { code: 'SE100', name: 'Software Foundations', credits: 3, group: 'MAJOR_REQUIRED', type: 'نظري', prerequisites: [] },
      { code: 'SE200', name: 'Software Design', credits: 3, group: 'MAJOR_REQUIRED', type: 'نظري', prerequisites: ['SE100'] },
    ],
  },
  {
    identity: { institutionId: 'ZU', facultyCode: 'NURS', majorCode: 'NURS', planNumber: '12', planKey: 'ZU:NURS:NURS:P12' },
    faculty: 'كلية التمريض', major: 'التمريض', totalRequiredCredits: 129,
    requirementGroups: [],
    courses: [
      { code: 'NURS100', name: 'Nursing Foundations', credits: 3, group: 'MAJOR_REQUIRED', type: 'نظري', prerequisites: [] },
      { code: 'NURS200', name: 'Clinical Nursing', credits: 4, group: 'MAJOR_REQUIRED', type: 'عملي', prerequisites: ['NURS100'] },
    ],
  },
  {
    identity: { institutionId: 'ZU', facultyCode: 'LAW', majorCode: 'LAW', planNumber: '12', planKey: 'ZU:LAW:LAW:P12' },
    faculty: 'كلية الحقوق', major: 'الحقوق', totalRequiredCredits: 141,
    requirementGroups: [],
    courses: [{ code: 'LAW100', name: 'Law Foundations', credits: 3, group: 'MAJOR_REQUIRED', type: 'نظري', prerequisites: [] }],
  },
];

describe('multi-major curriculum identity and authenticated API contract', () => {
  let store: UniversityStore;
  let app: FastifyInstance;

  before(async () => {
    store = new UniversityStore(':memory:');
    const source = store.getStudent('202310001');
    assert.ok(source);
    const insertStudent = store.db.prepare(
      'INSERT INTO students(student_id, profile_json, record_json, updated_at) VALUES (?, ?, ?, ?)',
    );
    const insertCurriculum = store.db.prepare(
      'INSERT INTO curriculum_plans(plan_key, data_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(plan_key) DO UPDATE SET data_json = excluded.data_json',
    );
    const now = new Date().toISOString();
    for (const curriculum of curricula) {
      insertCurriculum.run(curriculum.identity.planKey, JSON.stringify(curriculum), now);
    }
    const students = [
      ['202620001', curricula[0], 'SE100'],
      ['202620002', curricula[1], 'NURS100'],
      ['202620003', curricula[2], 'LAW100'],
    ] as const;
    for (const [studentId, curriculum, completed] of students) {
      const profile = structuredClone(source);
      profile.universityId = studentId;
      profile.faculty = curriculum.faculty;
      profile.major = curriculum.major;
      profile.studyPlan = 'خطة 12';
      profile.planKey = curriculum.identity.planKey;
      profile.planNumber = curriculum.identity.planNumber;
      profile.facultyCode = curriculum.identity.facultyCode;
      profile.majorCode = curriculum.identity.majorCode;
      profile.completedCourses = [completed];
      profile.currentRegisteredSections = [];
      profile.semesterHistory = [];
      insertStudent.run(studentId, JSON.stringify(profile), JSON.stringify({
        student_id: studentId,
        plan_id: '12',
        plan_number: '12',
        plan_key: curriculum.identity.planKey,
        faculty_code: curriculum.identity.facultyCode,
        major_code: curriculum.identity.majorCode,
        earned_credits: 3,
        cumulative_gpa: null,
      }), now);
    }
    app = createUniversityServer({
      store, servePortal: false, startWebhookWorker: false,
      morshidiTokenSecret: tokenSecret, logger: false,
    });
    await app.ready();
  });

  after(async () => { await app.close(); });

  async function get(studentId: string, path: string) {
    const issued = await issueIntegrationToken({ studentId }, { secret: tokenSecret });
    assert.equal(issued.success, true);
    if (!issued.success) throw new Error('token issue failed');
    return app.inject({ method: 'GET', url: `/api/integrations/morshidi/v1/student/${path}`,
      headers: { authorization: `Bearer ${issued.accessToken}` } });
  }

  test('same Plan 12 resolves to each student own plan, course membership, and credit total', async () => {
    for (const [studentId, curriculum] of [
      ['202620001', curricula[0]], ['202620002', curricula[1]], ['202620003', curricula[2]],
    ] as const) {
      const me = (await get(studentId, 'me')).json().student;
      assert.equal(me.planKey, curriculum.identity.planKey);
      assert.equal(me.planNumber, '12');
      assert.equal(me.majorCode, curriculum.identity.majorCode);

      const plan = (await get(studentId, 'academic-plan')).json().plan;
      assert.equal(plan.planKey, curriculum.identity.planKey);
      assert.equal(plan.totalRequiredCredits, curriculum.totalRequiredCredits);
      assert.deepEqual(plan.courses.map((course: { courseCode: string }) => course.courseCode),
        curriculum.courses.map((course) => course.code));

      const grouped = (await get(studentId, 'courses')).json().courses;
      const allCodes = [...grouped.completed, ...grouped.current, ...grouped.remaining]
        .map((course: { courseCode: string }) => course.courseCode);
      assert.deepEqual(new Set(allCodes), new Set(curriculum.courses.map((course) => course.code)));
      assert.equal(allCodes.some((code: string) => code.startsWith('1505')), false);
    }
  });

  test('authenticated token identity wins over owner-supplied student query parameters', async () => {
    const response = await get('202620002', 'academic-plan?studentId=202620001');
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().plan.planKey, 'ZU:NURS:NURS:P12');
  });

  test('unknown or malformed student curriculum identities fail closed', async () => {
    const row = store.db.prepare('SELECT record_json FROM students WHERE student_id = ?').get('202620003') as { record_json: string };
    const record = JSON.parse(row.record_json) as Record<string, unknown>;
    record.plan_key = 'ZU:LAW:UNKNOWN:P12';
    record.major_code = 'UNKNOWN';
    store.db.prepare('UPDATE students SET record_json = ? WHERE student_id = ?').run(JSON.stringify(record), '202620003');
    const unknown = await get('202620003', 'academic-plan');
    assert.equal(unknown.statusCode, 409);
    assert.equal(unknown.json().error, 'CURRICULUM_NOT_MAPPED');

    record.plan_key = 'not-a-plan-key';
    store.db.prepare('UPDATE students SET record_json = ? WHERE student_id = ?').run(JSON.stringify(record), '202620003');
    const malformed = await get('202620003', 'academic-plan');
    assert.equal(malformed.statusCode, 409);
    assert.equal(malformed.json().error, 'CURRICULUM_IDENTITY_INVALID');
  });

  test('portal progress totals and AI project-credit rules are curriculum scoped', () => {
    const nursing = store.getStudent('202620002');
    assert.ok(nursing);
    nursing.totalRequiredCredits = 129;
    nursing.requirementGroupCredits = { 'متطلبات التخصص الإجبارية': 66 };
    const nursingProject = {
      code: 'NURS499', name: 'مشروع التخرج في التمريض', credits: 3,
      group: 'متطلبات التخصص الإجبارية', type: 'إجباري', prerequisites: [], learningType: 'عملي',
    } satisfies PlanCourse;
    const progress = calculateStudentProgress(nursing, [nursingProject]);
    assert.equal(progress.totalPlanHours, 129);
    assert.equal(getRegistrationEligibility(nursingProject.code, nursing, [nursingProject]).state, 'ELIGIBLE');
    const derivedRecord = academicRecordFromProfile(nursing, '2026-1');
    assert.equal(derivedRecord.plan_key, 'ZU:NURS:NURS:P12');
    assert.equal(derivedRecord.plan_number, '12');
    assert.equal(derivedRecord.faculty_code, 'NURS');
    assert.equal(derivedRecord.major_code, 'NURS');
  });
});

test('curriculum migration is schema-only and locks tables to service-role access', () => {
  const sql = readFileSync(resolve(
    process.cwd(),
    'supabase/migrations/20261017155240_multi_plan_curriculum_foundation.sql',
  ), 'utf8');
  for (const table of [
    'curriculum_faculties', 'curriculum_majors', 'curriculum_plans',
    'curriculum_requirement_groups', 'curriculum_plan_courses',
  ]) {
    assert.match(sql, new RegExp(`create table(?: if not exists)? public\\.${table}`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`revoke all privileges on table public\\.${table} from anon, authenticated`, 'i'));
    assert.match(sql, new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role`, 'i'));
  }
  assert.doesNotMatch(sql, /\binsert\s+into\b/i);
});

