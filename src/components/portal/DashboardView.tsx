import React from 'react';
import { useStudent } from '../../context/StudentContext';
import { RequirementGroup } from '../../types/student';
import { calculateStudentProgress } from '../../services/academicEngine';
import { ProgressBar } from '../common/ProgressBar';
import { StatusBadge } from '../common/StatusBadge';
import {
  CheckCircle2,
  Hourglass,
  BookOpen,
  Award,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Clock,
  Sparkles,
  ChevronLeft,
  Layers,
  GraduationCap,
  ClipboardList
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { activeStudent, setActivePage, courses } = useStudent();
  const progress = calculateStudentProgress(activeStudent, courses);

  // Latest semester GPA and cumulative GPA (Out of 100%)
  const latestSemester = activeStudent.semesterHistory[activeStudent.semesterHistory.length - 1];
  const semesterGpa = latestSemester ? `${latestSemester.semesterGpa.toFixed(1)}%` : '—';
  const cumulativeGpa = latestSemester ? `${latestSemester.cumulativeGpa.toFixed(1)}%` : '—';

  // Total absences across current courses
  const totalAbsences = activeStudent.absences.reduce((acc, a) => acc + a.absencesCount, 0);

  // Next exam
  const sortedExams = [...activeStudent.exams].sort((a, b) => a.date.localeCompare(b.date));
  const nextExam = sortedExams[0];

  // Lectures for today
  const todaySections = activeStudent.currentRegisteredSections.filter(sec =>
    sec.daysArray.includes('الأحد')
  );

  return (
    <div className="space-y-6 animate-fade-in text-right">
      
      {/* Active Registration Period Banner (Light Theme) */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-50 via-white to-teal-50/70 border border-emerald-200/90 text-slate-900 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
            <ClipboardList className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                مفتوح الآن
              </span>
              <span className="text-sm font-extrabold text-slate-900">
                فترة تسجيل المواد والسحب والإضافة نشطة
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              يمكنك الآن تعديل جدولك الدراسي وتثبيت مساقات الفصل الأول 2026/2027
            </p>
          </div>
        </div>

        <button
          onClick={() => setActivePage('registration')}
          className="px-4 py-2 rounded-xl bg-univ-800 text-white font-bold text-xs hover:bg-univ-900 transition-colors shadow-soft flex items-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          <span>شاشة التسجيل</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Top Welcome Student Banner (Light Theme) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-univ-50/90 via-white to-emerald-50/50 border border-univ-200/80 p-6 sm:p-7 shadow-soft">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-univ-100 text-univ-900 border border-univ-200">
                {activeStudent.studyPlan} • {activeStudent.degree}
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                {activeStudent.academicStatus}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              أهلاً بك، {activeStudent.name}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600">
              {activeStudent.faculty} — قسم {activeStudent.major} | المرشد الأكاديمي: <strong className="text-slate-900">{activeStudent.academicAdvisor}</strong>
            </p>
          </div>

          {/* Quick link to Morshidi Assistant */}
          <button
            onClick={() => setActivePage('smart-assistant')}
            className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-univ-50 border border-univ-300 text-xs sm:text-sm font-bold text-univ-900 transition-all shadow-xs group cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>مرشدي الذكي (morshidi.vercel.app)</span>
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          </button>
        </div>
      </div>

      {/* 8 Metric Cards (With 100-based GPA) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. الساعات المنجزة */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">الساعات المنجزة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {progress.totalCompletedHours}{' '}
            <span className="text-xs font-normal text-slate-400">ساعة</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {progress.completionPercentage}% من 132 س
          </div>
        </div>

        {/* 2. الساعات المتبقية */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">الساعات المتبقية</span>
            <Hourglass className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {progress.remainingHours}{' '}
            <span className="text-xs font-normal text-slate-400">ساعة</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">للتخرج</div>
        </div>

        {/* 3. الساعات المسجلة حاليًا */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">الساعات المسجلة</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {progress.currentRegisteredHours}{' '}
            <span className="text-xs font-normal text-slate-400">ساعة</span>
          </div>
          <div className="text-[11px] text-blue-600 font-medium mt-1">الفصل الحالي</div>
        </div>

        {/* 4. المعدل الفصلي (من 100) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">المعدل الفصلي</span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {semesterGpa}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">من مئة (100)</div>
        </div>

        {/* 5. المعدل التراكمي (من 100) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">المعدل التراكمي</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-700 font-mono">
            {cumulativeGpa}
          </div>
          <div className="text-[11px] text-purple-600 font-medium mt-1">من مئة (100)</div>
        </div>

        {/* 6. عدد المواد الحالية */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">عدد المواد الحالية</span>
            <Layers className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {activeStudent.currentRegisteredSections.length}{' '}
            <span className="text-xs font-normal text-slate-400">مساق</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">بالجدول الفصلي</div>
        </div>

        {/* 7. عدد الغيابات */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">عدد الغيابات</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {totalAbsences}{' '}
            <span className="text-xs font-normal text-slate-400">محاضرة</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {activeStudent.absences.some(a => a.status === 'تنبيه') ? (
              <span className="text-rose-600 font-bold">يوجد تنبيه غياب</span>
            ) : (
              'في الحدود الآمنة'
            )}
          </div>
        </div>

        {/* 8. أقرب امتحان */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">أقرب امتحان</span>
            <Calendar className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-sm font-bold text-slate-900 truncate">
            {nextExam ? nextExam.courseName : 'لا امتحانات'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {nextExam ? `${nextExam.dayName} (${nextExam.date})` : '—'}
          </div>
        </div>

      </div>

      {/* Progress Breakdown */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-soft space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-univ-700" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              إنجاز متطلبات الخطة 12 (132 ساعة):
            </h2>
          </div>
          <span className="font-mono text-xs font-bold text-univ-800">
            {progress.totalCompletedHours} / 132 س ({progress.completionPercentage}%)
          </span>
        </div>

        <ProgressBar
          current={progress.totalCompletedHours}
          max={progress.totalPlanHours}
          showValues={false}
          variant="emerald"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          {Object.entries(progress.groupRequirements).map(([groupName, maxHours]) => {
            const completed = progress.groupCompletedHours[groupName as RequirementGroup] || 0;
            return (
              <div key={groupName} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                <span className="text-[11px] font-bold text-slate-700 block truncate mb-1">
                  {groupName}
                </span>
                <span className="font-mono text-xs font-bold text-univ-900">
                  {completed} / {maxHours} س
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Lectures */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-soft space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-univ-700" />
            <span>محاضرات اليوم (الأحد)</span>
          </h3>
          <button
            onClick={() => setActivePage('class-schedule')}
            className="text-xs font-semibold text-univ-700 hover:underline"
          >
            عرض الجدول الكامل
          </button>
        </div>

        {todaySections.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">لا توجد محاضرات مجدولة لهذا اليوم.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {todaySections.map(sec => (
              <div key={sec.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 truncate">{sec.courseName}</span>
                  <span className="text-[10px] font-mono font-bold text-univ-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {sec.startTime} - {sec.endTime}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{sec.days} • {sec.room} • {sec.instructor}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
