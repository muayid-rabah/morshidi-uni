import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, Compass } from 'lucide-react';
import { useStudent } from '../../context/StudentContext';
import './LoginView.css';

export const LoginView: React.FC = () => {
  const { login, isLoading } = useStudent();
  const [universityId, setUniversityId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    await login(universityId, password);
    setSubmitting(false);
  };

  return (
    <main className="university-signin" dir="rtl">
      <section className="university-signin-form" aria-labelledby="login-title">
        <a className="university-signin-brand" href="https://morshidi.vercel.app/">
          <Compass aria-hidden="true" />
          <span>مرشدي<small>بوابة الطالب</small></span>
        </a>
        <div className="university-signin-heading">
          <span className="university-signin-kicker">جامعـة مرشـدي</span>
          <h1 id="login-title">أهلاً بعودتك</h1>
        </div>
        <form onSubmit={submit} className="university-signin-fields">
          <div className="university-signin-field">
          <label htmlFor="university-id">الرقم الجامعي</label>
          <input
            id="university-id"
            name="username"
            type="text"
            inputMode="email"
            autoComplete="username"
            required
            value={universityId}
            onChange={(event) => setUniversityId(event.target.value)}
          />
          </div>
          <div className="university-signin-field">
          <label htmlFor="student-password">كلمة المرور</label>
          <div className="university-signin-password">
            <input
              id="student-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
          </div>
          <button className="university-signin-submit" type="submit" disabled={submitting || isLoading}>
            {submitting || isLoading ? 'جارٍ التحقق…' : 'دخول'}<ArrowLeft aria-hidden="true" />
          </button>
        </form>
        <a className="university-signin-return" href="https://morshidi.vercel.app/">الانتقال إلى مرشدي <ArrowLeft size={16} aria-hidden="true" /></a>
      </section>
      <aside className="university-signin-visual" aria-hidden="true">
        <span className="university-signin-coordinate">مسارك يبدأ من هنا</span>
        <svg viewBox="0 0 480 480" className="university-signin-astrolabe" fill="none">
          {[208,194,162,150,102].map(r=><circle key={r} cx="240" cy="240" r={r} stroke="currentColor" strokeWidth={r===208?1.5:.5}/>) }
          {Array.from({length:48},(_,i)=><path key={i} d={`M240 32V${i%4===0?54:42}`} stroke="currentColor" transform={`rotate(${i*7.5} 240 240)`}/>) }
          <path d="M240 70 284 205 410 240 280 280 240 410 203 278 70 240 203 202Z" stroke="currentColor"/>
          <path d="m240 115 25 150-25-25-25 25Z" fill="#d9884a"/>
          <circle cx="240" cy="240" r="12" fill="#0b1210" stroke="currentColor"/>
        </svg>
        <div className="university-signin-caption"><span>كل خطوة،</span><strong>أقرب لطموحك.</strong></div>
        <span className="university-signin-footnote">جامعة مرشدي · بوابة الطالب</span>
      </aside>
    </main>
  );
};
