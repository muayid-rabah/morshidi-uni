import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { demoStudents } from '../src/data/demoStudents';
import { academicDates } from '../src/data/academicDates';
import type { StudentProfile } from '../src/types/student';

const EXPECTED_COUNTS = {
  students: 5,
  courses: 68,
  offerings: 204,
  calendar: 1,
  academic_dates: 8,
  events: 0,
  aggregate_versions: 0,
} as const;

const PRIMARY_SEED_TABLES = ['students', 'courses', 'offerings', 'calendar', 'academic_dates'] as const;
const EVENT_TABLES = ['events', 'aggregate_versions'] as const;
const ALL_TABLES = [...PRIMARY_SEED_TABLES, ...EVENT_TABLES] as const;
type UniversityTable = (typeof ALL_TABLES)[number];

interface SeedManifest {
  active_term: {
    term_id: string;
    name: string;
  };
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

interface CalendarState {
  currentTerm: { code: string; label: string };
  registrationOpen: boolean;
  registrationWindow: { start: string | null; end: string | null };
  nextTerm: { code: string; label: string } | null;
}

type JsonObject = Record<string, unknown>;

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as T;
}

function academicRecordFromProfile(profile: StudentProfile, termCode: string): JsonObject {
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

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertUnique(values: string[], label: string): void {
  assertCondition(new Set(values).size === values.length, `${label} must be unique.`);
}

function sourceSnapshot(value: unknown): string {
  return JSON.stringify(value);
}

async function tableCount(client: SupabaseClient, table: UniversityTable): Promise<number> {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`Unable to count ${table}: ${error.message}`);
  if (count === null) throw new Error(`Unable to count ${table}: no exact count returned.`);
  return count;
}

async function readCounts(client: SupabaseClient): Promise<Record<UniversityTable, number>> {
  const entries = await Promise.all(ALL_TABLES.map(async (table) => [table, await tableCount(client, table)] as const));
  return Object.fromEntries(entries) as Record<UniversityTable, number>;
}

function printCounts(label: string, counts: Record<UniversityTable, number>): void {
  console.log(label);
  for (const table of ALL_TABLES) console.log(`  ${table}: ${counts[table]}`);
}

async function insertBatches(
  client: SupabaseClient,
  table: UniversityTable,
  rows: JsonObject[],
  batchSize = 100,
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const { error } = await client.from(table).insert(batch);
    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
  }
  console.log(`Inserted ${table}: ${rows.length}`);
}

