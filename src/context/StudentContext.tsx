import React, { createContext, useContext, useState, useEffect } from 'react';
import { StudentProfile, CourseSection } from '../types/student';
import { demoStudents } from '../data/demoStudents';
import { checkSectionConflict } from '../services/academicEngine';

export type NavigationPage =
  | 'dashboard'
  | 'student-info'
  | 'registration'
  | 'offered-courses'
  | 'add-drop'
  | 'class-schedule'
  | 'grades'
  | 'gpa'
  | 'study-plan'
  | 'absences'
  | 'exams'
  | 'financial'
  | 'smart-assistant';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface StudentContextType {
  activeStudent: StudentProfile;
  isAuthenticated: boolean;
  activePage: NavigationPage;
  setActivePage: (page: NavigationPage) => void;
  selectStudentById: (studentId: string) => void;
  login: (studentId: string, password?: string) => boolean;
  logout: () => void;
  
  // Registration basket for current session
  basketSections: CourseSection[];
  addToBasket: (section: CourseSection) => { success: boolean; message: string };
  addRecommendedSections: (sections: CourseSection[]) => void;
  replaceBasketSection: (currentSectionId: string, replacement: CourseSection) => { success: boolean; message: string };
  removeFromBasket: (sectionId: string) => void;
  clearBasket: () => void;
  confirmMockRegistration: () => void;
  withdrawRegisteredSection: (sectionId: string) => void;

  // Toast notifications
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
}

export interface StudentCredential {
  universityId: string;
  name: string;
  password: string;
  role: string;
  year: number;
}

