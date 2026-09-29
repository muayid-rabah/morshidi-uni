export type RequirementGroup =
  | 'متطلبات الجامعة الإجبارية'
  | 'متطلبات الجامعة الاختيارية'
  | 'متطلبات الكلية الإجبارية'
  | 'المتطلبات المساندة'
  | 'متطلبات التخصص الإجبارية'
  | 'متطلبات التخصص الاختيارية';

export type CourseStatus =
  | 'منجزة'          // COMPLETED
  | 'مسجلة حاليًا'   // CURRENTLY_REGISTERED
  | 'متاحة للتسجيل'  // ELIGIBLE_TO_REGISTER
  | 'غير منجزة'       // NOT_COMPLETED
  | 'غير متاحة'       // PREREQUISITES_NOT_MET
  | 'تحتاج مراجعة';  // REVIEW_REQUIRED

export type EligibilityState = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'REVIEW_REQUIRED';

export interface PlanCourse {
  code: string;
  name: string;
  credits: number;
  group: RequirementGroup;
  type: string;
  prerequisites: string[];
  reviewRequired?: boolean;
  reviewReason?: string;
  learningType: string;
}

export interface CourseGrade {
  courseCode: string;
  courseName: string;
  credits: number;
  grade: number; // e.g. 85
  letterGrade: string; // e.g. 'A', 'B+', etc.
  status: 'ناجح' | 'راسب' | 'منسحب';
  semesterId: string;
  semesterName: string;
}

export interface SemesterRecord {
  semesterId: string;
  semesterName: string;
  registeredHours: number;
  passedHours: number;
  semesterGpa: number;
  cumulativeGpa: number;
  courses: CourseGrade[];
}

export interface CourseSection {
  id: string;
  courseCode: string;
  courseName: string;
  sectionNumber: number;
  credits: number;
  instructor: string;
  days: string; // e.g. 'ح ث خ' or 'ن ر'
  daysArray: ('الأحد' | 'الاثنين' | 'الثلاثاء' | 'الأربعاء' | 'الخميس')[];
  startTime: string; // e.g. '09:30'
  endTime: string;   // e.g. '10:30'
  room: string;
  capacity: number;
  enrolled: number;
  status: 'متاحة' | 'ممتلئة' | 'مغلقة' | 'قائمة انتظار';
}

export interface AbsenceRecord {
  courseCode: string;
  courseName: string;
  instructor: string;
  totalLectures: number;
  absencesCount: number;
  absencePercentage: number;
  status: 'طبيعي' | 'تنبيه' | 'مرتفع';
}

export interface ExamRecord {
  courseCode: string;
  courseName: string;
  examType: 'الامتحان الأول' | 'الامتحان الثاني' | 'الامتحان النهائي';
  date: string; // YYYY-MM-DD
  dayName: string;
  time: string;
  room: string;
  seatNumber?: string;
}

export interface FinancialTransaction {
  id: string;
  date: string;
  reference: string;
  statement: string; // البيان
  debit: number;     // مدين
  credit: number;    // دائن
  balance: number;   // الرصيد
}

export interface StudentProfile {
  id: string;
  name: string;
  universityId: string;
  faculty: string;
  major: string;
  degree: string;
  studyType: string;
  admissionYear: number;
  studyPlan: string;
  academicAdvisor: string;
  academicStatus: string;
  avatarUrl?: string;
  profileType: 'advanced' | 'mid' | 'review' | 'early' | 'freshman';
  profileDescription: string;
  
  // Academic history & states
  completedCourses: string[]; // Course codes
  reviewCourses?: string[];   // Course codes that specifically require academic review
  currentRegisteredSections: CourseSection[];
  semesterHistory: SemesterRecord[];
  absences: AbsenceRecord[];
  exams: ExamRecord[];
  
  // Financial
  financialSummary: {
    previousBalance: number;
    totalFees: number;
    totalPayments: number;
    totalDiscounts: number;
    currentBalance: number;
  };
  transactions: FinancialTransaction[];
}

export interface AcademicDate {
  id: string;
  title: string;
  date: string;
  hijriDate?: string;
  status: 'مفتوح الآن' | 'مغلق' | 'قادم';
  description: string;
}
