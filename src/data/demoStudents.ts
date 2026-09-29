import { StudentProfile } from '../types/student';
import { offeredCourseSections } from './offeredSections';

// Helper to look up section by ID
const getSec = (id: string) => {
  const s = offeredCourseSections.find(sec => sec.id === id);
  if (!s) throw new Error(`Section not found: ${id}`);
  return s;
};

export const demoStudents: StudentProfile[] = [
  // ==========================================
  // STUDENT 1: أحمد محمود الخطيب (Advanced)
  // ==========================================
  {
    id: 'student-1',
    name: 'أحمد محمود الخطيب',
    universityId: '202310001',
    faculty: 'كلية تكنولوجيا المعلومات',
    major: 'الذكاء الاصطناعي',
    degree: 'بكالوريوس',
    studyType: 'انتظام',
    admissionYear: 2023,
    studyPlan: 'خطة 12',
    academicAdvisor: 'د. سامر العلي',
    academicStatus: 'منتظم (مستوى متقدم - مرتبة الشرف)',
    profileType: 'advanced',
    profileDescription: 'طالب في السنة الرابعة - مستوى متقدم، أنجز أغلب متطلبات الخطة بنجاح وتفوق.',
    completedCourses: [
      // University Required (18)
      '0200104', '0200105', '0200106', '0200110', '0200111', '0200115', '0200153', '0200154', '0400202',
      // University Elective (9)
      '0200113', '0200114', '0200122',
      // Faculty Required (21)
      '0300220', '1501110', '1501112', '1501221', '1501375', '1501476', '1502100', '1503100',
      // Supporting (12)
      '0200215', '0300104', '0300153', '0301245',
      // Major Required (completed so far)
      '1501111', '1501113', '1501222', '1501321', '1501340', '1501430', '1503270', '1505101', '1505201', '1505223', '1505311', '1505333', '1505381', '1505467', '1506180', '1506181',
      // Major Electives completed (3)
      '1501385'
    ],
    currentRegisteredSections: [
      getSec('SEC-1505468-1'), // مشروع (2) في الذكاء الاصطناعي (2 cr)
      getSec('SEC-1505461-1'), // الرؤية الحاسوبية (3 cr)
      getSec('SEC-1505415-1'), // التعلم العميق التطبيقي (3 cr)
      getSec('SEC-1505441-1'), // معالجة اللغات الطبيعية (3 cr)
      getSec('SEC-1505480-1'), // البيانات الضخمة (3 cr)
    ],
    semesterHistory: [
      {
        semesterId: '2023-1',
        semesterName: '2023/2024 - الفصل الأول',
        registeredHours: 16,
        passedHours: 16,
        semesterGpa: 92.4,
        cumulativeGpa: 92.4,
        courses: [
          { courseCode: '0200104', courseName: 'التربية الوطنية', credits: 3, grade: 90, letterGrade: 'A', status: 'ناجح', semesterId: '2023-1', semesterName: '2023/2024 - الفصل الأول' },
          { courseCode: '0200110', courseName: 'العلوم العسكرية', credits: 3, grade: 88, letterGrade: 'A-', status: 'ناجح', semesterId: '2023-1', semesterName: '2023/2024 - الفصل الأول' },
          { courseCode: '0300153', courseName: 'تفاضل وتكامل (1)', credits: 3, grade: 85, letterGrade: 'B+', status: 'ناجح', semesterId: '2023-1', semesterName: '2023/2024 - الفصل الأول' },
          { courseCode: '1501110', courseName: 'برمجة الحاسوب (1)', credits: 3, grade: 94, letterGrade: 'A', status: 'ناجح', semesterId: '2023-1', semesterName: '2023/2024 - الفصل الأول' },
          { courseCode: '1501111', courseName: 'مختبر برمجة الحاسوب (1)', credits: 1, grade: 95, letterGrade: 'A+', status: 'ناجح', semesterId: '2023-1', semesterName: '2023/2024 - الفصل الأول' },
          { courseCode: '0200153', courseName: 'المهارات الحياتية', credits: 1, grade: 92, letterGrade: 'A', status: 'ناجح', semesterId: '2023-1', semesterName: '2023/2024 - الفصل الأول' },
          { courseCode: '0200105', courseName: 'مهارات الاتصال والتواصل (اللغة العربية 1)', credits: 2, grade: 87, letterGrade: 'B+', status: 'ناجح', semesterId: '2023-1', semesterName: '2023/2024 - الفصل الأول' }
        ]
      },
      {
        semesterId: '2023-2',
        semesterName: '2023/2024 - الفصل الثاني',
        registeredHours: 18,
        passedHours: 18,
        semesterGpa: 94.6,
        cumulativeGpa: 93.5,
        courses: [
          { courseCode: '1501112', courseName: 'برمجة الحاسوب (2)', credits: 3, grade: 96, letterGrade: 'A+', status: 'ناجح', semesterId: '2023-2', semesterName: '2023/2024 - الفصل الثاني' },
          { courseCode: '1501113', courseName: 'مختبر برمجة الحاسوب (2)', credits: 1, grade: 94, letterGrade: 'A', status: 'ناجح', semesterId: '2023-2', semesterName: '2023/2024 - الفصل الثاني' },
          { courseCode: '0300220', courseName: 'رياضيات متقطعة', credits: 3, grade: 91, letterGrade: 'A', status: 'ناجح', semesterId: '2023-2', semesterName: '2023/2024 - الفصل الثاني' },
          { courseCode: '0301245', courseName: 'الجبر الخطي', credits: 3, grade: 88, letterGrade: 'A-', status: 'ناجح', semesterId: '2023-2', semesterName: '2023/2024 - الفصل الثاني' },
          { courseCode: '0200106', courseName: 'مهارات الاتصال والتواصل (اللغة الانجليزية 1)', credits: 3, grade: 90, letterGrade: 'A', status: 'ناجح', semesterId: '2023-2', semesterName: '2023/2024 - الفصل الثاني' },
          { courseCode: '1505101', courseName: 'البرمجة بلغة بايثون', credits: 3, grade: 98, letterGrade: 'A+', status: 'ناجح', semesterId: '2023-2', semesterName: '2023/2024 - الفصل الثاني' },
          { courseCode: '0400202', courseName: 'الريادة والابتكار', credits: 2, grade: 92, letterGrade: 'A', status: 'ناجح', semesterId: '2023-2', semesterName: '2023/2024 - الفصل الثاني' }
        ]
      },
      {
        semesterId: '2024-1',
        semesterName: '2024/2025 - الفصل الأول',
        registeredHours: 18,
        passedHours: 18,
        semesterGpa: 93.1,
        cumulativeGpa: 93.4,
        courses: [
          { courseCode: '1501221', courseName: 'تراكيب البيانات', credits: 3, grade: 89, letterGrade: 'A-', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '1505201', courseName: 'مقدمة في الذكاء الاصطناعي', credits: 3, grade: 95, letterGrade: 'A', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '0300104', courseName: 'الإحصاء والاحتمالات', credits: 3, grade: 84, letterGrade: 'B', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '1501222', courseName: 'نظم قواعد البيانات', credits: 3, grade: 93, letterGrade: 'A', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '0200111', courseName: 'الثقافة الاسلامية وقضايا العصر', credits: 3, grade: 92, letterGrade: 'A', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '1506180', courseName: 'برمجة ويب (1)', credits: 3, grade: 90, letterGrade: 'A', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' }
        ]
      },
      {
        semesterId: '2024-2',
        semesterName: '2024/2025 - الفصل الثاني',
        registeredHours: 18,
        passedHours: 18,
        semesterGpa: 94.0,
        cumulativeGpa: 93.6,
        courses: [
          { courseCode: '1505311', courseName: 'تعلم الالة', credits: 3, grade: 96, letterGrade: 'A+', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '1501321', courseName: 'تصميم وتحليل الخوارزميات', credits: 3, grade: 88, letterGrade: 'A-', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '1505223', courseName: 'برمجة وأدوات الذكاء الإصطناعي', credits: 3, grade: 94, letterGrade: 'A', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '1501340', courseName: 'شبكات الحاسوب', credits: 3, grade: 90, letterGrade: 'A', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '0200215', courseName: 'لغة انجليزية لأغراض خاصة بتكنولوجيا المعلومات (ESP-IT)', credits: 3, grade: 92, letterGrade: 'A', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '1505333', courseName: 'علم البيانات وتحليلها', credits: 3, grade: 93, letterGrade: 'A', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' }
        ]
      },
      {
        semesterId: '2025-1',
        semesterName: '2025/2026 - الفصل الأول',
        registeredHours: 16,
        passedHours: 16,
        semesterGpa: 93.8,
        cumulativeGpa: 93.6,
        courses: [
          { courseCode: '1505467', courseName: 'مشروع (1) في الذكاء الاصطناعي', credits: 1, grade: 95, letterGrade: 'A', status: 'ناجح', semesterId: '2025-1', semesterName: '2025/2026 - الفصل الأول' },
          { courseCode: '1501430', courseName: 'نظم التشغيل', credits: 3, grade: 87, letterGrade: 'B+', status: 'ناجح', semesterId: '2025-1', semesterName: '2025/2026 - الفصل الأول' },
          { courseCode: '1503270', courseName: 'مقدمة لهندسة البرمجيات', credits: 3, grade: 91, letterGrade: 'A', status: 'ناجح', semesterId: '2025-1', semesterName: '2025/2026 - الفصل الأول' },
          { courseCode: '1505381', courseName: 'مقدمة في الروبوتات', credits: 3, grade: 90, letterGrade: 'A', status: 'ناجح', semesterId: '2025-1', semesterName: '2025/2026 - الفصل الأول' },
          { courseCode: '1501385', courseName: 'برمجة الهواتف الذكية', credits: 3, grade: 92, letterGrade: 'A', status: 'ناجح', semesterId: '2025-1', semesterName: '2025/2026 - الفصل الأول' },
          { courseCode: '0200113', courseName: 'تاريخ الاردن وفلسطين', credits: 3, grade: 94, letterGrade: 'A', status: 'ناجح', semesterId: '2025-1', semesterName: '2025/2026 - الفصل الأول' }
        ]
      }
    ],
    absences: [
      { courseCode: '1505468', courseName: 'مشروع (2) في الذكاء الاصطناعي', instructor: 'لجنة مشاريع التخرج', totalLectures: 14, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' },
      { courseCode: '1505461', courseName: 'الرؤية الحاسوبية', instructor: 'د. نور حداد', totalLectures: 24, absencesCount: 1, absencePercentage: 4.1, status: 'طبيعي' },
      { courseCode: '1505415', courseName: 'التعلم العميق التطبيقي', instructor: 'د. رامي منصور', totalLectures: 24, absencesCount: 2, absencePercentage: 8.3, status: 'طبيعي' },
      { courseCode: '1505441', courseName: 'معالجة اللغات الطبيعية', instructor: 'د. سامر العلي', totalLectures: 16, absencesCount: 1, absencePercentage: 6.2, status: 'طبيعي' },
      { courseCode: '1505480', courseName: 'البيانات الضخمة', instructor: 'د. رامي منصور', totalLectures: 16, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' },
    ],
    exams: [
      { courseCode: '1505415', courseName: 'التعلم العميق التطبيقي', examType: 'الامتحان الأول', date: '2026-11-04', dayName: 'الأربعاء', time: '10:00 - 11:30', room: 'مختبر الحوسبة الفائقة', seatNumber: 'A-12' },
      { courseCode: '1505461', courseName: 'الرؤية الحاسوبية', examType: 'الامتحان الأول', date: '2026-11-08', dayName: 'الأحد', time: '12:00 - 13:30', room: 'مختبر الرؤية IT', seatNumber: 'B-04' },
      { courseCode: '1505441', courseName: 'معالجة اللغات الطبيعية', examType: 'الامتحان الأول', date: '2026-11-11', dayName: 'الأربعاء', time: '12:30 - 14:00', room: 'قاعة IT-206', seatNumber: 'C-18' },
      { courseCode: '1505480', courseName: 'البيانات الضخمة', examType: 'الامتحان الأول', date: '2026-11-16', dayName: 'الاثنين', time: '14:00 - 15:30', room: 'قاعة IT-303', seatNumber: 'A-09' },
      { courseCode: '1505468', courseName: 'مشروع (2) في الذكاء الاصطناعي', examType: 'الامتحان النهائي', date: '2027-01-22', dayName: 'الخميس', time: '14:00 - 17:00', room: 'قاعة المناقشات', seatNumber: 'Team 03' },
    ],
    financialSummary: {
      previousBalance: 0,
      totalFees: 750,
      totalPayments: 750,
      totalDiscounts: 75,
      currentBalance: 0,
    },
    transactions: [
      { id: 'TXN-101', date: '2026-09-10', reference: 'REC-2026-8801', statement: 'رسوم تسجيل فصل دراسي', debit: 50, credit: 0, balance: 50 },
      { id: 'TXN-102', date: '2026-09-10', reference: 'CRS-2026-8802', statement: 'رسوم ساعات معتمدة (14 ساعة)', debit: 700, credit: 0, balance: 750 },
      { id: 'TXN-103', date: '2026-09-12', reference: 'DISC-2026-004', statement: 'خصم منحة تفوق أكاديمي (10%)', debit: 0, credit: 75, balance: 675 },
      { id: 'TXN-104', date: '2026-09-15', reference: 'PAY-CLI-9092', statement: 'دفعة بنكية إلكترونية - إي فواتيركم', debit: 0, credit: 675, balance: 0 },
    ]
  },

  // ==========================================
  // STUDENT 2: ليان أحمد الحسن (Mid-program)
  // ==========================================
  {
    id: 'student-2',
    name: 'ليان أحمد الحسن',
    universityId: '202410002',
    faculty: 'كلية تكنولوجيا المعلومات',
    major: 'الذكاء الاصطناعي',
    degree: 'بكالوريوس',
    studyType: 'انتظام',
    admissionYear: 2024,
    studyPlan: 'خطة 12',
    academicAdvisor: 'د. نور حداد',
    academicStatus: 'منتظم (مستوى متوسط - جيد جداً)',
    profileType: 'mid',
    profileDescription: 'طالبة في منتصف مسارها الأكاديمي، قطعت شوطاً مميزاً في الأساسيات وبدأت في تخصص الذكاء الاصطناعي.',
    completedCourses: [
      // University Required (12)
      '0200104', '0200105', '0200106', '0200110', '0200115', '0200153',
      // University Elective (6)
      '0200113', '0200114',
      // Faculty Required (15)
      '0300220', '1501110', '1501112', '1501221', '1502100',
      // Supporting (9)
      '0300104', '0300153', '0301245',
      // Major Required (18)
      '1501111', '1501113', '1505101', '1505201', '1506180', '1506181'
    ],
    currentRegisteredSections: [
      getSec('SEC-1505311-1'), // تعلم الالة (3 cr)
      getSec('SEC-1501222-1'), // نظم قواعد البيانات (3 cr)
      getSec('SEC-1501340-1'), // شبكات الحاسوب (3 cr)
      getSec('SEC-1505223-1'), // برمجة وأدوات الذكاء الإصطناعي (3 cr)
      getSec('SEC-0200215-1'), // ESP-IT (3 cr)
    ],
    semesterHistory: [
      {
        semesterId: '2024-1',
        semesterName: '2024/2025 - الفصل الأول',
        registeredHours: 16,
        passedHours: 16,
        semesterGpa: 84.8,
        cumulativeGpa: 84.8,
        courses: [
          { courseCode: '0200104', courseName: 'التربية الوطنية', credits: 3, grade: 84, letterGrade: 'B', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '0300153', courseName: 'تفاضل وتكامل (1)', credits: 3, grade: 80, letterGrade: 'B-', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '1501110', courseName: 'برمجة الحاسوب (1)', credits: 3, grade: 91, letterGrade: 'A', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '1501111', courseName: 'مختبر برمجة الحاسوب (1)', credits: 1, grade: 92, letterGrade: 'A', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '0200105', courseName: 'مهارات الاتصال والتواصل (اللغة العربية 1)', credits: 3, grade: 88, letterGrade: 'A-', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '0200110', courseName: 'العلوم العسكرية', credits: 3, grade: 85, letterGrade: 'B+', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' }
        ]
      },
      {
        semesterId: '2024-2',
        semesterName: '2024/2025 - الفصل الثاني',
        registeredHours: 16,
        passedHours: 16,
        semesterGpa: 83.2,
        cumulativeGpa: 84.0,
        courses: [
          { courseCode: '1501112', courseName: 'برمجة الحاسوب (2)', credits: 3, grade: 86, letterGrade: 'B+', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '1501113', courseName: 'مختبر برمجة الحاسوب (2)', credits: 1, grade: 90, letterGrade: 'A', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '0300220', courseName: 'رياضيات متقطعة', credits: 3, grade: 82, letterGrade: 'B-', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '0301245', courseName: 'الجبر الخطي', credits: 3, grade: 85, letterGrade: 'B+', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '1505101', courseName: 'البرمجة بلغة بايثون', credits: 3, grade: 92, letterGrade: 'A', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '0200106', courseName: 'مهارات الاتصال والتواصل (اللغة الانجليزية 1)', credits: 3, grade: 80, letterGrade: 'B-', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' }
        ]
      }
    ],
    absences: [
      { courseCode: '1505311', courseName: 'تعلم الالة', instructor: 'د. رامي منصور', totalLectures: 24, absencesCount: 1, absencePercentage: 4.1, status: 'طبيعي' },
      { courseCode: '1501222', courseName: 'نظم قواعد البيانات', instructor: 'د. إياد الحمود', totalLectures: 24, absencesCount: 2, absencePercentage: 8.3, status: 'طبيعي' },
      { courseCode: '1501340', courseName: 'شبكات الحاسوب', instructor: 'د. عمار غرايبة', totalLectures: 24, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' },
      { courseCode: '1505223', courseName: 'برمجة وأدوات الذكاء الإصطناعي', instructor: 'د. سامر العلي', totalLectures: 16, absencesCount: 1, absencePercentage: 6.2, status: 'طبيعي' },
      { courseCode: '0200215', courseName: 'لغة انجليزية لأغراض خاصة بتكنولوجيا المعلومات (ESP-IT)', instructor: 'أ. دانيال حداد', totalLectures: 16, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' }
    ],
    exams: [
      { courseCode: '1501222', courseName: 'نظم قواعد البيانات', examType: 'الامتحان الأول', date: '2026-11-03', dayName: 'الثلاثاء', time: '09:00 - 10:30', room: 'قاعة IT-103', seatNumber: 'C-22' },
      { courseCode: '1505311', courseName: 'تعلم الالة', examType: 'الامتحان الأول', date: '2026-11-05', dayName: 'الخميس', time: '11:00 - 12:30', room: 'قاعة IT-301', seatNumber: 'D-05' },
      { courseCode: '1501340', courseName: 'شبكات الحاسوب', examType: 'الامتحان الأول', date: '2026-11-10', dayName: 'الثلاثاء', time: '10:00 - 11:30', room: 'قاعة IT-205', seatNumber: 'B-14' },
      { courseCode: '1505223', courseName: 'برمجة وأدوات الذكاء الإصطناعي', examType: 'الامتحان الأول', date: '2026-11-12', dayName: 'الخميس', time: '11:00 - 12:30', room: 'مختبر AI-2', seatNumber: 'A-08' },
    ],
    financialSummary: {
      previousBalance: 0,
      totalFees: 800,
      totalPayments: 800,
      totalDiscounts: 0,
      currentBalance: 0,
    },
    transactions: [
      { id: 'TXN-201', date: '2026-09-08', reference: 'REC-2026-4412', statement: 'رسوم تسجيل فصل دراسي', debit: 50, credit: 0, balance: 50 },
      { id: 'TXN-202', date: '2026-09-08', reference: 'CRS-2026-4413', statement: 'رسوم ساعات معتمدة (15 ساعة)', debit: 750, credit: 0, balance: 800 },
      { id: 'TXN-203', date: '2026-09-14', reference: 'PAY-CLI-3321', statement: 'دفعة بنكية إلكترونية - إي فواتيركم', debit: 0, credit: 800, balance: 0 },
    ]
  },

  // ==========================================
  // STUDENT 3: عمر خالد الزعبي (Review Required)
  // ==========================================
  {
    id: 'student-3',
    name: 'عمر خالد الزعبي',
    universityId: '202410003',
    faculty: 'كلية تكنولوجيا المعلومات',
    major: 'الذكاء الاصطناعي',
    degree: 'بكالوريوس',
    studyType: 'انتظام',
    admissionYear: 2024,
    studyPlan: 'خطة 12',
    academicAdvisor: 'د. سامر العلي',
    academicStatus: 'تحت الملاحظة الأكاديمية (مراجعة مطلوبة)',
    profileType: 'review',
    profileDescription: 'طالب لديه بعض المواد التي تتطلب مراجعة أكاديمية واعتماد معادلات الساعات السابقة.',
    completedCourses: [
      // University (9)
      '0200104', '0200105', '0200110',
      // Faculty (15)
      '0300220', '1501110', '1501112', '1501221',
      // Supporting (9)
      '0300153', '0300104', '0301245',
      // Major (15)
      '1501111', '1501113', '1505101', '1505201', '1505311'
    ],
    reviewCourses: ['1505320', '1505366'],
    currentRegisteredSections: [
      getSec('SEC-1501222-1'), // نظم قواعد البيانات (3 cr)
      getSec('SEC-1501340-1'), // شبكات الحاسوب (3 cr)
      getSec('SEC-1506180-1'), // برمجة ويب (1) (3 cr)
      getSec('SEC-1506181-1'), // مختبر برمجة ويب (1 cr)
      getSec('SEC-0200106-1'), // اللغة الإنجليزية 1 (3 cr)
    ],
    semesterHistory: [
      {
        semesterId: '2024-1',
        semesterName: '2024/2025 - الفصل الأول',
        registeredHours: 15,
        passedHours: 12,
        semesterGpa: 67.2,
        cumulativeGpa: 67.2,
        courses: [
          { courseCode: '0200104', courseName: 'التربية الوطنية', credits: 3, grade: 76, letterGrade: 'C+', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '0300153', courseName: 'تفاضل وتكامل (1)', credits: 3, grade: 68, letterGrade: 'D+', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '1501110', courseName: 'برمجة الحاسوب (1)', credits: 3, grade: 78, letterGrade: 'C+', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '1501111', courseName: 'مختبر برمجة الحاسوب (1)', credits: 1, grade: 80, letterGrade: 'B-', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '0200105', courseName: 'مهارات الاتصال والتواصل (اللغة العربية 1)', credits: 3, grade: 75, letterGrade: 'C', status: 'ناجح', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' },
          { courseCode: '0200106', courseName: 'مهارات الاتصال والتواصل (اللغة الانجليزية 1)', credits: 2, grade: 54, letterGrade: 'F', status: 'راسب', semesterId: '2024-1', semesterName: '2024/2025 - الفصل الأول' }
        ]
      },
      {
        semesterId: '2024-2',
        semesterName: '2024/2025 - الفصل الثاني',
        registeredHours: 16,
        passedHours: 16,
        semesterGpa: 73.5,
        cumulativeGpa: 70.4,
        courses: [
          { courseCode: '1501112', courseName: 'برمجة الحاسوب (2)', credits: 3, grade: 77, letterGrade: 'C+', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '1501113', courseName: 'مختبر برمجة الحاسوب (2)', credits: 1, grade: 82, letterGrade: 'B-', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '0300220', courseName: 'رياضيات متقطعة', credits: 3, grade: 73, letterGrade: 'C', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '0301245', courseName: 'الجبر الخطي', credits: 3, grade: 75, letterGrade: 'C', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '1505101', courseName: 'البرمجة بلغة بايثون', credits: 3, grade: 85, letterGrade: 'B+', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' },
          { courseCode: '0200110', courseName: 'العلوم العسكرية', credits: 3, grade: 82, letterGrade: 'B-', status: 'ناجح', semesterId: '2024-2', semesterName: '2024/2025 - الفصل الثاني' }
        ]
      }
    ],
    absences: [
      { courseCode: '1501222', courseName: 'نظم قواعد البيانات', instructor: 'د. إياد الحمود', totalLectures: 24, absencesCount: 4, absencePercentage: 16.7, status: 'تنبيه' },
      { courseCode: '1501340', courseName: 'شبكات الحاسوب', instructor: 'د. عمار غرايبة', totalLectures: 24, absencesCount: 2, absencePercentage: 8.3, status: 'طبيعي' },
      { courseCode: '1506180', courseName: 'برمجة ويب (1)', instructor: 'د. طارق الحنيطي', totalLectures: 16, absencesCount: 1, absencePercentage: 6.2, status: 'طبيعي' },
      { courseCode: '1506181', courseName: 'مختبر برمجة ويب (1)', instructor: 'م. أنس الخالدي', totalLectures: 8, absencesCount: 1, absencePercentage: 12.5, status: 'تنبيه' },
      { courseCode: '0200106', courseName: 'مهارات الاتصال والتواصل (اللغة الانجليزية 1)', instructor: 'د. رانيا النجار', totalLectures: 16, absencesCount: 2, absencePercentage: 12.5, status: 'تنبيه' },
    ],
    exams: [
      { courseCode: '1501222', courseName: 'نظم قواعد البيانات', examType: 'الامتحان الأول', date: '2026-11-03', dayName: 'الثلاثاء', time: '09:00 - 10:30', room: 'قاعة IT-103', seatNumber: 'B-09' },
      { courseCode: '1501340', courseName: 'شبكات الحاسوب', examType: 'الامتحان الأول', date: '2026-11-10', dayName: 'الثلاثاء', time: '10:00 - 11:30', room: 'قاعة IT-205', seatNumber: 'D-12' },
      { courseCode: '1506180', courseName: 'برمجة ويب (1)', examType: 'الامتحان الأول', date: '2026-11-15', dayName: 'الأحد', time: '09:30 - 11:00', room: 'قاعة IT-104', seatNumber: 'C-07' },
      { courseCode: '0200106', courseName: 'مهارات الاتصال والتواصل (اللغة الانجليزية 1)', examType: 'الامتحان الأول', date: '2026-11-18', dayName: 'الأربعاء', time: '11:00 - 12:30', room: 'مختبر 4 الآداب', seatNumber: 'A-21' },
    ],
    financialSummary: {
      previousBalance: 60,
      totalFees: 710,
      totalPayments: 650,
      totalDiscounts: 0,
      currentBalance: 120,
    },
    transactions: [
      { id: 'TXN-301', date: '2026-09-01', reference: 'BAL-FWD', statement: 'رصيد سابق مدور من الفصل الصيفي', debit: 60, credit: 0, balance: 60 },
      { id: 'TXN-302', date: '2026-09-12', reference: 'REC-2026-5591', statement: 'رسوم تسجيل فصل دراسي', debit: 50, credit: 0, balance: 110 },
      { id: 'TXN-303', date: '2026-09-12', reference: 'CRS-2026-5592', statement: 'رسوم ساعات معتمدة (13 ساعة)', debit: 650, credit: 0, balance: 760 },
      { id: 'TXN-304', date: '2026-09-16', reference: 'PAY-BNK-9923', statement: 'دفعة بنكية نقدية - بنك الإسكان', debit: 0, credit: 640, balance: 120 },
    ]
  },

  // ==========================================
  // STUDENT 4: سارة محمد القيسي (Early-program)
  // ==========================================
  {
    id: 'student-4',
    name: 'سارة محمد القيسي',
    universityId: '202510004',
    faculty: 'كلية تكنولوجيا المعلومات',
    major: 'الذكاء الاصطناعي',
    degree: 'بكالوريوس',
    studyType: 'انتظام',
    admissionYear: 2025,
    studyPlan: 'خطة 12',
    academicAdvisor: 'د. نور حداد',
    academicStatus: 'منتظم (مستوى ثانٍ - جيد جداً)',
    profileType: 'early',
    profileDescription: 'طالبة في سنتها الثانية، أنهت السنة التحضيرية بنجاح وتسير وفق الخطة الإرشادية.',
    completedCourses: [
      // University (6)
      '0200105', '0200106',
      // Faculty (7)
      '1501110', '1501112',
      // Supporting (6)
      '0300153', '0301245',
      // Major (2)
      '1501111', '1501113'
    ],
    currentRegisteredSections: [
      getSec('SEC-1501221-1'), // تراكيب البيانات (3 cr)
      getSec('SEC-0300220-1'), // رياضيات متقطعة (3 cr)
      getSec('SEC-1505101-1'), // البرمجة بلغة بايثون (3 cr)
      getSec('SEC-1505201-1'), // مقدمة في الذكاء الاصطناعي (3 cr)
      getSec('SEC-0200104-1'), // التربية الوطنية (3 cr)
      getSec('SEC-0200153-1'), // المهارات الحياتية (1 cr)
    ],
    semesterHistory: [
      {
        semesterId: '2025-1',
        semesterName: '2025/2026 - الفصل الأول',
        registeredHours: 16,
        passedHours: 16,
        semesterGpa: 82.5,
        cumulativeGpa: 82.5,
        courses: [
          { courseCode: '1501110', courseName: 'برمجة الحاسوب (1)', credits: 3, grade: 88, letterGrade: 'A-', status: 'ناجح', semesterId: '2025-1', semesterName: '2025/2026 - الفصل الأول' },
          { courseCode: '1501111', courseName: 'مختبر برمجة الحاسوب (1)', credits: 1, grade: 90, letterGrade: 'A', status: 'ناجح', semesterId: '2025-1', semesterName: '2025/2026 - الفصل الأول' },
          { courseCode: '0300153', courseName: 'تفاضل وتكامل (1)', credits: 3, grade: 80, letterGrade: 'B-', status: 'ناجح', semesterId: '2025-1', semesterName: '2025/2026 - الفصل الأول' },
          { courseCode: '0200105', courseName: 'مهارات الاتصال والتواصل (اللغة العربية 1)', credits: 3, grade: 85, letterGrade: 'B+', status: 'ناجح', semesterId: '2025-1', semesterName: '2025/2026 - الفصل الأول' },
          { courseCode: '0200106', courseName: 'مهارات الاتصال والتواصل (اللغة الانجليزية 1)', credits: 3, grade: 82, letterGrade: 'B-', status: 'ناجح', semesterId: '2025-1', semesterName: '2025/2026 - الفصل الأول' },
          { courseCode: '0301245', courseName: 'الجبر الخطي', credits: 3, grade: 81, letterGrade: 'B-', status: 'ناجح', semesterId: '2025-1', semesterName: '2025/2026 - الفصل الأول' }
        ]
      }
    ],
    absences: [
      { courseCode: '1501221', courseName: 'تراكيب البيانات', instructor: 'د. بلال السعدي', totalLectures: 24, absencesCount: 1, absencePercentage: 4.1, status: 'طبيعي' },
      { courseCode: '0300220', courseName: 'رياضيات متقطعة', instructor: 'د. عماد النجار', totalLectures: 16, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' },
      { courseCode: '1505101', courseName: 'البرمجة بلغة بايثون', instructor: 'د. سامر العلي', totalLectures: 24, absencesCount: 1, absencePercentage: 4.1, status: 'طبيعي' },
      { courseCode: '1505201', courseName: 'مقدمة في الذكاء الاصطناعي', instructor: 'د. نور حداد', totalLectures: 16, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' },
      { courseCode: '0200104', courseName: 'التربية الوطنية', instructor: 'د. فيصل الزعبي', totalLectures: 16, absencesCount: 1, absencePercentage: 6.2, status: 'طبيعي' },
      { courseCode: '0200153', courseName: 'المهارات الحياتية', instructor: 'أ. دينا القضاة', totalLectures: 8, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' },
    ],
    exams: [
      { courseCode: '1501221', courseName: 'تراكيب البيانات', examType: 'الامتحان الأول', date: '2026-11-04', dayName: 'الأربعاء', time: '11:00 - 12:30', room: 'مدرج الخوارزمي IT', seatNumber: 'C-33' },
      { courseCode: '0300220', courseName: 'رياضيات متقطعة', examType: 'الامتحان الأول', date: '2026-11-09', dayName: 'الاثنين', time: '08:00 - 09:30', room: 'قاعة العلوم 104', seatNumber: 'B-11' },
      { courseCode: '1505101', courseName: 'البرمجة بلغة بايثون', examType: 'الامتحان الأول', date: '2026-11-12', dayName: 'الخميس', time: '12:00 - 13:30', room: 'مختبر AI-1', seatNumber: 'A-15' },
      { courseCode: '1505201', courseName: 'مقدمة في الذكاء الاصطناعي', examType: 'الامتحان الأول', date: '2026-11-17', dayName: 'الثلاثاء', time: '09:30 - 11:00', room: 'قاعة IT-202', seatNumber: 'E-02' },
    ],
    financialSummary: {
      previousBalance: 0,
      totalFees: 850,
      totalPayments: 850,
      totalDiscounts: 0,
      currentBalance: 0,
    },
    transactions: [
      { id: 'TXN-401', date: '2026-09-07', reference: 'REC-2026-7788', statement: 'رسوم تسجيل فصل دراسي', debit: 50, credit: 0, balance: 50 },
      { id: 'TXN-402', date: '2026-09-07', reference: 'CRS-2026-7789', statement: 'رسوم ساعات معتمدة (16 ساعة)', debit: 800, credit: 0, balance: 850 },
      { id: 'TXN-403', date: '2026-09-11', reference: 'PAY-CLI-1029', statement: 'دفعة بنكية إلكترونية - إي فواتيركم', debit: 0, credit: 850, balance: 0 },
    ]
  },

  // ==========================================
  // STUDENT 5: يوسف علي الرواشدة (Freshman / First Year)
  // ==========================================
  {
    id: 'student-5',
    name: 'يوسف علي الرواشدة',
    universityId: '202610005',
    faculty: 'كلية تكنولوجيا المعلومات',
    major: 'الذكاء الاصطناعي',
    degree: 'بكالوريوس',
    studyType: 'انتظام',
    admissionYear: 2026,
    studyPlan: 'خطة 12',
    academicAdvisor: 'د. رامي منصور',
    academicStatus: 'مستجد (سنة أولى - فصل أول)',
    profileType: 'freshman',
    profileDescription: 'طالب مستجد التحق بالجامعة هذا الفصل، في بداية مسيرته الأكاديمية.',
    completedCourses: [],
    currentRegisteredSections: [
      getSec('SEC-1501110-1'), // برمجة الحاسوب (1) (3 cr)
      getSec('SEC-1501111-1'), // مختبر برمجة الحاسوب (1) (1 cr)
      getSec('SEC-0300153-1'), // تفاضل وتكامل (1) (3 cr)
      getSec('SEC-0200110-1'), // العلوم العسكرية (3 cr)
      getSec('SEC-0200105-1'), // اللغة العربية (1) (3 cr)
      getSec('SEC-0200153-1'), // المهارات الحياتية (1 cr)
      getSec('SEC-0400202-1'), // الريادة والابتكار (1 cr)
    ],
    semesterHistory: [],
    absences: [
      { courseCode: '1501110', courseName: 'برمجة الحاسوب (1)', instructor: 'د. سامر العلي', totalLectures: 12, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' },
      { courseCode: '1501111', courseName: 'مختبر برمجة الحاسوب (1)', instructor: 'م. أسامة التميمي', totalLectures: 4, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' },
      { courseCode: '0300153', courseName: 'تفاضل وتكامل (1)', instructor: 'د. علاء الرواشدة', totalLectures: 12, absencesCount: 1, absencePercentage: 8.3, status: 'طبيعي' },
      { courseCode: '0200110', courseName: 'العلوم العسكرية', instructor: 'العقيد د. طارق بني نصر', totalLectures: 12, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' },
      { courseCode: '0200105', courseName: 'مهارات الاتصال والتواصل (اللغة العربية 1)', instructor: 'د. محمود عبيدات', totalLectures: 12, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' },
      { courseCode: '0200153', courseName: 'المهارات الحياتية', instructor: 'أ. دينا القضاة', totalLectures: 4, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' },
      { courseCode: '0400202', courseName: 'الريادة والابتكار', instructor: 'د. قيس الشوابكة', totalLectures: 4, absencesCount: 0, absencePercentage: 0, status: 'طبيعي' },
    ],
    exams: [
      { courseCode: '1501110', courseName: 'برمجة الحاسوب (1)', examType: 'الامتحان الأول', date: '2026-11-02', dayName: 'الاثنين', time: '09:00 - 10:30', room: 'قاعة IT-101', seatNumber: 'S-45' },
      { courseCode: '0300153', courseName: 'تفاضل وتكامل (1)', examType: 'الامتحان الأول', date: '2026-11-06', dayName: 'الجمعة', time: '08:00 - 09:30', room: 'قاعة العلوم 201', seatNumber: 'S-12' },
      { courseCode: '0200105', courseName: 'مهارات الاتصال والتواصل (اللغة العربية 1)', examType: 'الامتحان الأول', date: '2026-11-11', dayName: 'الأربعاء', time: '08:00 - 09:30', room: 'مبنى الآداب 302', seatNumber: 'S-88' },
      { courseCode: '0200110', courseName: 'العلوم العسكرية', examType: 'الامتحان الأول', date: '2026-11-15', dayName: 'الأحد', time: '10:00 - 11:30', room: 'مدرج الفاروق', seatNumber: 'M-102' },
    ],
    financialSummary: {
      previousBalance: 0,
      totalFees: 820,
      totalPayments: 820,
      totalDiscounts: 0,
      currentBalance: 0,
    },
    transactions: [
      { id: 'TXN-501', date: '2026-09-01', reference: 'ADM-2026-0091', statement: 'رسوم قبول وجامعة جديدة', debit: 120, credit: 0, balance: 120 },
      { id: 'TXN-502', date: '2026-09-01', reference: 'CRS-2026-0092', statement: 'رسوم ساعات معتمدة (15 ساعة)', debit: 700, credit: 0, balance: 820 },
      { id: 'TXN-503', date: '2026-09-02', reference: 'PAY-CLI-5561', statement: 'دفعة بنكية إلكترونية - إي فواتيركم', debit: 0, credit: 820, balance: 0 },
    ]
  }
];
