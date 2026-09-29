import React from 'react';

interface ProgressBarProps {
  current: number;
  max: number;
  label?: string;
  sublabel?: string;
  variant?: 'emerald' | 'teal' | 'amber' | 'blue';
  showValues?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  max,
  label,
  sublabel,
  variant = 'emerald',
  showValues = true,
  className = '',
}) => {
  const percentage = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;

  const colorGradients = {
    emerald: 'bg-gradient-to-l from-emerald-500 to-teal-600',
    teal: 'bg-gradient-to-l from-teal-500 to-cyan-600',
    amber: 'bg-gradient-to-l from-amber-500 to-yellow-500',
    blue: 'bg-gradient-to-l from-blue-500 to-indigo-600',
  }[variant];

  return (
    <div className={`w-full ${className}`}>
      {(label || showValues) && (
        <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
          <div className="flex items-center gap-2">
            {label && <span className="text-slate-800">{label}</span>}
            {sublabel && <span className="text-slate-500 text-[11px] font-normal">{sublabel}</span>}
          </div>
          {showValues && (
            <span className="text-slate-600 font-semibold dir-ltr">
              {current} / {max} <span className="text-slate-400 font-normal">({percentage}%)</span>
            </span>
          )}
        </div>
      )}
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80 shadow-inner">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${colorGradients}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
