import type { CourseSection, PlanCourse, StudentProfile } from '../../src/types/student';
import { getRegistrationEligibility, checkSectionConflict } from '../../src/services/academicEngine';
import {
  CurriculumResolutionError,
  LEGACY_AI_PLAN_KEY,
  legacyAiCurriculum,
  resolveStudentCurriculumIdentity,
  type CurriculumDefinition,
} from '../curriculum/curriculum';
import type { UniversityRepository } from '../repositories/universityRepository';

export const DEMO_MAX_CREDIT_HOURS = 18;

export type RegistrationCode =
  | 'ELIGIBLE'
  | 'NOT_ELIGIBLE'
  | 'REVIEW_REQUIRED'
  | 'ALREADY_REGISTERED'
  | 'SECTION_FULL'
  | 'SCHEDULE_CONFLICT'
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'REGISTRATION_CLOSED'
  | 'COURSE_NOT_OFFERED'
  | 'INVALID_SECTION';

export interface RegistrationIssue {
  code: RegistrationCode;
  sectionId?: string;
  courseCode?: string;
  relatedSectionId?: string;
  messageAr: string;
  messageEn: string;
}

export interface RegistrationPreview {
  canRegister: boolean;
  selectedSections: CourseSection[];
  resultingSections: CourseSection[];
  resultingCredits: number;
  maxCredits: number;
  issues: RegistrationIssue[];
}

function field<T>(row: Record<string, unknown>, camel: string, snake: string): T | undefined {
  return (row[camel] ?? row[snake]) as T | undefined;
}

function asPlanCourse(row: Record<string, unknown>): PlanCourse {
  return {
    code: String(field(row, 'code', 'course_code') ?? ''),
    name: String(field(row, 'name', 'course_name') ?? field(row, 'title', 'title') ?? ''),
    credits: Number(field(row, 'credits', 'credit_hours') ?? 0),
    group: String(field(row, 'group', 'requirement_group') ?? field(row, 'type', 'type') ?? '') as PlanCourse['group'],
    type: String(field(row, 'type', 'type') ?? ''),
    prerequisites: Array.isArray(row.prerequisites) ? row.prerequisites.map(String) : [],
    reviewRequired: Boolean(field(row, 'reviewRequired', 'review_required')),
    reviewReason: String(field(row, 'reviewReason', 'review_reason') ?? ''),
    learningType: String(field(row, 'learningType', 'learning_type') ?? ''),
  };
}

function asSection(row: Record<string, unknown>): CourseSection {
  const capacity = Number(field(row, 'capacity', 'capacity') ?? 0);
  const enrolled = Number(field(row, 'enrolled', 'enrolled') ?? 0);
  return {
    id: String(field(row, 'id', 'section_id') ?? ''),
    courseCode: String(field(row, 'courseCode', 'course_code') ?? ''),
    courseName: String(field(row, 'courseName', 'course_name') ?? ''),
    sectionNumber: Number(field(row, 'sectionNumber', 'section_number') ?? 0),
    credits: Number(field(row, 'credits', 'credits') ?? 0),
    instructor: String(field(row, 'instructor', 'instructor') ?? ''),
    days: String(field(row, 'days', 'days') ?? ''),
    daysArray: (field(row, 'daysArray', 'days_array') ?? []) as CourseSection['daysArray'],
    startTime: String(field(row, 'startTime', 'start_time') ?? ''),
    endTime: String(field(row, 'endTime', 'end_time') ?? ''),
    meetings: Array.isArray(row.meetings) ? row.meetings as CourseSection['meetings'] : undefined,
    room: String(field(row, 'room', 'room') ?? ''),
    capacity,
    enrolled,
    status: String(field(row, 'status', 'status') ?? (enrolled < capacity ? 'متاحة' : 'ممتلئة')) as CourseSection['status'],
  };
}

