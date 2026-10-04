import React from 'react';
import { useStudent } from '../../context/StudentContext';
import { calculateStudentProgress, getCourseStatusForStudent, getRequirementHours } from '../../services/academicEngine';
import { RequirementGroup } from '../../types/student';
import { StatusBadge } from '../common/StatusBadge';
import { FileText, GraduationCap } from 'lucide-react';

const groups: RequirementGroup[] = [
  'متطلبات الجامعة الإجبارية', 'متطلبات الجامعة الاختيارية', 'متطلبات الكلية الإجبارية',
  'متطلبات التخصص الإجبارية', 'متطلبات التخصص الاختيارية', 'المتطلبات المساندة',
];

export const StudyPlanView: React.FC = () => {
  const { activeStudent, courses } = useStudent();
  const progress = calculateStudentProgress(activeStudent, courses);
  const requirementHours = getRequirementHours(courses);
  const failedHours = activeStudent.semesterHistory.flatMap(semester => semester.courses).filter(course => course.status === 'راسب').reduce((sum, course) => sum + course.credits, 0);
  return <div className="study-plan-legacy animate-fade-in text-right">
    <header className="legacy-page-heading"><div><h1>الخطط الدراسية</h1><p>الخطة الدراسية المعتمدة لتخصص {activeStudent.major} — {activeStudent.studyPlan}</p></div></header>
    <div className="academic-hours-summary"><div><span>الساعات المنجزة</span><strong>{progress.totalCompletedHours}</strong></div><div><span>الساعات المتبقية</span><strong>{progress.remainingHours}</strong></div><div><span>ساعات هذا الفصل</span><strong>{progress.currentRegisteredHours}</strong></div><div className={failedHours ? 'failed' : ''}><span>ساعات الرسوب</span><strong>{failedHours}</strong></div></div>
    <div className="plan-action-tabs"><button className="active"><FileText className="h-4 w-4" />المواد المشمولة في الخطة الدراسية</button><button><GraduationCap className="h-4 w-4" />الخطة الدراسية</button></div>
    <div className="plan-student-line">خطة {activeStudent.studyPlan} · الساعات المنجزة: <strong>{progress.totalCompletedHours}</strong> من <strong>{progress.totalPlanHours}</strong> ساعة</div>
    {groups.map(group => {
      const groupCourses = courses.filter(course => course.group === group);
      const completed = progress.groupCompletedHours[group] || 0;
      const registered = activeStudent.currentRegisteredSections.filter(section => groupCourses.some(course => course.code === section.courseCode)).reduce((sum, section) => sum + section.credits, 0);
      return <section key={group} className="plan-group-table">
        <h2>{group} <span>({requirementHours[group] || 0})</span></h2>
        <div className="plan-hours-row"><span>عدد الساعات المنجزة: <b>{completed}</b></span><span>عدد الساعات المسجلة: <b>{registered}</b></span></div>
        <div className="legacy-table-wrap"><table className="legacy-table"><thead><tr><th>رقم المادة</th><th>اسم المادة</th><th>عدد الساعات</th><th>المتطلب السابق</th><th>حالة المادة</th></tr></thead><tbody>{groupCourses.map(course => <tr key={course.code}><td className="font-mono">{course.code}</td><td className="font-bold">{course.name}</td><td>{course.credits}</td><td className="font-mono">{course.prerequisites.length ? course.prerequisites.join('، ') : '—'}</td><td><StatusBadge status={getCourseStatusForStudent(course, activeStudent)} size="sm" /></td></tr>)}</tbody></table></div>
      </section>;
    })}
  </div>;
};
