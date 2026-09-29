import React, { useState } from 'react';
import { useStudent, STUDENT_CREDENTIALS } from '../../context/StudentContext';
import {
  Lock,
  User,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  HelpCircle,
  X,
  GraduationCap,
  KeyRound,
  CheckCircle2,
  Calendar,
  BookOpen
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useStudent();
  const [universityId, setUniversityId] = useState('202310001');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'login' | 'accounts'>('login');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!universityId.trim()) {
      setErrorMsg('يُرجى إدخال الرقم الجامعي.');
      return;
    }
    const ok = login(universityId.trim(), password);
    if (!ok) {
      setErrorMsg('بيانات الدخول غير صحيحة. تأكد من الرقم الجامعي وكلمة المرور.');
    }
  };

  const handleFillAccount = (id: string, pass: string) => {
    setUniversityId(id);
    setPassword(pass);
    setErrorMsg('');
    setActiveTab('login');
  };

  return (
    <div className="min-h-screen bg-[#F4F7F6] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-arabic">
      
      {/* Background Soft Academic Motifs (Light Mode) */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-univ-100/60 blur-3xl" />
        <div className="absolute top-1/2 left-10 w-[500px] h-[500px] rounded-full bg-emerald-100/50 blur-3xl -translate-y-1/2" />
        <div className="absolute -bottom-20 right-1/4 w-80 h-80 rounded-full bg-teal-100/40 blur-2xl" />
      </div>

      <div className="relative z-10 max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left column (in RTL appears on right): University Identity & Highlights (Pure Light) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-white via-univ-50/50 to-emerald-50/40 p-6 sm:p-8 rounded-3xl border border-univ-200/80 shadow-soft flex flex-col justify-between text-right">
          <div className="space-y-6">
            
            {/* University Crest & Name */}
            <div className="flex items-center gap-3.5">
              <img
                src="/logo.svg"
                alt="شعار جامعة مرشدي"
                className="w-14 h-14 object-contain drop-shadow-xs shrink-0"
              />
              <div>
                <span className="text-xl sm:text-2xl font-black tracking-tight text-univ-950 block">
                  جامعة مرشدي
                </span>
                <span className="text-xs text-univ-800 font-semibold tracking-wider">
                  Morshidi University
                </span>
              </div>
            </div>

            {/* Academic Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-univ-100/80 text-univ-900 border border-univ-200 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>بوابة الطالب الإلكترونية الموحدة</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-slate-900 leading-snug">
                نظام القبول والتسجيل الأكاديمي
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                مرحباً بك في البوابة الرسمية لطلبة كلية تكنولوجيا المعلومات — قسم الذكاء الاصطناعي (خطة 12 - 132 ساعة معتمدة).
              </p>
            </div>

            {/* Portal Features List */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2.5 text-xs text-slate-700 bg-white/70 p-2.5 rounded-2xl border border-slate-200/60 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>تسجيل المواد واختيار الشعب مع فحص فوري للتعارضات</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-700 bg-white/70 p-2.5 rounded-2xl border border-slate-200/60 shadow-xs">
                <BookOpen className="w-4 h-4 text-univ-700 shrink-0" />
                <span>شعب متعددة متناسقة لكل مساق (نظري ولابات يوم واحد)</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-700 bg-white/70 p-2.5 rounded-2xl border border-slate-200/60 shadow-xs">
                <GraduationCap className="w-4 h-4 text-teal-700 shrink-0" />
                <span>سجل العلامات والمعدل التراكمي المئوي (من 100%)</span>
              </div>
            </div>

          </div>

          <div className="mt-8 pt-4 border-t border-univ-200/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>الفصل الأول 2026 / 2027</span>
            <span className="font-semibold text-emerald-800">فترة التسجيل نشطة الآن</span>
          </div>
        </div>

        {/* Right column: Login Card + Accounts Directory (Pure Light) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 shadow-soft-lg border border-slate-200/80 flex flex-col justify-between text-right">
          
          <div>
            {/* Top Tabs */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
                    activeTab === 'login'
                      ? 'bg-univ-800 text-white shadow-soft'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('accounts')}
                  className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'accounts'
                      ? 'bg-univ-800 text-white shadow-soft'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  <span>دليل حسابات الطلبة (5 حسابات)</span>
                </button>
              </div>

              <span className="text-[11px] font-mono text-univ-800 font-bold bg-univ-50 px-2.5 py-1 rounded-xl border border-univ-200 hidden sm:inline">
                خطة 12
              </span>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* TAB 1: LOGIN FORM */}
            {activeTab === 'login' && (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    الرقم الجامعي للطالب
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={universityId}
                      onChange={e => setUniversityId(e.target.value)}
                      placeholder="مثال: 202310001"
                      className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-univ-600/20 focus:border-univ-600 transition-all font-bold text-slate-900"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      كلمة المرور
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs text-univ-700 hover:text-univ-900 font-semibold hover:underline"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pr-10 pl-11 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-univ-600/20 focus:border-univ-600 transition-all font-bold text-slate-900"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                    <span>كلمة المرور الافتراضية: <strong className="font-mono text-univ-800 font-bold">123456</strong></span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('accounts')}
                      className="text-univ-700 font-bold hover:underline"
                    >
                      عرض الحسابات المعتمدة
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-4 py-3.5 px-4 rounded-2xl bg-univ-800 hover:bg-univ-900 text-white font-bold text-sm shadow-soft transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <span>تسجيل الدخول إلى البوابة</span>
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                </button>
              </form>
            )}

            {/* TAB 2: ACCOUNTS DIRECTORY */}
            {activeTab === 'accounts' && (
              <div className="space-y-3">
                <div className="p-3 bg-univ-50/80 rounded-2xl border border-univ-200 text-xs text-univ-950 flex items-center justify-between">
                  <span className="font-bold">5 حسابات طلاب بمستويات دراسية مختلفة:</span>
                  <span className="font-mono font-bold text-univ-800 bg-white px-2 py-0.5 rounded-lg border border-univ-200">
                    كلمة المرور: 123456
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                  {STUDENT_CREDENTIALS.map(c => (
                    <div
                      key={c.universityId}
                      className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded-2xl transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-univ-100 text-univ-800 font-bold text-sm flex items-center justify-center shrink-0 border border-univ-200">
                          {c.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{c.name}</h4>
                          <p className="text-[11px] text-slate-500 truncate">{c.role}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                            <span>الرقم: <strong className="text-univ-900 font-bold">{c.universityId}</strong></span>
                            <span>•</span>
                            <span>المرور: <strong className="text-slate-800 font-bold">{c.password}</strong></span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleFillAccount(c.universityId, c.password)}
                        className="px-3.5 py-1.5 rounded-xl bg-univ-50 hover:bg-univ-800 hover:text-white text-univ-800 border border-univ-200 text-xs font-bold transition-all shrink-0 shadow-xs cursor-pointer"
                      >
                        تعبئة ودخول
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
            جامعة مرشدي — نظام القبول والتسجيل المحوسب © {new Date().getFullYear()}
          </div>

        </div>

      </div>

      {/* Forgot Password Modal (Light Mode) */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in text-right">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-elevated border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">استعادة كلمة المرور</h3>
              <button
                onClick={() => setShowForgotModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              كلمة المرور المعتمدة لجميع الحسابات التجريبية في النظام هي:
            </p>

            <div className="p-4 rounded-2xl bg-univ-50 border border-univ-200 text-center space-y-1">
              <span className="text-[11px] text-slate-500 block">كلمة المرور الموحدة:</span>
              <span className="text-xl font-bold font-mono text-univ-950 tracking-wider">123456</span>
              <span className="text-[11px] text-univ-700 block">أو Morshidi123!</span>
            </div>

            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 rounded-xl bg-univ-800 hover:bg-univ-900 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              العودة لشاشة الدخول
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
