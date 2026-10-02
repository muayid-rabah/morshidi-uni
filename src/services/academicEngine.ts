import { PlanCourse, RequirementGroup, CourseStatus, EligibilityState, StudentProfile, CourseSection } from '../types/student';
import rawCourses from '../data/courses_plan12.json';

export const planCourses: PlanCourse[] = rawCourses as PlanCourse[];

export const REQUIREMENT_GROUP_HOURS: Record<RequirementGroup, number> = {
  'متطلبات الجامعة الإجبارية': 18,
  'متطلبات الجامعة الاختيارية': 9,
  'متطلبات الكلية الإجبارية': 21,
  'المتطلبات المساندة': 12,
  'متطلبات التخصص الإجبارية': 63,
  'متطلبات التخصص الاختيارية': 9,
};

export const TOTAL_PLAN_HOURS = 132;

// Check if student has satisfied all prerequisites for a course
export function arePrerequisitesSatisfied(prereqs: string[], completedCourses: string[]): boolean {
  if (!prereqs || prereqs.length === 0) return true;
  return prereqs.every(code => {
    // If prerequisite has an alternative (e.g., placement exams 0200150 or 0201001), treat satisfied if either is completed or waived
    return completedCourses.includes(code);
  });
}

// Compute dynamic course status for a student
export function getCourseStatusForStudent(
  course: PlanCourse,
  student: StudentProfile
): CourseStatus {
  // 1. Is completed?
  if (student.completedCourses.includes(course.code)) {
    return 'منجزة';
  }

  // 2. Is currently registered?
  const isRegistered = student.currentRegisteredSections.some(
    sec => sec.courseCode === course.code
  );
  if (isRegistered) {
    return 'مسجلة حاليًا';
  }

  // 3. Needs review?
  if (course.reviewRequired || student.reviewCourses?.includes(course.code)) {
    // Check if prerequisite code conflict is involved (e.g. 0300103 vs 0300104)
    return 'تحتاج مراجعة';
  }

  // 4. Prerequisites check
  const prereqsMet = arePrerequisitesSatisfied(course.prerequisites, student.completedCourses);
  if (prereqsMet) {
    return 'متاحة للتسجيل';
  }

  return 'غير متاحة';
}

// Get eligibility state for registration
export function getRegistrationEligibility(
  courseCode: string,
  student: StudentProfile
): { state: EligibilityState; label: string; reason?: string } {
  const course = planCourses.find(c => c.code === courseCode);
  if (!course) {
    return { state: 'NOT_ELIGIBLE', label: 'غير مسموح', reason: 'المادة غير موجودة في الخطة 12' };
  }

  if (student.completedCourses.includes(courseCode)) {
    return { state: 'NOT_ELIGIBLE', label: 'غير مسموح', reason: 'تم اجتياز المادة مسبقاً بنجاح' };
  }

  const isAlreadyRegistered = student.currentRegisteredSections.some(s => s.courseCode === courseCode);
  if (isAlreadyRegistered) {
    return { state: 'NOT_ELIGIBLE', label: 'غير مسموح', reason: 'المادة مسجلة حالياً في جدولك' };
  }

  if (course.reviewRequired || student.reviewCourses?.includes(courseCode)) {
    return {
      state: 'REVIEW_REQUIRED',
      label: 'يحتاج مراجعة',
      reason: course.reviewReason || 'المتطلب السابق يتطلب معادلة أو مراجعة مع المرشد الأكاديمي'
    };
  }

  // Field training and graduation projects are senior-level courses.
  // They only become registerable after completing 90 credited hours.
  const isProjectOrTraining = /مشروع|تدريب/.test(course.name);
  if (isProjectOrTraining && calculateStudentProgress(student).totalCompletedHours < 90) {
    return {
      state: 'NOT_ELIGIBLE',
      label: 'غير مسموح',
      reason: 'يتطلب إتمام 90 ساعة معتمدة قبل تسجيل المشروع أو التدريب الميداني'
    };
  }

  const prereqsMet = arePrerequisitesSatisfied(course.prerequisites, student.completedCourses);
  if (!prereqsMet) {
    return {
      state: 'NOT_ELIGIBLE',
      label: 'غير مسموح',
      reason: `لم يتم استيفاء المتطلب السابق (${course.prerequisites.join(', ')})`
    };
  }

  return { state: 'ELIGIBLE', label: 'مسموح' };
}

