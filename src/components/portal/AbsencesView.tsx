import React from 'react';
import { useStudent } from '../../context/StudentContext';
import { StatusBadge } from '../common/StatusBadge';
import {
  UserX,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  Percent,
  Calendar
} from 'lucide-react';

export const AbsencesView: React.FC = () => {
  const { activeStudent } = useStudent();
  const absences = activeStudent.absences;

  const totalLectures = absences.reduce((acc, a) => acc + a.totalLectures, 0);
  const totalAbsences = absences.reduce((acc, a) => acc + a.absencesCount, 0);
  const warningCount = absences.filter(a => a.status === 'تنبيه' || a.status === 'مرتفع').length;

  const overallAttendanceRate = totalLectures > 0
    ? Math.round(((totalLectures - totalAbsences) / totalLectures) * 100)
    : 100;

  return (
    <div className="space-y-6 animate-fade-in text-right">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <UserX className="w-6 h-6 text-univ-800" />
            <span>سجل الغيابات والحضور الأكاديمي</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            متابعة دقيقة لنسب الغياب في المساقات المسجلة حالياً للفصل الأول 2026/2027
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700">
            الفصل الأول 2026/2027
          </span>
        </div>
      </div>

      {/* Warning Notice if warning exists */}
      {warningCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3 shadow-soft">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold">تنبيه أكاديمي بشأن تجاوز نسبة الغياب المسموحة</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              لديك ({warningCount}) مادة تجاوزت نسبة الغياب فيها حد الإنذار الأول (15%). يُرجى مراجعة مدرسي المساقات وتقديم الأعذار الطبية أو الرسمية المعتمدة لتجنب الحرمان النهائي.
            </p>
          </div>
        </div>
      )}

      {/* Highlights Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs text-slate-500 block mb-1">إجمالي الغيابات</span>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {totalAbsences}{' '}
            <span className="text-xs font-normal text-slate-400">محاضرة</span>
          </div>
          <span className="text-[11px] text-slate-400">في جميع المساقات</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs text-slate-500 block mb-1">نسبة الحضور الإجمالية</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono">
            {overallAttendanceRate}%
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">حضور منتظم</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs text-slate-500 block mb-1">مواد تحت الملاحظة/إنذار</span>
          <div className={`text-2xl font-bold font-mono ${warningCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {warningCount}{' '}
            <span className="text-xs font-normal text-slate-400">مساق</span>
          </div>
          <span className="text-[11px] text-slate-400">تحتاج متابعة</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs text-slate-500 block mb-1">حد الحرمان الجامعي</span>
          <div className="text-2xl font-bold text-rose-700 font-mono">
            20%
          </div>
          <span className="text-[11px] text-rose-600 font-medium">حسب تعليمات الجامعة</span>
        </div>
      </div>

      {/* Absences Table Required by Prompt */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-soft overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            تفاصيل الحضور والغياب للمساقات المسجلة
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            {absences.length} مساقات مسجلة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-50/40 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3.5 px-4">رقم المادة</th>
                <th className="py-3.5 px-4">اسم المادة</th>
                <th className="py-3.5 px-4">المدرس</th>
                <th className="py-3.5 px-4 text-center">عدد المحاضرات المنعقدة</th>
                <th className="py-3.5 px-4 text-center">عدد الغيابات</th>
                <th className="py-3.5 px-4 text-center">نسبة الغياب</th>
                <th className="py-3.5 px-4 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {absences.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    لا توجد مساقات مسجلة لهذا الفصل الدراسي.
                  </td>
                </tr>
              ) : (
                absences.map((rec, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {rec.courseCode}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {rec.courseName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {rec.instructor}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-700">
                      {rec.totalLectures}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900">
                      {rec.absencesCount}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold">
                      <span className={rec.absencePercentage >= 15 ? 'text-rose-600' : 'text-slate-800'}>
                        {rec.absencePercentage}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={rec.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* University Absence Regulations Note */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
        <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-univ-700" />
          <span>تعليمات المواظبة والغياب في جامعة مرشدي:</span>
        </h4>
        <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
          <li>تعتبر نسبة الحضور إلزامية لكافة المحاضرات الوجاهية والمختبرات العملية بنسبة لا تقل عن 85%.</li>
          <li>إذا تجاوز غياب الطالب (15%) من مجموع الساعات المقررة دون عذر مرضي أو قهري يُوجه له إنذار غياب رسمي.</li>
          <li>إذا تجاوز غياب الطالب (20%) من الساعات دون عذر رسمي مقبول يُحرم من التقدم للامتحان النهائي ويرصد له علامة محروم (F).</li>
        </ul>
      </div>

    </div>
  );
};