async function curriculumForStudent(repository: UniversityRepository, profile: StudentProfile) {
  const record = await repository.getStudentRecord(profile.universityId);
  const identity = resolveStudentCurriculumIdentity(profile, record);
  const curriculum = await repository.getCurriculum?.(identity.planKey);
  if (curriculum) return curriculum;
  if (identity.planKey === LEGACY_AI_PLAN_KEY) return legacyAiCurriculum(await repository.listCourses());
  throw new CurriculumResolutionError('CURRICULUM_NOT_MAPPED', 'Student curriculum is not registered.');
}

function closedIssue(): RegistrationIssue {
  return { code: 'REGISTRATION_CLOSED', messageAr: 'فترة التسجيل مغلقة حالياً', messageEn: 'Registration is currently closed' };
}

export class RegistrationService {
  constructor(private readonly repository: UniversityRepository) {}

  async context(studentId: string) {
    const profile = await this.repository.getStudent(studentId);
    if (!profile) throw new Error('STUDENT_NOT_FOUND');
    const [calendar, curriculum] = await Promise.all([
      this.repository.getCalendar(),
      curriculumForStudent(this.repository, profile),
    ]);
    return {
      term: calendar.currentTerm,
      registrationOpen: calendar.registrationOpen,
      registrationWindow: calendar.registrationWindow,
      currentEnrollments: profile.currentRegisteredSections,
      registeredCredits: profile.currentRegisteredSections.reduce((sum, item) => sum + item.credits, 0),
      policy: { kind: 'FAKE_UNIVERSITY_DEMO_POLICY', maxCreditHours: DEMO_MAX_CREDIT_HOURS },
      planKey: curriculum.identity.planKey,
    };
  }

  async offerings(studentId: string) {
    const profile = await this.repository.getStudent(studentId);
    if (!profile) throw new Error('STUDENT_NOT_FOUND');
    const [calendar, curriculum] = await Promise.all([
      this.repository.getCalendar(),
      curriculumForStudent(this.repository, profile),
    ]);
    const courses = curriculum.courses.map(asPlanCourse);
    const courseByCode = new Map(courses.map((course) => [course.code, course]));
    const offerings = (await this.repository.listOfferings(calendar.currentTerm.code))
      .map(asSection)
      .filter((section) => courseByCode.has(section.courseCode));
    return offerings.map((section) => ({
      ...section,
      requirementGroup: courseByCode.get(section.courseCode)?.group ?? '',
      prerequisites: courseByCode.get(section.courseCode)?.prerequisites ?? [],
      eligibility: getRegistrationEligibility(section.courseCode, profile, courses),
      availableSeats: Math.max(0, section.capacity - section.enrolled),
    }));
  }

