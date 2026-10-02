import React, { useState } from 'react';
import { useStudent, NavigationPage } from '../../context/StudentContext';
import {
  Bell,
  LogOut,
  User,
  Menu,
  ShieldAlert,
  Calendar,
  CreditCard,
  GraduationCap
} from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { activeStudent, logout, setActivePage } = useStudent();
  const [showNotifications, setShowNotifications] = useState(false);

  // Dynamic realistic notifications
  const notifications = [
    {
      id: 'notif-1',
      title: 'فترة السحب والإضافة مفتوحة حالياً',
      time: 'اليوم',
      icon: <Calendar className="w-4 h-4 text-emerald-600" />,
      page: 'add-drop' as NavigationPage,
    },
    {
      id: 'notif-2',
      title: activeStudent.exams.length > 0 
        ? `أقرب امتحان: ${activeStudent.exams[0].courseName} (${activeStudent.exams[0].date})` 
        : 'تم الإعلان عن جدول الامتحانات النصفية',
      time: 'أمس',
      icon: <GraduationCap className="w-4 h-4 text-teal-600" />,
      page: 'exams' as NavigationPage,
    },
    ...(activeStudent.financialSummary.currentBalance > 0 ? [{
      id: 'notif-3',
      title: `مستحقات مالية غير مسددة (${activeStudent.financialSummary.currentBalance} د.أ)`,
      time: 'منذ يومين',
      icon: <CreditCard className="w-4 h-4 text-amber-600" />,
      page: 'financial' as NavigationPage,
    }] : []),
    ...(activeStudent.profileType === 'review' ? [{
      id: 'notif-4',
      title: 'تنبيه: مادة مساق 1505320 تتطلب مراجعة معادلة المتطلب السابق',
      time: 'منذ أسبوع',
      icon: <ShieldAlert className="w-4 h-4 text-rose-600" />,
      page: 'study-plan' as NavigationPage,
    }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#171a1b]/95 backdrop-blur-md border-b border-[#353b3f] shadow-xs">
      <div className="px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        
        {/* Right side: Mobile Menu + University Brand */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="القائمة الجانبية"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div
            onClick={() => setActivePage('dashboard')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <img
              src="/logo.svg"
              alt="شعار جامعة مرشدي"
              className="w-11 h-11 object-contain drop-shadow-sm transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold text-univ-950 tracking-tight">
                  جامعة مرشدي
                </span>
                <span className="hidden sm:inline-block text-[11px] font-semibold bg-univ-100 text-univ-800 px-2 py-0.5 rounded-full border border-univ-200">
                  بوابة الطالب
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Morshidi University
              </span>
            </div>
          </div>
        </div>

        {/* Center: Active Registration Indicator */}
        <div
          onClick={() => setActivePage('registration')}
          className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer transition-all shadow-xs group"
          title="فترة التسجيل والسحب والإضافة مفتوحة حالياً — انقر للذهاب للتسجيل"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
          </span>
          <span className="text-xs font-bold text-emerald-900 group-hover:underline">
            فترة التسجيل والسحب والإضافة مفتوحة حالياً
          </span>
        </div>

        {/* Center / Left side: Notifications & Student Profile & Logout */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 text-slate-600 hover:text-univ-900 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200/60 shadow-xs"
              aria-label="الإشعارات والتنبيهات"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute left-0 mt-2 w-80 bg-white rounded-3xl shadow-elevated border border-slate-200 py-2.5 z-50 animate-fade-in text-right">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">التنبيهات والإعلانات</span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">
                    {notifications.length} جديد
                  </span>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setActivePage(n.page);
                        setShowNotifications(false);
                      }}
                      className="p-3 hover:bg-slate-50 cursor-pointer flex items-start gap-3 transition-colors"
                    >
                      <div className="mt-0.5 p-1.5 bg-slate-100 rounded-xl">{n.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-800 font-medium leading-snug">{n.title}</p>
                        <span className="text-[10px] text-slate-400 mt-1 inline-block">{n.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Student Profile Snapshot in Navbar */}
          <div
            onClick={() => setActivePage('student-info')}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-50/80 hover:bg-slate-100 cursor-pointer transition-all border border-slate-200/80 group"
            title="انقر لعرض الملف الشخصي للطالب"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-univ-800 to-forest-800 text-white font-bold flex items-center justify-center shadow-soft text-xs">
                {activeStudent.name.charAt(0)}
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white absolute -bottom-0.5 -right-0.5" />
            </div>
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-univ-900 transition-colors">
                {activeStudent.name}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {activeStudent.universityId}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="px-3 py-2 text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50/80 border border-rose-200/80 rounded-2xl transition-all flex items-center gap-1.5 shadow-xs font-semibold text-xs"
            title="تسجيل الخروج من الحساب"
            aria-label="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">تسجيل الخروج</span>
          </button>
        </div>

      </div>
    </header>
  );
};
