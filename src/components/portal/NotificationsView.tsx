import React, { useState } from 'react';
import { BellRing, CalendarDays, CheckCheck, CircleAlert, Info, Megaphone } from 'lucide-react';

type Notice = { id: number; title: string; body: string; date: string; category: string; tone: 'important' | 'academic' | 'general'; unread: boolean; };

const universityNotices: Notice[] = [
  { id: 1, title: 'فتح فترة السحب والإضافة', body: 'يمكن لجميع الطلبة تنفيذ السحب والإضافة إلكترونياً ضمن المواعيد المعلنة.', date: 'اليوم · 09:00 ص', category: 'التسجيل', tone: 'important', unread: true },
  { id: 2, title: 'إعلان جدول الامتحانات النصفية', body: 'تم نشر مواعيد الامتحانات النصفية على صفحة الامتحانات. يرجى مراجعة القاعات والأوقات.', date: 'أمس · 01:30 م', category: 'الامتحانات', tone: 'academic', unread: true },
  { id: 3, title: 'تحديث على الخطة الدراسية', body: 'أُضيفت المواد المطروحة للفصل الحالي مع الشعب والمقاعد المتاحة لكل الطلبة.', date: '28 أيلول 2026', category: 'الشؤون الأكاديمية', tone: 'academic', unread: true },
  { id: 4, title: 'ساعات عمل القبول والتسجيل', body: 'يستقبل قسم القبول والتسجيل الاستفسارات من الأحد إلى الخميس، من 08:00 ص حتى 03:00 م.', date: '26 أيلول 2026', category: 'خدمة الطلبة', tone: 'general', unread: true },
  { id: 5, title: 'تنبيه: صيانة دورية للبوابة', body: 'قد تتوقف بعض الخدمات الإلكترونية لفترة قصيرة مساء الخميس لإجراء تحديثات تقنية.', date: '24 أيلول 2026', category: 'إعلان عام', tone: 'general', unread: true },
];

const noticeIcon = (tone: Notice['tone']) => tone === 'important' ? CircleAlert : tone === 'academic' ? CalendarDays : Info;

export const NotificationsView: React.FC = () => {
  const [notices, setNotices] = useState(universityNotices);
  const unreadCount = notices.filter(notice => notice.unread).length;
  const markAllRead = () => setNotices(items => items.map(item => ({ ...item, unread: false })));

  return <section className="notifications-page animate-fade-in text-right">
    <header className="notifications-hero">
      <div className="notifications-hero-icon"><BellRing className="h-6 w-6" /></div>
      <div><p>بوابة الجامعة</p><h1>الرسائل</h1><span>إشعارات وإعلانات عامة تصل إلى جميع الطلبة.</span></div>
      <button onClick={markAllRead} disabled={!unreadCount} className="notifications-read-button"><CheckCheck className="h-4 w-4" />تعليم الكل كمقروء</button>
    </header>
    <div className="notifications-summary"><span><b>{unreadCount}</b> رسائل جديدة</span><small>يتم تحديث الإعلانات الرسمية من الجامعة هنا</small></div>
    <div className="notifications-list">
      {notices.map(notice => {
        const Icon = noticeIcon(notice.tone);
        return <article key={notice.id} className={`notification-card ${notice.unread ? 'unread' : ''}`}>
          <div className={`notification-icon ${notice.tone}`}><Icon className="h-5 w-5" /></div>
          <div className="notification-copy"><div className="notification-meta"><span>{notice.category}</span><time>{notice.date}</time></div><h2>{notice.title}</h2><p>{notice.body}</p></div>
          {notice.unread && <i aria-label="غير مقروء" />}
        </article>;
      })}
    </div>
    <div className="notifications-footer"><Megaphone className="h-4 w-4" />هذه الرسائل إشعارات موحّدة لكل حسابات الطلبة.</div>
  </section>;
};
