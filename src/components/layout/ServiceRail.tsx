import React from 'react';
import { useStudent } from '../../context/StudentContext';
import { Calculator, CreditCard, Mail, MonitorCog, UsersRound } from 'lucide-react';

const services = [
  { label: 'المنصات الإلكترونية', note: 'معرفة حساباتك على المنصات', icon: UsersRound, tone: 'bg-purple-700' },
  { label: 'طلبات التسجيل الإلكترونية', note: 'طلبات تسجيل المواد', icon: MonitorCog, tone: 'bg-yellow-600' },
  { label: 'الرسائل', note: 'المراسلة من الجامعة للطالب', icon: Mail, tone: 'bg-indigo-700' },
  { label: 'الدفع الإلكتروني', note: 'تسديد الرسوم الجامعية', icon: CreditCard, tone: 'bg-red-700' },
  { label: 'احسب معدلك', note: 'آلة حساب المعدل التراكمي', icon: Calculator, tone: 'bg-blue-800' },
];

export const ServiceRail: React.FC = () => {
  const { setActivePage } = useStudent();

  return (
    <aside className="service-rail hidden xl:block w-72 shrink-0 px-5 py-8 text-right" aria-label="الخدمات الإلكترونية">
      <section className="mb-6 rounded-xl border border-[#3a4145] bg-[#181b1c] p-5 border-r-4 border-r-[#245398]">
        <h2 className="mb-3 text-base font-bold text-[#63a5ff]">أخبار الجامعة</h2>
        <p className="text-sm leading-7 text-[#f0e4d3]">لمتابعة أحدث الأخبار المتعلقة بالجامعة والأنشطة والإعلانات من هنا</p>
      </section>

      <section className="rounded-xl border border-[#3a4145] bg-[#181b1c] p-4 border-r-4 border-r-[#245398]">
        <h2 className="mb-4 text-base font-bold text-[#63a5ff]">خدمات إلكترونية</h2>
        <div className="space-y-3">
          {services.map(service => {
            const Icon = service.icon;
            return (
              <button
                key={service.label}
                onClick={() => {
                  if (service.label.includes('التسجيل')) setActivePage('registration');
                  if (service.label === 'الرسائل') setActivePage('smart-assistant');
                  if (service.label.includes('معدلك')) setActivePage('gpa');
                  if (service.label.includes('الدفع')) setActivePage('financial');
                }}
                className="flex w-full items-center gap-3 rounded-lg px-1 text-right transition-colors hover:bg-[#252a2d]"
              >
                <span className={`${service.tone} flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white`}><Icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[#f0e4d3]">{service.label}</span>
                  <span className="block text-xs text-[#c6b7a6]">{service.note}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
};
