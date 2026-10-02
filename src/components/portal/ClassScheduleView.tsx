import React, { useMemo, useState } from 'react';
import { Archive, CalendarDays } from 'lucide-react';
import { useStudent } from '../../context/StudentContext';

const CURRENT_TERM_ID = 'current-2026-1';

export const ClassScheduleView: React.FC = () => {
  const { activeStudent } = useStudent();
  const [year, setYear] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [shown, setShown] = useState(false);
  const historicYears = useMemo(() => [...new Set(activeStudent.semesterHistory.map(item => item.semesterId.split('-')[0]))], [activeStudent.semesterHistory]);
  const years = ['2026', ...historicYears.filter(item => item !== '2026')];
  const historicTerms = activeStudent.semesterHistory.filter(item => item.semesterId.startsWith(year));
  const record = activeStudent.semesterHistory.find(item => item.semesterId === semesterId);
  const isCurrentTerm = semesterId === CURRENT_TERM_ID;

  const onYearChange = (value: string) => { setYear(value); setSemesterId(''); setShown(false); };
  const onTermChange = (value: string) => { setSemesterId(value); setShown(false); };

  return <div className="term-query-page animate-fade-in text-right">
    <header><h1>الجدول الدراسي</h1><p>اعرض جدول الفصل الحالي أو أرشيف المواد التي درسها الطالب في السنوات السابقة.</p></header>
    <div className="term-query-form"><div><label htmlFor="schedule-year">السنة</label><select id="schedule-year" value={year} onChange={event => onYearChange(event.target.value)}><option value="">السنة</option>{years.map(value => <option key={value} value={value}>{value}/{Number(value) + 1}</option>)}</select></div><div><label htmlFor="schedule-semester">الفصل</label><select id="schedule-semester" value={semesterId} onChange={event => onTermChange(event.target.value)} disabled={!year}><option value="">الفصل</option>{year === '2026' && <option value={CURRENT_TERM_ID}>2026/2027 - الفصل الأول (الحالي)</option>}{historicTerms.map(item => <option key={item.semesterId} value={item.semesterId}>{item.semesterName}</option>)}</select></div><button onClick={() => setShown(true)} disabled={!semesterId} className="legacy-primary-button">عرض الجدول</button></div>

    {shown && isCurrentTerm && (activeStudent.currentRegisteredSections.length ? <div className="legacy-table-wrap term-results"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>الشعبة</th><th>الأيام</th><th>الوقت</th><th>الساعات</th><th>المدرس</th><th>القاعة</th></tr></thead><tbody>{activeStudent.currentRegisteredSections.map(section => <tr key={section.id}><td className="font-mono">{section.courseCode}</td><td className="font-bold">{section.courseName}</td><td>{section.sectionNumber}</td><td>{section.days}</td><td dir="ltr">{section.startTime} - {section.endTime}</td><td>{section.credits}</td><td>{section.instructor}</td><td>{section.room}</td></tr>)}</tbody></table></div> : <div className="term-schedule-empty">لا توجد مواد مسجلة لهذا الطالب في الفصل الحالي.</div>)}

    {shown && record && <section className="schedule-history-result"><div className="schedule-history-note"><Archive aria-hidden="true" /><span>أرشيف المواد المسجلة في {record.semesterName}</span><b>{record.registeredHours} ساعة</b></div><div className="legacy-table-wrap term-results"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>الساعات</th><th>العلامة</th><th>التقدير</th><th>الحالة</th></tr></thead><tbody>{record.courses.map(course => <tr key={`${course.courseCode}-${course.semesterId}`}><td className="font-mono">{course.courseCode}</td><td className="font-bold">{course.courseName}</td><td>{course.credits}</td><td>{course.grade}</td><td>{course.letterGrade}</td><td>{course.status}</td></tr>)}</tbody></table></div></section>}
    {shown && !isCurrentTerm && !record && <div className="term-schedule-empty"><CalendarDays aria-hidden="true" />لا يوجد أرشيف متاح للفصل المحدد.</div>}
  </div>;
};
