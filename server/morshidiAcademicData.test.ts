import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createUniversityServer } from './index';
import { UniversityStore } from './store';
import { issueIntegrationToken } from './auth/integrationToken';

describe('Morshidi Academic Data Integration Endpoints (Step 5)', () => {
  let store: UniversityStore;
  let app: ReturnType<typeof createUniversityServer>;

  const studentAId = '202310001';
  const studentBId = '202610005';
  const testTokenSecret = 'test-morshidi-academic-token-secret-999';
  const testClientId = 'morshidi';
  const testClientSecret = 'super-secret-morshidi-client-key-1234';
  const mockSupabaseUrl = 'https://mock.supabase.co';
  const mockSupabaseKey = 'mock-publishable-key';

  beforeEach(() => {
    store = new UniversityStore(':memory:');
    app = createUniversityServer({
      store,
      servePortal: false,
      startWebhookWorker: false,
      supabaseUrl: mockSupabaseUrl,
      supabaseKey: mockSupabaseKey,
      morshidiClientId: testClientId,
      morshidiClientSecret: testClientSecret,
      morshidiTokenSecret: testTokenSecret,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  // =========================================================================
  // A. /student/courses
  // =========================================================================
  describe('A. GET /student/courses', () => {
    it('1. valid token returns correct student courses with completed, current, and remaining groups', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/courses',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as {
        success: boolean;
        courses: {
          completed: Array<{ courseCode: string; name: string; credits: number; status: string }>;
          current: Array<{ courseCode: string; name: string; credits: number; status: string }>;
          remaining: Array<{ courseCode: string; name: string; credits: number; status: string }>;
        };
      };

      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.courses.completed));
      assert.ok(Array.isArray(body.courses.current));
      assert.ok(Array.isArray(body.courses.remaining));

      // Student A has completed courses
      assert.ok(body.courses.completed.length > 0);
      assert.equal(body.courses.completed[0].status, 'completed');
      assert.ok(body.courses.completed[0].courseCode);
      assert.ok(body.courses.completed[0].name);

      // Student A has current enrolled courses
      assert.ok(body.courses.current.length > 0);
      assert.equal(body.courses.current[0].status, 'enrolled');

      // Remaining courses exist
      assert.ok(body.courses.remaining.length > 0);
      assert.equal(body.courses.remaining[0].status, 'remaining');
    });

    it('2. completed, current, and remaining classifications are mutually exclusive', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/courses',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      const body = response.json() as {
        courses: {
          completed: Array<{ courseCode: string }>;
          current: Array<{ courseCode: string }>;
          remaining: Array<{ courseCode: string }>;
        };
      };

      const completedCodes = new Set(body.courses.completed.map((c) => c.courseCode));
      const currentCodes = new Set(body.courses.current.map((c) => c.courseCode));
      const remainingCodes = new Set(body.courses.remaining.map((c) => c.courseCode));

      for (const code of completedCodes) {
        assert.equal(currentCodes.has(code), false, `Course ${code} cannot be both completed and current`);
        assert.equal(remainingCodes.has(code), false, `Course ${code} cannot be both completed and remaining`);
      }
      for (const code of currentCodes) {
        assert.equal(remainingCodes.has(code), false, `Course ${code} cannot be both current and remaining`);
      }
    });

    it('3. cross-student security: injected query/body/header studentId cannot select another student', async () => {
      const tokenAResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenAResult.success, true);
      if (!tokenAResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: `/api/integrations/morshidi/v1/student/courses?studentId=${studentBId}&id=${studentBId}`,
        headers: {
          authorization: `Bearer ${tokenAResult.accessToken}`,
          'x-student-id': studentBId,
        },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as {
        courses: {
          completed: Array<{ courseCode: string }>;
        };
      };

      // Student A completed courses should be returned, not Student B's
      const profileA = store.getStudent(studentAId);
      assert.equal(body.courses.completed.length, profileA?.completedCourses.length);
    });

    it('4. security: response does not leak internal DB tables, credentials, or sensitive metadata', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/courses',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const raw = response.body;
      assert.equal(raw.includes('password'), false);
      assert.equal(raw.includes('profile_json'), false);
      assert.equal(raw.includes('record_json'), false);
      assert.equal(raw.includes('financialSummary'), false);
      assert.equal(raw.includes(testTokenSecret), false);
    });

    it('5. fresh university changes appear on next request without token reissuance', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      // Add a newly completed course to student A in the store
      const newCompletedCode = '0200114';
      const profile = store.getStudent(studentAId);
      assert.ok(profile);
      if (profile && !profile.completedCourses.includes(newCompletedCode)) {
        profile.completedCourses.push(newCompletedCode);
        store.db.prepare('UPDATE students SET profile_json = ? WHERE student_id = ?').run(JSON.stringify(profile), studentAId);
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/courses',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as {
        courses: { completed: Array<{ courseCode: string }> };
      };
      assert.ok(body.courses.completed.some((c) => c.courseCode === newCompletedCode));
    });
  });

  // =========================================================================
  // B. /student/grades
  // =========================================================================
  describe('B. GET /student/grades', () => {
    it('6. valid token returns correct grade history and authoritative GPA', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/grades',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as {
        success: boolean;
        cumulativeGpa: number;
        semesters: Array<{
          term: string;
          termLabel: string;
          semesterGpa: number;
          cumulativeGpa: number;
          courses: Array<{
            courseCode: string;
            name: string;
            credits: number;
            grade: number;
            letterGrade: string;
            status: string;
          }>;
        }>;
      };

      assert.equal(body.success, true);
      assert.ok(typeof body.cumulativeGpa === 'number');
      assert.ok(body.cumulativeGpa > 0);
      assert.ok(Array.isArray(body.semesters));
      assert.ok(body.semesters.length > 0);

      const firstSemester = body.semesters[0];
      assert.ok(firstSemester.term);
      assert.ok(firstSemester.termLabel);
      assert.ok(Array.isArray(firstSemester.courses));
      assert.ok(firstSemester.courses.length > 0);

      const firstCourse = firstSemester.courses[0];
      assert.ok(firstCourse.courseCode);
      assert.ok(firstCourse.name);
      assert.ok(typeof firstCourse.grade === 'number');
      assert.ok(typeof firstCourse.letterGrade === 'string');
      assert.ok(['passed', 'failed', 'withdrawn'].includes(firstCourse.status));
    });

    it('7. GPA comes from authoritative university academic record', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const record = store.getStudentRecord(studentAId);
      const expectedGpa = Number(record?.cumulative_gpa ?? 0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/grades',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as { cumulativeGpa: number };
      assert.equal(body.cumulativeGpa, expectedGpa);
    });

    it('8. grade information belongs only to authenticated student (cross-student attack has no effect)', async () => {
      const tokenAResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      const tokenBResult = await issueIntegrationToken({ studentId: studentBId }, { secret: testTokenSecret });
      assert.equal(tokenAResult.success, true);
      assert.equal(tokenBResult.success, true);
      if (!tokenAResult.success || !tokenBResult.success) return;

      const respA = await app.inject({
        method: 'GET',
        url: `/api/integrations/morshidi/v1/student/grades?studentId=${studentBId}`,
        headers: {
          authorization: `Bearer ${tokenAResult.accessToken}`,
          'x-student-id': studentBId,
        },
      });

      const respB = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/grades',
        headers: { authorization: `Bearer ${tokenBResult.accessToken}` },
      });

      assert.equal(respA.statusCode, 200);
      assert.equal(respB.statusCode, 200);

      const bodyA = respA.json() as { cumulativeGpa: number };
      const bodyB = respB.json() as { cumulativeGpa: number };

      const recordA = store.getStudentRecord(studentAId);
      const recordB = store.getStudentRecord(studentBId);

      assert.equal(bodyA.cumulativeGpa, recordA?.cumulative_gpa);
      assert.equal(bodyB.cumulativeGpa, recordB?.cumulative_gpa);
    });

    it('9. missing grade history returns safe empty structures when student has no semesters', async () => {
      // Modify a student in DB to have no semesterHistory
      const emptyStudentId = '202610005';
      const profile = store.getStudent(emptyStudentId);
      assert.ok(profile);
      if (profile) {
        profile.semesterHistory = [];
        store.db.prepare('UPDATE students SET profile_json = ? WHERE student_id = ?').run(JSON.stringify(profile), emptyStudentId);
      }

      const tokenResult = await issueIntegrationToken({ studentId: emptyStudentId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/grades',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as { success: boolean; semesters: unknown[] };
      assert.equal(body.success, true);
      assert.deepEqual(body.semesters, []);
    });

    it('10. security: no financial/auth/internal fields leak in grades response', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/grades',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const raw = response.body;
      assert.equal(raw.includes('financialSummary'), false);
      assert.equal(raw.includes('transactions'), false);
      assert.equal(raw.includes('access_token'), false);
      assert.equal(raw.includes('password'), false);
    });
  });

  // =========================================================================
  // C. /student/enrollments
  // =========================================================================
  describe('C. GET /student/enrollments', () => {
    it('11. returns current student registered sections for the active term', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/enrollments',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as {
        success: boolean;
        term: string;
        termLabel: string;
        enrollments: Array<{
          courseCode: string;
          courseName: string;
          sectionId: string;
          sectionNumber: number;
          credits: number;
          days: string;
          startTime: string;
          endTime: string;
          room: string;
          instructor: string;
        }>;
      };

      assert.equal(body.success, true);
      assert.ok(body.term);
      assert.ok(body.termLabel);
      assert.ok(Array.isArray(body.enrollments));
      assert.ok(body.enrollments.length > 0);

      const section = body.enrollments[0];
      assert.ok(section.courseCode);
      assert.ok(section.courseName);
      assert.ok(section.sectionId);
      assert.ok(typeof section.credits === 'number');
    });

    it('12. current term is resolved dynamically from university calendar state', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const calendar = store.getCalendar();

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/enrollments',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as { term: string; termLabel: string };
      assert.equal(body.term, calendar.currentTerm.code);
      assert.equal(body.termLabel, calendar.currentTerm.label);
    });

    it('13. empty enrollment list is handled as a valid empty collection', async () => {
      // Modify student in DB to have no registered sections
      const emptyStudentId = '202610005';
      const profile = store.getStudent(emptyStudentId);
      assert.ok(profile);
      if (profile) {
        profile.currentRegisteredSections = [];
        store.db.prepare('UPDATE students SET profile_json = ? WHERE student_id = ?').run(JSON.stringify(profile), emptyStudentId);
      }

      const tokenResult = await issueIntegrationToken({ studentId: emptyStudentId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/enrollments',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as { success: boolean; enrollments: unknown[] };
      assert.equal(body.success, true);
      assert.deepEqual(body.enrollments, []);
    });

    it('14. cross-student security: cannot request another student schedule', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: `/api/integrations/morshidi/v1/student/enrollments?studentId=${studentBId}`,
        headers: {
          authorization: `Bearer ${tokenResult.accessToken}`,
          'x-student-id': studentBId,
        },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as { enrollments: Array<{ sectionId: string }> };

      const profileA = store.getStudent(studentAId);
      assert.equal(body.enrollments.length, profileA?.currentRegisteredSections.length);
    });

    it('15. read-only guarantee: calling enrollments endpoint produces zero events or DB mutations', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const initialCursor = store.cursor();

      await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/enrollments',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      const finalCursor = store.cursor();
      assert.equal(initialCursor, finalCursor, 'No new event must be produced on read-only endpoint');
    });
  });

  // =========================================================================
  // D. /student/academic-plan
  // =========================================================================
  describe('D. GET /student/academic-plan', () => {
    it('16. returns authenticated student academic plan with total credits, earned credits, and remaining credits', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/academic-plan',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as {
        success: boolean;
        plan: {
          planId: string;
          major: string;
          totalRequiredCredits: number;
          earnedCredits: number;
          remainingCredits: number;
          courses: Array<{
            courseCode: string;
            name: string;
            credits: number;
            group: string;
            prerequisites: string[];
            status: string;
          }>;
        };
      };

      assert.equal(body.success, true);
      assert.ok(body.plan.planId);
      assert.ok(body.plan.major);
      assert.equal(body.plan.totalRequiredCredits, 132);
      assert.ok(typeof body.plan.earnedCredits === 'number');
      assert.ok(typeof body.plan.remainingCredits === 'number');
      assert.equal(body.plan.remainingCredits, body.plan.totalRequiredCredits - body.plan.earnedCredits);
      assert.ok(Array.isArray(body.plan.courses));
      assert.ok(body.plan.courses.length > 0);
    });

    it('17. prerequisites are mapped correctly from catalog', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/academic-plan',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      const body = response.json() as {
        plan: {
          courses: Array<{ courseCode: string; prerequisites: string[] }>;
        };
      };

      const courseWithPrereq = body.plan.courses.find((c) => c.courseCode === '0200105');
      assert.ok(courseWithPrereq);
      assert.ok(Array.isArray(courseWithPrereq.prerequisites));
      assert.ok(courseWithPrereq.prerequisites.includes('0200150'));
    });

    it('18. completed, current, and remaining course status is deterministic', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: '/api/integrations/morshidi/v1/student/academic-plan',
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });

      const body = response.json() as {
        plan: {
          courses: Array<{ courseCode: string; status: string }>;
        };
      };

      const profileA = store.getStudent(studentAId);
      assert.ok(profileA);
      const completedSet = new Set(profileA?.completedCourses);
      const currentSet = new Set(profileA?.currentRegisteredSections.map((s) => s.courseCode));

      for (const course of body.plan.courses) {
        if (completedSet.has(course.courseCode)) {
          assert.equal(course.status, 'completed');
        } else if (currentSet.has(course.courseCode)) {
          assert.equal(course.status, 'current');
        } else {
          assert.equal(course.status, 'remaining');
        }
      }
    });

    it('19. cross-student security: cannot request another student plan', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const response = await app.inject({
        method: 'GET',
        url: `/api/integrations/morshidi/v1/student/academic-plan?studentId=${studentBId}`,
        headers: {
          authorization: `Bearer ${tokenResult.accessToken}`,
          'x-student-id': studentBId,
        },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as { plan: { earnedCredits: number } };

      const recordA = store.getStudentRecord(studentAId);
      assert.equal(body.plan.earnedCredits, recordA?.earned_credits);
    });
  });

  // =========================================================================
  // E. Shared Authentication across all 4 endpoints
  // =========================================================================
  describe('E. Shared Authentication & Error Normalization', () => {
    const endpoints = [
      '/api/integrations/morshidi/v1/student/courses',
      '/api/integrations/morshidi/v1/student/grades',
      '/api/integrations/morshidi/v1/student/enrollments',
      '/api/integrations/morshidi/v1/student/academic-plan',
    ];

    const callGet = (targetApp: typeof app, url: string, token?: string) =>
      targetApp.inject({
        method: 'GET',
        url,
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
      });

    it('20. rejects missing Bearer token with 401 UNAUTHORIZED on all endpoints', async () => {
      for (const endpoint of endpoints) {
        const res = await callGet(app, endpoint);
        assert.equal(res.statusCode, 401, `${endpoint} must reject missing auth header with 401`);
        const body = res.json() as { success: boolean; error: string };
        assert.equal(body.success, false);
        assert.equal(body.error, 'UNAUTHORIZED');
      }
    });

    it('21. rejects tampered token with 401 UNAUTHORIZED on all endpoints', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const tamperedToken = `${tokenResult.accessToken.slice(0, -5)}abcde`;

      for (const endpoint of endpoints) {
        const res = await callGet(app, endpoint, tamperedToken);
        assert.equal(res.statusCode, 401, `${endpoint} must reject tampered token with 401`);
        const body = res.json() as { success: boolean; error: string };
        assert.equal(body.success, false);
        assert.equal(body.error, 'UNAUTHORIZED');
      }
    });

    it('22. rejects expired token with 401 TOKEN_EXPIRED on all endpoints', async () => {
      const expiredTokenResult = await issueIntegrationToken(
        { studentId: studentAId },
        { secret: testTokenSecret, expiresInSeconds: 60, nowInSeconds: 1700000000 },
      );
      assert.equal(expiredTokenResult.success, true);
      if (!expiredTokenResult.success) return;

      for (const endpoint of endpoints) {
        const res = await callGet(app, endpoint, expiredTokenResult.accessToken);
        assert.equal(res.statusCode, 401, `${endpoint} must return 401 TOKEN_EXPIRED`);
        const body = res.json() as { success: boolean; error: string };
        assert.equal(body.success, false);
        assert.equal(body.error, 'TOKEN_EXPIRED');
      }
    });

    it('23. rejects token with wrong audience or issuer with 401 UNAUTHORIZED on all endpoints', async () => {
      const badAudToken = await issueIntegrationToken(
        { studentId: studentAId },
        { secret: testTokenSecret, audience: 'wrong-audience' },
      );
      assert.equal(badAudToken.success, true);
      if (!badAudToken.success) return;

      for (const endpoint of endpoints) {
        const res = await callGet(app, endpoint, badAudToken.accessToken);
        assert.equal(res.statusCode, 401, `${endpoint} must return 401 UNAUTHORIZED`);
        const body = res.json() as { success: boolean; error: string };
        assert.equal(body.success, false);
        assert.equal(body.error, 'UNAUTHORIZED');
      }
    });

    it('24. returns 500 INTEGRATION_UNAVAILABLE when signing secret is unconfigured', async () => {
      const localStore = new UniversityStore(':memory:');
      const unconfiguredApp = createUniversityServer({
        store: localStore,
        servePortal: false,
        startWebhookWorker: false,
        supabaseUrl: mockSupabaseUrl,
        supabaseKey: mockSupabaseKey,
        morshidiClientId: testClientId,
        morshidiClientSecret: testClientSecret,
        morshidiTokenSecret: '', // Missing secret
      });

      try {
        for (const endpoint of endpoints) {
          const res = await unconfiguredApp.inject({
            method: 'GET',
            url: endpoint,
            headers: { authorization: 'Bearer some-test-token-123' },
          });
          assert.equal(res.statusCode, 500, `${endpoint} must return 500 when secret missing`);
          const body = res.json() as { success: boolean; error: string };
          assert.equal(body.success, false);
          assert.equal(body.error, 'INTEGRATION_UNAVAILABLE');
        }
      } finally {
        await unconfiguredApp.close();
      }
    });

    it('25. returns 404 STUDENT_NOT_FOUND when valid token references non-existent student', async () => {
      const nonExistentStudentId = '202999999';
      const tokenResult = await issueIntegrationToken({ studentId: nonExistentStudentId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      for (const endpoint of endpoints) {
        const res = await callGet(app, endpoint, tokenResult.accessToken);
        assert.equal(res.statusCode, 404, `${endpoint} must return 404 for missing student`);
        const body = res.json() as { success: boolean; error: string };
        assert.equal(body.success, false);
        assert.equal(body.error, 'STUDENT_NOT_FOUND');
      }
    });
  });

  // =========================================================================
  // F. Regression Check
  // =========================================================================
  describe('F. Regression Check', () => {
    it('26. single token can read /me and all 4 academic endpoints seamlessly', async () => {
      const tokenResult = await issueIntegrationToken({ studentId: studentAId }, { secret: testTokenSecret });
      assert.equal(tokenResult.success, true);
      if (!tokenResult.success) return;

      const authHeaders = { authorization: `Bearer ${tokenResult.accessToken}` };

      const meResp = await app.inject({ method: 'GET', url: '/api/integrations/morshidi/v1/student/me', headers: authHeaders });
      const coursesResp = await app.inject({ method: 'GET', url: '/api/integrations/morshidi/v1/student/courses', headers: authHeaders });
      const gradesResp = await app.inject({ method: 'GET', url: '/api/integrations/morshidi/v1/student/grades', headers: authHeaders });
      const enrollmentsResp = await app.inject({ method: 'GET', url: '/api/integrations/morshidi/v1/student/enrollments', headers: authHeaders });
      const planResp = await app.inject({ method: 'GET', url: '/api/integrations/morshidi/v1/student/academic-plan', headers: authHeaders });

      assert.equal(meResp.statusCode, 200);
      assert.equal(coursesResp.statusCode, 200);
      assert.equal(gradesResp.statusCode, 200);
      assert.equal(enrollmentsResp.statusCode, 200);
      assert.equal(planResp.statusCode, 200);
    });
  });
});
