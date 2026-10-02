import React, { useMemo, useState } from 'react';
import { Award, BookOpenCheck, ChartNoAxesCombined, GraduationCap } from 'lucide-react';
import { useStudent } from '../../context/StudentContext';
import { StatusBadge } from '../common/StatusBadge';

export const GradesView: React.FC = () => {
  const { activeStudent } = useStudent();
  const [year, setYear] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [shown, setShown] = useState(false);
  const years = useMemo(() => [...new Set(activeStudent.semesterHistory.map(item => item.semesterId.split('-')[0]))], [activeStudent.semesterHistory]);
  const recordsForYear = activeStudent.semesterHistory.filter(item => item.semesterId.startsWith(year));
  const record = activeStudent.semesterHistory.find(item => item.semesterId === semesterId);

  return <div className="term-query-page animate-fade-in text-right">
    <header><h1>العلامات</h1><p>حدد السنة والفصل لعرض السجل، المعدل الفصلي والمعدل التراكمي.</p></header>
    <div className="term-query-form"><div><label htmlFor="grades-year">السنة</label><select id="grades-year" value={year} onChange={event => { setYear(event.target.value); setSemesterId(''); setShown(false); }}><option value="">السنة</option>{years.map(value => <option key={value} value={value}>{value}/{Number(value) + 1}</option>)}</select></div><div><label htmlFor="grades-semester">الفصل</label><select id="grades-semester" value={semesterId} onChange={event => { setSemesterId(event.target.value); setShown(false); }} disabled={!year}><option value="">الفصل</option>{recordsForYear.map(item => <option key={item.semesterId} value={item.semesterId}>{item.semesterName}</option>)}</select></div><button onClick={() => setShown(true)} disabled={!semesterId} className="legacy-primary-button">عرض العلامات</button></div>
    {shown && record && <>
      <section className="grade-summary" aria-label="ملخص العلامات">
        <div><span><Award aria-hidden="true" />المعدل الفصلي</span><strong>{record.semesterGpa.toFixed(1)}<small>%</small></strong></div>
        <div><span><ChartNoAxesCombined aria-hidden="true" />المعدل التراكمي</span><strong>{record.cumulativeGpa.toFixed(1)}<small>%</small></strong></div>
        <div><span><BookOpenCheck aria-hidden="true" />الساعات المسجلة</span><strong>{record.registeredHours}<small> ساعة</small></strong></div>
        <div><span><GraduationCap aria-hidden="true" />الساعات المجتازة</span><strong>{record.passedHours}<small> ساعة</small></strong></div>
      </section>
      <div className="legacy-table-wrap term-results"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>الساعات</th><th>العلامة</th><th>التقدير</th><th>الحالة</th></tr></thead><tbody>{record.courses.map(course => <tr key={`${course.courseCode}-${course.semesterId}`}><td className="font-mono">{course.courseCode}</td><td className="font-bold">{course.courseName}</td><td>{course.credits}</td><td>{course.grade}</td><td>{course.letterGrade}</td><td><StatusBadge status={course.status} size="sm" /></td></tr>)}</tbody></table></div>
    </>}
  </div>;
};
