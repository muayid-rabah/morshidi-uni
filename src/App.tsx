import React, { useState } from 'react';
import { useStudent } from './context/StudentContext';
import { LoginView } from './components/auth/LoginView';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { ToastContainer } from './components/common/ToastContainer';
import { FloatingAssistant } from './components/portal/FloatingAssistant';

// Portal Views
import { DashboardView } from './components/portal/DashboardView';
import { StudentInfoView } from './components/portal/StudentInfoView';
import { RegistrationView } from './components/portal/RegistrationView';
import { OfferedCoursesView } from './components/portal/OfferedCoursesView';
import { AddDropView } from './components/portal/AddDropView';
import { ClassScheduleView } from './components/portal/ClassScheduleView';
import { GradesView } from './components/portal/GradesView';
import { GpaView } from './components/portal/GpaView';
import { StudyPlanView } from './components/portal/StudyPlanView';
import { AbsencesView } from './components/portal/AbsencesView';
import { ExamsView } from './components/portal/ExamsView';
import { FinancialView } from './components/portal/FinancialView';
import { MorshidiAssistantView } from './components/portal/MorshidiAssistantView';

import {
  GraduationCap,
  Sparkles,
  User,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';

export const App: React.FC = () => {
  const { isAuthenticated, activePage, activeStudent } = useStudent();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return (
      <>
        <LoginView />
        <ToastContainer />
      </>
    );
  }

  // Active View Switcher
  const renderActiveView = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardView />;
      case 'student-info':
        return <StudentInfoView />;
      case 'registration':
        return <RegistrationView />;
      case 'offered-courses':
        return <OfferedCoursesView />;
      case 'add-drop':
        return <AddDropView />;
      case 'class-schedule':
        return <ClassScheduleView />;
      case 'grades':
        return <GradesView />;
      case 'gpa':
        return <GpaView />;
      case 'study-plan':
        return <StudyPlanView />;
      case 'absences':
        return <AbsencesView />;
      case 'exams':
        return <ExamsView />;
      case 'financial':
        return <FinancialView />;
      case 'smart-assistant':
        return <MorshidiAssistantView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex flex-col font-arabic">
      
      {/* Top Navbar */}
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* Main Body with RTL Sidebar & Content Area */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        
        {/* Right-Side RTL Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 max-w-full overflow-hidden">
          
          {/* ==================================================
              SECTION 23: HOMEPAGE / PORTAL HEADER
              At the top of the portal show:
              جامعة مرشدي
              Morshidi University
              بوابة الطالب
              Student card:
              اسم الطالب | الرقم الجامعي | التخصص | المرشد الأكاديمي
              ================================================== */}
          {/* Sleek Top Student Identity Strip */}
          <div className="mb-6 px-5 py-3 rounded-2xl bg-white border border-slate-200/80 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-3 text-right">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-univ-800 to-forest-800 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                {activeStudent.name.charAt(0)}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-extrabold text-slate-900">{activeStudent.name}</span>
                <span className="text-slate-300">•</span>
                <span className="font-mono font-bold text-univ-800 bg-univ-50 px-2 py-0.5 rounded-lg border border-univ-200">
                  {activeStudent.universityId}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600 font-medium">{activeStudent.major}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">{activeStudent.studyPlan}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 self-start md:self-auto">
              <span>المرشد الأكاديمي:</span>
              <strong className="text-slate-800 font-semibold">{activeStudent.academicAdvisor}</strong>
            </div>
          </div>

          {/* Active View Container */}
          <div className="min-w-0">
            {renderActiveView()}
          </div>

        </main>
      </div>

      {/* Global Floating Assistant */}
      <FloatingAssistant />

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Modern Academic Portal Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/70 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <span>© {new Date().getFullYear()} جامعة مرشدي (Morshidi University)</span>
            <span>•</span>
            <span>عمادة القبول والتسجيل وكلية تكنولوجيا المعلومات</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>نظام الإرشاد الأكاديمي الذكي (خطة 12)</span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold">بوابة الطالب الرسمية</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
