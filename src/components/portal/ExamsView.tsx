import React, { useState } from 'react';
import { useStudent } from '../../context/StudentContext';
import { ExamRecord } from '../../types/student';
import {
  FileCheck2,
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  AlertCircle,
  Printer,
  Sparkles
} from 'lucide-react';

export const ExamsView: React.FC = () => {
  const { activeStudent } = useStudent();
  const exams = activeStudent.exams;

  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Sorted exams by date
  const sortedExams = [...exams].sort((a, b) => a.date.localeCompare(b.date));
  const nextExam = sortedExams[0];

  // Filtered
  const filteredExams = sortedExams.filter(e => {
    if (selectedType === 'ALL') return true;
    return e.examType === selectedType;
  });

  return (
    <div className="space-y-6 animate-fade-in text-right">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-univ-800" />
            <span>مواعيد وجدول الامتحانات</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            جدول الامتحانات المحوسبة والورقية ومواقع القاعات والمقاعد للطالب {activeStudent.name}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Exam Type Filter */}
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-univ-600/20 shadow-xs"
          >
            <option value="ALL">جميع الامتحانات</option>
            <option value="الامتحان الأول">الامتحان الأول</option>
            <option value="الامتحان الثاني">الامتحان الثاني</option>
            <option value="الامتحان النهائي">الامتحان النهائي</option>
          </select>

          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-univ-900 transition-colors shadow-xs"
            title="طباعة جدول الامتحانات"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Highlight Card: أقرب امتحان (Required by Prompt) */}
      {nextExam ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/80 border border-emerald-200/80 text-slate-900 p-6 sm:p-7 shadow-soft">
          <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>أقرب امتحان قادم</span>
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100/80 text-univ-900 border border-emerald-200/60">
                  {nextExam.examType}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                {nextExam.courseName}{' '}
                <span className="text-sm font-mono text-slate-500 font-normal">
                  ({nextExam.courseCode})
                </span>
              </h2>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 pt-1">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-univ-700" />
                  <span>{nextExam.dayName}، {nextExam.date}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <Clock className="w-4 h-4 text-univ-700" />
                  <span>{nextExam.time}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-univ-700" />
                  <span>{nextExam.room}</span>
                </div>
                {nextExam.seatNumber && (
                  <div className="flex items-center gap-1.5 font-mono">
                    <UserCheck className="w-4 h-4 text-univ-700" />
                    <span>رقم المقعد: <strong className="text-slate-900">{nextExam.seatNumber}</strong></span>
                  </div>
                )}
              </div>
            </div>

            <div className="self-start md:self-auto p-4 rounded-2xl bg-white border border-emerald-200/70 text-center min-w-[140px] shadow-xs">
              <span className="text-[11px] text-slate-500 block mb-0.5">التاريخ المقرر</span>
              <span className="text-base font-bold font-mono text-univ-900 block">{nextExam.date}</span>
              <span className="text-[10px] text-amber-700 font-semibold mt-1 inline-block">حضور قبل 15 دقيقة</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 text-center text-slate-500 text-xs">
          لا توجد امتحانات معلنة حالياً في سجلك الأكاديمي.
        </div>
      )}

      {/* Detailed Exams Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-soft overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            جدول الامتحانات المعتمد للفصل الحالي
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            {filteredExams.length} امتحانات مجدولة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-50/40 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3.5 px-4">رقم المادة</th>
                <th className="py-3.5 px-4">اسم المادة</th>
                <th className="py-3.5 px-4 text-center">نوع الامتحان</th>
                <th className="py-3.5 px-4">التاريخ</th>
                <th className="py-3.5 px-4">اليوم</th>
                <th className="py-3.5 px-4">الوقت</th>
                <th className="py-3.5 px-4">القاعة</th>
                <th className="py-3.5 px-4 text-center">رقم المقعد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    لا توجد امتحانات مطابقة للتصفية.
                  </td>
                </tr>
              ) : (
                filteredExams.map((ex, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {ex.courseCode}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {ex.courseName}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-univ-50 text-univ-800 border border-univ-200">
                        {ex.examType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-800 text-xs">
                      {ex.date}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {ex.dayName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-800 text-xs">
                      {ex.time}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {ex.room}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-univ-900">
                      {ex.seatNumber || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exam Guidelines Note */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
        <h4 className="font-bold text-slate-800">تعليمات عامة للامتحانات في جامعة مرشدي:</h4>
        <p className="text-[11px] leading-relaxed">
          - يُشترط إبراز الهوية الجامعية الرسمية لدخول قاعة الامتحان.<br />
          - يمنع منعاً باتاً إدخال الهواتف الذكية أو الساعات الإلكترونية داخل قاعات الامتحانات المحوسبة.<br />
          - في حال وجود تعارض بين موعدي امتحانين في نفس الوقت، يُرجى مراجعة عمادة الكلية لتسجيل موعد امتحان غير مكتمل رسمي.
        </p>
      </div>

    </div>
  );
};
