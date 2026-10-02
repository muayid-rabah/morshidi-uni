import React, { useMemo, useState } from 'react';
import { useStudent } from '../../context/StudentContext';
import { checkSectionConflict, findScheduleConflicts, getRegistrationEligibility, planCourses } from '../../services/academicEngine';
import { offeredCourseSections } from '../../data/offeredSections';
import { CourseSection, PlanCourse } from '../../types/student';
import { StatusBadge } from '../common/StatusBadge';
import { AlertTriangle, CheckCircle2, ClipboardList, Plus, Search, Trash2 } from 'lucide-react';

const groupOptions = [
  'متطلبات الجامعة الإجبارية', 'متطلبات الجامعة الاختيارية', 'متطلبات الكلية الإجبارية',
  'المتطلبات المساندة', 'متطلبات التخصص الإجبارية', 'متطلبات التخصص الاختيارية',
];

export const RegistrationView: React.FC = () => {
  const { activeStudent, basketSections, addToBasket, replaceBasketSection, removeFromBasket, clearBasket, confirmMockRegistration } = useStudent();
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [scope, setScope] = useState<'eligible' | 'all'>('eligible');
  const [chosenSections, setChosenSections] = useState<Record<string, string>>({});

  const registeredHours = activeStudent.currentRegisteredSections.reduce((sum, section) => sum + section.credits, 0);
  const basketHours = basketSections.reduce((sum, section) => sum + section.credits, 0);
  const scheduledSections = [...activeStudent.currentRegisteredSections, ...basketSections];
  const conflicts = useMemo(() => findScheduleConflicts(scheduledSections), [scheduledSections]);
  const filteredCourses = useMemo(() => planCourses.filter(course => {
    const eligibility = getRegistrationEligibility(course.code, activeStudent);
    const query = searchQuery.trim();
    return (!query || course.code.includes(query) || course.name.includes(query))
      && (groupFilter === 'ALL' || course.group === groupFilter)
      && (scope === 'all' || eligibility.state === 'ELIGIBLE');
  }), [activeStudent, groupFilter, scope, searchQuery]);

  const sectionsFor = (courseCode: string) => offeredCourseSections.filter(section => section.courseCode === courseCode);
  const selectedSection = (course: PlanCourse) => {
    const sections = sectionsFor(course.code);
    return sections.find(section => section.id === chosenSections[course.code]) || sections[0];
  };
  const sectionLabel = (section: CourseSection) => `شعبة ${section.sectionNumber} — ${section.days} (${section.startTime}–${section.endTime})`;

  return (
    <div className="registration-compact space-y-4 animate-fade-in text-right">
      <header className="legacy-page-heading">
        <div>
          <h1>التسجيل الإلكتروني</h1>
          <p>الفصل الأول 2026/2027 — اختر شعبة من الخيارات المتاحة ثم ثبّت مسودة جدولك.</p>
        </div>
        <span className="legacy-open-status">التسجيل مفتوح</span>
      </header>

      <section className="legacy-toolbar" aria-label="فلاتر التسجيل">
        <div className="legacy-toolbar-field"><label htmlFor="registration-year">السنة</label><select id="registration-year" defaultValue="2026/2027"><option>2026/2027</option></select></div>
        <div className="legacy-toolbar-field"><label htmlFor="registration-semester">الفصل</label><select id="registration-semester" defaultValue="الفصل الأول"><option>الفصل الأول</option><option>الفصل الثاني</option></select></div>
        <div className="legacy-hour-summary"><span>المسجل</span><strong>{registeredHours}</strong><span>المسودة</span><strong>{basketHours}</strong><span>الإجمالي</span><strong>{registeredHours + basketHours}/18</strong></div>
      </section>

      {conflicts.length > 0 && <div className="legacy-alert legacy-alert-danger"><AlertTriangle className="h-4 w-4" /><span>يوجد تعارض زمني في المسودة: {conflicts.map(conflict => conflict.reason).join(' — ')}</span></div>}

      <section className="legacy-data-section">
        <div className="legacy-section-title"><div><ClipboardList className="h-4 w-4" /><h2>مسودة جدول التسجيل</h2></div><span>{basketSections.length} مواد · {basketHours} ساعة</span></div>
        {basketSections.length === 0 ? <p className="legacy-empty-row">لم تضف أي مادة إلى مسودة التسجيل بعد.</p> : <div className="legacy-table-wrap"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>الشعبة</th><th>الموعد</th><th>القاعة / المدرس</th><th>الساعات</th><th>تعديل</th></tr></thead><tbody>{basketSections.map(section => {
          const alternatives = sectionsFor(section.courseCode).filter(candidate => candidate.status === 'متاحة' && ![...activeStudent.currentRegisteredSections, ...basketSections.filter(item => item.id !== section.id)].some(existing => checkSectionConflict(candidate, existing)));
          return <tr key={section.id}><td className="font-mono">{section.courseCode}</td><td className="font-bold">{section.courseName}</td><td>شعبة {section.sectionNumber}</td><td dir="ltr">{section.days} · {section.startTime}–{section.endTime}</td><td>{section.room} · {section.instructor}</td><td>{section.credits}</td><td><div className="flex items-center gap-2"><select aria-label={`تعديل شعبة ${section.courseName}`} value={section.id} onChange={event => { const replacement = offeredCourseSections.find(item => item.id === event.target.value); if (replacement) replaceBasketSection(section.id, replacement); }}>{alternatives.map(item => <option key={item.id} value={item.id}>{sectionLabel(item)}</option>)}</select><button onClick={() => removeFromBasket(section.id)} className="legacy-icon-button danger" aria-label={`حذف ${section.courseName}`}><Trash2 className="h-4 w-4" /></button></div></td></tr>;
        })}</tbody></table></div>}
        <div className="legacy-table-actions"><button onClick={clearBasket} disabled={!basketSections.length} className="legacy-text-button">إفراغ المسودة</button><button onClick={confirmMockRegistration} disabled={!basketSections.length || conflicts.length > 0} className="legacy-primary-button"><CheckCircle2 className="h-4 w-4" />تثبيت التسجيل</button></div>
      </section>

      <section className="legacy-data-section">
        <div className="legacy-section-title"><div><ClipboardList className="h-4 w-4" /><h2>الجدول الدراسي الحالي</h2></div><span>{registeredHours} ساعة مسجلة</span></div>
        <div className="legacy-table-wrap"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>الشعبة</th><th>الأيام والوقت</th><th>القاعة</th><th>المدرس</th><th>الساعات</th></tr></thead><tbody>{activeStudent.currentRegisteredSections.map(section => <tr key={section.id}><td className="font-mono">{section.courseCode}</td><td className="font-bold">{section.courseName}</td><td>{section.sectionNumber}</td><td dir="ltr">{section.days} · {section.startTime}–{section.endTime}</td><td>{section.room}</td><td>{section.instructor}</td><td>{section.credits}</td></tr>)}</tbody></table></div>
      </section>

      <section className="legacy-data-section">
        <div className="legacy-section-title"><div><ClipboardList className="h-4 w-4" /><h2>المواد والشعب المطروحة</h2></div><span>{filteredCourses.length} مادة</span></div>
        <div className="legacy-filter-row"><div className="legacy-search"><Search className="h-4 w-4" /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="ابحث باسم المادة أو رقمها" /></div><select value={groupFilter} onChange={event => setGroupFilter(event.target.value)}><option value="ALL">جميع المتطلبات</option>{groupOptions.map(group => <option key={group} value={group}>{group}</option>)}</select><div className="legacy-scope-toggle" role="group" aria-label="نطاق المواد"><button onClick={() => setScope('eligible')} className={scope === 'eligible' ? 'active' : ''}>المتاح لي</button><button onClick={() => setScope('all')} className={scope === 'all' ? 'active' : ''}>كامل الخطة</button></div></div>
        <div className="legacy-table-wrap"><table className="legacy-table registration-offerings"><thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>المتطلب</th><th>الساعات</th><th>الشعبة المختارة</th><th>القاعة / المدرس</th><th>الحالة</th><th></th></tr></thead><tbody>{filteredCourses.map(course => {
          const eligibility = getRegistrationEligibility(course.code, activeStudent);
          const sections = sectionsFor(course.code);
          const selected = selectedSection(course);
          const inBasket = basketSections.find(section => section.courseCode === course.code);
          const isRegistered = activeStudent.currentRegisteredSections.some(section => section.courseCode === course.code);
          const clashes = selected ? scheduledSections.some(section => section.id !== inBasket?.id && checkSectionConflict(selected, section)) : false;
          const canAdd = eligibility.state === 'ELIGIBLE' && !!selected && !isRegistered && !clashes;
          return <tr key={course.code} className={inBasket ? 'is-selected' : ''}><td className="font-mono">{course.code}</td><td><strong>{course.name}</strong><small>{course.group}</small></td><td>{course.prerequisites.length ? course.prerequisites.join('، ') : '—'}</td><td>{course.credits}</td><td><select disabled={!sections.length || isRegistered} value={selected?.id || ''} onChange={event => setChosenSections(previous => ({ ...previous, [course.code]: event.target.value }))}>{sections.map(section => <option key={section.id} value={section.id}>{sectionLabel(section)}</option>)}</select></td><td>{selected ? <>{selected.room}<small>{selected.instructor} · المتاح {selected.capacity - selected.enrolled}</small></> : 'لا توجد شعب'}</td><td>{isRegistered ? <StatusBadge status="مسجلة حاليًا" size="sm" /> : clashes ? <StatusBadge status="تعارض زمني" size="sm" /> : <StatusBadge status={eligibility.label} size="sm" />}</td><td>{inBasket ? <button className="legacy-icon-button danger" onClick={() => removeFromBasket(inBasket.id)} aria-label={`حذف ${course.name}`}><Trash2 className="h-4 w-4" /></button> : <button className="legacy-add-button" disabled={!canAdd} onClick={() => selected && addToBasket(selected)}><Plus className="h-4 w-4" />إضافة</button>}</td></tr>;
        })}</tbody></table></div>
      </section>
    </div>
  );
};
