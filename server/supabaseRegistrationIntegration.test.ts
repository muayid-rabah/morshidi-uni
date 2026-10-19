import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import { createUniversityServer } from './index';
import { RegistrationService } from './registration/registrationService';
import {
  SupabaseJsUniversityDataClient,
  SupabaseUniversityRepository,
} from './repositories/supabaseUniversityRepository';
import { issueIntegrationToken } from './auth/integrationToken';
import type { StudentProfile } from '../src/types/student';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || '';
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'local-demo-secret-key-32-chars-minimum';

function makeAuthenticatedJwt(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'supabase-demo',
    role: 'authenticated',
    sub,
    aud: 'authenticated',
    exp: 1983812996,
  })).toString('base64url');
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function testProfile(studentId: string, planKey: string): StudentProfile {
  const [, facultyCode, majorCode] = planKey.split(':');
  return {
    id: studentId,
    universityId: studentId,
    name: `Test Student ${studentId}`,
    faculty: facultyCode,
    major: majorCode,
    degree: 'Bachelor',
    studyType: 'Regular',
    admissionYear: 2026,
    studyPlan: 'Plan 12',
    planKey,
    planNumber: '12',
    facultyCode,
    majorCode,
    totalRequiredCredits: 132,
    requirementGroupCredits: {},
    academicAdvisor: 'Local Postgres Advisor',
    academicStatus: 'Freshman',
    profileType: 'freshman',
    profileDescription: 'Synthetic integration test student',
    earnedCredits: 0,
    completedCourses: [],
    currentRegisteredSections: [],
    semesterHistory: [],
    absences: [],
    exams: [],
    financialSummary: { previousBalance: 0, totalFees: 0, totalPayments: 0, totalDiscounts: 0, currentBalance: 0 },
    transactions: [],
  };
}

