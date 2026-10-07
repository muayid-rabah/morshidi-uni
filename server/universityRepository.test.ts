import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { UniversityStore, type UniEvent } from './store';
import { createUniversityRepository } from './repositories/createUniversityRepository';
import { SQLiteUniversityRepository } from './repositories/sqliteUniversityRepository';
import {
  SupabaseJsUniversityDataClient,
  SupabaseUniversityRepository,
  type CalendarSnapshot,
  type OfferingSnapshot,
  type RawEventRow,
  type StudentSnapshot,
  type UniversitySupabaseDataClient,
} from './repositories/supabaseUniversityRepository';
import type { UniversityRepository } from './repositories/universityRepository';

function rawEvent(event: UniEvent): RawEventRow {
  return {
    cursor: String(event.cursor),
    id: event.id,
    event_type: event.type,
    version: event.version,
    occurred_at: event.occurredAt,
    student_id: event.studentId ?? null,
    payload_json: event.payload,
    idempotency_key: event.idempotencyKey,
    attempts: 0,
  };
}

class SQLiteBackedSupabaseDataClient implements UniversitySupabaseDataClient {
  constructor(private readonly store: UniversityStore) {}

  async getStudent(studentId: string): Promise<StudentSnapshot | null> {
    const profile = this.store.getStudent(studentId);
    const record = this.store.getStudentRecord(studentId);
    return profile && record ? { studentId, profile, record, updatedAt: '2026-10-07T00:00:00.000Z' } : null;
  }
  async listStudents(): Promise<StudentSnapshot[]> {
    return this.store.listStudents().map((profile) => ({
      studentId: profile.universityId,
      profile,
      record: this.store.getStudentRecord(profile.universityId)!,
      updatedAt: '2026-10-07T00:00:00.000Z',
    }));
  }
  async listCourses() {
    return this.store.listCourses().map((data) => ({ courseCode: String(data.code), data }));
  }
  async getCourse(courseCode: string) { return this.store.getCourse(courseCode); }
  async listOfferings(termCode: string): Promise<OfferingSnapshot[]> {
    return this.store.listOfferings(termCode).map((data) => ({
      sectionId: String(data.id),
      courseCode: String(data.course_code),
      termCode,
      data,
      updatedAt: '2026-10-07T00:00:00.000Z',
    }));
  }
  async getOfferings(sectionIds: string[]): Promise<OfferingSnapshot[]> {
    const wanted = new Set(sectionIds);
    const term = this.store.getCalendar().currentTerm.code;
    return (await this.listOfferings(term)).filter((row) => wanted.has(row.sectionId));
  }
  async getCalendar(): Promise<CalendarSnapshot> {
    return { calendar: this.store.getCalendar(), updatedAt: '2026-10-07T00:00:00.000Z' };
  }
  async getAcademicDates() { return this.store.getAcademicDates(); }
  async hasCourses() { return this.store.hasAcademicData(); }
  async latestCursor() { return String(this.store.cursor()); }
  async eventsSince(since: number, limit: number) { return this.store.eventsSince(since, limit).map(rawEvent); }
  async eventByKey(key: string) {
    const event = this.store.eventsSince(0, 500).find((candidate) => candidate.idempotencyKey === key);
    return event ? rawEvent(event) : null;
  }
  async deliveryBatch(_now: string): Promise<RawEventRow[]> { return []; }
  async rpc(_name: string, _parameters: Record<string, unknown>): Promise<unknown> {
    throw new Error('RPC is not used by read parity tests.');
  }
}

