import React, { useState } from 'react';
import { useStudent } from '../../context/StudentContext';
import { StatusBadge } from '../common/StatusBadge';
import {
  GraduationCap,
  Award,
  Calendar,
  Layers,
  FileCheck,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';

export const GradesView: React.FC = () => {
  const { activeStudent } = useStudent();
  const history = activeStudent.semesterHistory;

  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(
    history.length > 0 ? history[history.length - 1].semesterId : ''
  );

  const currentSemesterRecord = history.find(s => s.semesterId === selectedSemesterId) || history[0];

  return (
    <div className="space-y-6 animate-fade-in text-right">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-univ-800" />
            <span>كشف العلامات الفصلي</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            سجل نتائج المساقات والدرجات المعتمدة حسب الفصول الأكاديمية للطالب {activeStudent.name}
          </p>
        </div>

        {history.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 hidden sm:inline">اختر الفصل الدراسي:</label>
            <select
              value={selectedSemesterId}
              onChange={e => setSelectedSemesterId(e.target.value)}
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-univ-600/20 shadow-xs"
            >
              {history.map(sem => (
                <option key={sem.semesterId} value={sem.semesterId}>
                  {sem.semesterName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-univ-50 text-univ-700 flex items-center justify-center mx-auto mb-2">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">طالب مستجد — لا توجد علامات سابقة بعد</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            أنت مسجل حالياً في أول فصل دراسي لك في جامعة مرشدي ({activeStudent.admissionYear}). ستظهر نتائجك وعلاماتك الرسمية فور انتهاء الامتحانات النهائية واعتمادها من مجلس الكلية.
          </p>
        </div>
      ) : (
        <>
          {/* Semester Performance Metric Highlights */}
          {currentSemesterRecord && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
                <span className="text-xs text-slate-500 block mb-1">الفصل المحدد</span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate block">
                  {currentSemesterRecord.semesterName}
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
                <span className="text-xs text-slate-500 block mb-1">الساعات المسجلة في الفصل</span>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
                  {currentSemesterRecord.registeredHours}{' '}
                  <span className="text-xs font-normal text-slate-400">ساعة</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
                <span className="text-xs text-slate-500 block mb-1">المعدل الفصلي</span>
                <div className="text-xl sm:text-2xl font-bold text-univ-800 font-mono">
                  {currentSemesterRecord.semesterGpa.toFixed(1)}%
                </div>
                <span className="text-[11px] text-teal-600 font-medium">من 100%</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
                <span className="text-xs text-slate-500 block mb-1">المعدل التراكمي في حينه</span>
                <div className="text-xl sm:text-2xl font-bold text-purple-700 font-mono">
                  {currentSemesterRecord.cumulativeGpa.toFixed(1)}%
                </div>
                <span className="text-[11px] text-purple-600 font-medium">من 100%</span>
              </div>
            </div>
          )}

          {/* Grades Table */}
          {currentSemesterRecord && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-soft overflow-hidden">
              <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-univ-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    تفاصيل مساقات {currentSemesterRecord.semesterName}
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {currentSemesterRecord.courses.length} مساقات مرصودة
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead className="bg-slate-50/40 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                    <tr>
                      <th className="py-3.5 px-4">رقم المادة</th>
                      <th className="py-3.5 px-4">اسم المادة</th>
                      <th className="py-3.5 px-4 text-center">الساعات</th>
                      <th className="py-3.5 px-4 text-center">العلامة المئوية</th>
                      <th className="py-3.5 px-4 text-center">الرمز التقديري</th>
                      <th className="py-3.5 px-4 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentSemesterRecord.courses.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {c.courseCode}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {c.courseName}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                          {c.credits}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900 text-sm">
                          {c.grade}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-univ-800">
                          {c.letterGrade}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <StatusBadge status={c.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};
