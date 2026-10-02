import React, { useState } from 'react';
import { useStudent, STUDENT_CREDENTIALS } from '../../context/StudentContext';
import { ArrowLeft, BookOpen, CheckCircle2, Eye, EyeOff, GraduationCap, KeyRound, Lock, ShieldCheck, User, X } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useStudent();
  const [universityId, setUniversityId] = useState('202310001');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'login' | 'accounts'>('login');

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg('');
    if (!universityId.trim()) {
      setErrorMsg('يرجى إدخال الرقم الجامعي أولاً.');
      return;
    }
    if (!login(universityId.trim(), password)) setErrorMsg('بيانات الدخول غير صحيحة. تأكد من الرقم الجامعي وكلمة المرور.');
  };

  const handleFillAccount = (id: string, pass: string) => {
    setUniversityId(id);
    setPassword(pass);
    setErrorMsg('');
    setActiveTab('login');
  };

  return <main className="morshidi-login min-h-screen font-arabic" dir="rtl">
    <div className="morshidi-login-orb orb-one" /><div className="morshidi-login-orb orb-two" /><div className="morshidi-login-grid" />
    <div className="morshidi-login-shell">
      <section className="morshidi-login-brand" aria-labelledby="portal-title">
        <div className="morshidi-login-brand-top">
          <div className="morshidi-login-crest"><img src="/logo.svg" alt="شعار جامعة مرشدي" /></div>
          <div><p>جامعة مرشدي</p><span>Morshidi University</span></div>
        </div>
        <div className="morshidi-login-status"><i />بوابة الطالب الإلكترونية الموحّدة</div>
        <div className="morshidi-login-intro">
          <p className="morshidi-login-kicker">نظام القبول والتسجيل</p>
          <h1 id="portal-title">رحلتك الأكاديمية،<br />بكل وضوح.</h1>
          <p>تابع خطتك، سجّل شعبك، راقب جدولك ونتائجك من بوابة أكاديمية مصمّمة لك.</p>
        </div>
        <div className="morshidi-login-features">
          <div><CheckCircle2 aria-hidden="true" /><span>تسجيل ذكي مع فحص فوري للتعارضات</span></div>
          <div><BookOpen aria-hidden="true" /><span>شعب متعددة بمواعيد وقاعات واضحة</span></div>
          <div><GraduationCap aria-hidden="true" /><span>خطة دراسية وعلامات وتقدم نحو التخرج</span></div>
        </div>
        <footer><span>الفصل الأول 2026 / 2027</span><b>فترة التسجيل نشطة الآن</b></footer>
      </section>

      <section className="morshidi-login-card" aria-label="تسجيل الدخول">
        <div className="morshidi-login-tabs" role="tablist" aria-label="خيارات تسجيل الدخول">
          <button type="button" role="tab" aria-selected={activeTab === 'login'} className={activeTab === 'login' ? 'active' : ''} onClick={() => setActiveTab('login')}>تسجيل الدخول</button>
          <button type="button" role="tab" aria-selected={activeTab === 'accounts'} className={activeTab === 'accounts' ? 'active' : ''} onClick={() => setActiveTab('accounts')}><KeyRound aria-hidden="true" />حسابات الطلبة <em>{STUDENT_CREDENTIALS.length}</em></button>
          <span>خطة 12</span>
        </div>
        {errorMsg && <div className="morshidi-login-error" role="alert">{errorMsg}</div>}
        {activeTab === 'login' ? <form onSubmit={handleFormSubmit} className="morshidi-login-form">
          <div className="morshidi-form-group">
            <label htmlFor="university-id">الرقم الجامعي للطالب</label>
            <div className="morshidi-input-wrap"><User aria-hidden="true" /><input id="university-id" value={universityId} onChange={event => setUniversityId(event.target.value)} placeholder="مثال: 202310001" inputMode="numeric" autoComplete="username" required /></div>
          </div>
          <div className="morshidi-form-group">
            <div className="morshidi-form-label"><label htmlFor="portal-password">كلمة المرور</label><button type="button" onClick={() => setShowForgotModal(true)}>نسيت كلمة المرور؟</button></div>
            <div className="morshidi-input-wrap"><Lock aria-hidden="true" /><input id="portal-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" required /><button type="button" className="morshidi-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>{showPassword ? <EyeOff /> : <Eye />}</button></div>
            <div className="morshidi-form-hint"><span>كلمة المرور الافتراضية: <b>123456</b></span><button type="button" onClick={() => setActiveTab('accounts')}>عرض الحسابات المعتمدة</button></div>
          </div>
          <button type="submit" className="morshidi-login-submit">تسجيل الدخول إلى البوابة <ArrowLeft aria-hidden="true" /></button>
        </form> : <div className="morshidi-account-directory" role="tabpanel">
          <div className="morshidi-directory-note"><span>حسابات تجريبية بمستويات دراسية مختلفة</span><b>كلمة المرور: 123456</b></div>
          <div className="morshidi-account-list">{STUDENT_CREDENTIALS.map(account => <article key={account.universityId}>
            <div className="morshidi-account-avatar">{account.name.charAt(0)}</div>
            <div className="morshidi-account-info"><h2>{account.name}</h2><p>{account.role}</p><span>{account.universityId} · 123456</span></div>
            <button type="button" onClick={() => handleFillAccount(account.universityId, account.password)}>دخول</button>
          </article>)}</div>
        </div>}
        <div className="morshidi-login-card-footer">جامعة مرشدي · نظام القبول والتسجيل المحوسب © {new Date().getFullYear()}</div>
      </section>
    </div>
    {showForgotModal && <div className="morshidi-login-modal" role="dialog" aria-modal="true" aria-labelledby="password-help-title">
      <div className="morshidi-login-modal-card"><button className="morshidi-modal-close" type="button" onClick={() => setShowForgotModal(false)} aria-label="إغلاق"><X /></button><ShieldCheck aria-hidden="true" /><h2 id="password-help-title">استعادة كلمة المرور</h2><p>للحسابات التجريبية استخدم كلمة المرور الموحدة التالية:</p><strong>123456</strong><span>أو Morshidi123!</span><button type="button" onClick={() => setShowForgotModal(false)}>العودة لتسجيل الدخول</button></div>
    </div>}
  </main>;
};
