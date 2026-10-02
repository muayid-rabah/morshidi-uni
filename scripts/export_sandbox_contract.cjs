const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'src', 'data');
const OUT_DIR = path.join(ROOT_DIR, 'public', 'api', 'v1');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 1. Load courses_plan12.json
const coursesRaw = fs.readFileSync(path.join(DATA_DIR, 'courses_plan12.json'), 'utf8');
const coursesSource = JSON.parse(coursesRaw);
const courseMap = new Map(coursesSource.map(c => [c.code, c]));

// 2. Load offeredSections.ts via vm
let secCode = fs.readFileSync(path.join(DATA_DIR, 'offeredSections.ts'), 'utf8');
secCode = secCode.replace(/import\s+[^;]+;/, '');
secCode = secCode.replace(/export\s+const\s+offeredCourseSections:\s*CourseSection\[\]\s*=/, 'const offeredCourseSections =');

const secCtx = {};
vm.runInNewContext(secCode + '\n;secCtx.sections = offeredCourseSections;', { secCtx });
const sectionsSource = secCtx.sections;

// 3. Load demoStudents.ts via vm
let stuCode = fs.readFileSync(path.join(DATA_DIR, 'demoStudents.ts'), 'utf8');
stuCode = stuCode.replace(/import\s+[^;]+;/g, '');
stuCode = stuCode.replace(/\(id:\s*string\)/g, '(id)');
stuCode = stuCode.replace(/export\s+const\s+demoStudents:\s*StudentProfile\[\]\s*=/, 'const demoStudents =');

const stuCtx = {};
vm.runInNewContext(secCode + '\n' + stuCode + '\n;stuCtx.students = demoStudents;', { stuCtx, console });
const studentsSource = stuCtx.students;

// 4. Build courses export
const exportedCourses = coursesSource.map(c => ({
  code: c.code,
  name: c.name,
  credits: c.credits,
  group: c.group,
  type: c.type,
  prerequisites: c.prerequisites || [],
  review_required: Boolean(c.reviewRequired),
  review_reason: c.reviewReason || null,
  learning_type: c.learningType || 'نظري'
}));

// 5. Build offerings export
const exportedOfferings = sectionsSource.map(sec => ({
  id: sec.id,
  course_code: sec.courseCode,
  course_name: sec.courseName,
  section_number: sec.sectionNumber,
  credits: sec.credits,
  instructor: sec.instructor,
  days: sec.days,
  days_array: sec.daysArray,
  start_time: sec.startTime,
  end_time: sec.endTime,
  room: sec.room,
  capacity: sec.capacity,
  enrolled: sec.enrolled,
  available: sec.capacity - sec.enrolled,
  status: sec.status
}));

// 6. Build students export
const exportedStudents = studentsSource.map(s => {
  const earned_credits = (s.completedCourses || []).reduce((sum, c) => sum + (courseMap.get(c)?.credits || 0), 0);
  const lastSem = (s.semesterHistory && s.semesterHistory.length > 0) ? s.semesterHistory[s.semesterHistory.length - 1] : null;
  const cumulative_gpa = lastSem ? lastSem.cumulativeGpa : 0;

  return {
    id: s.id,
    student_id: s.universityId,
    university_id: s.universityId,
    name: s.name,
    faculty: s.faculty,
    major: s.major,
    degree: s.degree,
    study_type: s.studyType,
    admission_year: s.admissionYear,
    study_plan: s.studyPlan,
    academic_advisor: s.academicAdvisor,
    academic_status: s.academicStatus,
    profile_type: s.profileType,
    profile_description: s.profileDescription,
    completed_courses: s.completedCourses || [],
    review_courses: s.reviewCourses || [],
    current_registered_section_ids: (s.currentRegisteredSections || []).map(sec => sec.id),
    earned_credits,
    cumulative_gpa
  };
});

