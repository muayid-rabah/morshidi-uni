import React, { useMemo, useState } from 'react';
import { useStudent } from '../../context/StudentContext';
import { calculateStudentProgress, getRegistrationEligibility } from '../../services/academicEngine';
import { StatusBadge } from '../common/StatusBadge';
import { CalendarClock, ClipboardList, ListChecks, Plus, Search } from 'lucide-react';

type Tab = 'offered' | 'dates' | 'registered';

export const RegistrationView: React.FC = () => {
  const { activeStudent, courses, offeredSections, academicDates, calendar, basketSections, addToBasket, removeFromBasket, confirmMockRegistration, withdrawRegisteredSection } = useStudent();
  const [tab, setTab] = useState<Tab>('registered');
  const [query, setQuery] = useState('');
  const progress = calculateStudentProgress(activeStudent, courses);
  const registeredHours = activeStudent.currentRegisteredSections.reduce((sum, section) => sum + section.credits, 0);
  const basketHours = basketSections.reduce((sum, section) => sum + section.credits, 0);
  const failedHours = activeStudent.semesterHistory.flatMap(term => term.courses).filter(course => course.status === 'راسب').reduce((sum, course) => sum + course.credits, 0);
  const visibleSections = useMemo(() => offeredSections.filter(section => {
    const value = query.trim().toLocaleLowerCase();
    return !value || section.courseCode.toLocaleLowerCase().includes(value) || section.courseName.toLocaleLowerCase().includes(value);
  }), [offeredSections, query]);

  return <div className="registration-compact registration-portal animate-fade-in text-right">
    <header className="legacy-page-heading"><div><h1>التسجيل الإلكتروني</h1><p>{calendar?.currentTerm.label || 'الفصل الحالي'}</p></div></header>
    <div className="academic-hours-summary"><div><span>الساعات المنجزة</span><strong>{progress.totalCompletedHours}</strong></div><div><span>الساعات المتبقية</span><strong>{progress.remainingHours}</strong></div><div><span>ساعات هذا الفصل</span><strong>{registeredHours + basketHours}</strong></div><div className={failedHours ? 'failed' : ''}><span>ساعات الرسوب</span><strong>{failedHours}</strong></div></div>
    <nav className="registration-tabs" aria-label="أقسام التسجيل">
      <button className={tab === 'offered' ? 'active' : ''} onClick={() => setTab('offered')}><ClipboardList className="h-5 w-5" />المواد المطروحة</button>
      <button className={tab === 'dates' ? 'active' : ''} onClick={() => setTab('dates')}><CalendarClock className="h-5 w-5" />مواعيد التسجيل</button>
      <button className={tab === 'registered' ? 'active' : ''} onClick={() => setTab('registered')}><ListChecks className="h-5 w-5" />جدولي</button>
    </nav>
    {tab === 'dates' && <section className="registration-tab-content"><h2>مواعيد التسجيل · {calendar?.currentTerm.label || 'الفصل الحالي'}</h2><p>حالة التسجيل: {calendar?.registrationOpen ? 'مفتوح' : 'مغلق'}</p><div className="legacy-table-wrap"><table className="legacy-table"><thead><tr><th>الموعد</th><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>{academicDates.map(item => <tr key={item.id}><td>{item.title}</td><td dir="ltr">{item.date}</td><td>{item.status}</td></tr>)}</tbody></table></div>{calendar?.registrationWindow.end && <p>ينتهي التسجيل: <time dir="ltr">{calendar.registrationWindow.end}</time></p>}</section>}
    {tab === 'registered' && <section className="registration-tab-content"><div className="registration-title-row"><h2>جدولي الحالي</h2><button onClick={confirmMockRegistration} disabled={!basketSections.length || !calendar?.registrationOpen} className="legacy-primary-button">تأكيد المسودة ({basketSections.length})</button></div><div className="legacy-table-wrap"><table className="legacy-table"><thead><tr><th>المادة</th><th>الشعبة</th><th>الأيام</th><th>الوقت</th><th>الساعات</th><th></th></tr></thead><tbody>{[...activeStudent.currentRegisteredSections, ...basketSections].map(section => { const draft = basketSections.some(item => item.id === section.id); return <tr key={section.id}><td>{section.courseCode} · {section.courseName}</td><td>{section.sectionNumber}</td><td>{section.days}</td><td dir="ltr">{section.startTime}–{section.endTime}</td><td>{section.credits}</td><td><button onClick={() => draft ? removeFromBasket(section.id) : withdrawRegisteredSection(section.id)} className="legacy-add-button danger-button">سحب</button></td></tr>; })}</tbody></table></div><p className="registration-total">مسجلة: <strong>{registeredHours}</strong> ساعة · مسودة: <strong>{basketHours}</strong> ساعة</p></section>}
    {tab === 'offered' && <section className="registration-tab-content"><div className="registration-title-row"><div><h2>المواد المطروحة</h2><p>{calendar?.currentTerm.label || 'الفصل الحالي'} · {visibleSections.length} شعبة</p></div><label className="legacy-search"><Search className="h-4 w-4"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث برقم المادة أو اسمها"/></label></div>{!calendar?.registrationOpen && <p role="status">التسجيل مغلق حاليًا؛ يمكنك مراجعة الشعب وتجهيز مسودتك.</p>}<div className="legacy-table-wrap"><table className="legacy-table"><thead><tr><th>المادة</th><th>الشعبة</th><th>الأيام</th><th>الوقت</th><th>القاعة</th><th>الساعات</th><th>المدرس</th><th>المقاعد</th><th>الأهلية</th><th></th></tr></thead><tbody>{visibleSections.map(section => { const eligibility = getRegistrationEligibility(section.courseCode, activeStudent, courses); const draft = basketSections.find(item => item.courseCode === section.courseCode); const alreadyTaken = activeStudent.currentRegisteredSections.some(item => item.courseCode === section.courseCode); const available = section.status === 'متاحة' && section.enrolled < section.capacity; const canAdd = eligibility.state === 'ELIGIBLE' && !draft && !alreadyTaken && available; return <tr key={section.id}><td>{section.courseCode} · {section.courseName}</td><td>{section.sectionNumber}</td><td>{section.days}</td><td dir="ltr">{section.startTime}–{section.endTime}</td><td>{section.room}</td><td>{section.credits}</td><td>{section.instructor}</td><td>{Math.max(0, section.capacity - section.enrolled)} / {section.capacity}</td><td><StatusBadge status={eligibility.label} size="sm"/></td><td>{draft ? <button onClick={() => removeFromBasket(draft.id)} className="legacy-add-button danger-button">إزالة</button> : <button disabled={!canAdd} onClick={() => addToBasket(section)} className="legacy-add-button"><Plus className="h-4 w-4"/>أضف</button>}</td></tr>;})}</tbody></table></div></section>}
  </div>;
};
