import React, { useState } from 'react';
import { Eye, EyeOff, GraduationCap, LogIn } from 'lucide-react';
import { useStudent } from '../../context/StudentContext';

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
    <main className="morshidi-login-shell" dir="rtl">
      <section className="morshidi-login-card" aria-labelledby="login-title">
        <div className="morshidi-login-brand">
          <span className="morshidi-login-brand-mark"><GraduationCap aria-hidden="true" /></span>
          <div><span className="morshidi-login-brand-name">مرشدي</span><span className="morshidi-login-brand-subtitle">بوابة الطالب</span></div>
        </div>
        <h1 id="login-title">تسجيل الدخول</h1>
        <form onSubmit={submit} className="morshidi-login-form">
          <label htmlFor="university-id">الرقم الجامعي</label>
          <input
            id="university-id"
            name="username"
            inputMode="numeric"
            autoComplete="username"
            required
            value={universityId}
            onChange={(event) => setUniversityId(event.target.value)}
          />
          <label htmlFor="student-password">كلمة المرور</label>
          <div className="morshidi-password-field">
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
          <button className="morshidi-login-submit" type="submit" disabled={submitting || isLoading}>
            <LogIn aria-hidden="true" />{submitting || isLoading ? 'جارٍ التحقق…' : 'دخول'}
          </button>
        </form>
        <p className="morshidi-login-security-note">الدخول بحسابك الجامعي</p>
      </section>
    </main>
  );
};