async function verifyRemoteData(
  client: SupabaseClient,
  expectedStudentIds: string[],
  sourceOfferingIds: string[],
  sourceSnapshotsBefore: Record<string, string>,
  sourceValues: Record<string, unknown>,
): Promise<void> {
  const counts = await readCounts(client);
  printCounts('Post-seed row counts:', counts);
  for (const table of ALL_TABLES) {
    assertCondition(counts[table] === EXPECTED_COUNTS[table],
      `Expected ${EXPECTED_COUNTS[table]} ${table} rows, found ${counts[table]}.`);
  }

  const { data: studentRows, error: studentsError } = await client
    .from('students')
    .select('student_id, profile_json, record_json')
    .order('student_id');
  if (studentsError) throw new Error(`Student verification failed: ${studentsError.message}`);
  assertCondition(studentRows !== null, 'Student verification returned no data.');

  const actualStudentIds = studentRows.map((row) => String(row.student_id));
  assertCondition(sourceSnapshot(actualStudentIds) === sourceSnapshot([...expectedStudentIds].sort()),
    'Supabase student IDs do not match the deterministic seed IDs.');
  for (const row of studentRows) {
    const profile = row.profile_json as { universityId?: unknown } | null;
    assertCondition(profile?.universityId === row.student_id,
      `Student profile identity mismatch for ${String(row.student_id)}.`);
    assertCondition(row.record_json !== null, `Student ${String(row.student_id)} has a null academic record.`);
  }

  const { data: courseRows, error: coursesError } = await client.from('courses').select('course_code');
  if (coursesError) throw new Error(`Course verification failed: ${coursesError.message}`);
  const courseCodes = new Set((courseRows ?? []).map((row) => String(row.course_code)));

  const { data: offeringRows, error: offeringsError } = await client
    .from('offerings')
    .select('section_id, course_code');
  if (offeringsError) throw new Error(`Offering verification failed: ${offeringsError.message}`);
  assertCondition(offeringRows !== null, 'Offering verification returned no data.');
  const offeringIds = offeringRows.map((row) => String(row.section_id));
  assertUnique(offeringIds, 'Supabase offering section IDs');
  assertCondition(sourceSnapshot([...offeringIds].sort()) === sourceSnapshot([...sourceOfferingIds].sort()),
    'Supabase offering IDs do not match the deterministic seed IDs.');
  for (const row of offeringRows) {
    assertCondition(courseCodes.has(String(row.course_code)),
      `Offering ${String(row.section_id)} references a missing course.`);
  }

  const offeringIdSet = new Set(offeringIds);
  for (const row of studentRows) {
    const profile = row.profile_json as { currentRegisteredSections?: Array<{ id?: unknown }> };
    assertCondition(Array.isArray(profile.currentRegisteredSections),
      `Student ${String(row.student_id)} has no registered-sections array.`);
    for (const section of profile.currentRegisteredSections) {
      assertCondition(typeof section.id === 'string' && offeringIdSet.has(section.id),
        `Student ${String(row.student_id)} references a missing registered section.`);
    }
  }

  const { data: calendarRows, error: calendarError } = await client
    .from('calendar')
    .select('id, data_json');
  if (calendarError) throw new Error(`Calendar verification failed: ${calendarError.message}`);
  assertCondition(calendarRows?.length === 1 && calendarRows[0].id === 1, 'Calendar singleton row is invalid.');
  const calendarData = calendarRows[0].data_json as { currentTerm?: { code?: unknown } };
  assertCondition(calendarData.currentTerm?.code === '2026-1', 'Calendar current term is not 2026-1.');

  for (const [name, before] of Object.entries(sourceSnapshotsBefore)) {
    assertCondition(sourceSnapshot(sourceValues[name]) === before, `Seed source ${name} was mutated.`);
  }
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  assertCondition(supabaseUrl, 'SUPABASE_URL is required.');
  assertCondition(secretKey, 'SUPABASE_SECRET_KEY is required.');

  const manifest = readJson<SeedManifest>('../server/seed-data/manifest.json');
  const academicRecordsFile = readJson<{ records: SeedRecord[] }>('../server/seed-data/academic-records.json');
  const courses = readJson<JsonObject[]>('../server/seed-data/courses.json');
  const offerings = readJson<SeedOffering[]>('../server/seed-data/offerings.json');
  const academicRecords = academicRecordsFile.records;

  const sourceValues: Record<string, unknown> = {
    demoStudents,
    academicRecordsFile,
    courses,
    offerings,
    manifest,
    academicDates,
  };
  const sourceSnapshotsBefore = Object.fromEntries(
    Object.entries(sourceValues).map(([name, value]) => [name, sourceSnapshot(value)]),
  );

  assertCondition(demoStudents.length === EXPECTED_COUNTS.students,
    `Expected ${EXPECTED_COUNTS.students} students, found ${demoStudents.length}.`);
  assertCondition(academicRecords.length === EXPECTED_COUNTS.students,
    `Expected ${EXPECTED_COUNTS.students} academic records, found ${academicRecords.length}.`);
  assertCondition(courses.length === EXPECTED_COUNTS.courses,
    `Expected ${EXPECTED_COUNTS.courses} courses, found ${courses.length}.`);
  assertCondition(offerings.length === EXPECTED_COUNTS.offerings,
    `Expected ${EXPECTED_COUNTS.offerings} offerings, found ${offerings.length}.`);
  assertCondition(academicDates.length === EXPECTED_COUNTS.academic_dates,
    `Expected ${EXPECTED_COUNTS.academic_dates} academic dates, found ${academicDates.length}.`);
  assertCondition(manifest.active_term.term_id === '2026-1',
    `Expected active term 2026-1, found ${manifest.active_term.term_id}.`);

  const studentIds = demoStudents.map((profile) => profile.universityId);
  const courseCodes = courses.map((course) => String(course.code));
  const offeringIds = offerings.map((offering) => offering.id);
  assertUnique(studentIds, 'Student IDs');
  assertUnique(courseCodes, 'Course codes');
  assertUnique(offeringIds, 'Offering section IDs');
  const courseCodeSet = new Set(courseCodes);
  const offeringIdSet = new Set(offeringIds);
  for (const offering of offerings) {
    assertCondition(courseCodeSet.has(offering.course_code),
      `Offering ${offering.id} references missing course ${offering.course_code}.`);
  }
  for (const profile of demoStudents) {
    for (const section of profile.currentRegisteredSections) {
      assertCondition(offeringIdSet.has(section.id),
        `Student ${profile.universityId} references missing section ${section.id}.`);
    }
  }

  const currentTerm = {
    code: manifest.active_term.term_id,
    label: manifest.active_term.name,
  };
  const nextTermCode = `${currentTerm.code.split('-')[0]}-${Number(currentTerm.code.split('-')[1] || 0) + 1}`;
  const calendar: CalendarState = {
    currentTerm,
    registrationOpen: false,
    registrationWindow: { start: null, end: null },
    nextTerm: { code: nextTermCode, label: nextTermCode },
  };
  const seedTimestamp = new Date().toISOString();

  const courseRows = courses.map((course) => ({
    course_code: String(course.code),
    data_json: course,
    updated_at: seedTimestamp,
  }));
  const offeringRows = offerings.map((offering) => ({
    section_id: offering.id,
    course_code: offering.course_code,
    term_code: currentTerm.code,
    data_json: offering,
    updated_at: seedTimestamp,
  }));
  const studentRows = demoStudents.map((profile) => ({
    student_id: profile.universityId,
    profile_json: profile,
    record_json: academicRecords.find((record) => record.student_id === profile.universityId)
      ?? academicRecordFromProfile(profile, currentTerm.code),
    updated_at: seedTimestamp,
  }));
  const calendarRows = [{ id: 1, data_json: calendar, updated_at: seedTimestamp }];
  const academicDateRows = academicDates.map((item) => ({
    date_id: item.id,
    data_json: item,
    updated_at: seedTimestamp,
  }));

  const client = createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  console.log('Checking University Supabase table counts...');
  const initialCounts = await readCounts(client);
  printCounts('Initial row counts:', initialCounts);
  if (PRIMARY_SEED_TABLES.some((table) => initialCounts[table] > 0)) {
    throw new Error('University Supabase is not empty. Seed aborted.');
  }
  if (EVENT_TABLES.some((table) => initialCounts[table] > 0)) {
    throw new Error('University Supabase event tables are not empty. Seed aborted.');
  }

  await insertBatches(client, 'courses', courseRows);
  await insertBatches(client, 'offerings', offeringRows);
  await insertBatches(client, 'students', studentRows);
  await insertBatches(client, 'calendar', calendarRows);
  await insertBatches(client, 'academic_dates', academicDateRows);

  await verifyRemoteData(client, [...studentIds].sort(), offeringIds, sourceSnapshotsBefore, sourceValues);
  console.log('University Supabase seed completed and verified successfully.');
}

main().catch((error: unknown) => {
  console.error(`Seed failed: ${error instanceof Error ? error.message : 'Unknown error.'}`);
  process.exitCode = 1;
});
