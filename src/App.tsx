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

export const App: React.FC = () => {
  const { isAuthenticated, activePage } = useStudent();
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
    <div className="legacy-portal min-h-screen flex flex-col font-arabic">
      
      {/* Top Navbar */}
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* Main Body with RTL Sidebar & Content Area */}
      <div className="flex-1 flex w-full mx-auto max-w-[1920px]">
        
        {/* Right-Side RTL Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 min-w-0 max-w-full overflow-hidden">
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
      <footer className="mt-auto border-t border-slate-200/80 py-6 text-center text-xs text-slate-500">
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
