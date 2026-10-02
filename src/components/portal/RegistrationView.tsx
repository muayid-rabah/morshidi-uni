import React, { useMemo, useState } from 'react';
import { useStudent } from '../../context/StudentContext';
import { checkSectionConflict, getRegistrationEligibility, planCourses } from '../../services/academicEngine';
import { offeredCourseSections } from '../../data/offeredSections';
import { PlanCourse } from '../../types/student';
import { StatusBadge } from '../common/StatusBadge';
import { CheckCircle2, Plus, Search, Trash2 } from 'lucide-react';

const groupOptions = [
  'متطلبات الجامعة الإجبارية', 'متطلبات الجامعة الاختيارية', 'متطلبات الكلية الإجبارية',
  'المتطلبات المساندة', 'متطلبات التخصص الإجبارية', 'متطلبات التخصص الاختيارية',
];

export const RegistrationView: React.FC = () => {
  const { activeStudent, basketSections, addToBasket, removeFromBasket, confirmMockRegistration } = useStudent();
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [chosenSections, setChosenSections] = useState<Record<string, string>>({});

  const registeredHours = activeStudent.currentRegisteredSections.reduce((sum, section) => sum + section.credits, 0);
  const basketHours = basketSections.reduce((sum, section) => sum + section.credits, 0);
  const scheduled = [...activeStudent.currentRegisteredSections, ...basketSections];
  const courses = useMemo(() => planCourses.filter(course => {
    const query = searchQuery.trim();
    return (!query || course.code.includes(query) || course.name.includes(query))
      && (groupFilter === 'ALL' || course.group === groupFilter);
  }), [groupFilter, searchQuery]);

  const sectionsFor = (code: string) => offeredCourseSections.filter(section => section.courseCode === code);
  const currentSelection = (course: PlanCourse) => {
    const sections = sectionsFor(course.code);
    return sections.find(section => section.id === chosenSections[course.code]) || sections[0];
  };
  return (
    <div className="registration-compact single-registration-page animate-fade-in text-right">
      <header className="legacy-page-heading">
        <div><h1>التسجيل الإلكتروني</h1><p>يرجى تحديد السنة والفصل الدراسي لعرض المواد والشعب المطروحة.</p></div>
      </header>

      <div className="legacy-registration-controls">
        <select aria-label="السنة الدراسية" defaultValue="2026/2027"><option>2026/2027</option></select>
        <select aria-label="الفصل الدراسي" defaultValue="الفصل الأول"><option>الفصل الأول</option><option>الفصل الثاني</option></select>
        <button className="legacy-primary-button">عرض المواد</button>
        <div className="registration-hours"><span>المسجل: <strong>{registeredHours}</strong></span><span>المسودة: <strong>{basketHours}</strong></span><span>الإجمالي: <strong>{registeredHours + basketHours}/18</strong></span></div>
      </div>

      <div className="legacy-filter-row registration-filter-row">
        <div className="legacy-search"><Search className="h-4 w-4" aria-hidden="true" /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="بحث برقم المادة أو اسمها" /></div>
        <select value={groupFilter} onChange={event => setGroupFilter(event.target.value)} aria-label="تصنيف المتطلبات"><option value="ALL">جميع المتطلبات</option>{groupOptions.map(group => <option key={group} value={group}>{group}</option>)}</select>
        <span className="registration-result-count">{courses.length} مادة مطروحة · 3 شعب لكل مادة</span>
      </div>

      <div className="legacy-table-wrap registration-main-table">
        <table className="legacy-table">
          <thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>المجموعة</th><th>الساعات</th><th>الشعبة</th><th>الأيام والوقت</th><th>القاعة</th><th>المدرس</th><th>المتاح</th><th>الحالة</th><th>التسجيل</th></tr></thead>
          <tbody>{courses.map(course => {
            const eligibility = getRegistrationEligibility(course.code, activeStudent);
            const sections = sectionsFor(course.code);
            const selected = currentSelection(course);
            const inBasket = basketSections.find(section => section.courseCode === course.code);
            const registered = activeStudent.currentRegisteredSections.some(section => section.courseCode === course.code);
            const hasConflict = selected ? scheduled.some(item => item.id !== inBasket?.id && checkSectionConflict(selected, item)) : false;
            const isAvailable = selected?.status === 'متاحة' && (selected.enrolled ?? 0) < (selected.capacity ?? 0);
            const canAdd = eligibility.state === 'ELIGIBLE' && !registered && !inBasket && !!selected && isAvailable && !hasConflict;
            const status = registered ? 'مسجلة حاليًا' : inBasket ? 'ضمن المسودة' : hasConflict ? 'تعارض زمني' : eligibility.label;
            return <tr key={course.code} className={inBasket ? 'is-selected' : ''}>
              <td className="font-mono">{course.code}</td>
              <td><strong>{course.name}</strong>{course.prerequisites.length > 0 && <small>المتطلب: {course.prerequisites.join('، ')}</small>}</td>
              <td>{course.group}</td><td>{course.credits}</td>
              <td><select aria-label={`اختيار شعبة ${course.name}`} disabled={!sections.length || registered || !!inBasket} value={selected?.id || ''} onChange={event => setChosenSections(previous => ({ ...previous, [course.code]: event.target.value }))}>{sections.map(section => <option key={section.id} value={section.id}>{`شعبة ${section.sectionNumber}`}</option>)}</select></td>
              <td dir="ltr">{selected ? `${selected.days} | ${selected.startTime} - ${selected.endTime}` : '—'}</td>
              <td>{selected?.room || '—'}</td><td>{selected?.instructor || '—'}</td><td>{selected ? `${selected.capacity - selected.enrolled}/${selected.capacity}` : '—'}</td>
              <td><StatusBadge status={status} size="sm" /></td>
              <td>{inBasket ? <button className="legacy-icon-button danger" onClick={() => removeFromBasket(inBasket.id)} aria-label={`حذف ${course.name} من المسودة`}><Trash2 className="h-4 w-4" /></button> : <button disabled={!canAdd} onClick={() => selected && addToBasket(selected)} className="legacy-add-button"><Plus className="h-4 w-4" />إضافة</button>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>

      <footer className="registration-submit-bar">
        <span>المواد المختارة: <strong>{basketSections.length}</strong> · الساعات: <strong>{basketHours}</strong></span>
        <button onClick={confirmMockRegistration} disabled={!basketSections.length} className="legacy-primary-button"><CheckCircle2 className="h-4 w-4" />تثبيت جدول التسجيل</button>
      </footer>
    </div>
  );
};