describe('UniversityRepository read parity', () => {
  let store: UniversityStore | undefined;

  afterEach(() => {
    store?.close();
    store = undefined;
  });

  it('returns the same unwrapped shapes from SQLite and Supabase adapters', async () => {
    store = new UniversityStore(':memory:');
    store.setRegistration(true, null, null, 'repository-parity-event');
    const sqlite = new SQLiteUniversityRepository(store);
    const supabase = new SupabaseUniversityRepository(new SQLiteBackedSupabaseDataClient(store));
    const studentId = '202310001';
    const courseCode = String(store.listCourses()[0].code);

    assert.deepEqual(await supabase.getStudent(studentId), await sqlite.getStudent(studentId));
    assert.deepEqual(await supabase.getStudentRecord(studentId), await sqlite.getStudentRecord(studentId));
    assert.deepEqual(await supabase.listStudents(), await sqlite.listStudents());
    assert.deepEqual(await supabase.listCourses(), await sqlite.listCourses());
    assert.deepEqual(await supabase.getCourse(courseCode), await sqlite.getCourse(courseCode));
    assert.deepEqual(await supabase.listOfferings(), await sqlite.listOfferings());
    assert.deepEqual(await supabase.getCalendar(), await sqlite.getCalendar());
    assert.deepEqual(await supabase.getAcademicDates(), await sqlite.getAcademicDates());
    assert.equal(await supabase.cursor(), await sqlite.cursor());
    assert.deepEqual(await supabase.eventsSince(0), await sqlite.eventsSince(0));
  });

  it('rejects event cursors that cannot be represented safely as JavaScript numbers', async () => {
    store = new UniversityStore(':memory:');
    const data = new SQLiteBackedSupabaseDataClient(store);
    data.latestCursor = async () => (BigInt(Number.MAX_SAFE_INTEGER) + 1n).toString();
    const repository = new SupabaseUniversityRepository(data);
    await assert.rejects(repository.cursor(), /EVENT_CURSOR_OUT_OF_RANGE/);
  });

  it('normalizes RPC timestamps and preserves optional studentId event shape', async () => {
    store = new UniversityStore(':memory:');
    const data = new SQLiteBackedSupabaseDataClient(store);
    let includeStudent = false;
    data.rpc = async () => ({
      duplicate: false,
      event: {
        id: includeStudent ? 'student-event' : 'calendar-event',
        type: includeStudent ? 'plan.updated' : 'registration.opened',
        version: 1,
        occurredAt: '2026-10-07 12:34:56+00',
        ...(includeStudent ? { studentId: '202310001' } : {}),
        payload: { nullableValue: null },
        idempotencyKey: includeStudent ? 'student-key' : 'calendar-key',
        cursor: '42',
      },
    });
    const repository = new SupabaseUniversityRepository(data);

    const calendarResult = await repository.setRegistration(true, null, null, 'calendar-key');
    assert.equal(calendarResult.event.occurredAt, '2026-10-07T12:34:56.000Z');
    assert.equal('studentId' in calendarResult.event, false);
    assert.deepEqual(calendarResult.event.payload, { nullableValue: null });

    includeStudent = true;
    const studentEvent = await repository.updateStudentPlan('202310001', 'hardened-plan', 'student-key');
    assert.equal(studentEvent.occurredAt, '2026-10-07T12:34:56.000Z');
    assert.equal(studentEvent.studentId, '202310001');
    assert.equal(studentEvent.cursor, 42);
  });

  it('preserves transactional registration error codes from Supabase RPC failures', async () => {
    const rpcClient = (message: string) => new SupabaseJsUniversityDataClient({
      rpc: async () => ({ data: null, error: { message } }),
    } as never);

    await assert.rejects(rpcClient('REGISTRATION_CLOSED').rpc('university_register_sections', {}),
      (error: Error) => error.message === 'REGISTRATION_CLOSED');
    await assert.rejects(rpcClient('WRONG_TERM').rpc('university_register_sections', {}),
      (error: Error) => error.message === 'WRONG_TERM');
  });
});

describe('createUniversityRepository', () => {
  const repositories: UniversityRepository[] = [];

  afterEach(async () => {
    await Promise.all(repositories.splice(0).map((repository) => repository.close()));
  });

  it('defaults to SQLite when UNI_DATA_BACKEND is missing', () => {
    const repository = createUniversityRepository({ env: {}, databasePath: ':memory:' });
    repositories.push(repository);
    assert.ok(repository instanceof SQLiteUniversityRepository);
  });

  it('selects SQLite explicitly', () => {
    const repository = createUniversityRepository({ env: { UNI_DATA_BACKEND: 'sqlite' }, databasePath: ':memory:' });
    repositories.push(repository);
    assert.ok(repository instanceof SQLiteUniversityRepository);
  });

  it('selects Supabase only when required credentials are present', () => {
    const backingStore = new UniversityStore(':memory:');
    const dataClient = new SQLiteBackedSupabaseDataClient(backingStore);
    const repository = createUniversityRepository({
      env: {
        UNI_DATA_BACKEND: 'supabase',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'test-secret-placeholder',
      },
      supabaseDataClient: dataClient,
    });
    repositories.push({
      ...repository,
      close: async () => {
        await repository.close();
        backingStore.close();
      },
    } as UniversityRepository);
    assert.ok(repository instanceof SupabaseUniversityRepository);
  });

  it('fails fast for an unknown backend', () => {
    assert.throws(() => createUniversityRepository({ env: { UNI_DATA_BACKEND: 'other' } }),
      /Unsupported UNI_DATA_BACKEND/);
  });

  it('fails fast when Supabase mode has no secret key', () => {
    assert.throws(() => createUniversityRepository({
      env: { UNI_DATA_BACKEND: 'supabase', SUPABASE_URL: 'https://example.supabase.co' },
    }), /SUPABASE_SECRET_KEY is required/);
  });
});
