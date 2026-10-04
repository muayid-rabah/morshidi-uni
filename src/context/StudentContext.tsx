import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AcademicDate, CourseSection, PlanCourse, StudentProfile } from '../types/student';
import { checkSectionConflict, getRegistrationEligibility, getRecommendedRegistrationSections } from '../services/academicEngine';
import {
  getAcademicDates, getCalendar, getCourses, getMe, getOfferings, getStoredToken, getStudent,
  postGrade as sendGrade, registerSections, signInStudent, storeToken,
  UniversityApiError,
} from '../lib/universityApi';

export type NavigationPage =
  | 'dashboard' | 'student-info' | 'registration' | 'offered-courses' | 'add-drop' | 'class-schedule'
  | 'grades' | 'gpa' | 'study-plan' | 'absences' | 'exams' | 'financial' | 'notifications'
  | 'smart-assistant' | 'admin';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface StudentContextType {
  activeStudent: StudentProfile;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: 'student' | 'admin';
  activePage: NavigationPage;
  setActivePage: (page: NavigationPage) => void;
  selectStudentById: (studentId: string) => void;
  login: (studentId: string, password?: string) => Promise<boolean>;
  logout: () => void;
  refreshData: () => Promise<void>;
  postGrade: (courseCode: string, grade: number, letterGrade?: string) => Promise<boolean>;
  courses: PlanCourse[];
  offeredSections: CourseSection[];
  academicDates: AcademicDate[];
  calendar: Awaited<ReturnType<typeof getCalendar>> | null;
  studentDirectory: StudentProfile[];
  basketSections: CourseSection[];
  addToBasket: (section: CourseSection) => { success: boolean; message: string };
  addRecommendedSections: (sections: CourseSection[]) => void;
  replaceBasketSection: (currentSectionId: string, replacement: CourseSection) => { success: boolean; message: string };
  removeFromBasket: (sectionId: string) => void;
  clearBasket: () => void;
  confirmMockRegistration: () => Promise<void>;
  withdrawRegisteredSection: (sectionId: string) => Promise<void>;
  resetSandbox: () => void;
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
}

