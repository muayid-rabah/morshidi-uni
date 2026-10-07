import { createClient } from '@supabase/supabase-js';
import { SupabaseJsUniversityDataClient, SupabaseUniversityRepository,
  type UniversitySupabaseDataClient } from '../server/repositories/supabaseUniversityRepository';
import { SQLiteUniversityRepository } from '../server/repositories/sqliteUniversityRepository';
import { UniversityStore } from '../server/store';

const STUDENT_ID = '202310001';
const COURSE_CODES = ['0200104', '1505211', '1506181'];
const EXPECTED_COUNTS = { students: 5, courses: 68, offerings: 204, academicDates: 8, events: 0 } as const;

interface Difference {
  path: string;
  sqlite: unknown;
  supabase: unknown;
}

function collectDifferences(sqlite: unknown, supabase: unknown, path: string, differences: Difference[]): void {
  if (Object.is(sqlite, supabase)) return;

  if (Array.isArray(sqlite) || Array.isArray(supabase)) {
    if (!Array.isArray(sqlite) || !Array.isArray(supabase)) {
      differences.push({ path, sqlite, supabase });
      return;
    }
    if (sqlite.length !== supabase.length) {
      differences.push({ path: `${path}.length`, sqlite: sqlite.length, supabase: supabase.length });
    }
    for (let index = 0; index < Math.min(sqlite.length, supabase.length); index += 1) {
      collectDifferences(sqlite[index], supabase[index], `${path}[${index}]`, differences);
    }
    return;
  }

  const sqliteIsObject = sqlite !== null && typeof sqlite === 'object';
  const supabaseIsObject = supabase !== null && typeof supabase === 'object';
  if (sqliteIsObject || supabaseIsObject) {
    if (!sqliteIsObject || !supabaseIsObject) {
      differences.push({ path, sqlite, supabase });
      return;
    }
    const sqliteObject = sqlite as Record<string, unknown>;
    const supabaseObject = supabase as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(sqliteObject), ...Object.keys(supabaseObject)])].sort();
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!Object.hasOwn(sqliteObject, key) || !Object.hasOwn(supabaseObject, key)) {
        differences.push({ path: childPath, sqlite: sqliteObject[key], supabase: supabaseObject[key] });
      } else {
        collectDifferences(sqliteObject[key], supabaseObject[key], childPath, differences);
      }
    }
    return;
  }

  differences.push({ path, sqlite, supabase });
}

function display(value: unknown): string {
  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json;
}

