import React, { useState } from 'react';
import { useStudent } from '../../context/StudentContext';
import { CourseSection } from '../../types/student';
import {
  CalendarRange,
  Table as TableIcon,
  Calendar,
  Printer,
  MapPin,
  Clock,
  User,
  BookOpen
} from 'lucide-react';

export const ClassScheduleView: React.FC = () => {
  const { activeStudent } = useStudent();
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');

  const days: ('الأحد' | 'الاثنين' | 'الثلاثاء' | 'الأربعاء' | 'الخميس')[] = [
    'الأحد',
    'الاثنين',
    'الثلاثاء',
    'الأربعاء',
    'الخميس',
  ];

  // Time slots for calendar from 08:00 to 17:00
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'
  ];

  // Convert time string "09:30" to slot index or position
  const getSlotDetails = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  const registeredSections = activeStudent.currentRegisteredSections;

  return (
    <div className="space-y-6 animate-fade-in text-right">
      
      {/* Header and View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarRange className="w-6 h-6 text-univ-800" />
            <span>الجدول الدراسي الأسبوعي</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            جدول المحاضرات المسجلة للفصل الأول 2026/2027 للطالب {activeStudent.name}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Toggle View Mode */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white text-univ-900 shadow-soft font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>تقويم أسبوعي</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-univ-900 shadow-soft font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>جدول تفصيلي</span>
            </button>
          </div>

          {/* Print button */}
          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-univ-900 hover:border-univ-400 transition-colors shadow-xs"
            title="طباعة الجدول الدراسي"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {registeredSections.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400">
          لا توجد محاضرات مسجلة في هذا الجدول.
        </div>
      ) : viewMode === 'calendar' ? (
        /* ================= 1. WEEKLY CALENDAR VIEW ================= */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-soft p-4 sm:p-6 overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Days Header */}
            <div className="grid grid-cols-5 gap-3 pb-3 border-b border-slate-200 text-center font-bold text-xs sm:text-sm text-slate-800">
              {days.map(day => {
                const dayCount = registeredSections.filter(s => s.daysArray.includes(day)).length;
                return (
                  <div key={day} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center">
                    <span>{day}</span>
                    <span className="text-[11px] font-normal text-slate-500 font-mono mt-0.5">
                      {dayCount} محاضرات
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Days Columns Grid */}
            <div className="grid grid-cols-5 gap-3 pt-3">
              {days.map(day => {
                const daySections = registeredSections
                  .filter(s => s.daysArray.includes(day))
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));

                return (
                  <div key={day} className="space-y-3 min-h-[360px] bg-slate-50/40 p-2 rounded-2xl border border-slate-100">
                    {daySections.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-300 text-xs italic py-12">
                        لا محاضرات
                      </div>
                    ) : (
                      daySections.map(sec => {
                        return (
                          <div
                            key={`${day}-${sec.id}`}
                            className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-soft hover:shadow-soft-lg hover:border-univ-400 transition-all text-right space-y-2 group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-univ-50 text-univ-800 border border-univ-200 font-mono">
                                شعبة {sec.sectionNumber}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 font-semibold">
                                {sec.courseCode}
                              </span>
                            </div>

                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-univ-900 transition-colors leading-snug">
                              {sec.courseName}
                            </h4>

                            <div className="space-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                              <div className="flex items-center gap-1.5 font-mono text-univ-800 font-semibold">
                                <Clock className="w-3 h-3 text-univ-600 shrink-0" />
                                <span>{sec.startTime} - {sec.endTime}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{sec.room}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <User className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{sec.instructor}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ================= 2. TABLE VIEW ================= */
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
                  <th className="py-3.5 px-4">وقت البداية</th>
                  <th className="py-3.5 px-4">وقت النهاية</th>
                  <th className="py-3.5 px-4">القاعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registeredSections.map(sec => (
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
                      {sec.startTime}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-800 text-xs">
                      {sec.endTime}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      {sec.room}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
