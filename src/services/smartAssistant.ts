import type { PlanCourse, StudentProfile } from '../types/student';
import { calculateStudentProgress, getRegistrationEligibility } from './academicEngine';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedActions?: { label: string; action: string }[];
}

/** Answers are derived only from the signed-in student's live profile and current catalog. */
export function generateAssistantResponse(question: string, student: StudentProfile, courses: PlanCourse[]): string {
  const q = question.trim().toLocaleLowerCase();
  const progress = calculateStudentProgress(student, courses);
  const semester = student.semesterHistory[student.semesterHistory.length - 1];
  const active = student.currentRegisteredSections;
  if (/معدل|gpa/.test(q)) {
    return `معدلك التراكمي المسجل: ${semester?.cumulativeGpa ?? 'غير متوفر'} من 100. آخر معدل فصلي: ${semester?.semesterGpa ?? 'غير متوفر'}.`;
  }
  if (/ساعة|ساعات|تخرج|تخرّج/.test(q)) {
    return `أنجزت ${progress.totalCompletedHours} ساعة من ${progress.totalPlanHours}، والمتبقي ${progress.remainingHours} ساعة. مسجل لك حاليًا ${active.reduce((n, s) => n + s.credits, 0)} ساعة.`;
  }
  if (/مسجل|منزل|جدول|شعب/.test(q)) {
    if (!active.length) return 'لا توجد مواد مسجلة في السجل الحالي.';
    return `موادك المسجلة الآن:\n${active.map(section => `- ${section.courseName} (${section.courseCode}) · ${section.credits} ساعات · ${section.days} ${section.startTime}–${section.endTime}`).join('\n')}`;
  }
  if (/أقدر|استطيع|مؤهل|أنزل|اسجل|أسجل/.test(q)) {
    const eligible = courses.filter(course => getRegistrationEligibility(course.code, student, courses).state === 'ELIGIBLE');
    return eligible.length ? `مواد مستوفية لمتطلباتها السابقة حسب سجلك:\n${eligible.slice(0, 12).map(course => `- ${course.name} (${course.code}) · ${course.credits} ساعات`).join('\n')}\nتأكد من صفحة التسجيل لمعرفة الشعب المفتوحة والمقاعد.` : 'لا توجد مواد مؤهلة ظاهرة في الخطة الحالية.';
  }
  const recent = semester?.courses.slice(-6) ?? [];
  if (recent.length) return `أهلًا ${student.name}. أقدر أراجع سجلك الدراسي. آخر مواد ظاهرة:\n${recent.map(course => `- ${course.courseName}: ${course.letterGrade}`).join('\n')}`;
  return `أهلًا ${student.name}. لا تظهر محاولات دراسية في السجل الحالي بعد.`;
}