function readOnlyClient(delegate: SupabaseJsUniversityDataClient): UniversitySupabaseDataClient {
  return {
    getStudent: delegate.getStudent.bind(delegate),
    listStudents: delegate.listStudents.bind(delegate),
    listCourses: delegate.listCourses.bind(delegate),
    getCourse: delegate.getCourse.bind(delegate),
    listOfferings: delegate.listOfferings.bind(delegate),
    getOfferings: delegate.getOfferings.bind(delegate),
    getCalendar: delegate.getCalendar.bind(delegate),
    getAcademicDates: delegate.getAcademicDates.bind(delegate),
    hasCourses: delegate.hasCourses.bind(delegate),
    latestCursor: delegate.latestCursor.bind(delegate),
    eventsSince: delegate.eventsSince.bind(delegate),
    eventByKey: delegate.eventByKey.bind(delegate),
    deliveryBatch: delegate.deliveryBatch.bind(delegate),
    rpc: async () => {
      throw new Error('READ_ONLY_PARITY_GUARD: RPC calls are disabled.');
    },
  };
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl) throw new Error('SUPABASE_URL is required.');
  if (!secretKey) throw new Error('SUPABASE_SECRET_KEY is required.');

  const sqliteStore = new UniversityStore(':memory:');
  const sqlite = new SQLiteUniversityRepository(sqliteStore);
  const supabaseClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const supabase = new SupabaseUniversityRepository(readOnlyClient(new SupabaseJsUniversityDataClient(supabaseClient)));

  try {
    const [
      sqliteCalendar, supabaseCalendar,
      sqliteDates, supabaseDates,
      sqliteStudents, supabaseStudents,
      sqliteCourses, supabaseCourses,
      sqliteOfferings, supabaseOfferings,
      sqliteCursor, supabaseCursor,
      sqliteEvents, supabaseEvents,
      sqliteStudent, supabaseStudent,
      sqliteRecord, supabaseRecord,
      sqliteKnownCourses, supabaseKnownCourses,
    ] = await Promise.all([
      sqlite.getCalendar(), supabase.getCalendar(),
      sqlite.getAcademicDates(), supabase.getAcademicDates(),
      sqlite.listStudents(), supabase.listStudents(),
      sqlite.listCourses(), supabase.listCourses(),
      sqlite.listOfferings(), supabase.listOfferings(),
      sqlite.cursor(), supabase.cursor(),
      sqlite.eventsSince(0), supabase.eventsSince(0),
      sqlite.getStudent(STUDENT_ID), supabase.getStudent(STUDENT_ID),
      sqlite.getStudentRecord(STUDENT_ID), supabase.getStudentRecord(STUDENT_ID),
      Promise.all(COURSE_CODES.map((code) => sqlite.getCourse(code))),
      Promise.all(COURSE_CODES.map((code) => supabase.getCourse(code))),
    ]);

    const differences: Difference[] = [];
    const compare = (path: string, sqliteValue: unknown, supabaseValue: unknown) =>
      collectDifferences(sqliteValue, supabaseValue, path, differences);

    compare('calendar', sqliteCalendar, supabaseCalendar);
    compare('academicDates', sqliteDates, supabaseDates);
    compare('students', sqliteStudents, supabaseStudents);
    compare('courses', sqliteCourses, supabaseCourses);
    compare('offerings', sqliteOfferings, supabaseOfferings);
    compare('cursor', sqliteCursor, supabaseCursor);
    compare('events', sqliteEvents, supabaseEvents);
    compare(`student.${STUDENT_ID}.profile`, sqliteStudent, supabaseStudent);
    compare(`student.${STUDENT_ID}.record`, sqliteRecord, supabaseRecord);
    COURSE_CODES.forEach((code, index) => compare(`course.${code}`, sqliteKnownCourses[index], supabaseKnownCourses[index]));

    const countPairs = {
      students: [sqliteStudents.length, supabaseStudents.length, EXPECTED_COUNTS.students],
      courses: [sqliteCourses.length, supabaseCourses.length, EXPECTED_COUNTS.courses],
      offerings: [sqliteOfferings.length, supabaseOfferings.length, EXPECTED_COUNTS.offerings],
      academicDates: [sqliteDates.length, supabaseDates.length, EXPECTED_COUNTS.academicDates],
      events: [sqliteEvents.length, supabaseEvents.length, EXPECTED_COUNTS.events],
    } as const;
    for (const [name, [sqliteCount, supabaseCount, expectedCount]] of Object.entries(countPairs)) {
      if (sqliteCount !== expectedCount || supabaseCount !== expectedCount) {
        differences.push({ path: `counts.${name}`, sqlite: sqliteCount, supabase: supabaseCount });
      }
    }

    const matches = (prefix: string) => !differences.some((difference) =>
      difference.path === prefix || difference.path.startsWith(`${prefix}.`) || difference.path.startsWith(`${prefix}[`));
    console.log('Repository parity:');
    console.log(differences.length === 0 ? 'PASS' : 'FAIL');
    console.log('');
    console.log(`Students: ${sqliteStudents.length} == ${supabaseStudents.length}`);
    console.log(`Courses: ${sqliteCourses.length} == ${supabaseCourses.length}`);
    console.log(`Offerings: ${sqliteOfferings.length} == ${supabaseOfferings.length}`);
    console.log(`Academic dates: ${sqliteDates.length} == ${supabaseDates.length}`);
    console.log(`Calendar: ${matches('calendar') ? 'MATCH' : 'MISMATCH'}`);
    console.log(`Student ${STUDENT_ID} profile: ${matches(`student.${STUDENT_ID}.profile`) ? 'MATCH' : 'MISMATCH'}`);
    console.log(`Student ${STUDENT_ID} record: ${matches(`student.${STUDENT_ID}.record`) ? 'MATCH' : 'MISMATCH'}`);
    console.log(`Offerings: ${matches('offerings') ? 'MATCH' : 'MISMATCH'}`);
    console.log(`Course catalog: ${matches('courses') ? 'MATCH' : 'MISMATCH'}`);
    for (const code of COURSE_CODES) console.log(`Course ${code}: ${matches(`course.${code}`) ? 'MATCH' : 'MISMATCH'}`);
    console.log(`Cursor: ${sqliteCursor} == ${supabaseCursor}`);
    console.log(`Events: ${sqliteEvents.length} == ${supabaseEvents.length}`);

    for (const difference of differences) {
      console.log('');
      console.log('MISMATCH:');
      console.log(difference.path);
      console.log(`SQLite: ${display(difference.sqlite)}`);
      console.log(`Supabase: ${display(difference.supabase)}`);
    }

    if (differences.length > 0) process.exitCode = 1;
  } finally {
    await Promise.all([sqlite.close(), supabase.close()]);
  }
}

main().catch((error: unknown) => {
  console.error(`Repository parity verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
