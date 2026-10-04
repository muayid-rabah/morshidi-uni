import React, { useState } from 'react';
import { useStudent } from '../../context/StudentContext';
import { StatusBadge } from '../common/StatusBadge';
import {
  CalendarDays,
  Calendar,
  AlertCircle,
  Clock,
  Trash2,
  Plus,
  HelpCircle,
  FileCheck,
  CheckCircle2,
  X
} from 'lucide-react';

export const AddDropView: React.FC = () => {
  const { activeStudent, academicDates, calendar, setActivePage, showToast } = useStudent();
  const [dropTargetCourse, setDropTargetCourse] = useState<{ code: string; name: string } | null>(null);

  const handleConfirmDrop = () => {
    if (!dropTargetCourse) return;
    showToast(`تم تقديم طلب إسقاط مساق: ${dropTargetCourse.name} بنجاح لدى مسجل الكلية`, 'success');
    setDropTargetCourse(null);
  };

  return (
    <div className="space-y-6 animate-fade-in text-right">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-univ-800" />
            <span>السحب والإضافة ومواعيد التسجيل الأكاديمي</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            التقويم الأكاديمي المعتمد للفصل الدراسي الأول 2026/2027 في جامعة مرشدي
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>فترة السحب والإضافة الإلكترونية نشطة</span>
        </div>
      </div>

      {/* Required Academic Date Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {academicDates.map(item => (
          <div
            key={item.id}
            className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-soft hover:shadow-soft-lg transition-all space-y-2.5 flex flex-col justify-between"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-xl bg-slate-50 text-univ-800 border border-slate-100">
                  <Calendar className="w-4 h-4" />
                </span>
                <StatusBadge status={item.status} size="sm" />
              </div>

              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                {item.title}
              </h3>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs font-mono font-bold text-univ-800 dir-ltr text-right">
                {item.date}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Currently Registered Courses Drop / Manage Section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              المساقات المسجلة للفصل الحالي (إدارة السحب والإسقاط):
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              يمكنك إسقاط مادة أو استبدالها خلال فترة السحب والإضافة الرسمية
            </p>
          </div>

          <button
            onClick={() => setActivePage('registration')}
            className="px-4 py-2 rounded-xl bg-univ-800 hover:bg-univ-900 text-white font-bold text-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow-soft"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مساق جديد</span>
          </button>
        </div>

        {activeStudent.currentRegisteredSections.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            لا توجد مساقات مسجلة حالياً في جدولك الدراسي.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeStudent.currentRegisteredSections.map(sec => (
              <div
                key={sec.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 px-2 rounded-xl transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-univ-900">{sec.courseCode}</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900">{sec.courseName}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                      شعبة {sec.sectionNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {sec.instructor} • {sec.days} ({sec.startTime} - {sec.endTime}) • {sec.room}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-slate-700">
                    {sec.credits} ساعات
                  </span>
                  <button
                    onClick={() => setDropTargetCourse({ code: sec.courseCode, name: sec.courseName })}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>طلب إسقاط</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Regulations Note */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-600">
        <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-univ-700" />
          <span>تعليمات السحب والإضافة في جامعة مرشدي:</span>
        </h4>
        <ul className="list-disc list-inside space-y-1 pr-1 text-[11px] leading-relaxed">
          <li>لا يجوز أن يقل العبء الدراسي للطالب المنتظم بعد السحب عن 12 ساعة معتمدة إلا بموافقة عميد الكلية.</li>
          <li>المواد المسحوبة خلال فترة السحب والإضافة لا تثبت في كشف العلامات ولا يترتب عليها رسوم دراسية.</li>
          <li>الانسحاب بعد انتهاء فترة السحب والإضافة يرصد فيه علامة (W) ولا تسترد الرسوم الجامعية.</li>
        </ul>
      </div>

      {/* Confirmation Modal for Course Drop */}
      {dropTargetCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in text-right">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-elevated border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">تأكيد طلب إسقاط المساق</h3>
              <button
                onClick={() => setDropTargetCourse(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
              هل أنت متأكد من رغبتك في إسقاط مساق{' '}
              <strong className="text-slate-900">{dropTargetCourse.name}</strong> ({dropTargetCourse.code})؟
            </p>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 mb-4">
              يرجى التأكد من أن مجموع ساعاتك المتبقية لن يقل عن الحد الأدنى للعبء الدراسي (12 ساعة معتمدة).
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDropTargetCourse(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmDrop}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors"
              >
                تأكيد الإسقاط
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
