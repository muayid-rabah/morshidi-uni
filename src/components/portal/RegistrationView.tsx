import React, { useState, useMemo } from 'react';
import { useStudent } from '../../context/StudentContext';
import {
  planCourses,
  getRegistrationEligibility,
  getRecommendedRegistrationSections,
  checkSectionConflict,
  findScheduleConflicts,
} from '../../services/academicEngine';
import { offeredCourseSections } from '../../data/offeredSections';
import { CourseSection, PlanCourse } from '../../types/student';
import { StatusBadge } from '../common/StatusBadge';
import {
  ClipboardList,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  CalendarRange,
  Clock,
  ShieldAlert,
  Search,
  BookOpen,
  Sparkles,
  Info,
  MapPin,
  ListChecks,
  Route
} from 'lucide-react';

export const RegistrationView: React.FC = () => {
  const {
    activeStudent,
    basketSections,
    addToBasket,
    addRecommendedSections,
    replaceBasketSection,
    removeFromBasket,
    clearBasket,
    confirmMockRegistration,
  } = useStudent();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [selectedSectionsByCode, setSelectedSectionsByCode] = useState<Record<string, string>>({});
  const [courseScope, setCourseScope] = useState<'eligible' | 'all'>('eligible');

  // Registered and basket hours
  const registeredHours = activeStudent.currentRegisteredSections.reduce(
    (acc, s) => acc + s.credits,
    0
  );
  const basketHours = basketSections.reduce((acc, s) => acc + s.credits, 0);
  const totalProjectedHours = registeredHours + basketHours;

  // Schedule conflicts
  const allCurrentSections = [...activeStudent.currentRegisteredSections, ...basketSections];
  const conflicts = useMemo(() => findScheduleConflicts(allCurrentSections), [allCurrentSections]);
  const recommendedSections = useMemo(
    () => getRecommendedRegistrationSections(activeStudent, offeredCourseSections, basketSections),
    [activeStudent, basketSections]
  );
  const recommendedHours = recommendedSections.reduce((sum, section) => sum + section.credits, 0);
  const eligibleCoursesCount = useMemo(
    () => planCourses.filter(course => getRegistrationEligibility(course.code, activeStudent).state === 'ELIGIBLE').length,
    [activeStudent]
  );

  const handleAdd = (course: PlanCourse) => {
    const sections = offeredCourseSections.filter(s => s.courseCode === course.code);
    if (sections.length === 0) return;

    const chosenSecId = selectedSectionsByCode[course.code] || sections[0].id;
    const sec = sections.find(s => s.id === chosenSecId) || sections[0];
    addToBasket(sec);
  };

  const availablePlanCourses = useMemo(() => {
    return planCourses.filter(course => {
      const matchesSearch =
        course.code.includes(searchQuery.trim()) ||
        course.name.includes(searchQuery.trim());
      if (!matchesSearch) return false;
      if (selectedGroupFilter !== 'ALL' && course.group !== selectedGroupFilter) return false;
      if (courseScope === 'eligible' && getRegistrationEligibility(course.code, activeStudent).state !== 'ELIGIBLE') return false;
      return true;
    });
  }, [searchQuery, selectedGroupFilter, courseScope, activeStudent]);

  return (
    <div className="space-y-5 animate-fade-in text-right">
      
      {/* Active Registration Period Header Banner (Light Theme) */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-univ-50/90 via-white to-emerald-50/60 border border-univ-200/80 text-slate-900 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>فترة تسجيل المواد نشطة ومفتوحة الآن</span>
            </span>
            <span className="text-xs text-slate-500 font-medium">الفصل الأول 2026/2027</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
            تسجيل المواد الدراسية — خطة 12 (الذكاء الاصطناعي)
          </h1>
          <p className="text-xs text-slate-600">
            يعرض النظام موادك المؤهلة الآن ويختار من ثلاث شعب متاحة لكل مادة دون تعارض مع جدولك.
          </p>
        </div>

        {/* Current Hours Stats */}
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-xs self-start sm:self-auto">
          <div className="text-center pl-3 border-l border-slate-200">
            <span className="text-[10px] text-slate-500 block">الساعات المثبتة</span>
            <span className="font-mono text-base font-bold text-slate-900">{registeredHours} س</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-slate-500 block">ساعات السلة</span>
            <span className="font-mono text-base font-bold text-emerald-700">+{basketHours} س</span>
          </div>
        </div>
      </div>

      {/* Personalized, conflict-free recommendation */}
      <section className="overflow-hidden rounded-3xl border border-univ-200/80 bg-white shadow-soft">
        <div className="border-b border-univ-100 bg-univ-50/80 px-5 py-4 text-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-univ-800 shadow-xs ring-1 ring-univ-100">
                <Route className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold">خطة مقترحة لهذه المرحلة</h2>
                <p className="mt-0.5 text-xs text-slate-600">مبنية على المواد المنجزة، المتطلبات السابقة، المقاعد المتاحة وجدولك الحالي.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="rounded-full border border-univ-100 bg-white px-3 py-1 text-univ-900">{eligibleCoursesCount} مادة مؤهل لها</span>
              <span className="rounded-full border border-univ-100 bg-white px-3 py-1 text-univ-900">{recommendedHours} ساعة مقترحة</span>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          {recommendedSections.length > 0 ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {recommendedSections.map(section => (
                  <div key={section.id} className="rounded-xl border border-univ-100 bg-univ-50/70 px-3 py-2 text-xs">
                    <div className="font-bold text-slate-900">{section.courseName}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-univ-800">
                      <span>شعبة {section.sectionNumber}</span><span className="text-univ-300">•</span><span>{section.days}</span><span className="text-univ-300">•</span><span dir="ltr">{section.startTime}–{section.endTime}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => addRecommendedSections(recommendedSections)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-univ-800 px-4 py-2.5 text-xs font-bold text-white shadow-soft transition-colors hover:bg-univ-900"
              >
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                إضافة الخطة المقترحة
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">لا توجد مواد متوافقة إضافية ضمن الحد المتبقي من الساعات. راجع سلتك أو جدولك الحالي.</p>
          )}
        </div>
      </section>

      {/* Semester schedule and editable registration draft */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-univ-800" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">جدول الفصل الحالي</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">مواد مثبتة بالفعل — {registeredHours} ساعة</p>
              </div>
            </div>
            <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">{activeStudent.currentRegisteredSections.length} مواد</span>
          </div>
          <div className="space-y-2">
            {activeStudent.currentRegisteredSections.map(section => (
              <div key={section.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-900">{section.courseName}</span>
                  <span className="font-mono text-univ-800">شعبة {section.sectionNumber}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{section.days} · <span dir="ltr">{section.startTime}–{section.endTime}</span></p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-univ-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between border-b border-univ-100 pb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-univ-800" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">مسودة جدول التسجيل</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">أضف المواد ثم عدّل الشعبة من السلة قبل التثبيت.</p>
              </div>
            </div>
            <span className="rounded-full bg-univ-50 px-2.5 py-1 text-[11px] font-bold text-univ-800">{basketHours} ساعة</span>
          </div>
          {basketSections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-xs text-slate-500">لم تضف موادًا بعد. استخدم الخطة المقترحة أو اختر المواد من القائمة أدناه.</div>
          ) : (
            <div className="space-y-2">
              {basketSections.map(section => (
                <div key={section.id} className="rounded-2xl border border-univ-100 bg-univ-50/40 px-3 py-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{section.courseName}</span>
                    <span className="font-mono font-bold text-univ-800">شعبة {section.sectionNumber}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{section.days} · <span dir="ltr">{section.startTime}–{section.endTime}</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Demo Notice Note (Concise and clean) */}
      <div className="px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>تنبيه: هذا تسجيل تجريبي تفاعلي داخل نظام مرشدي لفحص الأهلية والتعارضات.</span>
        </div>
        <span className="text-[11px] text-amber-700 font-bold hidden sm:inline">سقف العبء: 18 ساعة</span>
      </div>

      {/* Registration Basket Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-soft space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-univ-800" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">تعديل جدول التسجيل</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">بدّل الشعبة أو احذف المادة قبل تثبيت الجدول.</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-univ-100 text-univ-800 text-xs font-bold font-mono">
              {basketSections.length} مساق
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-600">
              الساعات المختارة: <strong className="text-univ-900 font-mono text-sm">{basketHours}</strong> س
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">
              العبء الإجمالي المتوقع:{' '}
              <strong className={totalProjectedHours > 18 ? 'text-rose-600 font-mono text-sm' : 'text-slate-900 font-mono text-sm'}>
                {totalProjectedHours} / 18
              </strong>{' '}
              ساعة
            </span>
          </div>
        </div>

        {/* Schedule Conflicts Alert */}
        {conflicts.length > 0 && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>يوجد تعارض زمني بين المواد المختارة:</span>
            </div>
            {conflicts.map((c, i) => (
              <p key={i} className="pr-5 text-[11px] text-rose-800">• {c.reason}</p>
            ))}
          </div>
        )}

        {basketSections.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            السلة فارغة. اختر الشعب المناسبة من قائمة المواد بالأسفل لإضافتها إلى جدولك.
          </p>
        ) : (
          <div className="space-y-2">
            {basketSections.map(sec => {
              const alternativeSections = offeredCourseSections.filter(section =>
                section.courseCode === sec.courseCode
                && section.status === 'متاحة'
                && ![...activeStudent.currentRegisteredSections, ...basketSections.filter(item => item.id !== sec.id)]
                  .some(existing => checkSectionConflict(section, existing))
              );

              return (
              <div
                key={sec.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-univ-50/40 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="font-mono text-xs font-bold text-univ-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {sec.courseCode}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                    {sec.courseName}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-univ-100 text-univ-800">
                    {sec.credits} س.م
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                    شعبة {sec.sectionNumber}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600">
                    {sec.days}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    ({sec.startTime} - {sec.endTime})
                  </span>
                  <span className="text-[11px] text-slate-400 hidden md:inline">
                    {sec.room} • {sec.instructor}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`section-${sec.id}`}>تعديل الشعبة</label>
                  <select
                    id={`section-${sec.id}`}
                    value={sec.id}
                    onChange={event => {
                      const replacement = offeredCourseSections.find(section => section.id === event.target.value);
                      if (replacement) replaceBasketSection(sec.id, replacement);
                    }}
                    className="max-w-48 rounded-xl border border-univ-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-univ-900 focus:outline-none"
                  >
                    {alternativeSections.map(section => (
                      <option key={section.id} value={section.id}>شعبة {section.sectionNumber} — {section.days} ({section.startTime}–{section.endTime})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeFromBasket(sec.id)}
                    className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition-colors"
                    title="إزالة من السلة"
                    aria-label={`إزالة ${sec.courseName} من المسودة`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              );
            })}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={clearBasket}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
              >
                إفراغ السلة
              </button>
              <button
                onClick={confirmMockRegistration}
                className="px-5 py-2.5 rounded-xl bg-univ-800 hover:bg-univ-900 text-white font-bold text-xs shadow-soft transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تثبيت التسجيل</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute inset-y-0 right-3 my-auto text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث برقم المادة أو الاسم..."
            className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-univ-600/20"
          />
        </div>

        <div className="flex w-full rounded-xl border border-slate-200 bg-white p-1 sm:w-auto" role="group" aria-label="نطاق المواد المعروضة">
          <button
            onClick={() => setCourseScope('eligible')}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors sm:flex-none ${courseScope === 'eligible' ? 'bg-univ-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            المتاح لي الآن
          </button>
          <button
            onClick={() => setCourseScope('all')}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors sm:flex-none ${courseScope === 'all' ? 'bg-univ-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            كامل الخطة
          </button>
        </div>

        <select
          value={selectedGroupFilter}
          onChange={e => setSelectedGroupFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
        >
          <option value="ALL">جميع المجموعات</option>
          <option value="متطلبات الجامعة الإجبارية">متطلبات الجامعة الإجبارية</option>
          <option value="متطلبات الجامعة الاختيارية">متطلبات الجامعة الاختيارية</option>
          <option value="متطلبات الكلية الإجبارية">متطلبات الكلية الإجبارية</option>
          <option value="المتطلبات المساندة">المتطلبات المساندة</option>
          <option value="متطلبات التخصص الإجبارية">متطلبات التخصص الإجبارية</option>
          <option value="متطلبات التخصص الاختيارية">متطلبات التخصص الاختيارية</option>
        </select>
      </div>

      {/* Available Courses Detailed Cards/Table */}
      <div className="space-y-3">
        {availablePlanCourses.map(course => {
          const eligibility = getRegistrationEligibility(course.code, activeStudent);
          const sections = offeredCourseSections.filter(s => s.courseCode === course.code);
          const isAlreadyInBasket = basketSections.some(s => s.courseCode === course.code);
          const isCurrentlyRegistered = activeStudent.currentRegisteredSections.some(s => s.courseCode === course.code);

          const chosenSecId = selectedSectionsByCode[course.code] || (sections[0] ? sections[0].id : '');
          const currentChosenSection = sections.find(s => s.id === chosenSecId) || sections[0];
           const selectedSectionConflicts = currentChosenSection
             ? allCurrentSections.some(section => checkSectionConflict(currentChosenSection, section))
             : false;

          return (
            <div
              key={course.code}
              className={`p-4 rounded-3xl bg-white border transition-all ${
                isAlreadyInBasket
                  ? 'border-univ-500 bg-univ-50/20 shadow-soft'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                {/* Course Details */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200">
                      {course.code}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {course.name}
                    </h3>
                    {/* Number of Credits Clearly Displayed */}
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-univ-50 text-univ-800 border border-univ-200">
                      {course.credits} س.م
                    </span>
                    <StatusBadge status={eligibility.label} size="sm" />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>المجموعة: <strong className="text-slate-700">{course.group}</strong></span>
                    <span>
                      المتطلب السابق:{' '}
                      {course.prerequisites.length > 0 ? (
                        <span className="font-mono font-semibold text-slate-700">{course.prerequisites.join(', ')}</span>
                      ) : (
                        <span className="text-slate-400">لا يوجد</span>
                      )}
                    </span>
                    {eligibility.reason && (
                      <span className="text-amber-800 font-medium">
                        • {eligibility.reason}
                      </span>
                    )}
                  </div>
                </div>

                {/* Section selection with Days & Time Details */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {sections.length > 0 ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <select
                        disabled={eligibility.state !== 'ELIGIBLE' || isCurrentlyRegistered}
                        value={chosenSecId}
                        onChange={e =>
                          setSelectedSectionsByCode(prev => ({
                            ...prev,
                            [course.code]: e.target.value,
                          }))
                        }
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none disabled:opacity-60 max-w-xs"
                      >
                        {sections.map(s => (
                          <option key={s.id} value={s.id}>
                            شعبة {s.sectionNumber} | {s.days} ({s.startTime} - {s.endTime})
                          </option>
                        ))}
                      </select>

                      {currentChosenSection && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg ${selectedSectionConflicts ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {selectedSectionConflicts ? 'تتعارض مع الجدول الحالي' : `${currentChosenSection.room} • ${currentChosenSection.instructor}`}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">لا توجد شعب معلنة</span>
                  )}

                  {/* Add / Remove Button */}
                  {isAlreadyInBasket ? (
                    <button
                      onClick={() => {
                        const secInBasket = basketSections.find(s => s.courseCode === course.code);
                        if (secInBasket) removeFromBasket(secInBasket.id);
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إزالة</span>
                    </button>
                  ) : (
                    <button
                      disabled={eligibility.state !== 'ELIGIBLE' || sections.length === 0 || selectedSectionConflicts}
                      onClick={() => handleAdd(course)}
                      className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                        eligibility.state === 'ELIGIBLE' && sections.length > 0 && !selectedSectionConflicts
                          ? 'bg-univ-800 hover:bg-univ-900 text-white shadow-soft'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة</span>
                    </button>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