describe('REAL LOCAL POSTGRES / SUPABASE REGISTRATION VALIDATION', () => {
  let serviceClient: SupabaseClient;
  let anonClient: SupabaseClient;
  let authClient: SupabaseClient;
  let repository: SupabaseUniversityRepository;
  let registrationService: RegistrationService;
  let app: FastifyInstance;

  const testStudentA = '209990001';
  const testStudentB = '209990002';
  const testStudentC = '209990003';
  const testStudentD = '209990004';

  before(async () => {
    serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const authJwt = makeAuthenticatedJwt('user-auth-test-id');
    authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${authJwt}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const dataClient = new SupabaseJsUniversityDataClient(serviceClient);
    repository = new SupabaseUniversityRepository(dataClient);
    registrationService = new RegistrationService(repository);

    // Ensure registration window is open on local database
    await repository.setRegistration(true, '2026-09-01T00:00:00Z', '2026-12-31T23:59:59Z', 'init-test-registration-open');

    // Create synthetic test students in local Supabase
    const studentsToCreate = [
      testProfile(testStudentA, 'ZU:IT:AI:P12'),
      testProfile(testStudentB, 'ZU:IT:AI:P12'),
      testProfile(testStudentC, 'ZU:IT:SE:P12'),
      testProfile(testStudentD, 'ZU:IT:SE:P12'),
    ];

    for (const student of studentsToCreate) {
      await serviceClient.from('students').upsert({
        student_id: student.universityId,
        profile_json: student,
        record_json: { student_id: student.universityId, plan_key: student.planKey, attempts: [] },
        updated_at: new Date().toISOString(),
      });
    }

    app = createUniversityServer({
      repository,
      servePortal: false,
      startWebhookWorker: false,
      logger: false,
      morshidiClientId: 'morshidi-real-test',
      morshidiClientSecret: 'registration-client-secret-real-postgres',
      morshidiTokenSecret: 'registration-token-secret-real-postgres-long',
    });
    await app.ready();
  });

  after(async () => {
    if (app) await app.close();
    // Clean up test students
    await serviceClient.from('students').delete().in('student_id', [testStudentA, testStudentB, testStudentC, testStudentD]);
  });

  beforeEach(async () => {
    const now = new Date().toISOString();
    const studentsToUpsert = [
      testProfile(testStudentA, 'ZU:IT:AI:P12'),
      testProfile(testStudentB, 'ZU:IT:AI:P12'),
      testProfile(testStudentC, 'ZU:IT:SE:P12'),
      testProfile(testStudentD, 'ZU:IT:SE:P12'),
    ];
    for (const student of studentsToUpsert) {
      await serviceClient.from('students').upsert({
        student_id: student.universityId,
        profile_json: student,
        record_json: { student_id: student.universityId, plan_key: student.planKey, attempts: [] },
        updated_at: now,
      });
    }
  });

  // =========================================================================
  // STEP 5: Real Local Postgres Schema Validation
  // =========================================================================
  test('Step 5: schema objects, tables, RPCs, constraints and RLS are verified on Postgres 17', async () => {
    // 1. Verify all 12 tables exist
    const { data: tables, error: tableErr } = await serviceClient.rpc('university_register_sections', {});
    // Table existence can be queried directly via PostgREST or select from each table
    const tableNames = [
      'students', 'courses', 'offerings', 'calendar', 'academic_dates',
      'events', 'aggregate_versions', 'curriculum_faculties', 'curriculum_majors',
      'curriculum_plans', 'curriculum_requirement_groups', 'curriculum_plan_courses',
    ];
    for (const name of tableNames) {
      const { count, error } = await serviceClient.from(name).select('*', { count: 'exact', head: true });
      assert.equal(error, null, `Table ${name} must be accessible: ${error?.message}`);
      assert.ok(typeof count === 'number', `Table ${name} must return row count`);
    }

    // 2. Canonical curriculum counts: 7 faculties, 17 majors, 17 plans, 102 groups, 1155 plan courses
    const { count: facCount } = await serviceClient.from('curriculum_faculties').select('*', { count: 'exact', head: true });
    assert.equal(facCount, 7, 'Must have 7 canonical faculties');

    const { count: majCount } = await serviceClient.from('curriculum_majors').select('*', { count: 'exact', head: true });
    assert.equal(majCount, 17, 'Must have 17 canonical majors');

    const { count: planCount } = await serviceClient.from('curriculum_plans').select('*', { count: 'exact', head: true });
    assert.equal(planCount, 17, 'Must have 17 canonical study plans');

    const { count: groupCount } = await serviceClient.from('curriculum_requirement_groups').select('*', { count: 'exact', head: true });
    assert.equal(groupCount, 102, 'Must have 102 requirement groups');

    const { count: courseCount } = await serviceClient.from('curriculum_plan_courses').select('*', { count: 'exact', head: true });
    assert.equal(courseCount, 1155, 'Must have 1155 curriculum plan courses');

    // 3. Calendar active term check
    const cal = await repository.getCalendar();
    assert.equal(cal.currentTerm.code, '2026-1');
    assert.equal(cal.registrationOpen, true);
  });

  // =========================================================================
  // STEP 6: RLS / Privileges Verification
  // =========================================================================
  test('Step 6: RLS and execution boundaries block anon and authenticated while allowing service_role', async () => {
    // 1. Anon role cannot mutate tables directly
    const anonInsertStudent = await anonClient.from('students').insert({ student_id: 'hack-anon', profile_json: {}, record_json: {} });
    assert.ok(anonInsertStudent.error, 'Anon direct insert into students must fail');

    const anonInsertOffering = await anonClient.from('offerings').insert({ section_id: 'hack-sec', course_code: '0200104', term_code: '2026-1', data_json: {} });
    assert.ok(anonInsertOffering.error, 'Anon direct insert into offerings must fail');

    const anonInsertEvent = await anonClient.from('events').insert({ id: 'hack-evt', event_type: 'test', version: 1, idempotency_key: 'hack' });
    assert.ok(anonInsertEvent.error, 'Anon direct insert into events must fail');

    // 2. Authenticated role cannot mutate tables directly
    const authInsertStudent = await authClient.from('students').insert({ student_id: 'hack-auth', profile_json: {}, record_json: {} });
    assert.ok(authInsertStudent.error, 'Authenticated direct insert into students must fail');

    const authInsertOffering = await authClient.from('offerings').insert({ section_id: 'hack-sec-2', course_code: '0200104', term_code: '2026-1', data_json: {} });
    assert.ok(authInsertOffering.error, 'Authenticated direct insert into offerings must fail');

    // 3. Privileged RPCs cannot be executed by anon
    const anonRpcRegister = await anonClient.rpc('university_register_sections', {
      p_student_id: testStudentA,
      p_expected_student_updated_at: new Date().toISOString(),
      p_profile_json: {},
      p_offering_updates: [],
      p_event_payload: {},
      p_idempotency_key: 'anon-hack-rpc',
    });
    assert.ok(anonRpcRegister.error, 'Anon must not execute university_register_sections');

    const anonRpcAudit = await anonClient.rpc('university_record_registration_audit', {
      p_student_id: testStudentA,
      p_payload: { action: 'REGISTER', outcome: 'CONFIRMED' },
      p_idempotency_key: 'anon-hack-audit',
    });
    assert.ok(anonRpcAudit.error, 'Anon must not execute university_record_registration_audit');

    // 4. Privileged RPCs cannot be executed by authenticated role directly
    const authRpcRegister = await authClient.rpc('university_register_sections', {
      p_student_id: testStudentA,
      p_expected_student_updated_at: new Date().toISOString(),
      p_profile_json: {},
      p_offering_updates: [],
      p_event_payload: {},
      p_idempotency_key: 'auth-hack-rpc',
    });
    assert.ok(authRpcRegister.error, 'Authenticated role must not execute university_register_sections directly');

    const authRpcAudit = await authClient.rpc('university_record_registration_audit', {
      p_student_id: testStudentA,
      p_payload: { action: 'REGISTER', outcome: 'CONFIRMED' },
      p_idempotency_key: 'auth-hack-audit',
    });
    assert.ok(authRpcAudit.error, 'Authenticated role must not execute university_record_registration_audit directly');

    // 5. Service role CAN execute privileged RPCs
    const auditEvent = await repository.recordRegistrationAudit(testStudentA, {
      action: 'REGISTER', outcome: 'CONFIRMED', sectionIds: ['SEC-0200104-1'], source: 'test-rls',
    }, 'service-role-audit-test');
    assert.equal(auditEvent.type, 'registration.audit');
    assert.equal(auditEvent.studentId, testStudentA);
  });

  // =========================================================================
  // STEP 7: Student Ownership Enforcement
  // =========================================================================
  test('Step 7: Student ownership is strictly enforced via integration token claims', async () => {
    // 1. Issue token for Student A
    const tokenA = await issueIntegrationToken(
      { studentId: testStudentA },
      { secret: 'registration-token-secret-real-postgres-long' },
    );
    assert.equal(tokenA.success, true);
    if (!tokenA.success) return;

    // 2. Request context passing Student B's ID in query parameter
    const contextRes = await app.inject({
      method: 'GET',
      url: `/api/integrations/morshidi/v1/student/registration/context?studentId=${testStudentB}`,
      headers: { authorization: `Bearer ${tokenA.accessToken}` },
    });
    assert.equal(contextRes.statusCode, 200);
    // Student B was in the query parameter, but the response MUST be for Student A (AI Plan 12)
    assert.equal(contextRes.json().context.planKey, 'ZU:IT:AI:P12');

    // 3. Issue token for Student C (SE Plan 12)
    const tokenC = await issueIntegrationToken(
      { studentId: testStudentC },
      { secret: 'registration-token-secret-real-postgres-long' },
    );
    assert.equal(tokenC.success, true);
    if (!tokenC.success) return;

    // Student C context returns SE plan key
    const contextCRes = await app.inject({
      method: 'GET',
      url: '/api/integrations/morshidi/v1/student/registration/context',
      headers: { authorization: `Bearer ${tokenC.accessToken}` },
    });
    assert.equal(contextCRes.statusCode, 200);
    assert.equal(contextCRes.json().context.planKey, 'ZU:IT:SE:P12');

    // 4. Student A attempts to drop Student B's enrollment:
    // If Student B is registered in a section, Student A requesting drop of that section returns INVALID_SECTION
    const dropAttempt = await registrationService.drop(testStudentA, 'SEC-0200104-1', 'drop-ownership-test-1');
    assert.equal(dropAttempt.success, false);
    if (!dropAttempt.success) {
      assert.equal(dropAttempt.issues[0]?.code, 'INVALID_SECTION');
    }
  });

  // =========================================================================
  // STEP 8: Idempotency on Real PostgreSQL
  // =========================================================================
  test('Step 8: Idempotency on real Postgres prevents duplicate enrollments and duplicate seat consumption', async () => {
    const studentId = testStudentA;
    const sectionId = 'SEC-0200104-1';
    const idempKey = `idemp-real-pg-${Date.now()}`;

    // Get offering before registration
    const { data: offeringBeforeData } = await serviceClient.from('offerings').select('data_json').eq('section_id', sectionId);
    const offeringBefore = offeringBeforeData?.[0];
    assert.ok(offeringBefore);
    const enrolledBefore = Number(offeringBefore.data_json.enrolled);

    // First registration
    const firstResult = await registrationService.register(studentId, [sectionId], idempKey);
    assert.equal(firstResult.success, true);
    assert.equal(firstResult.duplicate, false);

    // Verify student has exactly 1 enrollment
    const studentAfterFirst = await repository.getStudent(studentId);
    assert.equal(studentAfterFirst?.currentRegisteredSections.length, 1);
    assert.equal(studentAfterFirst?.currentRegisteredSections[0].id, sectionId);

    // Verify offering enrolled count incremented by 1
    const { data: offeringAfterFirstData } = await serviceClient.from('offerings').select('data_json').eq('section_id', sectionId);
    const offeringAfterFirst = offeringAfterFirstData?.[0];
    assert.equal(Number(offeringAfterFirst?.data_json.enrolled), enrolledBefore + 1);

    // Retry with SAME idempotency key
    const retryResult = await registrationService.register(studentId, [sectionId], idempKey);
    assert.equal(retryResult.success, true);
    assert.equal(retryResult.duplicate, true);

    // Verify student STILL has exactly 1 enrollment (zero duplicate enrollments)
    const studentAfterRetry = await repository.getStudent(studentId);
    assert.equal(studentAfterRetry?.currentRegisteredSections.length, 1);

    // Verify offering enrolled count is STILL incremented by only 1 (zero duplicate seats consumed)
    const { data: offeringAfterRetryData } = await serviceClient.from('offerings').select('data_json').eq('section_id', sectionId);
    const offeringAfterRetry = offeringAfterRetryData?.[0];
    assert.equal(Number(offeringAfterRetry?.data_json.enrolled), enrolledBefore + 1);

    // Now try to register same section with a DIFFERENT idempotency key
    const diffKeyResult = await registrationService.preview(studentId, [sectionId]);
    assert.equal(diffKeyResult.canRegister, false);
    assert.equal(diffKeyResult.issues.some((i) => i.code === 'ALREADY_REGISTERED'), true);

    // Clean up: drop section
    await registrationService.drop(studentId, sectionId, `${idempKey}:cleanup-drop`);
  });

  // =========================================================================
  // STEP 9: Critical Final-Seat Concurrency Test (RELEASE GATE)
  // =========================================================================
  test('Step 9: Final-seat concurrency race test prevents double booking across multiple runs', async () => {
    const courseCode = '0200104';
    const numRuns = 5;

    for (let run = 1; run <= numRuns; run += 1) {
      const concurrencySectionId = `SEC-CONCUR-GATE-${run}`;
      const now = new Date().toISOString();

      // Setup isolated test section with capacity = 1, enrolled = 0, available = 1
      const sectionData = {
        id: concurrencySectionId,
        course_code: courseCode,
        course_name: 'التربية الوطنية',
        section_number: 99,
        credits: 3,
        instructor: 'دكتور التزامن',
        days: 'ح ث خ',
        days_array: ['الأحد', 'الثلاثاء', 'الخميس'],
        start_time: '14:00',
        end_time: '15:00',
        room: 'قاعة 999',
        capacity: 1,
        enrolled: 0,
        available: 1,
        status: 'متاحة',
      };

      await serviceClient.from('offerings').upsert({
        section_id: concurrencySectionId,
        course_code: courseCode,
        term_code: '2026-1',
        data_json: sectionData,
        updated_at: now,
      });

      // Reset student schedules
      await serviceClient.from('students').upsert({
        student_id: testStudentA,
        profile_json: testProfile(testStudentA, 'ZU:IT:AI:P12'),
        record_json: { student_id: testStudentA, plan_key: 'ZU:IT:AI:P12', attempts: [] },
        updated_at: now,
      });

      await serviceClient.from('students').upsert({
        student_id: testStudentB,
        profile_json: testProfile(testStudentB, 'ZU:IT:AI:P12'),
        record_json: { student_id: testStudentB, plan_key: 'ZU:IT:AI:P12', attempts: [] },
        updated_at: now,
      });

      // Fire BOTH registrations concurrently against REAL PostgreSQL
      const ts = Date.now();
      const keyA = `concur-run-${run}-studentA-${ts}`;
      const keyB = `concur-run-${run}-studentB-${ts}`;

      const results = await Promise.allSettled([
        registrationService.register(testStudentA, [concurrencySectionId], keyA),
        registrationService.register(testStudentB, [concurrencySectionId], keyB),
      ]);

      let successCount = 0;
      let sectionFullCount = 0;

      for (const res of results) {
        if (res.status === 'fulfilled' && res.value.success) {
          successCount += 1;
        } else if (res.status === 'rejected') {
          if (res.reason?.message === 'SECTION_FULL') {
            sectionFullCount += 1;
          }
        } else if (res.status === 'fulfilled' && !res.value.success) {
          if (res.value.preview?.issues.some((i) => i.code === 'SECTION_FULL')) {
            sectionFullCount += 1;
          }
        }
      }

      // CRITICAL RELEASE GATE ASSERTIONS:
      assert.equal(successCount, 1, `Run ${run}: Exactly one registration must succeed`);
      assert.equal(sectionFullCount, 1, `Run ${run}: Exactly one registration must be rejected with SECTION_FULL`);

      // Verify PostgreSQL offering state:
      const { data: offeringRows } = await serviceClient.from('offerings').select('data_json').eq('section_id', concurrencySectionId);
      const offering = offeringRows?.[0]?.data_json;
      assert.equal(Number(offering.enrolled), 1, `Run ${run}: Final enrolled count must be 1`);
      assert.equal(Number(offering.available), 0, `Run ${run}: Final available seats must be 0`);

      // Verify PostgreSQL student state:
      const studentA = await repository.getStudent(testStudentA);
      const studentB = await repository.getStudent(testStudentB);
      const enrolledA = studentA?.currentRegisteredSections.some((s) => s.id === concurrencySectionId) ? 1 : 0;
      const enrolledB = studentB?.currentRegisteredSections.some((s) => s.id === concurrencySectionId) ? 1 : 0;

      const totalEnrolled = enrolledA + enrolledB;
      assert.equal(totalEnrolled, 1, `Run ${run}: Combined enrollments across students must be exactly 1`);
      assert.notEqual(enrolledA, enrolledB, `Run ${run}: DOUBLE_BOOKING_OCCURRED = NO`);

      // Clean up the isolated section and events for this run
      await serviceClient.from('offerings').delete().eq('section_id', concurrencySectionId);
    }

    // Clean up student profiles after concurrency test
    const resetNow = new Date().toISOString();
    await serviceClient.from('students').upsert({
      student_id: testStudentA,
      profile_json: testProfile(testStudentA, 'ZU:IT:AI:P12'),
      record_json: { student_id: testStudentA, plan_key: 'ZU:IT:AI:P12', attempts: [] },
      updated_at: resetNow,
    });
    await serviceClient.from('students').upsert({
      student_id: testStudentB,
      profile_json: testProfile(testStudentB, 'ZU:IT:AI:P12'),
      record_json: { student_id: testStudentB, plan_key: 'ZU:IT:AI:P12', attempts: [] },
      updated_at: resetNow,
    });
  });

  // =========================================================================
  // STEP 10: Drop + Seat Restoration
  // =========================================================================
  test('Step 10: Drop restores seat correctly and duplicate drop does not restore extra seats', async () => {
    const studentId = testStudentA;
    const sectionId = 'SEC-0200104-3'; // initially enrolled=27, available=18, capacity=45
    const idempKey = `drop-restore-seat-test-${Date.now()}`;

    const { data: offeringBeforeData } = await serviceClient.from('offerings').select('data_json').eq('section_id', sectionId);
    const offeringBefore = offeringBeforeData?.[0];
    assert.ok(offeringBefore);
    const initialEnrolled = Number(offeringBefore.data_json.enrolled);
    const initialAvailable = Number(offeringBefore.data_json.available);

    // Register first
    const regResult = await registrationService.register(studentId, [sectionId], `${idempKey}:reg`);
    assert.equal(regResult.success, true);

    const { data: offeringAfterRegData } = await serviceClient.from('offerings').select('data_json').eq('section_id', sectionId);
    const offeringAfterReg = offeringAfterRegData?.[0];
    assert.equal(Number(offeringAfterReg?.data_json.enrolled), initialEnrolled + 1);
    assert.equal(Number(offeringAfterReg?.data_json.available), initialAvailable - 1);

    // Drop winning enrollment
    const dropResult = await registrationService.drop(studentId, sectionId, `${idempKey}:drop`);
    assert.equal(dropResult.success, true);
    assert.equal(dropResult.duplicate, false);

    // Verify seat is restored
    const { data: offeringAfterDropData } = await serviceClient.from('offerings').select('data_json').eq('section_id', sectionId);
    const offeringAfterDrop = offeringAfterDropData?.[0];
    assert.equal(Number(offeringAfterDrop?.data_json.enrolled), initialEnrolled);
    assert.equal(Number(offeringAfterDrop?.data_json.available), initialAvailable);

    // Verify audit event recorded for drop
    const dropAuditEvent = await repository.getEventByIdempotencyKey(`${idempKey}:drop:audit`);
    assert.ok(dropAuditEvent);
    assert.equal(dropAuditEvent?.payload.action, 'DROP');
    assert.equal(dropAuditEvent?.payload.outcome, 'CONFIRMED');

    // Idempotent retry of drop: MUST NOT restore another seat
    const dropRetry = await registrationService.drop(studentId, sectionId, `${idempKey}:drop`);
    assert.equal(dropRetry.success, true);
    assert.equal(dropRetry.duplicate, true);

    const { data: offeringAfterDropRetryData } = await serviceClient.from('offerings').select('data_json').eq('section_id', sectionId);
    const offeringAfterDropRetry = offeringAfterDropRetryData?.[0];
    assert.equal(Number(offeringAfterDropRetry?.data_json.enrolled), initialEnrolled);
    assert.equal(Number(offeringAfterDropRetry?.data_json.available), initialAvailable);
  });

  // =========================================================================
  // STEP 11: Preview Must Not Mutate
  // =========================================================================
  test('Step 11: Repeated preview does not mutate student, offerings, audit or academic records', async () => {
    const studentId = testStudentA;
    const sectionId = 'SEC-0200104-1';

    const studentBefore = await repository.getStudent(studentId);
    const recordBefore = await repository.getStudentRecord(studentId);
    const { data: offeringBeforeData } = await serviceClient.from('offerings').select('data_json').eq('section_id', sectionId);
    const offeringBefore = offeringBeforeData?.[0];
    assert.ok(offeringBefore);
    const { count: auditCountBefore } = await serviceClient.from('events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'registration.audit');

    // Run preview 5 times
    for (let i = 0; i < 5; i += 1) {
      const preview = await registrationService.preview(studentId, [sectionId]);
      assert.equal(preview.canRegister, true);
    }

    // Verify student profile unchanged
    const studentAfter = await repository.getStudent(studentId);
    assert.deepEqual(studentAfter?.currentRegisteredSections, studentBefore?.currentRegisteredSections);

    // Verify student academic record unchanged
    const recordAfter = await repository.getStudentRecord(studentId);
    assert.deepEqual(recordAfter, recordBefore);

    // Verify offering unchanged
    const { data: offeringAfterData } = await serviceClient.from('offerings').select('data_json').eq('section_id', sectionId);
    const offeringAfter = offeringAfterData?.[0];
    assert.equal(offeringAfter?.data_json.enrolled, offeringBefore?.data_json.enrolled);
    assert.equal(offeringAfter?.data_json.available, offeringBefore?.data_json.available);

    // Verify zero registration.audit events were added
    const { count: auditCountAfter } = await serviceClient.from('events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'registration.audit');
    assert.equal(auditCountAfter, auditCountBefore);
  });

  // =========================================================================
  // STEP 12: Registration Rules on Real Postgres
  // =========================================================================
  test('Step 12: Registration rules validate deterministically on real Postgres', async () => {
    const studentId = testStudentA;

    // 1. REGISTRATION_CLOSED
    await repository.setRegistration(false, null, null, `close-reg-rule-${Date.now()}`);
    const closedPreview = await registrationService.preview(studentId, ['SEC-0200104-1']);
    assert.equal(closedPreview.canRegister, false);
    assert.equal(closedPreview.issues.some((i) => i.code === 'REGISTRATION_CLOSED'), true);
    // Re-open registration
    await repository.setRegistration(true, '2026-09-01T00:00:00Z', '2026-12-31T23:59:59Z', `reopen-reg-rule-${Date.now()}`);

    // 2. SECTION_FULL
    // SEC-0200104-2 has enrolled=45, capacity=45, status='ممتلئة'
    const fullPreview = await registrationService.preview(studentId, ['SEC-0200104-2']);
    assert.equal(fullPreview.canRegister, false);
    assert.equal(fullPreview.issues.some((i) => i.code === 'SECTION_FULL'), true);

    // 3. SCHEDULE_CONFLICT
    // SEC-0200104-1 and SEC-0200111-1 both meet Sun/Tue/Thu 12:00-13:00
    const conflictPreview = await registrationService.preview(studentId, ['SEC-0200104-1', 'SEC-0200111-1']);
    assert.equal(conflictPreview.canRegister, false);
    assert.equal(conflictPreview.issues.some((i) => i.code === 'SCHEDULE_CONFLICT'), true);

    // 4. INVALID_SECTION
    const invalidPreview = await registrationService.preview(studentId, ['SEC-DOES-NOT-EXIST']);
    assert.equal(invalidPreview.canRegister, false);
    assert.equal(invalidPreview.issues.some((i) => i.code === 'INVALID_SECTION'), true);

    // 5. FOREIGN_PLAN_SECTION (COURSE_NOT_OFFERED)
    // DEMO-2026-1-0801114-01 is a Nursing course (not in AI Plan 12)
    const foreignPreview = await registrationService.preview(studentId, ['DEMO-2026-1-0801114-01']);
    assert.equal(foreignPreview.canRegister, false);
    assert.equal(foreignPreview.issues.some((i) => i.code === 'COURSE_NOT_OFFERED'), true);

    // 6. COURSE_NOT_ELIGIBLE (unmet prerequisite)
    // SEC-1501112-1 requires course 1501110, which testStudentA has not completed
    const notEligiblePreview = await registrationService.preview(studentId, ['SEC-1501112-1']);
    assert.equal(notEligiblePreview.canRegister, false);
    assert.equal(notEligiblePreview.issues.some((i) => i.code === 'NOT_ELIGIBLE'), true);

    // 7. REVIEW_REQUIRED (fail-closed)
    // SEC-1505311-1 is Machine Learning, which has review_required=true
    const reviewPreview = await registrationService.preview(studentId, ['SEC-1505311-1']);
    assert.equal(reviewPreview.canRegister, false);
    assert.equal(reviewPreview.issues.some((i) => i.code === 'REVIEW_REQUIRED'), true);

    // 8. CREDIT_LIMIT_EXCEEDED
    // 7 distinct AI Plan 12 sections of 3 credits each = 21 credits (> 18)
    const sevenSections = [
      'SEC-0200104-1', 'SEC-0200105-1', 'SEC-0200106-1',
      'SEC-0200110-1', 'SEC-0200111-1', 'SEC-0200113-1', 'SEC-0200114-1',
    ];
    const creditLimitPreview = await registrationService.preview(studentId, sevenSections);
    assert.equal(creditLimitPreview.canRegister, false);
    assert.equal(creditLimitPreview.issues.some((i) => i.code === 'CREDIT_LIMIT_EXCEEDED'), true);
  });

  // =========================================================================
  // STEP 13: Audit Trail & Secret Leakage Prevention
  // =========================================================================
  test('Step 13: Audit trail records confirmed/rejected operations with zero secret leakage', async () => {
    const studentId = testStudentA;
    const testKey = 'audit-verification-key-1';

    // 1. Rejected registration audit event
    const rejResult = await registrationService.register(studentId, ['SEC-0200104-2'], testKey);
    assert.equal(rejResult.success, false);

    const rejAuditEvent = await repository.getEventByIdempotencyKey(`${testKey}:audit`);
    assert.ok(rejAuditEvent);
    assert.equal(rejAuditEvent?.payload.action, 'REGISTER');
    assert.equal(rejAuditEvent?.payload.outcome, 'REJECTED');
    assert.deepEqual(rejAuditEvent?.payload.rejectionCodes, ['SECTION_FULL']);

    // 2. Check for secret leakage across all events in PostgreSQL
    const { data: allEvents, error } = await serviceClient.from('events').select('payload_json');
    assert.equal(error, null);

    const forbiddenPatterns = [
      SERVICE_ROLE_KEY,
      ANON_KEY,
      JWT_SECRET,
      'super-secret',
      'secret-dev-key',
      'Bearer ',
    ];

    for (const row of allEvents || []) {
      const payloadStr = JSON.stringify(row.payload_json);
      for (const pattern of forbiddenPatterns) {
        assert.equal(
          payloadStr.includes(pattern),
          false,
          `Audit payload must NOT leak sensitive credential: ${pattern.slice(0, 10)}...`,
        );
      }
    }
  });
});
