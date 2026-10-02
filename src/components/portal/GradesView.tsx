import React, { useState } from 'react';
import { useStudent } from '../../context/StudentContext';
import { StatusBadge } from '../common/StatusBadge';

export const GradesView: React.FC = () => {
  const { activeStudent } = useStudent();
  const [year, setYear] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [shown, setShown] = useState(false);
  const record = activeStudent.semesterHistory.find(item => item.semesterId === semesterId);
  return <div className="term-query-page animate-fade-in text-right">
    <header><h1>العلامات</h1><p>يرجى تحديد السنة والفصل الدراسي لعرض جميع العلامات</p></header>
    <div className="term-query-form"><div><label htmlFor="grades-year">السنة</label><select id="grades-year" value={year} onChange={event => { setYear(event.target.value); setSemesterId(''); setShown(false); }}><option value="">السنة</option>{[...new Set(activeStudent.semesterHistory.map(item => item.semesterId.split('-')[0]))].map(value => <option key={value} value={value}>{value}/{Number(value) + 1}</option>)}</select></div><div><label htmlFor="grades-semester">الفصل</label><select id="grades-semester" value={semesterId} onChange={event => setSemesterId(event.target.value)} disabled={!year}><option value="">الفصل</option>{activeStudent.semesterHistory.filter(item => item.semesterId.startsWith(year)).map(item => <option key={item.semesterId} value={item.semesterId}>{item.semesterName}</option>)}</select></div><button onClick={() => setShown(true)} disabled={!semesterId} className="legacy-primary-button">عرض العلامات</button></div>
    {shown && record && <div className="legacy-table-wrap term-results"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>الساعات</th><th>العلامة</th><th>التقدير</th><th>الحالة</th></tr></thead><tbody>{record.courses.map(course => <tr key={`${course.courseCode}-${course.semesterId}`}><td className="font-mono">{course.courseCode}</td><td className="font-bold">{course.courseName}</td><td>{course.credits}</td><td>{course.grade}</td><td>{course.letterGrade}</td><td><StatusBadge status={course.status} size="sm" /></td></tr>)}</tbody></table></div>}
  </div>;
};
