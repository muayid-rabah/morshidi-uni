import React from 'react';
import { useStudent, NavigationPage } from '../../context/StudentContext';
import { Bell, CalendarRange, FileCheck2, FileText, GraduationCap, LayoutDashboard, LogOut, ReceiptText, RotateCcw, Sparkles, UserCheck, X } from 'lucide-react';
import { openMorshidi } from '../../services/morshidiLink';

interface SidebarProps { isOpen: boolean; onClose: () => void; }
interface NavItem { id: NavigationPage; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string | number; }

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activePage, setActivePage, activeStudent, logout, resetSandbox, basketSections } = useStudent();
  const mainItems: NavItem[] = [
    { id: 'dashboard', label: 'الشاشة الرئيسية', icon: LayoutDashboard },
    { id: 'student-info', label: 'معلومات الطالب', icon: UserCheck },
    { id: 'notifications', label: 'الرسائل', icon: Bell, badge: 5 },
    { id: 'class-schedule', label: 'الجدول الدراسي', icon: CalendarRange },
    { id: 'exams', label: 'الامتحانات', icon: FileCheck2 },
    { id: 'registration', label: 'التسجيل الإلكتروني', icon: ReceiptText, badge: basketSections.length || undefined },
    { id: 'study-plan', label: 'الخطة الدراسية', icon: GraduationCap },
    { id: 'grades', label: 'العلامات', icon: FileText },
  ];

  const openPage = (page: NavigationPage) => { setActivePage(page); onClose(); };
  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    return <button key={item.id} onClick={() => openPage(item.id)} className={`portal-side-item ${activePage === item.id ? 'active' : ''}`}><span><Icon className="h-4 w-4" aria-hidden="true" />{item.label}</span>{item.badge && <b>{item.badge}</b>}</button>;
  };

  return <>
    {isOpen && <div onClick={onClose} className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" />}
    <aside className={`portal-sidebar fixed top-0 right-0 z-40 h-full w-64 transition-transform duration-300 lg:static lg:z-10 lg:translate-x-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="portal-profile">
        <div className="portal-avatar">{activeStudent.name.charAt(0)}</div>
        <strong>{activeStudent.name}</strong><span>{activeStudent.major}</span>
        <button onClick={onClose} className="portal-close lg:hidden" aria-label="إغلاق القائمة"><X className="h-5 w-5" /></button>
      </div>
      <nav className="portal-side-nav" aria-label="التنقل الرئيسي">{mainItems.map(renderItem)}</nav>
      <div className="portal-sidebar-bottom">
        <button onClick={() => openMorshidi(activeStudent)} className="portal-ai-quick"><span><Sparkles className="h-4 w-4" />مرشدي الذكي</span><em>AI</em></button>
        <button onClick={resetSandbox} className="portal-side-item text-amber-600 hover:text-amber-700"><span><RotateCcw className="h-4 w-4" />إعادة ضبط البيئة التجريبية</span></button>
        <div className="portal-logout"><button onClick={logout} className="portal-side-item"><span><LogOut className="h-4 w-4" />تسجيل الخروج</span></button></div>
      </div>
    </aside>
  </>;
};
