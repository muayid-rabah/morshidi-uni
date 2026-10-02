import React from 'react';
import { useStudent, NavigationPage } from '../../context/StudentContext';
import {
  LayoutDashboard,
  UserCheck,
  ClipboardList,
  BookOpen,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  TrendingUp,
  FileText,
  UserX,
  FileCheck2,
  Wallet,
  Sparkles,
  LogOut,
  X,
  ShieldAlert,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: NavigationPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activePage, setActivePage, activeStudent, logout, basketSections } = useStudent();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'student-info', label: 'معلومات الطالب', icon: UserCheck },
    {
      id: 'registration',
      label: 'التسجيل',
      icon: ClipboardList,
      badge: basketSections.length > 0 ? basketSections.length : undefined,
      badgeColor: 'bg-emerald-600 text-white',
    },
    { id: 'offered-courses', label: 'المواد المطروحة', icon: BookOpen },
    { id: 'add-drop', label: 'السحب والإضافة', icon: CalendarDays },
    { id: 'class-schedule', label: 'الجدول الدراسي', icon: CalendarRange },
    { id: 'grades', label: 'العلامات', icon: GraduationCap },
    { id: 'gpa', label: 'المعدل التراكمي', icon: TrendingUp },
    {
      id: 'study-plan',
      label: 'الخطة الدراسية',
      icon: FileText,
      badge: activeStudent.profileType === 'review' ? 'مراجعة' : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'absences',
      label: 'الغيابات',
      icon: UserX,
      badge: activeStudent.absences.some(a => a.status === 'تنبيه') ? 'تنبيه' : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'exams',
      label: 'مواعيد الامتحانات',
      icon: FileCheck2,
      badge: activeStudent.exams.length > 0 ? activeStudent.exams.length : undefined,
      badgeColor: 'bg-teal-700 text-white',
    },
    {
      id: 'financial',
      label: 'الأمور المالية',
      icon: Wallet,
      badge: activeStudent.financialSummary.currentBalance > 0 ? `${activeStudent.financialSummary.currentBalance} د.أ` : undefined,
      badgeColor: 'bg-amber-600 text-white',
    },
    {
      id: 'smart-assistant',
      label: 'مرشدي الذكي',
      icon: Sparkles,
      badge: 'AI',
      badgeColor: 'bg-gradient-to-r from-univ-600 to-teal-500 text-white animate-pulse',
    },
  ];

  const handleNavClick = (page: NavigationPage) => {
    setActivePage(page);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 right-0 z-40 h-full w-72 bg-[#191c1d] border-l border-[#353b3f] shadow-soft-lg flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } lg:static lg:z-10`}
      >
        {/* Sidebar Header with Student Card */}
        <div className="p-5 border-b border-[#353b3f] text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-28 w-28 items-center justify-center rounded-xl border-2 border-[#245398] bg-[#2a3033] text-4xl font-bold text-[#63a5ff] shadow-soft">
              {activeStudent.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-[#f0e4d3] line-clamp-1">
                {activeStudent.name}
              </span>
              <span className="text-sm text-[#63a5ff] font-medium">
                {activeStudent.major}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Major & Advisor Badge */}
        {/* Navigation Items List */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-[#245398] text-white shadow-xs font-semibold'
                    : 'text-[#c6b7a6] hover:bg-[#24292b] hover:text-[#f0e4d3]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-[#9da5a7] group-hover:text-[#63a5ff]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.badgeColor || 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Review Notice if applicable */}
        {activeStudent.profileType === 'review' && (
          <div className="mx-3 mb-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-right">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>مراجعة أكاديمية مطلوبة</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-tight">
              لديك مواد تتطلب معادلة مسبقة وموافقة مرشدك {activeStudent.academicAdvisor}.
            </p>
          </div>
        )}

        {/* Logout action */}
        <div className="p-3 border-t border-[#353b3f]">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-800 transition-colors"
          >
            <LogOut className="w-4 h-4 text-rose-600" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
};