  async preview(studentId: string, sectionIds: string[]): Promise<RegistrationPreview> {
    const profile = await this.repository.getStudent(studentId);
    if (!profile) throw new Error('STUDENT_NOT_FOUND');
    const [calendar, curriculum, rawOfferings] = await Promise.all([
      this.repository.getCalendar(),
      curriculumForStudent(this.repository, profile),
      this.repository.listOfferings(),
    ]);
    const courses = curriculum.courses.map(asPlanCourse);
    const planCodes = new Set(courses.map((course) => course.code));
    const offeringById = new Map(rawOfferings.map(asSection).map((section) => [section.id, section]));
    const issues: RegistrationIssue[] = [];
    if (!calendar.registrationOpen) issues.push(closedIssue());
    if (new Set(sectionIds).size !== sectionIds.length) {
      issues.push({ code: 'INVALID_SECTION', messageAr: 'لا يمكن تكرار الشعبة في الطلب', messageEn: 'A section cannot be repeated in one request' });
    }
    const selectedSections: CourseSection[] = [];
    for (const sectionId of [...new Set(sectionIds)]) {
      const section = offeringById.get(sectionId);
      if (!section) {
        issues.push({ code: 'INVALID_SECTION', sectionId, messageAr: 'الشعبة غير صالحة', messageEn: 'Invalid section' });
        continue;
      }
      if (!planCodes.has(section.courseCode)) {
        issues.push({ code: 'COURSE_NOT_OFFERED', sectionId, courseCode: section.courseCode, messageAr: 'المادة ليست ضمن الخطة الأكاديمية للطالب', messageEn: 'Course is not in the student curriculum' });
        continue;
      }
      if (profile.currentRegisteredSections.some((item) => item.id === section.id || item.courseCode === section.courseCode)) {
        issues.push({ code: 'ALREADY_REGISTERED', sectionId, courseCode: section.courseCode, messageAr: 'المادة مسجلة مسبقاً', messageEn: 'Course is already registered' });
        continue;
      }
      const eligibility = getRegistrationEligibility(section.courseCode, profile, courses);
      if (eligibility.state === 'REVIEW_REQUIRED') {
        issues.push({ code: 'REVIEW_REQUIRED', sectionId, courseCode: section.courseCode, messageAr: eligibility.reason ?? 'تتطلب مراجعة أكاديمية', messageEn: 'Prerequisite relationship requires academic review' });
      } else if (eligibility.state !== 'ELIGIBLE') {
        issues.push({ code: 'NOT_ELIGIBLE', sectionId, courseCode: section.courseCode, messageAr: eligibility.reason ?? 'الطالب غير مؤهل للمادة', messageEn: 'Student is not eligible for this course' });
      }
      if (section.enrolled >= section.capacity) {
        issues.push({ code: 'SECTION_FULL', sectionId, courseCode: section.courseCode, messageAr: 'الشعبة ممتلئة', messageEn: 'Section is full' });
      }
      selectedSections.push(section);
    }
    const resultingSections = [...profile.currentRegisteredSections, ...selectedSections];
    const seenCourses = new Set<string>();
    for (const section of resultingSections) {
      if (seenCourses.has(section.courseCode)) {
        issues.push({ code: 'ALREADY_REGISTERED', sectionId: section.id, courseCode: section.courseCode, messageAr: 'لا يمكن تسجيل أكثر من شعبة للمادة', messageEn: 'Only one section per course may be registered' });
      }
      seenCourses.add(section.courseCode);
    }
    for (let left = 0; left < resultingSections.length; left += 1) {
      for (let right = left + 1; right < resultingSections.length; right += 1) {
        if (checkSectionConflict(resultingSections[left], resultingSections[right])) {
          issues.push({ code: 'SCHEDULE_CONFLICT', sectionId: resultingSections[left].id, relatedSectionId: resultingSections[right].id, messageAr: 'يوجد تعارض في أوقات الشعب', messageEn: 'Selected sections have a schedule conflict' });
        }
      }
    }
    const resultingCredits = resultingSections.reduce((sum, item) => sum + item.credits, 0);
    if (resultingCredits > DEMO_MAX_CREDIT_HOURS) {
      issues.push({ code: 'CREDIT_LIMIT_EXCEEDED', messageAr: 'تم تجاوز الحد الأعلى للساعات في سياسة الجامعة الافتراضية', messageEn: 'Fake University demo credit limit exceeded' });
    }
    return { canRegister: issues.length === 0 && selectedSections.length > 0, selectedSections, resultingSections, resultingCredits, maxCredits: DEMO_MAX_CREDIT_HOURS, issues };
  }

