import type { PlanCourse, RequirementGroup, CourseStatus, EligibilityState, StudentProfile, CourseSection } from '../types/student';

export const GOVERNED_DEGREE_PLAN_CREDITS = 132;

export const GOVERNED_GROUP_REQUIREMENTS: Record<RequirementGroup, number> = {
  "\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u062c\u0628\u0627\u0631\u064a\u0629": 18,
  "\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0627\u062e\u062a\u064a\u0627\u0631\u064a\u0629": 9,
  "\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0643\u0644\u064a\u0629 \u0627\u0644\u0625\u062c\u0628\u0627\u0631\u064a\u0629": 21,
  "\u0627\u0644\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0645\u0633\u0627\u0646\u062f\u0629": 12,
  "\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u062e\u0635\u0635 \u0627\u0644\u0625\u062c\u0628\u0627\u0631\u064a\u0629": 63,
  "\u0645\u062a\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u062e\u0635\u0635 \u0627\u0644\u0627\u062e\u062a\u064a\u0627\u0631\u064a\u0629": 9,
};


export function getRequirementHours(_courses: PlanCourse[]): Record<string, number> {
  return { ...GOVERNED_GROUP_REQUIREMENTS };
}

export function arePrerequisitesSatisfied(prereqs: string[], completedCourses: string[]): boolean {
  return !prereqs?.length || prereqs.every((code) => completedCourses.includes(code));
}

export function getCourseStatusForStudent(course: PlanCourse, student: StudentProfile): CourseStatus {
  if (student.completedCourses.includes(course.code)) return 'منجزة';
  if (student.currentRegisteredSections.some((section) => section.courseCode === course.code)) return 'مسجلة حاليًا';
  if (course.reviewRequired || student.reviewCourses?.includes(course.code)) return 'تحتاج مراجعة';
  return arePrerequisitesSatisfied(course.prerequisites, student.completedCourses) ? 'متاحة للتسجيل' : 'غير متاحة';
}

export function getRegistrationEligibility(
  courseCode: string,
  student: StudentProfile,
  courses: PlanCourse[],
): { state: EligibilityState; label: string; reason?: string } {
  const course = courses.find((item) => item.code === courseCode);
  if (!course) return { state: 'NOT_ELIGIBLE', label: 'غير مؤهل', reason: 'المادة غير موجودة في الخطة' };
  if (student.completedCourses.includes(courseCode)) return { state: 'NOT_ELIGIBLE', label: 'غير مؤهل', reason: 'المادة مجتازة سابقًا' };
  if (student.currentRegisteredSections.some((section) => section.courseCode === courseCode)) {
    return { state: 'NOT_ELIGIBLE', label: 'غير مؤهل', reason: 'المادة مسجلة حاليًا' };
  }
  if (course.reviewRequired || student.reviewCourses?.includes(courseCode)) {
    return { state: 'REVIEW_REQUIRED', label: 'تحتاج مراجعة', reason: course.reviewReason || 'تحتاج مراجعة المرشد الأكاديمي' };
  }
  const isProjectOrTraining = /مشروع|تدريب/.test(course.name);
  if (isProjectOrTraining && calculateStudentProgress(student, courses).totalCompletedHours < 90) {
    return { state: 'NOT_ELIGIBLE', label: 'غير مؤهل', reason: 'تتطلب 90 ساعة منجزة' };
  }
  if (!arePrerequisitesSatisfied(course.prerequisites, student.completedCourses)) {
    return { state: 'NOT_ELIGIBLE', label: 'غير مؤهل', reason: `المتطلبات السابقة: ${course.prerequisites.join('، ')}` };
  }
  return { state: 'ELIGIBLE', label: 'مؤهل' };
}

export function calculateStudentProgress(student: StudentProfile, courses: PlanCourse[]) {
  const groupRequirements = getRequirementHours(courses);
  const groupCompletedHours = Object.fromEntries(
    Object.keys(groupRequirements).map((group) => [group, 0]),
  ) as Record<RequirementGroup, number>;

  let fallbackCompletedHours = 0;

  for (const code of student.completedCourses) {
    const course = courses.find((item) => item.code === code);
    if (!course) continue;

    const groupHours = groupCompletedHours[course.group] || 0;
    const limit = groupRequirements[course.group] || 0;
    const creditedHours = Math.min(course.credits, Math.max(0, limit - groupHours));

    groupCompletedHours[course.group] = groupHours + creditedHours;
    fallbackCompletedHours += creditedHours;
  }

  const reportedEarnedCredits =
    typeof student.earnedCredits === 'number'
      ? student.earnedCredits
      : typeof student.earned_credits === 'number'
        ? student.earned_credits
        : fallbackCompletedHours;

  const totalPlanHours = GOVERNED_DEGREE_PLAN_CREDITS;
  const totalCompletedHours = Math.max(0, reportedEarnedCredits);

  const currentRegisteredHours = student.currentRegisteredSections.reduce(
    (sum, section) => sum + section.credits,
    0,
  );

  const remainingHours = Math.max(0, totalPlanHours - totalCompletedHours);

  const completionPercentage = totalPlanHours
    ? Math.min(
        100,
        Math.round((totalCompletedHours / totalPlanHours) * 1000) / 10,
      )
    : 0;

  return {
    totalPlanHours,
    totalCompletedHours,
    remainingHours,
    currentRegisteredHours,
    groupCompletedHours,
    groupRequirements,
    completionPercentage,
  };
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function checkSectionConflict(sectionA: CourseSection, sectionB: CourseSection): boolean {
  if (sectionA.id === sectionB.id) return false;
  if (!sectionA.daysArray.some((day) => sectionB.daysArray.includes(day))) return false;
  return Math.max(timeToMinutes(sectionA.startTime), timeToMinutes(sectionB.startTime)) <
    Math.min(timeToMinutes(sectionA.endTime), timeToMinutes(sectionB.endTime));
}

export function findScheduleConflicts(sections: CourseSection[]) {
  const conflicts: { secA: CourseSection; secB: CourseSection; reason: string }[] = [];
  for (let left = 0; left < sections.length; left += 1) {
    for (let right = left + 1; right < sections.length; right += 1) {
      if (checkSectionConflict(sections[left], sections[right])) {
        conflicts.push({ secA: sections[left], secB: sections[right], reason: `تعارض بين ${sections[left].courseName} و${sections[right].courseName}` });
      }
    }
  }
  return conflicts;
}

export function getRecommendedRegistrationSections(
  student: StudentProfile,
  offeredSections: CourseSection[],
  courses: PlanCourse[],
  basketSections: CourseSection[] = [],
  maxHours = 18,
): CourseSection[] {
  const selected = [...student.currentRegisteredSections, ...basketSections];
  let usedHours = selected.reduce((sum, section) => sum + section.credits, 0);
  const recommendation: CourseSection[] = [];
  for (const course of courses) {
    if (usedHours >= maxHours) break;
    const eligibility = getRegistrationEligibility(course.code, student, courses);
    const alreadySelected = [...selected, ...recommendation].some((section) => section.courseCode === course.code);
    if (eligibility.state !== 'ELIGIBLE' || alreadySelected || usedHours + course.credits > maxHours) continue;
    const compatible = offeredSections
      .filter((section) => section.courseCode === course.code && section.status === 'متاحة' && section.enrolled < section.capacity)
      .sort((left, right) => left.sectionNumber - right.sectionNumber)
      .find((section) => ![...selected, ...recommendation].some((existing) => checkSectionConflict(section, existing)));
    if (compatible) {
      recommendation.push(compatible);
      usedHours += compatible.credits;
    }
  }
  return recommendation;
}