const EMPTY_STUDENT: StudentProfile = {
  id: '', name: '', universityId: '', faculty: '', major: '', degree: '', studyType: '', admissionYear: 0,
  studyPlan: '', academicAdvisor: '', academicStatus: '', profileType: 'early', profileDescription: '',
  completedCourses: [], reviewCourses: [], currentRegisteredSections: [], semesterHistory: [], absences: [], exams: [],
  financialSummary: { previousBalance: 0, totalFees: 0, totalPayments: 0, totalDiscounts: 0, currentBalance: 0 },
  transactions: [],
};

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeStudent, setActiveStudent] = useState<StudentProfile>(EMPTY_STUDENT);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(() => Boolean(getStoredToken()));
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [activePage, setActivePage] = useState<NavigationPage>('dashboard');
  const [courses, setCourses] = useState<PlanCourse[]>([]);
  const [offeredSections, setOfferedSections] = useState<CourseSection[]>([]);
  const [academicDates, setAcademicDates] = useState<AcademicDate[]>([]);
  const [calendar, setCalendar] = useState<Awaited<ReturnType<typeof getCalendar>> | null>(null);
  const [studentDirectory, setStudentDirectory] = useState<StudentProfile[]>([]);
  const [basketSections, setBasketSections] = useState<CourseSection[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts((previous) => [...previous, { id, type, message }]);
    window.setTimeout(() => setToasts((previous) => previous.filter((toast) => toast.id !== id)), 4500);
  }, []);

  const dismissToast = (id: string) => setToasts((previous) => previous.filter((toast) => toast.id !== id));

  const loadState = useCallback(async (token: string, selectedStudentId?: string) => {
    const me = await getMe(token);
    const [nextCalendar, nextDates, nextCourses] = await Promise.all([getCalendar(token), getAcademicDates(token), getCourses(token)]);
    const targetId = me.role === 'admin' ? (selectedStudentId || sessionStorage.getItem('morshidi_admin_student_id') || null) : me.studentId;
    const [nextStudent, nextOfferings, directory] = await Promise.all([
      targetId ? getStudent<StudentProfile>(token, targetId) : Promise.resolve(EMPTY_STUDENT),
      getOfferings(nextCalendar.currentTerm.code, token),
      me.role === 'admin' ? getStudentDirectory(token) : Promise.resolve([] as StudentProfile[]),
    ]);
    setRole(me.role);
    setCalendar(nextCalendar);
    setAcademicDates(nextDates);
    setCourses(nextCourses);
    setOfferedSections(nextOfferings);
    setActiveStudent(nextStudent);
    setStudentDirectory(directory);
    setIsAuthenticated(true);
    return nextStudent;
  }, []);

  const refreshData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    const previousStudentId = activeStudent.universityId || undefined;
    try {
      await loadState(token, previousStudentId);
    } catch (error) {
      if (error instanceof UniversityApiError && error.status === 401) {
        storeToken(null);
        setIsAuthenticated(false);
        setActiveStudent(EMPTY_STUDENT);
      }
      showToast(error instanceof UniversityApiError ? error.message : 'تعذر تحديث البيانات.', 'error');
    }
  }, [activeStudent.universityId, loadState, showToast]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    void loadState(token).catch(() => {
      storeToken(null);
      setIsAuthenticated(false);
      setActiveStudent(EMPTY_STUDENT);
    }).finally(() => setIsLoading(false));
  }, [loadState]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = window.setInterval(() => { void refreshData(); }, 60_000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, refreshData]);

  const login = async (studentId: string, password = '') => {
    setIsLoading(true);
    try {
      const token = await signInStudent(studentId, password);
      storeToken(token);
      await loadState(token);
      setActivePage('dashboard');
      setBasketSections([]);
      showToast('تم تسجيل الدخول.', 'success');
      return true;
    } catch (error) {
      storeToken(null);
      setIsAuthenticated(false);
      showToast(error instanceof UniversityApiError ? error.message : 'تعذر تسجيل الدخول.', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    storeToken(null);
    setIsAuthenticated(false);
    setRole('student');
    setActiveStudent(EMPTY_STUDENT);
    setStudentDirectory([]);
    setBasketSections([]);
    setActivePage('dashboard');
    showToast('تم تسجيل الخروج.', 'info');
  };

  const selectStudentById = (studentId: string) => {
    if (role !== 'admin') {
      if (studentId !== activeStudent.universityId) showToast('يمكنك عرض سجلك فقط.', 'error');
      return;
    }
    const token = getStoredToken();
    if (!token) return;
    sessionStorage.setItem('morshidi_admin_student_id', studentId);
    void getStudent<StudentProfile>(token, studentId).then(setActiveStudent).catch((error) => {
      showToast(error instanceof UniversityApiError ? error.message : 'تعذر تحميل سجل الطالب.', 'error');
    });
  };

  const addToBasket = (section: CourseSection) => {
    const eligibility = getRegistrationEligibility(section.courseCode, activeStudent, courses);
    if (eligibility.state !== 'ELIGIBLE') {
      showToast(eligibility.reason || 'المادة غير متاحة للتسجيل.', 'error');
      return { success: false, message: eligibility.reason || 'المادة غير متاحة' };
    }
    if (section.status !== 'متاحة' || section.enrolled >= section.capacity) {
      showToast('الشعبة ممتلئة أو مغلقة.', 'error');
      return { success: false, message: 'الشعبة غير متاحة' };
    }
    if (basketSections.some((item) => item.id === section.id || item.courseCode === section.courseCode)) {
      showToast('المادة أو الشعبة موجودة في السلة.', 'warning');
      return { success: false, message: 'موجودة في السلة' };
    }
    const existing = [...activeStudent.currentRegisteredSections, ...basketSections];
    const conflict = existing.find((item) => checkSectionConflict(section, item));
    if (conflict) {
      showToast(`يوجد تعارض مع ${conflict.courseName}.`, 'error');
      return { success: false, message: 'يوجد تعارض في الجدول' };
    }
    const currentHours = existing.reduce((sum, item) => sum + item.credits, 0);
    if (currentHours + section.credits > 18) {
      showToast('تجاوزت الحد الأعلى للساعات.', 'error');
      return { success: false, message: 'تجاوزت الحد الأعلى' };
    }
    setBasketSections((previous) => [...previous, section]);
    showToast('أضيفت الشعبة إلى السلة.', 'success');
    return { success: true, message: 'تمت الإضافة' };
  };

  const addRecommendedSections = (sections: CourseSection[]) => {
    const suggestions = getRecommendedRegistrationSections(activeStudent, offeredSections, courses, basketSections);
    const proposed = sections.length ? sections : suggestions;
    const next = [...basketSections];
    for (const section of proposed) {
      if (next.some((item) => item.courseCode === section.courseCode)) continue;
      const conflict = [...activeStudent.currentRegisteredSections, ...next].some((item) => checkSectionConflict(section, item));
      const hours = [...activeStudent.currentRegisteredSections, ...next].reduce((sum, item) => sum + item.credits, 0);
      if (!conflict && hours + section.credits <= 18) next.push(section);
    }
    setBasketSections(next);
  };

  const replaceBasketSection = (currentSectionId: string, replacement: CourseSection) => {
    const current = basketSections.find((section) => section.id === currentSectionId);
    if (!current) return { success: false, message: 'الشعبة غير موجودة في السلة' };
    const remaining = basketSections.filter((section) => section.id !== currentSectionId);
    const conflict = [...activeStudent.currentRegisteredSections, ...remaining].find((section) => checkSectionConflict(replacement, section));
    if (conflict) return { success: false, message: `يوجد تعارض مع ${conflict.courseName}` };
    setBasketSections([...remaining, replacement]);
    return { success: true, message: 'تم تغيير الشعبة' };
  };

  const removeFromBasket = (sectionId: string) => setBasketSections((previous) => previous.filter((section) => section.id !== sectionId));
  const clearBasket = () => setBasketSections([]);

  const confirmMockRegistration = async () => {
    const token = getStoredToken();
    if (!token || role !== 'student' || !activeStudent.universityId) {
      showToast('يتطلب التسجيل حساب طالب.', 'error');
      return;
    }
    try {
      const sectionIds = [...activeStudent.currentRegisteredSections, ...basketSections].map((section) => section.id);
      await registerSections(token, [...new Set(sectionIds)]);
      setBasketSections([]);
      await refreshData();
      showToast('تم تحديث جدولك من النظام الجامعي.', 'success');
    } catch (error) {
      showToast(error instanceof UniversityApiError ? error.message : 'تعذر إتمام التسجيل.', 'error');
    }
  };

  const withdrawRegisteredSection = async (sectionId: string) => {
    const token = getStoredToken();
    if (!token || role !== 'student') return;
    try {
      const nextIds = activeStudent.currentRegisteredSections.filter((section) => section.id !== sectionId).map((section) => section.id);
      await registerSections(token, nextIds);
      await refreshData();
      showToast('تم تحديث جدولك.', 'success');
    } catch (error) {
      showToast(error instanceof UniversityApiError ? error.message : 'تعذر تعديل الجدول.', 'error');
    }
  };

  const postGrade = async (courseCode: string, grade: number, letterGrade?: string) => {
    const token = getStoredToken();
    if (!token || role !== 'admin' || !activeStudent.universityId) return false;
    try {
      await sendGrade(token, { studentId: activeStudent.universityId, courseCode, grade, letterGrade });
      await refreshData();
      showToast('تم حفظ العلامة وتحديث السجل.', 'success');
      return true;
    } catch (error) {
      showToast(error instanceof UniversityApiError ? error.message : 'تعذر حفظ العلامة.', 'error');
      return false;
    }
  };

  const resetSandbox = () => logout();

  const value: StudentContextType = {
    activeStudent, isAuthenticated, isLoading, role, activePage, setActivePage, selectStudentById, login, logout,
    refreshData, postGrade, courses, offeredSections, academicDates, calendar, studentDirectory,
    basketSections, addToBasket, addRecommendedSections, replaceBasketSection, removeFromBasket, clearBasket,
    confirmMockRegistration, withdrawRegisteredSection, resetSandbox, toasts, showToast, dismissToast,
  };

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
};

async function getStudentDirectory(token: string): Promise<StudentProfile[]> {
  const response = await fetch(`${(import.meta.env.VITE_UNI_API_URL || '').replace(/\/$/, '')}/v1/students`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new UniversityApiError(response.status, 'STUDENT_DIRECTORY_FAILED');
  return response.json() as Promise<StudentProfile[]>;
}

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (!context) throw new Error('useStudent must be used within a StudentProvider');
  return context;
};
