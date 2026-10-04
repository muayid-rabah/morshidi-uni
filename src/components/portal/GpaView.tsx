import React, { useState } from 'react';
import { useStudent } from '../../context/StudentContext';
import { calculateStudentProgress } from '../../services/academicEngine';
import {
  TrendingUp,
  Award,
  CheckCircle2,
  Hourglass,
  Calculator,
  Calendar,
  Layers
} from 'lucide-react';

export const GpaView: React.FC = () => {
  const { activeStudent, courses } = useStudent();
  const progress = calculateStudentProgress(activeStudent, courses);
  const history = activeStudent.semesterHistory;

  const latestSemester = history[history.length - 1];
  const semesterGpa = latestSemester ? latestSemester.semesterGpa : 0;
  const cumulativeGpa = latestSemester ? latestSemester.cumulativeGpa : 0;

  // Simulator state (100% scale)
  const [simHours, setSimHours] = useState<number>(15);
  const [simGrade, setSimGrade] = useState<number>(85);

  // Projected cumulative GPA formula (100% scale):
  const currentTotalPoints = history.reduce((acc, sem) => acc + sem.passedHours * sem.semesterGpa, 0);
  const simulatedTotalHours = progress.totalCompletedHours + simHours;
  const simulatedCumulativeGpa = simulatedTotalHours > 0
    ? (currentTotalPoints + simHours * simGrade) / simulatedTotalHours
    : simGrade;

  const getGpaRating = (val: number) => {
    if (val >= 84) return 'امتياز (مرتبة الشرف)';
    if (val >= 76) return 'جيد جداً';
    if (val >= 68) return 'جيد';
    if (val >= 60) return 'مقبول';
    if (val > 0) return 'إنذار أكاديمي';
    return 'قيد الاحتساب';
  };

  const getYCoord = (val: number) => {
    const clamped = Math.max(50, Math.min(100, val));
    return 200 - ((clamped - 50) / 50) * 170 - 15;
  };

  return (
    <div className="space-y-6 animate-fade-in text-right">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-univ-800" />
            <span>المعدل التراكمي والأداء الأكاديمي</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            سجل تطور المعدل التراكمي ومحاكاة الأداء الأكاديمي (النظام المئوي من 100%)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            النظام المئوي: من 100%
          </span>
        </div>
      </div>

      {/* 5 Required Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        
        {/* المعدل الفصلي */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs font-semibold text-slate-500 block mb-1">المعدل الفصلي</span>
          <div className="text-2xl font-bold text-univ-800 font-mono">
            {semesterGpa > 0 ? `${semesterGpa.toFixed(1)}%` : '—'}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">آخر فصل دراسي</span>
        </div>

        {/* المعدل التراكمي */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs font-semibold text-slate-500 block mb-1">المعدل التراكمي</span>
          <div className="text-2xl font-bold text-purple-700 font-mono">
            {cumulativeGpa > 0 ? `${cumulativeGpa.toFixed(1)}%` : '—'}
          </div>
          <span className="text-[11px] text-purple-600 font-medium">
            {getGpaRating(cumulativeGpa)}
          </span>
        </div>

        {/* الساعات المجتازة */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs font-semibold text-slate-500 block mb-1">الساعات المجتازة</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono">
            {progress.totalCompletedHours}{' '}
            <span className="text-xs font-normal text-slate-400">ساعة</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">بنجاح تام</span>
        </div>

        {/* الساعات المحتسبة */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs font-semibold text-slate-500 block mb-1">الساعات المحتسبة</span>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {progress.totalCompletedHours}{' '}
            <span className="text-xs font-normal text-slate-400">ساعة</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">ضمن الخطة 12</span>
        </div>

        {/* الساعات المتبقية */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold text-slate-500 block mb-1">الساعات المتبقية</span>
          <div className="text-2xl font-bold text-teal-700 font-mono">
            {progress.remainingHours}{' '}
            <span className="text-xs font-normal text-slate-400">ساعة</span>
          </div>
          <span className="text-[11px] text-teal-600 font-medium">حتى التخرج</span>
        </div>

      </div>

      {/* SVG Chart Showing Semester Performance Over Time */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-univ-700" />
              <span>منحنى تطور المعدل التراكمي والفصلي (من 100%)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              مقارنة بصرية بين المعدل الفصلي (الأخضر) والمعدل التراكمي (البنفسجي)
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-teal-700">
              <span className="w-3 h-3 rounded-full bg-teal-600" />
              المعدل الفصلي
            </span>
            <span className="flex items-center gap-1.5 text-purple-700">
              <span className="w-3 h-3 rounded-full bg-purple-600" />
              المعدل التراكمي
            </span>
          </div>
        </div>

        {history.length < 2 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            يتطلب الرسم البياني فصلين دراسيين على الأقل لعرض منحنى التطور التراكمي.
          </div>
        ) : (
          <div className="py-4 overflow-x-auto">
            <div className="min-w-[500px] h-64 relative flex flex-col justify-between">
              
              {/* SVG Graphic with dynamic points */}
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                {/* Horizontal Grid lines (60% to 100%) */}
                {[60, 70, 80, 90, 100].map(val => {
                  const y = getYCoord(val);
                  return (
                    <g key={val}>
                      <line x1="45" y1={y} x2="490" y2={y} stroke="#f1f5f9" strokeWidth="1.5" strokeDasharray="3 3" />
                      <text x="35" y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="monospace">
                        {val}%
                      </text>
                    </g>
                  );
                })}

                {/* Calculate points for history */}
                {(() => {
                  const stepX = (490 - 65) / Math.max(1, history.length - 1);
                  const semesterPoints = history.map((sem, idx) => {
                    const x = 65 + idx * stepX;
                    const y = getYCoord(sem.semesterGpa);
                    return { x, y, val: sem.semesterGpa };
                  });

                  const cumulativePoints = history.map((sem, idx) => {
                    const x = 65 + idx * stepX;
                    const y = getYCoord(sem.cumulativeGpa);
                    return { x, y, val: sem.cumulativeGpa };
                  });

                  const semPath = semesterPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
                  const cumPath = cumulativePoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');

                  return (
                    <>
                      {/* Lines */}
                      <path d={semPath} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" />
                      <path d={cumPath} fill="none" stroke="#7e22ce" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 2" />

                      {/* Points for Semester */}
                      {semesterPoints.map((pt, i) => (
                        <g key={`sem-${i}`}>
                          <circle cx={pt.x} cy={pt.y} r="4.5" fill="#ffffff" stroke="#0d9488" strokeWidth="2.5" />
                          <text x={pt.x} y={pt.y - 8} fill="#0f766e" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            {pt.val.toFixed(1)}%
                          </text>
                        </g>
                      ))}

                      {/* Points for Cumulative */}
                      {cumulativePoints.map((pt, i) => (
                        <g key={`cum-${i}`}>
                          <circle cx={pt.x} cy={pt.y} r="4.5" fill="#ffffff" stroke="#7e22ce" strokeWidth="2.5" />
                          <text x={pt.x} y={pt.y + 16} fill="#6b21a8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            {pt.val.toFixed(1)}%
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>

              {/* Semester labels under chart */}
              <div className="flex justify-between px-6 pt-2 text-[11px] text-slate-500 font-semibold border-t border-slate-100">
                {history.map((s, idx) => (
                  <div key={idx} className="text-center">
                    {s.semesterName.replace(' - الفصل', ' ف')}
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Required Table: الفصل، الساعات، المعدل الفصلي، المعدل التراكمي */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-soft overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">
            سجل التدرج الأكاديمي والمعدلات الفصيلة والتراكمية
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-50/40 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3.5 px-4">الفصل الدراسي</th>
                <th className="py-3.5 px-4 text-center">الساعات المسجلة</th>
                <th className="py-3.5 px-4 text-center">الساعات المجتازة</th>
                <th className="py-3.5 px-4 text-center">المعدل الفصلي</th>
                <th className="py-3.5 px-4 text-center">المعدل التراكمي</th>
                <th className="py-3.5 px-4 text-center">التقدير الفصلي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    لا توجد فصول سابقة مسجلة.
                  </td>
                </tr>
              ) : (
                history.map((sem, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {sem.semesterName}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                      {sem.registeredHours}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-700">
                      {sem.passedHours}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-univ-800 text-sm">
                      {sem.semesterGpa.toFixed(1)}%
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-purple-700 text-sm">
                      {sem.cumulativeGpa.toFixed(1)}%
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {getGpaRating(sem.semesterGpa)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GPA Simulator Calculator */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Calculator className="w-5 h-5 text-univ-700" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">أداة محاكاة المعدل التراكمي المتوقع</h3>
            <p className="text-xs text-slate-500">احتسب تأثير ساعات ومعدل الفصل القادم على معدلك التراكمي</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              الساعات المتوقع تسجيلها:
            </label>
            <input
              type="number"
              min="3"
              max="21"
              value={simHours}
              onChange={e => setSimHours(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-univ-600/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              المعدل الفصلي المتوقع (من 100%):
            </label>
            <input
              type="number"
              step="1"
              min="50"
              max="100"
              value={simGrade}
              onChange={e => setSimGrade(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-univ-600/20"
            />
          </div>

          <div className="p-3 bg-univ-50/80 rounded-2xl border border-univ-200 text-center">
            <span className="text-[11px] text-slate-500 block mb-0.5">المعدل التراكمي الجديد المتوقع:</span>
            <span className="text-xl font-bold font-mono text-univ-900">
              {simulatedCumulativeGpa.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};
