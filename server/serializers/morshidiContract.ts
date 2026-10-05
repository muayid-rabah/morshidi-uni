import type { StudentProfile } from '../../src/types/student';

/**
 * Clean, safe, high-level student profile contract for external Morshidi consumers.
 *
 * Excludes all sensitive internal data (financials, full semester course attempts,
 * internal IDs, auth provider details, absences, exams, admin metadata).
 */
export interface MorshidiStudentProfileResponse {
  studentId: string;
  name: string;
  email: string;
  faculty: string;
  major: string;
  degree: string;
  studyType: string;
  admissionYear: number;
  academicAdvisor: string;
  academicStatus: string;
  gpa: number;
  earnedCredits: number;
}

/**
 * 1. Courses Integration Contracts
 */
export interface MorshidiCourseItem {
  courseCode: string;
  name: string;
  credits: number;
  status: 'completed' | 'enrolled' | 'remaining';
}

export interface MorshidiStudentCoursesResponse {
  completed: MorshidiCourseItem[];
  current: MorshidiCourseItem[];
  remaining: MorshidiCourseItem[];
}

/**
 * 2. Grades Integration Contracts
 */
export interface MorshidiGradeCourseItem {
  courseCode: string;
  name: string;
  credits: number;
  grade: number;
  letterGrade: string;
  status: 'passed' | 'failed' | 'withdrawn';
}

export interface MorshidiSemesterGrades {
  term: string;
  termLabel: string;
  registeredHours: number;
  passedHours: number;
  semesterGpa: number;
  cumulativeGpa: number;
  courses: MorshidiGradeCourseItem[];
}

export interface MorshidiStudentGradesResponse {
  cumulativeGpa: number;
  semesters: MorshidiSemesterGrades[];
}

/**
 * 3. Enrollments Integration Contracts
 */
export interface MorshidiEnrollmentItem {
  courseCode: string;
  courseName: string;
  sectionId: string;
  sectionNumber: number;
  credits: number;
  days: string;
  daysArray: string[];
  startTime: string;
  endTime: string;
  room: string;
  instructor: string;
}

export interface MorshidiStudentEnrollmentsResponse {
  term: string;
  termLabel: string;
  enrollments: MorshidiEnrollmentItem[];
}

/**
 * 4. Academic Plan Integration Contracts
 */
export interface MorshidiPlanCourseItem {
  courseCode: string;
  name: string;
  credits: number;
  group: string;
  type: string;
  prerequisites: string[];
  status: 'completed' | 'current' | 'remaining';
}

export interface MorshidiAcademicPlanResponse {
  planId: string;
  major: string;
  totalRequiredCredits: number;
  earnedCredits: number;
  remainingCredits: number;
  courses: MorshidiPlanCourseItem[];
}

/**
 * Maps live internal UniversityStore student profile and academic record
 * into the isolated external Morshidi profile contract.
 */
export function mapStudentToMorshidiProfile(
  profile: StudentProfile,
  record?: Record<string, unknown> | null,
): MorshidiStudentProfileResponse {
  const gpa = typeof record?.cumulative_gpa === 'number'
    ? record.cumulative_gpa
    : (profile.semesterHistory?.at(-1)?.cumulativeGpa ?? 0);

  const earnedCredits = typeof record?.earned_credits === 'number'
    ? record.earned_credits
    : (profile.semesterHistory?.reduce((sum, semester) => sum + semester.passedHours, 0) ?? 0);

  return {
    studentId: profile.universityId,
    name: profile.name,
    email: `${profile.universityId}@std.morshidi.edu.jo`,
    faculty: profile.faculty,
    major: profile.major,
    degree: profile.degree,
    studyType: profile.studyType,
    admissionYear: profile.admissionYear,
    academicAdvisor: profile.academicAdvisor,
    academicStatus: profile.academicStatus,
    gpa,
    earnedCredits,
  };
}

/**
 * Maps student course states (completed, current, remaining) into the Morshidi contract.
 */
export function mapStudentCoursesToMorshidi(
  profile: StudentProfile,
  catalog: Record<string, unknown>[],
): MorshidiStudentCoursesResponse {
  const catalogMap = new Map<string, Record<string, unknown>>(
    catalog.map((c) => [String(c.code), c]),
  );

  const completedCodesSet = new Set(profile.completedCourses ?? []);
  const currentCodesSet = new Set(
    (profile.currentRegisteredSections ?? []).map((s) => s.courseCode),
  );

  // Completed courses
  const completed: MorshidiCourseItem[] = (profile.completedCourses ?? []).map((code) => {
    const info = catalogMap.get(code);
    return {
      courseCode: code,
      name: String(info?.name ?? code),
      credits: Number(info?.credits ?? 0),
      status: 'completed',
    };
  });

  // Current enrolled courses (deduplicated by courseCode)
  const currentMap = new Map<string, MorshidiCourseItem>();
  for (const sec of profile.currentRegisteredSections ?? []) {
    if (!currentMap.has(sec.courseCode)) {
      const info = catalogMap.get(sec.courseCode);
      currentMap.set(sec.courseCode, {
        courseCode: sec.courseCode,
        name: sec.courseName || String(info?.name ?? sec.courseCode),
        credits: sec.credits ?? Number(info?.credits ?? 0),
        status: 'enrolled',
      });
    }
  }
  const current = Array.from(currentMap.values());

  // Remaining courses from catalog
  const remaining: MorshidiCourseItem[] = [];
  for (const c of catalog) {
    const code = String(c.code);
    if (!completedCodesSet.has(code) && !currentCodesSet.has(code)) {
      remaining.push({
        courseCode: code,
        name: String(c.name),
        credits: Number(c.credits ?? 0),
        status: 'remaining',
      });
    }
  }

  return { completed, current, remaining };
}

