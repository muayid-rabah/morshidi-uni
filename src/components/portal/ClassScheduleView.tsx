import React, { useState } from 'react';
import { useStudent } from '../../context/StudentContext';

export const ClassScheduleView: React.FC = () => {
  const { activeStudent } = useStudent();
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [shown, setShown] = useState(false);
  const hasSchedule = activeStudent.currentRegisteredSections.length > 0;
  return <div className="term-query-page animate-fade-in text-right">
    <header><h1>الجدول الدراسي</h1><p>يرجى تحديد السنة والفصل الدراسي لعرض الجدول الدراسي</p></header>
    <div className="term-query-form"><div><label htmlFor="schedule-year">السنة</label><select id="schedule-year" value={year} onChange={event => setYear(event.target.value)}><option value="">السنة</option><option value="2026/2027">2026/2027</option></select></div><div><label htmlFor="schedule-semester">الفصل</label><select id="schedule-semester" value={semester} onChange={event => setSemester(event.target.value)}><option value="">الفصل</option><option value="الأول">الفصل الأول</option><option value="الثاني">الفصل الثاني</option></select></div><button onClick={() => setShown(true)} disabled={!year || !semester} className="legacy-primary-button">عرض الجدول</button></div>
    {shown && (hasSchedule ? <div className="legacy-table-wrap term-results"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>الشعبة</th><th>الأيام</th><th>الوقت</th><th>الساعات</th><th>المدرس</th><th>القاعة</th></tr></thead><tbody>{activeStudent.currentRegisteredSections.map(section => <tr key={section.id}><td className="font-mono">{section.courseCode}</td><td className="font-bold">{section.courseName}</td><td>{section.sectionNumber}</td><td>{section.days}</td><td dir="ltr">{section.startTime} - {section.endTime}</td><td>{section.credits}</td><td>{section.instructor}</td><td>{section.room}</td></tr>)}</tbody></table></div> : <div className="term-schedule-empty">لا توجد مواد مسجلة لهذا الطالب في الفصل المحدد.</div>)}
  </div>;
};
