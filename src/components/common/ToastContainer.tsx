import React from 'react';
import { useStudent } from '../../context/StudentContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useStudent();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 left-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map(toast => {
        let bgStyle = 'bg-white border-slate-200 text-slate-800';
        let icon = <Info className="w-5 h-5 text-blue-500 shrink-0" />;

        switch (toast.type) {
          case 'success':
            bgStyle = 'bg-emerald-50 border-emerald-200 text-emerald-950 shadow-emerald-500/10';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
            break;
          case 'error':
            bgStyle = 'bg-rose-50 border-rose-200 text-rose-950 shadow-rose-500/10';
            icon = <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />;
            break;
          case 'warning':
            bgStyle = 'bg-amber-50 border-amber-200 text-amber-950 shadow-amber-500/10';
            icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
            break;
          case 'info':
            bgStyle = 'bg-teal-50 border-teal-200 text-teal-950 shadow-teal-500/10';
            icon = <Info className="w-5 h-5 text-teal-600 shrink-0" />;
            break;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-soft-lg animate-fade-in ${bgStyle} transition-all`}
          >
            {icon}
            <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              aria-label="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