/**
 * Maps academic history and grades into the Morshidi grade contract.
 */
export function mapStudentGradesToMorshidi(
  profile: StudentProfile,
  record?: Record<string, unknown> | null,
): MorshidiStudentGradesResponse {
  const cumulativeGpa = typeof record?.cumulative_gpa === 'number'
    ? record.cumulative_gpa
    : (profile.semesterHistory?.at(-1)?.cumulativeGpa ?? 0);

  const semesters: MorshidiSemesterGrades[] = (profile.semesterHistory ?? []).map((sem) => ({
    term: sem.semesterId,
    termLabel: sem.semesterName,
    registeredHours: sem.registeredHours,
    passedHours: sem.passedHours,
    semesterGpa: sem.semesterGpa,
    cumulativeGpa: sem.cumulativeGpa,
    courses: (sem.courses ?? []).map((crs) => {
      let status: 'passed' | 'failed' | 'withdrawn';
      if (crs.status === 'ناجح') {
        status = 'passed';
      } else if (crs.status === 'راسب') {
        status = 'failed';
      } else {
        status = 'withdrawn';
      }
      return {
        courseCode: crs.courseCode,
        name: crs.courseName,
        credits: crs.credits,
        grade: crs.grade,
        letterGrade: crs.letterGrade,
        status,
      };
    }),
  }));

  return {
    cumulativeGpa,
    semesters,
  };
}

/**
 * Maps active term enrollments into the Morshidi enrollments contract.
 */
export function mapStudentEnrollmentsToMorshidi(
  profile: StudentProfile,
  currentTerm: { code: string; label: string },
): MorshidiStudentEnrollmentsResponse {
  const enrollments: MorshidiEnrollmentItem[] = (profile.currentRegisteredSections ?? []).map((sec) => ({
    courseCode: sec.courseCode,
    courseName: sec.courseName,
    sectionId: sec.id,
    sectionNumber: sec.sectionNumber,
    credits: sec.credits,
    days: sec.days,
    daysArray: Array.isArray(sec.daysArray) ? [...sec.daysArray] : [],
    startTime: sec.startTime,
    endTime: sec.endTime,
    room: sec.room,
    instructor: sec.instructor,
  }));

  return {
    term: currentTerm.code,
    termLabel: currentTerm.label,
    enrollments,
  };
}

/**
 * Maps student academic plan and course requirement tree into the Morshidi academic plan contract.
 */
export function mapAcademicPlanToMorshidi(
  profile: StudentProfile,
  record: Record<string, unknown> | null | undefined,
  catalog: Record<string, unknown>[],
): MorshidiAcademicPlanResponse {
  const planId = String(
    record?.plan_id ?? (profile.studyPlan ? profile.studyPlan.replace(/[^0-9]/g, '') || profile.studyPlan : '12'),
  );
  const major = profile.major;
  const totalRequiredCredits = 132;
  const earnedCredits = typeof record?.earned_credits === 'number'
    ? record.earned_credits
    : (profile.semesterHistory?.reduce((sum, semester) => sum + semester.passedHours, 0) ?? 0);
  const remainingCredits = Math.max(0, totalRequiredCredits - earnedCredits);

  const completedCodesSet = new Set(profile.completedCourses ?? []);
  const currentCodesSet = new Set(
    (profile.currentRegisteredSections ?? []).map((s) => s.courseCode),
  );

  const courses: MorshidiPlanCourseItem[] = catalog.map((c) => {
    const code = String(c.code);
    let status: 'completed' | 'current' | 'remaining' = 'remaining';
    if (completedCodesSet.has(code)) {
      status = 'completed';
    } else if (currentCodesSet.has(code)) {
      status = 'current';
    }

    return {
      courseCode: code,
      name: String(c.name),
      credits: Number(c.credits ?? 0),
      group: String(c.group ?? ''),
      type: String(c.type ?? ''),
      prerequisites: Array.isArray(c.prerequisites) ? (c.prerequisites as string[]) : [],
      status,
    };
  });

  return {
    planId,
    major,
    totalRequiredCredits,
    earnedCredits,
    remainingCredits,
    courses,
  };
}

