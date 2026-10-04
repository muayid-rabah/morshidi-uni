import React, { useState, useMemo } from 'react';
import { useStudent } from '../../context/StudentContext';
import { CourseSection } from '../../types/student';
import { StatusBadge } from '../common/StatusBadge';
import {
  BookOpen,
  Search,
  Filter,
  Users,
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const OfferedCoursesView: React.FC = () => {
  const { offeredSections: liveSections, calendar } = useStudent();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('ALL');
  const [selectedDay, setSelectedDay] = useState('ALL');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Extract unique instructors
  const instructors = useMemo(() => {
    const list = Array.from(new Set(liveSections.map(s => s.instructor)));
    return list.sort();
  }, [liveSections]);

  // Filter sections
  const filteredSections = useMemo(() => {
    return liveSections.filter(section => {
      // Search
      const matchesSearch =
        section.courseCode.includes(searchQuery.trim()) ||
        section.courseName.includes(searchQuery.trim()) ||
        section.room.includes(searchQuery.trim());
      if (!matchesSearch) return false;

      // Instructor
      if (selectedInstructor !== 'ALL' && section.instructor !== selectedInstructor) {
        return false;
      }

      // Day
      if (selectedDay !== 'ALL') {
        if (selectedDay === 'يوم واحد') {
          if (!section.days.includes('يوم واحد') && section.daysArray.length !== 1) {
            return false;
          }
        } else if (!section.days.includes(selectedDay) && !section.daysArray.includes(selectedDay as any)) {
          return false;
        }
      }

      // Only available
      if (onlyAvailable && section.status !== 'متاحة') {
        return false;
      }

      return true;
    });
  }, [searchQuery, selectedInstructor, selectedDay, onlyAvailable, liveSections]);

  return (
    <div className="space-y-6 animate-fade-in text-right">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-univ-800" />
            <span>المواد والشعب المطروحة للفصل الدراسي</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            جدول الشعب المعلنة للفصل الأول 2026/2027 مع تفاصيل الأوقات والقاعات والمقاعد الشاغرة
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-xs">
          <span>إجمالي الشعب المطروحة:</span>
          <span className="font-mono text-univ-800 font-bold">{liveSections.length}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-soft space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              بحث عن مادة
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="رقم أو اسم المادة..."
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-univ-600/20 focus:border-univ-600"
              />
            </div>
          </div>

          {/* Instructor Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              المدرس
            </label>
            <select
              value={selectedInstructor}
              onChange={e => setSelectedInstructor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none"
            >
              <option value="ALL">جميع المدرسين</option>
              {instructors.map(inst => (
                <option key={inst} value={inst}>{inst}</option>
              ))}
            </select>
          </div>

          {/* Day Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              الأيام
            </label>
            <select
              value={selectedDay}
              onChange={e => setSelectedDay(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none"
            >
              <option value="ALL">جميع الأيام</option>
              <option value="ح ث خ">الأحد، الثلاثاء، الخميس (ح ث خ)</option>
              <option value="ن ر">الاثنين، الأربعاء (ن ر)</option>
              <option value="يوم واحد">مختبرات وتطبيقات (يوم واحد فقط)</option>
            </select>
          </div>

          {/* Toggle Available Only */}
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-slate-50 border border-slate-200 w-full hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={e => setOnlyAvailable(e.target.checked)}
                className="w-4 h-4 text-univ-700 rounded focus:ring-univ-500"
              />
              <span className="text-xs font-semibold text-slate-800">
                المواد المتاحة فقط
              </span>
            </label>
          </div>

        </div>
      </div>

      {/* Offered Courses Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3.5 px-4">رقم المادة</th>
                <th className="py-3.5 px-4">اسم المادة</th>
                <th className="py-3.5 px-4 text-center">الشعبة</th>
                <th className="py-3.5 px-4 text-center">الساعات</th>
                <th className="py-3.5 px-4">المدرس</th>
                <th className="py-3.5 px-4">الأيام</th>
                <th className="py-3.5 px-4">الوقت</th>
                <th className="py-3.5 px-4">القاعة</th>
                <th className="py-3.5 px-4 text-center">السعة</th>
                <th className="py-3.5 px-4 text-center">المسجلون</th>
                <th className="py-3.5 px-4 text-center">المقاعد المتبقية</th>
                <th className="py-3.5 px-4 text-center">حالة الشعبة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSections.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    لا توجد شعب مطابقة لمعايير البحث المحددة.
                  </td>
                </tr>
              ) : (
                filteredSections.map(sec => {
                  const remainingSeats = Math.max(0, sec.capacity - sec.enrolled);
                  return (
                    <tr key={sec.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {sec.courseCode}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {sec.courseName}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                        {sec.sectionNumber}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-univ-800">
                        {sec.credits}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {sec.instructor}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {sec.days}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-800 text-xs">
                        {sec.startTime} - {sec.endTime}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {sec.room}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                        {sec.capacity}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                        {sec.enrolled}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold">
                        <span className={remainingSeats === 0 ? 'text-rose-600' : 'text-emerald-700'}>
                          {remainingSeats}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={sec.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
