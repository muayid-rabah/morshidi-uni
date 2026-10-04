import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createUniversityServer } from './index';
import { safeEqual, signWebhook, UniversityStore } from './store';

let store: UniversityStore;
let app: ReturnType<typeof createUniversityServer>;
let studentId: string;
let otherStudentId: string;

beforeEach(async () => {
  store = new UniversityStore(':memory:');
  [studentId, otherStudentId] = store.listStudents().map((student) => student.universityId);
  app = createUniversityServer({
    store,
    servePortal: false,
    startWebhookWorker: false,
    serviceSecret: 'test-service-secret',
    adminUserIds: ['admin-user'],
    verifyUser: async (token) => {
      if (token === 'student') return { id: 'student-user', email: `${studentId}@std.morshidi.edu.jo` };
      if (token === 'other') return { id: 'other-user', email: `${otherStudentId}@std.morshidi.edu.jo` };
      if (token === 'admin') return { id: 'admin-user', email: 'admin@morshidi.edu.jo' };
      return null;
    },
  });
});

afterEach(async () => {
  await app.close();
});

test('student reads only their own profile and record', async () => {
  const own = await app.inject({ method: 'GET', url: `/v1/students/${studentId}`, headers: { authorization: 'Bearer student' } });
  assert.equal(own.statusCode, 200);
  assert.equal((own.json() as { universityId: string }).universityId, studentId);

  const ownRecord = await app.inject({ method: 'GET', url: `/v1/students/${studentId}/records`, headers: { authorization: 'Bearer student' } });
  assert.equal(ownRecord.statusCode, 200);
  assert.equal((ownRecord.json() as { student_id: string }).student_id, studentId);

  const crossStudent = await app.inject({ method: 'GET', url: `/v1/students/${otherStudentId}`, headers: { authorization: 'Bearer student' } });
  assert.equal(crossStudent.statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: `/v1/students/${studentId}` })).statusCode, 401);
});

test('admin grade mutations are idempotent and update records before emitting events', async () => {
  const courseCode = String(store.listCourses()[0].code);
  const request = {
    method: 'POST' as const,
    url: '/v1/admin/grades',
    headers: { authorization: 'Bearer admin', 'idempotency-key': 'grade-test-1' },
    payload: { studentId, courseCode, grade: 91, letterGrade: 'A' },
  };
  const first = await app.inject(request);
  assert.equal(first.statusCode, 201);
  assert.equal((first.json() as { duplicate: boolean }).duplicate, false);
  const cursorAfterFirst = store.cursor();
  assert.equal(cursorAfterFirst, 2, 'one grade mutation emits grade.posted and record.updated');

  const duplicate = await app.inject(request);
  assert.equal(duplicate.statusCode, 200);
  assert.equal((duplicate.json() as { duplicate: boolean }).duplicate, true);
  assert.equal(store.cursor(), cursorAfterFirst);
  assert.equal(store.getStudentRecord(studentId)?.cumulative_gpa,
    store.getStudent(studentId)?.semesterHistory.at(-1)?.cumulativeGpa);

  const events = store.eventsSince(0);
  assert.deepEqual(events.map((event) => event.type), ['grade.posted', 'record.updated']);
  assert.deepEqual(events.map((event) => event.version), [1, 2]);
});

test('unauthorized users cannot post grades or read the service event feed', async () => {
  const deniedGrade = await app.inject({ method: 'POST', url: '/v1/admin/grades', headers: { authorization: 'Bearer student' },
    payload: { studentId, courseCode: String(store.listCourses()[0].code), grade: 88 } });
  assert.equal(deniedGrade.statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/events?since=0' })).statusCode, 401);
  const service = await app.inject({ method: 'GET', url: '/v1/events?since=0', headers: { 'x-uni-api-key': 'test-service-secret' } });
  assert.equal(service.statusCode, 200);
  assert.deepEqual((service.json() as { events: unknown[] }).events, []);
});

test('Morshidi service key reads the live student contract without exposing it publicly', async () => {
  const denied = await app.inject({ method: 'GET', url: `/v1/integration/students/${studentId}` });
  assert.equal(denied.statusCode, 401);
  const response = await app.inject({ method: 'GET', url: `/v1/integration/students/${studentId}`,
    headers: { 'x-uni-api-key': 'test-service-secret' } });
  assert.equal(response.statusCode, 200);
  const value = response.json() as { profile: { universityId: string }; record: { student_id: string }; synthetic: boolean };
  assert.equal(value.profile.universityId, studentId);
  assert.equal(value.record.student_id, studentId);
  assert.equal(value.synthetic, true);
  const manifest = await app.inject({ method: 'GET', url: '/v1/manifest' });
  assert.equal((manifest.json() as { schema_version: string }).schema_version, '1.0.0');
});

test('production can start without loading synthetic student or course fixtures', async () => {
  const emptyStore = new UniversityStore(':memory:', false);
  const emptyApp = createUniversityServer({ store: emptyStore, servePortal: false, startWebhookWorker: false });
  try {
    assert.equal(emptyStore.hasAcademicData(), false);
    assert.equal((await emptyApp.inject({ method: 'GET', url: '/v1/calendar' })).statusCode, 503);
    assert.equal((await emptyApp.inject({ method: 'GET', url: '/v1/courses' })).statusCode, 503);
  } finally {
    await emptyApp.close();
  }
});

test('calendar owns current term and duplicate registration commands do not append events', async () => {
  const before = store.getCalendar();
  assert.ok(before.currentTerm.code);
  assert.notEqual(before.currentTerm.code, '2024-1');
  const first = store.setRegistration(true, '2026-10-05T00:00:00Z', '2026-10-10T00:00:00Z', 'registration-open-1');
  const cursor = store.cursor();
  const retry = store.setRegistration(true, null, null, 'registration-open-1');
  assert.equal(retry.event.id, first.event.id);
  assert.equal(store.cursor(), cursor);
  assert.equal(retry.calendar.registrationOpen, true);
  assert.equal(store.eventsSince(0)[0].type, 'registration.opened');
});

test('section updates are idempotent and service signatures are tamper evident', () => {
  const sectionId = String(store.listOfferings()[0].id);
  const original = store.listOfferings()[0];
  const capacity = Number(original.capacity);
  store.updateOffering(sectionId, { capacity: capacity + 1 }, 'update', 'section-update-1');
  const cursor = store.cursor();
  const retry = store.updateOffering(sectionId, { capacity: capacity + 10 }, 'update', 'section-update-1');
  assert.equal(retry.duplicate, true);
  assert.equal(store.cursor(), cursor);
  assert.equal(Number(retry.section?.capacity), capacity + 1);

  const body = JSON.stringify({ id: 'e1', type: 'grade.posted' });
  const signature = signWebhook(body, 'shared-secret');
  assert.ok(safeEqual(signature, signWebhook(body, 'shared-secret')));
  assert.ok(!safeEqual(signature, signWebhook(`${body} `, 'shared-secret')));
});
