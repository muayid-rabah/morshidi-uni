import React from 'react';
import { useStudent } from '../../context/StudentContext';
import { calculateStudentProgress, getCourseStatusForStudent, planCourses, REQUIREMENT_GROUP_HOURS } from '../../services/academicEngine';
import { RequirementGroup } from '../../types/student';
import { StatusBadge } from '../common/StatusBadge';
import { FileText, GraduationCap } from 'lucide-react';

const groups: RequirementGroup[] = [
  'متطلبات الجامعة الإجبارية', 'متطلبات الجامعة الاختيارية', 'متطلبات الكلية الإجبارية',
  'متطلبات التخصص الإجبارية', 'متطلبات التخصص الاختيارية', 'المتطلبات المساندة',
];

export const StudyPlanView: React.FC = () => {
  const { activeStudent } = useStudent();
  const progress = calculateStudentProgress(activeStudent);
  return <div className="study-plan-legacy animate-fade-in text-right">
    <header className="legacy-page-heading"><div><h1>الخطط الدراسية</h1><p>الخطة الدراسية المعتمدة لتخصص {activeStudent.major} — {activeStudent.studyPlan}</p></div></header>
    <div className="plan-action-tabs"><button className="active"><FileText className="h-4 w-4" />المواد المشمولة في الخطة الدراسية</button><button><GraduationCap className="h-4 w-4" />الخطة الدراسية</button></div>
    <div className="plan-student-line">خطة {activeStudent.studyPlan} · الساعات المنجزة: <strong>{progress.totalCompletedHours}</strong> من <strong>{progress.totalPlanHours}</strong> ساعة</div>
    {groups.map(group => {
      const courses = planCourses.filter(course => course.group === group);
      const completed = progress.groupCompletedHours[group] || 0;
      const registered = activeStudent.currentRegisteredSections.filter(section => courses.some(course => course.code === section.courseCode)).reduce((sum, section) => sum + section.credits, 0);
      return <section key={group} className="plan-group-table">
        <h2>{group} <span>({REQUIREMENT_GROUP_HOURS[group]})</span></h2>
        <div className="plan-hours-row"><span>عدد الساعات المنجزة: <b>{completed}</b></span><span>عدد الساعات المسجلة: <b>{registered}</b></span></div>
        <div className="legacy-table-wrap"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>عدد الساعات</th><th>المتطلب السابق</th><th>حالة المادة</th></tr></thead><tbody>{courses.map(course => <tr key={course.code}><td className="font-mono">{course.code}</td><td className="font-bold">{course.name}</td><td>{course.credits}</td><td className="font-mono">{course.prerequisites.length ? course.prerequisites.join('، ') : '—'}</td><td><StatusBadge status={getCourseStatusForStudent(course, activeStudent)} size="sm" /></td></tr>)}</tbody></table></div>
      </section>;
    })}
  </div>;
};