// Compute hours breakdown for a student
export function calculateStudentProgress(student: StudentProfile) {
  // Map of completed course credits
  const groupCompletedHours: Record<RequirementGroup, number> = {
    'متطلبات الجامعة الإجبارية': 0,
    'متطلبات الجامعة الاختيارية': 0,
    'متطلبات الكلية الإجبارية': 0,
    'المتطلبات المساندة': 0,
    'متطلبات التخصص الإجبارية': 0,
    'متطلبات التخصص الاختيارية': 0,
  };

  let totalCompletedHours = 0;

  for (const code of student.completedCourses) {
    const course = planCourses.find(c => c.code === code);
    if (course) {
      const group = course.group;
      const currentInGroup = groupCompletedHours[group] || 0;
      const maxForGroup = REQUIREMENT_GROUP_HOURS[group];
      
      // Cap at group maximum for requirement completion
      const applicableHours = Math.min(course.credits, Math.max(0, maxForGroup - currentInGroup));
      groupCompletedHours[group] = currentInGroup + applicableHours;
      totalCompletedHours += course.credits;
    }
  }

  const currentRegisteredHours = student.currentRegisteredSections.reduce(
    (acc, sec) => acc + sec.credits,
    0
  );

  const remainingHours = Math.max(0, TOTAL_PLAN_HOURS - totalCompletedHours);

  return {
    totalPlanHours: TOTAL_PLAN_HOURS,
    totalCompletedHours,
    remainingHours,
    currentRegisteredHours,
    groupCompletedHours,
    groupRequirements: REQUIREMENT_GROUP_HOURS,
    completionPercentage: Math.min(100, Math.round((totalCompletedHours / TOTAL_PLAN_HOURS) * 100)),
  };
}

// Convert "09:30" to minutes from midnight
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Check if two sections have a schedule conflict
export function checkSectionConflict(secA: CourseSection, secB: CourseSection): boolean {
  if (secA.id === secB.id) return false;
  
  // Check overlapping days
  const hasCommonDay = secA.daysArray.some(d => secB.daysArray.includes(d));
  if (!hasCommonDay) return false;

  // Check time overlap
  const startA = timeToMinutes(secA.startTime);
  const endA = timeToMinutes(secA.endTime);
  const startB = timeToMinutes(secB.startTime);
  const endB = timeToMinutes(secB.endTime);

  return Math.max(startA, startB) < Math.min(endA, endB);
}

// Find all conflicts in a set of sections
export function findScheduleConflicts(sections: CourseSection[]): { secA: CourseSection; secB: CourseSection; reason: string }[] {
  const conflicts: { secA: CourseSection; secB: CourseSection; reason: string }[] = [];

  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      if (checkSectionConflict(sections[i], sections[j])) {
        conflicts.push({
          secA: sections[i],
          secB: sections[j],
          reason: `تعارض بين ${sections[i].courseName} (${sections[i].startTime}-${sections[i].endTime}) و ${sections[j].courseName} (${sections[j].startTime}-${sections[j].endTime})`
        });
      }
    }
  }

  return conflicts;
}

/**
 * Builds a practical registration suggestion for the current student.
 * Only courses that are eligible, have an available seat, fit the remaining
 * credit limit, and do not overlap with the existing timetable are returned.
 */
export function getRecommendedRegistrationSections(
  student: StudentProfile,
  offeredSections: CourseSection[],
  basketSections: CourseSection[] = [],
  maxHours = 18
): CourseSection[] {
  const selected = [...student.currentRegisteredSections, ...basketSections];
  let usedHours = selected.reduce((sum, section) => sum + section.credits, 0);
  const recommendation: CourseSection[] = [];

  for (const course of planCourses) {
    if (usedHours >= maxHours) break;

    const eligibility = getRegistrationEligibility(course.code, student);
    const alreadySelected = selected.some(section => section.courseCode === course.code)
      || recommendation.some(section => section.courseCode === course.code);

    if (eligibility.state !== 'ELIGIBLE' || alreadySelected || usedHours + course.credits > maxHours) {
      continue;
    }

    const compatibleSection = offeredSections
      .filter(section => section.courseCode === course.code && section.status === 'متاحة')
      .sort((a, b) => a.sectionNumber - b.sectionNumber)
      .find(section => ![...selected, ...recommendation].some(existing => checkSectionConflict(section, existing)));

    if (compatibleSection) {
      recommendation.push(compatibleSection);
      usedHours += compatibleSection.credits;
    }
  }

  return recommendation;
}
