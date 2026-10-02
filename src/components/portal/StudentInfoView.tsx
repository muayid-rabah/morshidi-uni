import React from 'react';
import { useStudent } from '../../context/StudentContext';
import {
  User,
  GraduationCap,
  Building2,
  Calendar,
  Award,
  IdCard,
  QrCode,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  MapPin,
  Contact,
  HeartPulse
} from 'lucide-react';

export const StudentInfoView: React.FC = () => {
  const { activeStudent } = useStudent();
  const officialFields = [
    { label: 'الاسم الكامل', value: activeStudent.name, icon: User },
    { label: 'الرقم الجامعي', value: activeStudent.universityId, icon: IdCard, mono: true },
    { label: 'الكلية', value: activeStudent.faculty, icon: Building2 },
    { label: 'التخصص', value: activeStudent.major, icon: BookOpen },
    { label: 'الدرجة العلمية', value: activeStudent.degree, icon: GraduationCap },
    { label: 'نوع الدراسة', value: activeStudent.studyType, icon: Calendar },
    { label: 'سنة القبول', value: String(activeStudent.admissionYear), icon: Calendar, mono: true },
    { label: 'الخطة الدراسية', value: `${activeStudent.studyPlan} — 132 ساعة معتمدة`, icon: Award },
    { label: 'الحالة الأكاديمية', value: activeStudent.academicStatus, icon: HeartPulse },
    { label: 'المرشد الأكاديمي', value: activeStudent.academicAdvisor, icon: Contact },
    { label: 'البريد الجامعي', value: `${activeStudent.universityId}@std.morshidi.edu.jo`, icon: Mail, mono: true },
    { label: 'هاتف التواصل', value: '+962 7 9123 4567', icon: Phone, mono: true },
  ];

  return (
    <div className="space-y-6 animate-fade-in text-right">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <IdCard className="w-6 h-6 text-univ-800" />
            <span>معلومات الطالب والملف الأكاديمي</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            البيانات الرسمية المقيدة في عمادة القبول والتسجيل بجامعة مرشدي
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>ملف جامعي موثق ونشط</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Official Student Digital Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative overflow-hidden rounded-3xl bg-white border-2 border-univ-200/90 text-slate-900 shadow-soft-lg">
            {/* University Crest Header Bar */}
            <div className="bg-gradient-to-r from-univ-800 to-forest-800 text-white p-5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <img src="/logo.svg" alt="Morshidi Logo" className="w-10 h-10 object-contain drop-shadow" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-white">جامعة مرشدي</h3>
                  <p className="text-[10px] text-univ-200 tracking-wide font-medium">Morshidi University</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                بطاقة طالب رسمية
              </span>
            </div>

            {/* Student Photo & Identity */}
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-univ-50 border-2 border-univ-200 flex items-center justify-center text-3xl font-extrabold text-univ-800 shadow-soft shrink-0">
                  {activeStudent.name.charAt(0)}
                </div>
                <div className="space-y-1 min-w-0">
                  <h4 className="text-base font-extrabold text-slate-950 truncate">{activeStudent.name}</h4>
                  <div className="text-xs text-univ-800 font-mono tracking-wider font-bold">
                    {activeStudent.universityId}
                  </div>
                  <p className="text-xs text-slate-600 font-semibold truncate">{activeStudent.major}</p>
                  <p className="text-[11px] text-slate-400">{activeStudent.faculty}</p>
                </div>
              </div>

              {/* Barcode & Security Hologram Footer */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="space-y-0.5">
                  <span className="block text-[10px] text-slate-400 uppercase">العام الجامعي</span>
                  <span className="font-mono font-bold text-slate-800">2026 / 2027</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-xl bg-slate-50 border border-slate-200">
                    <QrCode className="w-8 h-8 text-univ-800" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Academic Advisor Quick Contact Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-soft space-y-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-univ-700" />
              <span>المرشد الأكاديمي المباشر</span>
            </h3>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-univ-50/60 border border-univ-100">
              <div className="w-9 h-9 rounded-xl bg-univ-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {activeStudent.academicAdvisor.charAt(3) || 'م'}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">{activeStudent.academicAdvisor}</p>
                <p className="text-[11px] text-slate-500">أستاذ مساعد — قسم الذكاء الاصطناعي</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono text-[11px]">advisor@morshidi.edu.jo</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>مبنى كلية IT — الطابق الثاني — مكتب 214</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed official fields in the legacy portal format */}
        <div className="lg:col-span-7 rounded-lg p-5 sm:p-6 border border-slate-200/80 shadow-soft">
          <div className="portal-panel-title mb-5 flex items-center justify-between pb-3">
            <div>
              <h2 className="text-lg font-bold">معلومات الطالب</h2>
              <p className="mt-1 text-xs text-slate-500">البيانات الرسمية والأكاديمية المسجلة في النظام</p>
            </div>
            <span className="rounded bg-univ-800 px-2.5 py-1 text-[11px] font-bold text-white">ملف نشط</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {officialFields.map(field => {
              const Icon = field.icon;
              return (
                <div key={field.label} className="portal-field">
                  <div className="portal-field-icon"><Icon className="h-5 w-5" aria-hidden="true" /></div>
                  <div className="portal-field-copy">
                    <span className="portal-field-label">{field.label}</span>
                    <span className={`portal-field-value ${field.mono ? 'font-mono' : ''}`}>{field.value}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-lg border border-[#765c22] bg-[#342a0d] px-4 py-3 text-xs text-[#f0d58a]">
            البيانات أعلاه مقيدة من عمادة القبول والتسجيل. لطلب التعديل، راجع القسم المختص وأحضر الوثائق الداعمة.
          </div>
        </div>

      </div>

    </div>
  );
};