export const STUDENT_CREDENTIALS: StudentCredential[] = [
  {
    universityId: '202310001',
    name: 'أحمد محمود الخطيب',
    password: '123456',
    role: 'طالب سنة رابعة (متفوق - مرتبة الشرف)',
    year: 2023
  },
  {
    universityId: '202410002',
    name: 'ليان أحمد الحسن',
    password: '123456',
    role: 'طالبة سنة ثالثة (منتصف الخطة الدراسية)',
    year: 2024
  },
  {
    universityId: '202410003',
    name: 'عمر خالد الزعبي',
    password: '123456',
    role: 'طالب بمستوى متقدم (لديه مواد تحتاج مراجعة)',
    year: 2024
  },
  {
    universityId: '202510004',
    name: 'سارة محمد القيسي',
    password: '123456',
    role: 'طالبة سنة ثانية (بداية التخصص)',
    year: 2025
  },
  {
    universityId: '202610005',
    name: 'يوسف علي الرواشدة',
    password: '123456',
    role: 'طالب مستجد سنة أولى (الفصل الأول)',
    year: 2026
  }
];

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(sessionStorage.getItem('morshidi_student_id'));
  });

  const [activeStudent, setActiveStudent] = useState<StudentProfile>(() => {
    const savedId = sessionStorage.getItem('morshidi_student_id');
    if (savedId) {
      const found = demoStudents.find(s => s.universityId === savedId || s.id === savedId);
      if (found) return found;
    }
    return demoStudents[0];
  });

  const [activePage, setActivePage] = useState<NavigationPage>('dashboard');
  const [basketSections, setBasketSections] = useState<CourseSection[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // When active student changes, reset basket to empty
  useEffect(() => {
    setBasketSections([]);
  }, [activeStudent.id]);

  const showToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const selectStudentById = (studentId: string) => {
    const student = demoStudents.find(
      s => s.universityId === studentId || s.id === studentId
    );
    if (student) {
      setActiveStudent(student);
      sessionStorage.setItem('morshidi_student_id', student.universityId);
      showToast(`تم فتح حساب الطالب: ${student.name}`, 'info');
    }
  };

  const login = (studentId: string, password?: string) => {
    const trimmedId = studentId.trim();
    const student = demoStudents.find(
      s => s.universityId === trimmedId || s.id === trimmedId
    );

    if (!student) {
      showToast('الرقم الجامعي غير مسجل في النظام.', 'error');
      return false;
    }

    // Password verification: accept 123456, student individual passwords, or Morshidi123!
    const validPasswords = [
      '123456',
      '12345678',
      'Morshidi123!',
      `${student.name.split(' ')[0]}@${student.admissionYear}`,
      `${student.name.split(' ')[0].toLowerCase()}${student.admissionYear}`,
    ];

    if (password && password.trim() !== '') {
      const trimmedPass = password.trim();
      const isMatch = validPasswords.some(p => p.toLowerCase() === trimmedPass.toLowerCase()) || trimmedPass === '123456';
      if (!isMatch) {
        showToast('كلمة المرور غير صحيحة. كلمة المرور المعتمدة هي 123456', 'error');
        return false;
      }
    }

    setActiveStudent(student);
    sessionStorage.setItem('morshidi_student_id', student.universityId);
    setIsAuthenticated(true);
    setActivePage('dashboard');
    showToast(`مرحباً بك يا ${student.name} في بوابة جامعة مرشدي`, 'success');
    return true;
  };

  const logout = () => {
    sessionStorage.removeItem('morshidi_student_id');
    setIsAuthenticated(false);
    showToast('تم تسجيل الخروج بنجاح من البوابة', 'info');
  };

  const addToBasket = (section: CourseSection) => {
    if (section.status !== 'متاحة' || section.enrolled >= section.capacity) {
      showToast('لا يمكن إضافة هذه الشعبة لأنها ممتلئة أو غير متاحة للتسجيل.', 'error');
      return { success: false, message: 'الشعبة غير متاحة' };
    }

    // Check if already in basket
    if (basketSections.some(s => s.id === section.id)) {
      showToast('الشعبة مضافة مسبقاً إلى سلة التسجيل', 'warning');
      return { success: false, message: 'الشعبة مضافة مسبقاً' };
    }

    // Check if course already added in basket with another section
    if (basketSections.some(s => s.courseCode === section.courseCode)) {
      showToast('المادة مضافة مسبقاً بشعبة أخرى في السلة', 'warning');
      return { success: false, message: 'المادة مضافة بشعبة أخرى' };
    }

    const scheduledSections = [...activeStudent.currentRegisteredSections, ...basketSections];
    const conflictingSection = scheduledSections.find(existing => checkSectionConflict(section, existing));
    if (conflictingSection) {
      showToast(`لا يمكن إضافة الشعبة: تتعارض مع ${conflictingSection.courseName} في جدولك.`, 'error');
      return { success: false, message: 'يوجد تعارض زمني في الجدول' };
    }

    // Calculate total hours
    const currentBasketHours = basketSections.reduce((acc, s) => acc + s.credits, 0);
    const existingRegisteredHours = activeStudent.currentRegisteredSections.reduce((acc, s) => acc + s.credits, 0);
    
    if (currentBasketHours + existingRegisteredHours + section.credits > 18) {
      showToast(`تجاوز الحد الأقصى للعبء الدراسي (18 ساعة معتمدة)`, 'error');
      return { success: false, message: 'تجاوز العبء الدراسي المسموح' };
    }

    setBasketSections(prev => [...prev, section]);
    showToast(`تمت إضافة مساق ${section.courseName} (شعبة ${section.sectionNumber}) إلى السلة`, 'success');
    return { success: true, message: 'تمت الإضافة بنجاح' };
  };

  const addRecommendedSections = (sections: CourseSection[]) => {
    const selected = [...activeStudent.currentRegisteredSections, ...basketSections];
    const nextBasket = [...basketSections];
    let usedHours = selected.reduce((sum, section) => sum + section.credits, 0);
    let addedCount = 0;

    for (const section of sections) {
      const duplicateCourse = [...selected, ...nextBasket].some(item => item.courseCode === section.courseCode);
      const hasConflict = [...selected, ...nextBasket].some(item => checkSectionConflict(section, item));
      const unavailable = section.status !== 'متاحة' || section.enrolled >= section.capacity;

      if (duplicateCourse || hasConflict || unavailable || usedHours + section.credits > 18) continue;

      nextBasket.push(section);
      usedHours += section.credits;
      addedCount += 1;
    }

    if (addedCount === 0) {
      showToast('لا توجد شعب جديدة متوافقة يمكن إضافتها إلى السلة الآن.', 'info');
      return;
    }

    setBasketSections(nextBasket);
    showToast(`تمت إضافة ${addedCount} مواد مقترحة دون تعارض إلى سلة التسجيل.`, 'success');
  };

  const replaceBasketSection = (currentSectionId: string, replacement: CourseSection) => {
    const currentSection = basketSections.find(section => section.id === currentSectionId);
    if (!currentSection) {
      return { success: false, message: 'لم تعد هذه الشعبة موجودة في مسودة الجدول' };
    }

    if (currentSection.id === replacement.id) {
      return { success: true, message: 'هذه هي الشعبة المختارة بالفعل' };
    }

    if (currentSection.courseCode !== replacement.courseCode || replacement.status !== 'متاحة' || replacement.enrolled >= replacement.capacity) {
      showToast('لا يمكن استبدال الشعبة بالخيار المحدد.', 'error');
      return { success: false, message: 'الشعبة البديلة غير متاحة' };
    }

    const scheduleWithoutCurrent = [
      ...activeStudent.currentRegisteredSections,
      ...basketSections.filter(section => section.id !== currentSectionId),
    ];
    const conflictingSection = scheduleWithoutCurrent.find(section => checkSectionConflict(replacement, section));

    if (conflictingSection) {
      showToast(`الشعبة البديلة تتعارض مع ${conflictingSection.courseName} في جدولك.`, 'error');
      return { success: false, message: 'يوجد تعارض زمني في الجدول' };
    }

    setBasketSections(previous => previous.map(section => section.id === currentSectionId ? replacement : section));
    showToast(`تم تعديل ${replacement.courseName} إلى الشعبة ${replacement.sectionNumber} دون تعارض.`, 'success');
    return { success: true, message: 'تم تعديل الشعبة بنجاح' };
  };

  const removeFromBasket = (sectionId: string) => {
    const sec = basketSections.find(s => s.id === sectionId);
    setBasketSections(prev => prev.filter(s => s.id !== sectionId));
    if (sec) {
      showToast(`تمت إزالة مساق ${sec.courseName} من السلة`, 'info');
    }
  };

  const clearBasket = () => {
    setBasketSections([]);
  };

  const confirmMockRegistration = () => {
    if (basketSections.length === 0) {
      showToast('السلة فارغة. اختر شعباً دراسية أولاً للتسجيل.', 'warning');
      return;
    }

    // Clone student with new registered sections
    const newRegistered = [...activeStudent.currentRegisteredSections, ...basketSections];
    const newStudent: StudentProfile = {
      ...activeStudent,
      currentRegisteredSections: newRegistered,
    };
    setActiveStudent(newStudent);
    setBasketSections([]);
    showToast('تم حفظ التسجيل التجريبي بنجاح داخل نظام مرشدي!', 'success');
  };

  const withdrawRegisteredSection = (sectionId: string) => {
    const section = activeStudent.currentRegisteredSections.find(item => item.id === sectionId);
    if (!section) return;
    setActiveStudent(previous => ({
      ...previous,
      currentRegisteredSections: previous.currentRegisteredSections.filter(item => item.id !== sectionId),
    }));
    showToast(`تم سحب مادة ${section.courseName} من جدولك.`, 'info');
  };

  return (
    <StudentContext.Provider
      value={{
        activeStudent,
        isAuthenticated,
        activePage,
        setActivePage,
        selectStudentById,
        login,
        logout,
        basketSections,
        addToBasket,
        addRecommendedSections,
        replaceBasketSection,
        removeFromBasket,
        clearBasket,
        confirmMockRegistration,
        withdrawRegisteredSection,
        toasts,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </StudentContext.Provider>
  );
};

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error('useStudent must be used within a StudentProvider');
  }
  return context;
};
