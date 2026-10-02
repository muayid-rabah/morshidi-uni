import React, { useMemo, useState } from 'react';
import { useStudent } from '../../context/StudentContext';
import { checkSectionConflict, getRegistrationEligibility, planCourses } from '../../services/academicEngine';
import { offeredCourseSections } from '../../data/offeredSections';
import { PlanCourse } from '../../types/student';
import { StatusBadge } from '../common/StatusBadge';
import { CalendarClock, ClipboardList, ListChecks, Plus, Search, Trash2 } from 'lucide-react';

type RegistrationTab = 'offered' | 'dates' | 'registered';
const groupOptions = ['متطلبات الجامعة الإجبارية', 'متطلبات الجامعة الاختيارية', 'متطلبات الكلية الإجبارية', 'المتطلبات المساندة', 'متطلبات التخصص الإجبارية', 'متطلبات التخصص الاختيارية'];

export const RegistrationView: React.FC = () => {
  const { activeStudent, basketSections, addToBasket, removeFromBasket, confirmMockRegistration, withdrawRegisteredSection } = useStudent();
  const [tab, setTab] = useState<RegistrationTab>('offered');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [chosenSections, setChosenSections] = useState<Record<string, string>>({});
  const scheduled = [...activeStudent.currentRegisteredSections, ...basketSections];

  const courses = useMemo(() => planCourses.filter(course => {
    const query = searchQuery.trim();
    return (!query || course.code.includes(query) || course.name.includes(query)) && (groupFilter === 'ALL' || course.group === groupFilter);
  }), [groupFilter, searchQuery]);
  const sectionsFor = (code: string) => offeredCourseSections.filter(section => section.courseCode === code);
  const selectedSection = (course: PlanCourse) => {
    const sections = sectionsFor(course.code);
    return sections.find(section => section.id === chosenSections[course.code]) || sections[0];
  };
  const registeredHours = activeStudent.currentRegisteredSections.reduce((sum, section) => sum + section.credits, 0);
  const basketHours = basketSections.reduce((sum, section) => sum + section.credits, 0);

  return <div className="registration-compact registration-portal animate-fade-in text-right">
    <header className="legacy-page-heading"><div><h1>التسجيل الإلكتروني</h1></div></header>
    <nav className="registration-tabs" aria-label="أقسام التسجيل">
      <button className={tab === 'offered' ? 'active' : ''} onClick={() => setTab('offered')}><ClipboardList className="h-5 w-5" />المواد المطروحة</button>
      <button className={tab === 'dates' ? 'active' : ''} onClick={() => setTab('dates')}><CalendarClock className="h-5 w-5" />مواعيد التسجيل</button>
      <button className={tab === 'registered' ? 'active' : ''} onClick={() => setTab('registered')}><ListChecks className="h-5 w-5" />التسجيل</button>
    </nav>

    {tab === 'dates' && <section className="registration-tab-content"><h2>مواعيد التسجيل</h2><p>المواعيد التي يسمح فيها للطالب بإضافة أو حذف المواد.</p><div className="legacy-table-wrap"><table className="legacy-table concise-table"><thead><tr><th>اليوم</th><th>التاريخ</th><th>الوقت</th></tr></thead><tbody><tr><td>الأحد</td><td dir="ltr">09/08/2026</td><td dir="ltr">12:30 - 14:30</td></tr><tr><td>الثلاثاء</td><td dir="ltr">11/08/2026</td><td dir="ltr">10:30 - 12:30</td></tr></tbody></table></div></section>}

    {tab === 'registered' && <section className="registration-tab-content"><div className="registration-title-row"><div><h2>التسجيل</h2><p>يمكنك سحب المواد من جدولك أو تثبيت المواد التي أضفتها.</p></div><button onClick={confirmMockRegistration} disabled={!basketSections.length} className="legacy-primary-button">تثبيت التسجيل ({basketSections.length})</button></div><div className="legacy-table-wrap registration-main-table"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>الشعبة</th><th>الأيام</th><th>الوقت</th><th>الساعات</th><th>المدرس</th><th></th></tr></thead><tbody>{[...activeStudent.currentRegisteredSections, ...basketSections].map(section => { const isDraft = basketSections.some(item => item.id === section.id); return <tr key={section.id} className={isDraft ? 'is-selected' : ''}><td className="font-mono">{section.courseCode}</td><td><strong>{section.courseName}</strong>{isDraft && <small>بانتظار التثبيت</small>}</td><td>{section.sectionNumber}</td><td>{section.days}</td><td dir="ltr">{section.startTime} - {section.endTime}</td><td>{section.credits}</td><td>{section.instructor}</td><td><button onClick={() => isDraft ? removeFromBasket(section.id) : withdrawRegisteredSection(section.id)} className="legacy-add-button danger-button">سحب</button></td></tr>; })}</tbody></table></div><div className="registration-total">الساعات المسجلة: <strong>{registeredHours}</strong> · ساعات المسودة: <strong>{basketHours}</strong></div></section>}

    {tab === 'offered' && <section className="registration-tab-content"><h2>المواد المطروحة</h2><p>حدد نوع الدراسة والمتطلب، ثم سجّل الشعبة المناسبة مباشرة من الجدول.</p><div className="legacy-registration-controls"><select aria-label="نوع الدراسة" defaultValue="بكالوريوس"><option>بكالوريوس</option></select><select aria-label="الفصل الدراسي" defaultValue="الفصل الأول"><option>الفصل الأول</option><option>الفصل الثاني</option></select><button className="legacy-primary-button">عرض المواد</button></div><div className="legacy-filter-row registration-filter-row"><div className="legacy-search"><Search className="h-4 w-4" aria-hidden="true" /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="ابحث عن مواد" /></div><select value={groupFilter} onChange={event => setGroupFilter(event.target.value)} aria-label="تصنيف المواد"><option value="ALL">جميع المتطلبات</option>{groupOptions.map(group => <option key={group} value={group}>{group}</option>)}</select><span className="registration-result-count">{courses.length} مادة · 3 شعب لكل مادة</span></div><div className="legacy-table-wrap registration-main-table"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>المادة</th><th>الشعبة</th><th>الأيام</th><th>الوقت</th><th>القاعة</th><th>الساعات</th><th>المدرس</th><th>الحالة</th><th>#</th></tr></thead><tbody>{courses.map(course => { const eligibility = getRegistrationEligibility(course.code, activeStudent); const sections = sectionsFor(course.code); const selected = selectedSection(course); const draft = basketSections.find(item => item.courseCode === course.code); const registered = activeStudent.currentRegisteredSections.some(item => item.courseCode === course.code); const conflicts = selected ? scheduled.some(item => item.id !== draft?.id && checkSectionConflict(selected, item)) : false; const canAdd = eligibility.state === 'ELIGIBLE' && !draft && !registered && !!selected && selected.status === 'متاحة' && selected.enrolled < selected.capacity && !conflicts; const status = registered ? 'مسجلة حاليًا' : draft ? 'ضمن المسودة' : conflicts ? 'تعارض زمني' : eligibility.label; return <tr key={course.code} className={draft ? 'is-selected' : ''}><td className="font-mono">{course.code}</td><td><strong>{course.name}</strong><small>{course.group}</small></td><td><select aria-label={`اختيار شعبة ${course.name}`} disabled={!sections.length || registered || !!draft} value={selected?.id || ''} onChange={event => setChosenSections(previous => ({ ...previous, [course.code]: event.target.value }))}>{sections.map(section => <option key={section.id} value={section.id}>شعبة {section.sectionNumber}</option>)}</select></td><td>{selected?.days || '—'}</td><td dir="ltr">{selected ? `${selected.startTime} - ${selected.endTime}` : '—'}</td><td>{selected?.room || '—'}</td><td>{course.credits}</td><td>{selected?.instructor || '—'}</td><td><StatusBadge status={status} size="sm" /></td><td>{draft ? <button className="legacy-add-button danger-button" onClick={() => removeFromBasket(draft.id)}>سحب</button> : <button disabled={!canAdd} onClick={() => selected && addToBasket(selected)} className="legacy-add-button"><Plus className="h-4 w-4" />تسجيل</button>}</td></tr>; })}</tbody></table></div></section>}
  </div>;
};
