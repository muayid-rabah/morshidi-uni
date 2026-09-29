import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  let colorStyles = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  switch (status) {
    // Course statuses
    case 'منجزة':
    case 'ناجح':
    case 'مسموح':
    case 'متاحة':
    case 'مفتوح الآن':
    case 'طبيعي':
      colorStyles = 'bg-emerald-50 text-emerald-800 border-emerald-200 ring-1 ring-emerald-600/10';
      dotColor = 'bg-emerald-500';
      break;

    case 'مسجلة حاليًا':
      colorStyles = 'bg-teal-50 text-teal-800 border-teal-200 ring-1 ring-teal-600/10';
      dotColor = 'bg-teal-500 animate-pulse';
      break;

    case 'متاحة للتسجيل':
      colorStyles = 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-600/10';
      dotColor = 'bg-blue-500';
      break;

    case 'تحتاج مراجعة':
    case 'يحتاج مراجعة':
    case 'تنبيه':
    case 'قائمة انتظار':
      colorStyles = 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-600/20';
      dotColor = 'bg-amber-500';
      break;

    case 'غير متاحة':
    case 'غير مسموح':
    case 'راسب':
    case 'مرتفع':
    case 'ممتلئة':
    case 'مغلقة':
      colorStyles = 'bg-rose-50 text-rose-800 border-rose-200 ring-1 ring-rose-600/10';
      dotColor = 'bg-rose-500';
      break;

    case 'غير منجزة':
    case 'منسحب':
    case 'قادم':
      colorStyles = 'bg-slate-100 text-slate-700 border-slate-200';
      dotColor = 'bg-slate-400';
      break;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs font-medium px-2.5 py-1',
    lg: 'text-sm font-semibold px-3 py-1.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClasses} ${colorStyles} transition-colors ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{status}</span>
    </span>
  );
};