// 7. Build academic records export
const exportedAcademicRecords = {
  schema_version: '1.0.0',
  fixture_version: '2026.10.02.v1',
  institution_id: 'morshidi-sandbox',
  records: studentsSource.map(s => {
    const earned_credits = (s.completedCourses || []).reduce((sum, c) => sum + (courseMap.get(c)?.credits || 0), 0);
    const lastSem = (s.semesterHistory && s.semesterHistory.length > 0) ? s.semesterHistory[s.semesterHistory.length - 1] : null;
    const cumulative_gpa = lastSem ? lastSem.cumulativeGpa : 0;

    return {
      student_id: s.universityId,
      program_id: 'IT',
      major_id: 'AI',
      plan_id: '12',
      plan_version_id: 'PLAN-12-V1',
      earned_credits,
      cumulative_gpa,
      semesters: (s.semesterHistory || []).map(sem => ({
        semester_id: sem.semesterId,
        semester_name: sem.semesterName,
        registered_hours: sem.registeredHours,
        passed_hours: sem.passedHours,
        semester_gpa: sem.semesterGpa,
        cumulative_gpa: sem.cumulativeGpa
      })),
      attempts: (s.semesterHistory || []).flatMap(sem => (sem.courses || []).map(c => ({
        course_code: c.courseCode,
        course_name: c.courseName,
        credits: c.credits,
        numeric_grade: c.grade,
        letter_grade: c.letterGrade,
        source_status: c.status,
        outcome: c.status === 'ناجح' ? 'PASSED' : 'FAILED',
        semester_id: sem.semesterId,
        semester_name: sem.semesterName
      }))),
      current_registered_sections: (s.currentRegisteredSections || []).map(sec => ({
        id: sec.id,
        course_code: sec.courseCode,
        course_name: sec.courseName,
        section_number: sec.sectionNumber,
        credits: sec.credits,
        instructor: sec.instructor,
        days: sec.days,
        days_array: sec.daysArray,
        start_time: sec.startTime,
        end_time: sec.endTime,
        room: sec.room
      }))
    };
  })
};

// 8. Build manifest export
const exportedManifest = {
  schema_version: '1.0.0',
  fixture_version: '2026.10.02.v1',
  institution_id: 'morshidi-sandbox',
  institution_name: 'جامعة مرشدي — البيئة التجريبية',
  institution_name_en: 'Morshidi University (Sandbox)',
  plan_id: '12',
  plan_title: 'الخطة الدراسية لبكالوريوس الذكاء الاصطناعي - خطة 12',
  total_plan_credits: 132,
  synthetic: true,
  source: 'MORSHIDI_SANDBOX_UNIVERSITY',
  student_count: exportedStudents.length,
  course_count: exportedCourses.length,
  offering_count: exportedOfferings.length,
  active_term: {
    term_id: '2026-1',
    name: '2026/2027 - الفصل الأول',
    is_current: true
  },
  endpoints: {
    manifest: '/api/v1/manifest.json',
    students: '/api/v1/students.json',
    courses: '/api/v1/courses.json',
    offerings: '/api/v1/offerings.json',
    academic_records: '/api/v1/academic-records.json'
  }
};

// Security Assertion: Ensure NO passwords or credentials enter contract files
const FORBIDDEN_TOKENS = ['password', 'secret', 'access_token', 'refresh_token', 'api_key', 'credential', 'private_key'];

function checkSafety(obj, label) {
  const jsonStr = JSON.stringify(obj).toLowerCase();
  for (const token of FORBIDDEN_TOKENS) {
    if (jsonStr.includes(`"${token}"`) || jsonStr.includes(`'${token}'`)) {
      throw new Error(`CRITICAL SECURITY FAILURE: Token "${token}" detected in exported contract ${label}!`);
    }
  }
}

checkSafety(exportedManifest, 'manifest');
checkSafety(exportedStudents, 'students');
checkSafety(exportedCourses, 'courses');
checkSafety(exportedOfferings, 'offerings');
checkSafety(exportedAcademicRecords, 'academic-records');

// Counts Validation
if (exportedStudents.length !== 5) throw new Error(`Expected 5 students, got ${exportedStudents.length}`);
if (exportedCourses.length !== 68) throw new Error(`Expected 68 courses, got ${exportedCourses.length}`);
if (exportedOfferings.length !== 204) throw new Error(`Expected 204 offerings, got ${exportedOfferings.length}`);
if (exportedAcademicRecords.records.length !== 5) throw new Error(`Expected 5 academic records, got ${exportedAcademicRecords.records.length}`);

// Write files
const filesToWrite = [
  { path: path.join(OUT_DIR, 'manifest.json'), data: exportedManifest },
  { path: path.join(OUT_DIR, 'students.json'), data: exportedStudents },
  { path: path.join(OUT_DIR, 'courses.json'), data: exportedCourses },
  { path: path.join(OUT_DIR, 'offerings.json'), data: exportedOfferings },
  { path: path.join(OUT_DIR, 'academic-records.json'), data: exportedAcademicRecords }
];

for (const file of filesToWrite) {
  fs.writeFileSync(file.path, JSON.stringify(file.data, null, 2) + '\n', 'utf8');
}

console.log('✓ Sandbox contract successfully exported and validated:');
console.log(`  - Students: ${exportedStudents.length}`);
console.log(`  - Courses: ${exportedCourses.length}`);
console.log(`  - Offerings: ${exportedOfferings.length}`);
console.log(`  - Academic records: ${exportedAcademicRecords.records.length}`);
console.log(`  - Output directory: ${OUT_DIR}`);
console.log('  - Credential safety check: PASSED (zero credentials in export)');
