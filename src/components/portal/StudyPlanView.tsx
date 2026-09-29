import React, { useState, useMemo } from 'react';
import { useStudent } from '../../context/StudentContext';
import {
  planCourses,
  calculateStudentProgress,
  getCourseStatusForStudent,
  REQUIREMENT_GROUP_HOURS,
} from '../../services/academicEngine';
import { RequirementGroup, CourseStatus, PlanCourse } from '../../types/student';
import { StatusBadge } from '../common/StatusBadge';
import { ProgressBar } from '../common/ProgressBar';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';

export const StudyPlanView: React.FC = () => {
  const { activeStudent } = useStudent();
  const progress = calculateStudentProgress(activeStudent);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const groupsList: RequirementGroup[] = [
    'متطلبات الجامعة الإجبارية',
    'متطلبات الجامعة الاختيارية',
    'متطلبات الكلية الإجبارية',
    'المتطلبات المساندة',
    'متطلبات التخصص الإجبارية',
    'متطلبات التخصص الاختيارية',
  ];

  const toggleGroupCollapse = (group: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  // Filter courses
  const filteredCourses = useMemo(() => {
    return planCourses.filter(course => {
      // Search
      const matchesSearch =
        course.code.includes(searchQuery.trim()) ||
        course.name.includes(searchQuery.trim()) ||
        course.prerequisites.some(p => p.includes(searchQuery.trim()));

      if (!matchesSearch) return false;

      // Group filter
      if (selectedGroup !== 'ALL' && course.group !== selectedGroup) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'ALL') {
        const status = getCourseStatusForStudent(course, activeStudent);
        if (status !== selectedStatus) return false;
      }

      return true;
    });
  }, [searchQuery, selectedGroup, selectedStatus, activeStudent]);

  return (
    <div className="space-y-6 animate-fade-in text-right">
      
      {/* Header and Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-univ-800" />
            <span>الخطة الدراسية الرسمية (خطة 12)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            تخصص الذكاء الاصطناعي — كلية تكنولوجيا المعلومات (132 ساعة معتمدة)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-univ-100 text-univ-800 border border-univ-200">
            68 مساقاً/خياراً معتمداً
          </span>
        </div>
      </div>

      {/* Required Study Plan Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs font-semibold text-slate-500 block mb-1">اسم التخصص والخطة</span>
          <div className="text-base font-bold text-slate-900">الذكاء الاصطناعي</div>
          <span className="text-xs text-univ-700 font-semibold font-mono">خطة رقم (12)</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs font-semibold text-slate-500 block mb-1">الساعات المنجزة</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono">
            {progress.totalCompletedHours}{' '}
            <span className="text-xs font-normal text-slate-400">ساعة</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">
            {progress.completionPercentage}% من إجمالي 132 س
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs font-semibold text-slate-500 block mb-1">الساعات المسجلة حالياً</span>
          <div className="text-2xl font-bold text-teal-700 font-mono">
            {progress.currentRegisteredHours}{' '}
            <span className="text-xs font-normal text-slate-400">ساعة</span>
          </div>
          <span className="text-[11px] text-teal-600 font-medium">الفصل الحالي</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft">
          <span className="text-xs font-semibold text-slate-500 block mb-1">الساعات المتبقية</span>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {progress.remainingHours}{' '}
            <span className="text-xs font-normal text-slate-400">ساعة</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">حتى التخرج</span>
        </div>
      </div>

      {/* Requirement Group Progress Overview */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-univ-700" />
          <span>إنجاز متطلبات المجموعات الست:</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupsList.map(groupName => {
            const max = REQUIREMENT_GROUP_HOURS[groupName];
            const current = progress.groupCompletedHours[groupName] || 0;
            return (
              <div
                key={groupName}
                onClick={() => setSelectedGroup(selectedGroup === groupName ? 'ALL' : groupName)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedGroup === groupName
                    ? 'border-univ-600 bg-univ-50/70 ring-1 ring-univ-600/30'
                    : 'border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-univ-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">{groupName}</span>
                  <span className="text-xs font-bold text-univ-800 font-mono">
                    {current} / {max} س
                  </span>
                </div>
                <ProgressBar
                  current={current}
                  max={max}
                  showValues={false}
                  variant={current >= max ? 'emerald' : 'teal'}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث برقم المادة أو الاسم..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-univ-600/20 focus:border-univ-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="منجزة">منجزة</option>
            <option value="مسجلة حاليًا">مسجلة حاليًا</option>
            <option value="متاحة للتسجيل">متاحة للتسجيل</option>
            <option value="غير متاحة">غير متاحة</option>
            <option value="تحتاج مراجعة">تحتاج مراجعة</option>
          </select>

          {/* Group Filter */}
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">جميع المجموعات</option>
            {groupsList.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Courses Grouped Tables */}
      <div className="space-y-6">
        {groupsList
          .filter(g => selectedGroup === 'ALL' || selectedGroup === g)
          .map(groupName => {
            const groupCourses = filteredCourses.filter(c => c.group === groupName);
            if (groupCourses.length === 0) return null;

            const isCollapsed = collapsedGroups[groupName];
            const max = REQUIREMENT_GROUP_HOURS[groupName];
            const completed = progress.groupCompletedHours[groupName] || 0;

            return (
              <div
                key={groupName}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-soft overflow-hidden"
              >
                {/* Group Section Header */}
                <div
                  onClick={() => toggleGroupCollapse(groupName)}
                  className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-univ-700" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{groupName}</h3>
                      <span className="text-[11px] text-slate-500 font-mono">
                        المطلوب: {max} ساعات • المنجز: {completed} ساعات
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white text-slate-700 border border-slate-200">
                      {groupCourses.length} مادة
                    </span>
                    {isCollapsed ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Table */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs sm:text-sm">
                      <thead className="bg-slate-50/50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                        <tr>
                          <th className="py-3 px-4">رقم المادة</th>
                          <th className="py-3 px-4">اسم المادة</th>
                          <th className="py-3 px-4 text-center">عدد الساعات</th>
                          <th className="py-3 px-4">المتطلب السابق</th>
                          <th className="py-3 px-4">نوع التعليم</th>
                          <th className="py-3 px-4 text-center">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {groupCourses.map(course => {
                          const status = getCourseStatusForStudent(course, activeStudent);
                          const hasReviewNote = course.reviewRequired || activeStudent.reviewCourses?.includes(course.code);

                          return (
                            <tr
                              key={course.code}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                status === 'مسجلة حاليًا' ? 'bg-teal-50/30' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                                {course.code}
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-slate-900">
                                <div className="space-y-0.5">
                                  <span>{course.name}</span>
                                  {hasReviewNote && (
                                    <div className="text-[11px] text-amber-800 font-medium flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                      <span>{course.reviewReason || 'المتطلب السابق يتطلب مراجعة معادلة'}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                                {course.credits}
                              </td>
                              <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                                {course.prerequisites.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {course.prerequisites.map(p => (
                                      <span
                                        key={p}
                                        className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                                          activeStudent.completedCourses.includes(p)
                                            ? 'bg-emerald-100 text-emerald-800 font-bold'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        {p}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-normal">لا يوجد</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-slate-500 text-xs">
                                {course.learningType}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <StatusBadge status={status} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
      </div>

    </div>
  );
};