  async register(studentId: string, sectionIds: string[], idempotencyKey: string) {
    const prior = await this.repository.getEventByIdempotencyKey(idempotencyKey);
    if (prior) {
      if (prior.studentId !== studentId || prior.type !== 'schedule.changed') throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      const profile = await this.repository.getStudent(studentId);
      if (!profile || !sectionIds.every((id) => profile.currentRegisteredSections.some((item) => item.id === id))) {
        throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      }
      return { success: true as const, duplicate: true, enrollments: profile.currentRegisteredSections };
    }
    const preview = await this.preview(studentId, sectionIds);
    if (!preview.canRegister) {
      await this.repository.recordRegistrationAudit(studentId, { action: 'REGISTER', outcome: 'REJECTED',
        rejectionCodes: [...new Set(preview.issues.map((item) => item.code))], sectionIds, source: 'morshidi' }, `${idempotencyKey}:audit`);
      return { success: false as const, preview };
    }
    let result;
    try {
      result = await this.repository.registerSections(studentId, preview.resultingSections.map((item) => item.id), idempotencyKey);
    } catch (error) {
      const rejectionCode = error instanceof Error ? error.message : 'REGISTRATION_FAILED';
      await this.repository.recordRegistrationAudit(studentId, { action: 'REGISTER', outcome: 'REJECTED',
        rejectionCodes: [rejectionCode], sectionIds, source: 'morshidi' }, `${idempotencyKey}:audit`);
      throw error;
    }
    await this.repository.recordRegistrationAudit(studentId, { action: 'REGISTER', outcome: 'CONFIRMED',
      rejectionCodes: [], sectionIds, source: 'morshidi', duplicate: result.duplicate }, `${idempotencyKey}:audit`);
    return { success: true as const, duplicate: result.duplicate, enrollments: result.sections, preview };
  }

  async drop(studentId: string, sectionId: string, idempotencyKey: string) {
    const prior = await this.repository.getEventByIdempotencyKey(idempotencyKey);
    if (prior) {
      if (prior.studentId !== studentId || prior.type !== 'schedule.changed') throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      const profile = await this.repository.getStudent(studentId);
      if (!profile || profile.currentRegisteredSections.some((item) => item.id === sectionId)) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return { success: true as const, duplicate: true, enrollments: profile.currentRegisteredSections };
    }
    const [profile, calendar] = await Promise.all([this.repository.getStudent(studentId), this.repository.getCalendar()]);
    if (!profile) throw new Error('STUDENT_NOT_FOUND');
    if (!calendar.registrationOpen) {
      await this.repository.recordRegistrationAudit(studentId, { action: 'DROP', outcome: 'REJECTED',
        rejectionCodes: ['REGISTRATION_CLOSED'], sectionIds: [sectionId], source: 'morshidi' }, `${idempotencyKey}:audit`);
      return { success: false as const, issues: [closedIssue()] };
    }
    if (!profile.currentRegisteredSections.some((item) => item.id === sectionId)) {
      await this.repository.recordRegistrationAudit(studentId, { action: 'DROP', outcome: 'REJECTED',
        rejectionCodes: ['INVALID_SECTION'], sectionIds: [sectionId], source: 'morshidi' }, `${idempotencyKey}:audit`);
      return { success: false as const, issues: [{ code: 'INVALID_SECTION' as const, sectionId, messageAr: 'الشعبة غير مسجلة للطالب', messageEn: 'Section is not registered for this student' }] };
    }
    const finalIds = profile.currentRegisteredSections.filter((item) => item.id !== sectionId).map((item) => item.id);
    let result;
    try {
      result = await this.repository.registerSections(studentId, finalIds, idempotencyKey);
    } catch (error) {
      const rejectionCode = error instanceof Error ? error.message : 'REGISTRATION_FAILED';
      await this.repository.recordRegistrationAudit(studentId, { action: 'DROP', outcome: 'REJECTED',
        rejectionCodes: [rejectionCode], sectionIds: [sectionId], source: 'morshidi' }, `${idempotencyKey}:audit`);
      throw error;
    }
    await this.repository.recordRegistrationAudit(studentId, { action: 'DROP', outcome: 'CONFIRMED', rejectionCodes: [],
      sectionIds: [sectionId], source: 'morshidi', duplicate: result.duplicate }, `${idempotencyKey}:audit`);
    return { success: true as const, duplicate: result.duplicate, enrollments: result.sections };
  }
}

