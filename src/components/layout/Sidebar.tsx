import React, { useState } from 'react';
import { useStudent, NavigationPage } from '../../context/StudentContext';
import { BookOpen, CalendarDays, CalendarRange, ChevronDown, FileCheck2, FileText, GraduationCap, LayoutDashboard, LogOut, MessagesSquare, ReceiptText, Sparkles, UserCheck, UserX, X } from 'lucide-react';

interface SidebarProps { isOpen: boolean; onClose: () => void; }
interface NavItem { id: NavigationPage; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string | number; }

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activePage, setActivePage, activeStudent, logout, basketSections } = useStudent();
  const [moreOpen, setMoreOpen] = useState(false);
  const mainItems: NavItem[] = [
    { id: 'student-info', label: 'معلومات الطالب', icon: UserCheck },
    { id: 'smart-assistant', label: 'الرسائل', icon: MessagesSquare, badge: 5 },
    { id: 'class-schedule', label: 'الجدول الدراسي', icon: CalendarRange },
    { id: 'exams', label: 'الامتحانات', icon: FileCheck2 },
    { id: 'registration', label: 'التسجيل الإلكتروني', icon: ReceiptText, badge: basketSections.length || undefined },
    { id: 'study-plan', label: 'شهادة الأداء الأكاديمي', icon: GraduationCap },
    { id: 'grades', label: 'العلامات', icon: FileText },
    { id: 'gpa', label: 'العلامات التفصيلية', icon: Sparkles },
  ];
  const moreItems: NavItem[] = [
    { id: 'offered-courses', label: 'الشعب المطروحة', icon: BookOpen },
    { id: 'add-drop', label: 'السحب والإضافة', icon: CalendarDays },
    { id: 'absences', label: 'الغيابات', icon: UserX },
    { id: 'financial', label: 'الأمور المالية', icon: ReceiptText },
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  ];
  const openPage = (page: NavigationPage) => { setActivePage(page); onClose(); };
  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = activePage === item.id;
    return <button key={item.id} onClick={() => openPage(item.id)} className={`portal-side-item ${active ? 'active' : ''}`}><span><Icon className="h-4 w-4" aria-hidden="true" />{item.label}</span>{item.badge && <b>{item.badge}</b>}</button>;
  };
  return <>
    {isOpen && <div onClick={onClose} className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" />}
    <aside className={`portal-sidebar fixed top-0 right-0 z-40 h-full w-64 transition-transform duration-300 lg:static lg:z-10 lg:translate-x-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="portal-profile">
        <div className="portal-avatar">{activeStudent.name.charAt(0)}</div>
        <strong>{activeStudent.name}</strong><span>{activeStudent.major}</span>
        <button onClick={onClose} className="portal-close lg:hidden" aria-label="إغلاق القائمة"><X className="h-5 w-5" /></button>
      </div>
      <nav className="portal-side-nav">{mainItems.map(renderItem)}
        <button className="portal-side-item more" onClick={() => setMoreOpen(value => !value)} aria-expanded={moreOpen}><span><ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />المزيد</span></button>
        {moreOpen && <div className="portal-more-items">{moreItems.map(renderItem)}</div>}
      </nav>
      <div className="portal-logout"><button onClick={logout} className="portal-side-item"><span><LogOut className="h-4 w-4" />تسجيل الخروج</span></button></div>
    </aside>
  </>;
};
