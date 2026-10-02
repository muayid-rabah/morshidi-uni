import React, { useMemo, useState } from 'react';
import { useStudent } from '../../context/StudentContext';
import { calculateStudentProgress, getRegistrationEligibility, planCourses } from '../../services/academicEngine';
import { offeredCourseSections } from '../../data/offeredSections';
import { StatusBadge } from '../common/StatusBadge';
import { CalendarClock, ClipboardList, ListChecks, Plus, Search } from 'lucide-react';

type RegistrationTab = 'offered' | 'dates' | 'registered';
const groupOptions = ['متطلبات الجامعة الإجبارية', 'متطلبات الجامعة الاختيارية', 'متطلبات الكلية الإجبارية', 'المتطلبات المساندة', 'متطلبات التخصص الإجبارية', 'متطلبات التخصص الاختيارية'];

export const RegistrationView: React.FC = () => {
  const { activeStudent, basketSections, addToBasket, removeFromBasket, confirmMockRegistration, withdrawRegisteredSection } = useStudent();
  const [tab, setTab] = useState<RegistrationTab>('registered');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const registeredHours = activeStudent.currentRegisteredSections.reduce((sum, section) => sum + section.credits, 0);
  const basketHours = basketSections.reduce((sum, section) => sum + section.credits, 0);
  const progress = calculateStudentProgress(activeStudent);
  const failedHours = activeStudent.semesterHistory.flatMap(semester => semester.courses).filter(course => course.status === 'راسب').reduce((sum, course) => sum + course.credits, 0);
  const offeredRows = useMemo(() => offeredCourseSections.filter(section => {
    const course = planCourses.find(item => item.code === section.courseCode);
    const query = searchQuery.trim();
    return !!course && (!query || section.courseCode.includes(query) || section.courseName.includes(query)) && (groupFilter === 'ALL' || course.group === groupFilter);
  }), [groupFilter, searchQuery]);

  return <div className="registration-compact registration-portal animate-fade-in text-right">
    <header className="legacy-page-heading"><div><h1>التسجيل الإلكتروني</h1></div></header>
    <div className="academic-hours-summary"><div><span>الساعات المنجزة</span><strong>{progress.totalCompletedHours}</strong></div><div><span>الساعات المتبقية</span><strong>{progress.remainingHours}</strong></div><div><span>ساعات هذا الفصل</span><strong>{registeredHours + basketHours}</strong></div><div className={failedHours ? 'failed' : ''}><span>ساعات الرسوب</span><strong>{failedHours}</strong></div></div>
    <nav className="registration-tabs" aria-label="أقسام التسجيل">
      <button className={tab === 'offered' ? 'active' : ''} onClick={() => setTab('offered')}><ClipboardList className="h-5 w-5" />المواد المطروحة</button>
      <button className={tab === 'dates' ? 'active' : ''} onClick={() => setTab('dates')}><CalendarClock className="h-5 w-5" />مواعيد التسجيل</button>
      <button className={tab === 'registered' ? 'active' : ''} onClick={() => setTab('registered')}><ListChecks className="h-5 w-5" />التسجيل</button>
    </nav>

    {tab === 'dates' && <section className="registration-tab-content"><h2>مواعيد التسجيل</h2><p>المواعيد التي يسمح فيها للطالب بإضافة أو حذف المواد.</p><div className="legacy-table-wrap"><table className="legacy-table concise-table"><thead><tr><th>اليوم</th><th>التاريخ</th><th>الوقت</th></tr></thead><tbody><tr><td>الأحد</td><td dir="ltr">09/08/2026</td><td dir="ltr">12:30 - 14:30</td></tr><tr><td>الثلاثاء</td><td dir="ltr">11/08/2026</td><td dir="ltr">10:30 - 12:30</td></tr></tbody></table></div></section>}

    {tab === 'registered' && <section className="registration-tab-content"><div className="registration-title-row"><div><h2>التسجيل</h2><p>يمكنك سحب المواد من جدولك أو إضافة مواد جديدة.</p></div><div className="registration-actions"><button onClick={() => setTab('offered')} className="legacy-primary-button"><Plus className="h-4 w-4" />إضافة مواد</button><button onClick={confirmMockRegistration} disabled={!basketSections.length} className="legacy-primary-button">تثبيت التسجيل ({basketSections.length})</button></div></div><div className="legacy-table-wrap registration-main-table"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>الشعبة</th><th>الأيام</th><th>الوقت</th><th>الساعات</th><th>المدرس</th><th></th></tr></thead><tbody>{[...activeStudent.currentRegisteredSections, ...basketSections].map(section => { const isDraft = basketSections.some(item => item.id === section.id); return <tr key={section.id} className={isDraft ? 'is-selected' : ''}><td className="font-mono">{section.courseCode}</td><td><strong>{section.courseName}</strong>{isDraft && <small>بانتظار التثبيت</small>}</td><td>{section.sectionNumber}</td><td>{section.days}</td><td dir="ltr">{section.startTime} - {section.endTime}</td><td>{section.credits}</td><td>{section.instructor}</td><td><button onClick={() => isDraft ? removeFromBasket(section.id) : withdrawRegisteredSection(section.id)} className="legacy-add-button danger-button">سحب</button></td></tr>; })}</tbody></table></div><div className="registration-total">الساعات المسجلة: <strong>{registeredHours}</strong> · ساعات المسودة: <strong>{basketHours}</strong></div></section>}

    {tab === 'offered' && <section className="registration-tab-content"><h2>إضافة مواد</h2><p>كل مادة أدناه لها ثلاث شعب موزعة على ح / ث / خ أو ن / ر، ويظهر زر التسجيل فقط للشعبة المسموح بها.</p><div className="legacy-registration-controls"><select aria-label="نوع الدراسة" defaultValue="بكالوريوس"><option>بكالوريوس</option></select><select aria-label="الفصل الدراسي" defaultValue="الفصل الأول"><option>الفصل الأول</option><option>الفصل الثاني</option></select><button className="legacy-primary-button">عرض المواد</button></div><div className="legacy-filter-row registration-filter-row"><div className="legacy-search"><Search className="h-4 w-4" aria-hidden="true" /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="ابحث عن مواد" /></div><select value={groupFilter} onChange={event => setGroupFilter(event.target.value)} aria-label="تصنيف المواد"><option value="ALL">جميع المتطلبات</option>{groupOptions.map(group => <option key={group} value={group}>{group}</option>)}</select><span className="registration-result-count">{offeredRows.length} شعبة مطروحة</span></div><div className="legacy-table-wrap registration-main-table"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>المادة</th><th>الشعبة</th><th>الأيام</th><th>الوقت</th><th>القاعة</th><th>الساعات</th><th>المدرس</th><th>الحالة</th><th>#</th></tr></thead><tbody>{offeredRows.map(section => { const eligibility = getRegistrationEligibility(section.courseCode, activeStudent); const draft = basketSections.find(item => item.courseCode === section.courseCode); const registered = activeStudent.currentRegisteredSections.some(item => item.courseCode === section.courseCode); const available = section.status === 'متاحة' && section.enrolled < section.capacity; const canAdd = eligibility.state === 'ELIGIBLE' && !draft && !registered && available; const status = registered ? 'مسجلة حاليًا' : draft?.id === section.id ? 'ضمن المسودة' : !available ? 'الشعبة مغلقة' : eligibility.label; return <tr key={section.id} className={draft?.id === section.id ? 'is-selected' : ''}><td className="font-mono">{section.courseCode}</td><td><strong>{section.courseName}</strong></td><td>{section.sectionNumber}</td><td>{section.days}</td><td dir="ltr">{section.startTime} - {section.endTime}</td><td>{section.room}</td><td>{section.credits}</td><td>{section.instructor}</td><td><StatusBadge status={status} size="sm" />{eligibility.reason && !canAdd && !registered && <small>{eligibility.reason}</small>}</td><td>{draft?.id === section.id ? <button className="legacy-add-button danger-button" onClick={() => removeFromBasket(draft.id)}>سحب</button> : <button disabled={!canAdd} onClick={() => addToBasket(section)} className="legacy-add-button"><Plus className="h-4 w-4" />تسجيل</button>}</td></tr>; })}</tbody></table></div></section>}
  </div>;
};
