import React from 'react';
import { Bell, Menu, Sparkles } from 'lucide-react';
import { useStudent } from '../../context/StudentContext';

interface NavbarProps { onToggleSidebar: () => void; }

const pageTitles: Record<string, string> = {
  dashboard: 'الرئيسية', 'student-info': 'ملف الطالب', registration: 'التسجيل الإلكتروني',
  'offered-courses': 'الشعب المطروحة', 'add-drop': 'السحب والإضافة', 'class-schedule': 'الجدول الدراسي',
  grades: 'العلامات', gpa: 'المعدل التراكمي', 'study-plan': 'الخطة الدراسية', absences: 'الغيابات',
  exams: 'الامتحانات', financial: 'الأمور المالية', notifications: 'الرسائل', 'smart-assistant': 'مرشدي الذكي',
};

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { activePage, activeStudent, setActivePage } = useStudent();
  return <header className="portal-topbar sticky top-0 z-30">
    <div className="portal-topbar-inner">
      <div className="portal-brand"><div className="portal-brand-mark"><Sparkles className="h-4 w-4" /></div><div><strong>مرشدي</strong><span>بوابتك الأكاديمية الذكية</span></div></div>
      <div className="portal-current-page"><span>بوابة الطالب</span><b>{pageTitles[activePage]}</b></div>
      <div className="portal-top-actions"><button onClick={() => setActivePage('notifications')} className="portal-bell" aria-label="الإشعارات"><Bell className="h-5 w-5" /><i /></button><div className="portal-mini-user"><span>{activeStudent.name.split(' ')[0]}</span><small>{activeStudent.universityId}</small></div><button onClick={onToggleSidebar} className="portal-menu-button" aria-label="فتح القائمة"><Menu className="h-5 w-5" /></button></div>
    </div>
  </header>;
};
